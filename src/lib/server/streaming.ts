/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2026 the-byte-bender
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Stream, Audio } from "$lib/server/database";
import { Op } from "sequelize";
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
    ClientsideStreamChat,
    ClientsideStreamMute,
    ClientsideReaction,
} from "$lib/types";
import { StreamState, StreamFormat } from "$lib/types";

const execFileAsync = promisify(execFile);

const STREAM_ARCHIVE_DIR = path.join(os.tmpdir(), "audiopub-streams");
const STREAM_ARCHIVE_MAX_BYTES = 750 * 1024 * 1024;

export class StreamingService extends EventEmitter {
    private pollIntervalMs: number;
    private icecastHost: string = "";
    private icecastAdminUser: string = "";
    private icecastAdminPassword: string = "";
    private timer: ReturnType<typeof setInterval> | null = null;
    private archiveControllers: Map<string, AbortController> = new Map();

    constructor(pollIntervalMs: number = 5 * 60 * 1000) {
        super();
        this.pollIntervalMs = pollIntervalMs;
    }

    notifyChatSent(streamId: string, chat: ClientsideStreamChat) {
        this.emit(STREAM_CHAT_SENT, {
            streamId,
            chat,
        } as StreamChatSentEvent);
    }

    notifyChatDeleted(streamId: string, chatId: string) {
        this.emit(STREAM_CHAT_DELETED, {
            streamId,
            chatId,
        } as StreamChatDeletedEvent);
    }

    /**
     * Reaction tallies are shared by everyone, but "did I react" is not, so the
     * broadcast carries the actor and their new emoji and each client folds its
     * own state in.
     */
    notifyChatReaction(
        streamId: string,
        chatId: string,
        reactions: ClientsideReaction[],
        actorId: string,
        emoji: string | null,
    ) {
        this.emit(STREAM_CHAT_REACTION, {
            streamId,
            chatId,
            reactions,
            actorId,
            emoji,
        } as StreamChatReactionEvent);
    }

    notifyStateChanged(
        streamId: string,
        oldState: StreamState,
        newState: StreamState,
    ) {
        this.emit(STREAM_STATE_CHANGED, {
            streamId,
            oldState,
            newState,
        } as StreamStateChangedEvent);
    }

    notifyListenersChanged(
        streamId: string,
        activeListeners: number,
        peekListeners: number,
    ) {
        this.emit(STREAM_LISTENERS_CHANGED, {
            streamId,
            activeListeners,
            peekListeners,
        } as StreamListenersChangedEvent);
    }

    notifyModerationChanged(
        streamId: string,
        kind: "mute" | "unmute" | "slowmode",
        userId?: string,
        slowModeSeconds?: number,
        mute?: ClientsideStreamMute,
    ) {
        this.emit(STREAM_MODERATION_CHANGED, {
            streamId,
            kind,
            userId,
            slowModeSeconds,
            mute,
        } as StreamModerationChangedEvent);
    }

    notifyDestroyed(
        streamId: string,
        reason: "pending_expired" | "owner_ended",
    ) {
        this.emit(STREAM_DESTROYED, {
            streamId,
            reason,
        } as StreamDestroyedEvent);
    }

    async endStream(streamId: string) {
        const pendingDeleted = await Stream.destroy({
            where: { id: streamId, state: StreamState.pending },
        });
        if (pendingDeleted > 0) {
            this.notifyDestroyed(streamId, "owner_ended");
            return;
        }

        await Stream.update(
            { state: StreamState.finished },
            {
                where: {
                    id: streamId,
                    state: { [Op.ne]: StreamState.finished },
                },
            },
        );

        const updatedStream = await Stream.findByPk(streamId);
        if (!updatedStream) return; // Already finished

        await this.disconnectSource(updatedStream.userId);
        this.notifyStateChanged(
            updatedStream.id,
            updatedStream.state,
            StreamState.finished,
        );

        if (updatedStream.shouldArchive && updatedStream.format) {
            await this.stopArchiving(updatedStream.id);
            const archivePath = path.join(STREAM_ARCHIVE_DIR, updatedStream.id);
            const audioDestPath = path.join(
                process.cwd(),
                "audio",
                updatedStream.id,
            );

            const outputFormat =
                updatedStream.format === StreamFormat.mp3 ? "mp3" : "adts";

            try {
                await execFileAsync("ffmpeg", [
                    "-y",
                    "-i",
                    archivePath,
                    "-c",
                    "copy",
                    "-f",
                    outputFormat,
                    "-loglevel",
                    "quiet",
                    audioDestPath,
                ]);
                await fs.unlink(archivePath);
            } catch (err) {
                console.error(
                    "Error while processing archived stream with ffmpeg:",
                    err,
                );
                return;
            }

            const audio = await Audio.create({
                id: updatedStream.id,
                title: updatedStream.title,
                description: updatedStream.description,
                extension: updatedStream.format,
                hasFile: true,
                isFromAi: false,
                userId: updatedStream.userId,
                plays: updatedStream.peekListeners,
                archivedStreamId: updatedStream.id,
            });

            this.emit(STREAM_ARCHIVED, {
                streamId: updatedStream.id,
                audioId: audio.id,
            } as StreamArchivedEvent);
        } else {
            await updatedStream.destroy();
        }
    }

    async poll() {
        try {
            const cutoff = new Date(Date.now() - this.pollIntervalMs);

            const expiredPending = await Stream.findAll({
                where: {
                    state: StreamState.pending,
                    createdAt: { [Op.lt]: cutoff },
                },
            });
            for (const stream of expiredPending) {
                await stream.destroy();
                this.notifyDestroyed(stream.id, "pending_expired");
            }

            const expiredDisconnected = await Stream.findAll({
                where: {
                    state: StreamState.disconnected,
                    disconnectedAt: { [Op.ne]: null, [Op.lt]: cutoff },
                },
            });
            for (const stream of expiredDisconnected) {
                await this.endStream(stream.id);
            }
        } catch {
            // Swallow errors. This runs in the background and should not crash the process
        }
    }

    private async probeStream(
        stream: Stream,
    ): Promise<{ format: string; codec: string; contentType: string } | null> {
        const url = `http://${this.icecastHost}/${stream.userId}`;
        const args = [
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_entries",
            "format=format_name:stream=codec_name",
            "-probesize",
            "33000",
            "-i",
            url,
        ];

        let output: string;
        try {
            const { stdout } = await execFileAsync("ffprobe", args);
            output = stdout;
        } catch (e) {
            return null;
        }

        let probe: {
            format?: { format_name?: string };
            streams?: Array<{ codec_name?: string }>;
        };
        try {
            probe = JSON.parse(output);
        } catch {
            return null;
        }

        const streams = probe.streams ?? [];
        if (streams.length !== 1) return null;

        const codec = streams[0].codec_name ?? "";
        const format = probe.format?.format_name ?? "";

        if (codec !== "mp3" && codec !== "aac") return null;
        if (format !== "mp3" && format !== "aac") return null;

        const contentType = codec === "mp3" ? "audio/mpeg" : "audio/aac";

        return { format, codec, contentType };
    }

    private async startArchiving(stream: Stream): Promise<void> {
        if (!stream.shouldArchive) return;

        const archivePath = path.join(STREAM_ARCHIVE_DIR, stream.id);
        await fs.mkdir(STREAM_ARCHIVE_DIR, { recursive: true });

        const controller = new AbortController();
        this.archiveControllers.set(stream.id, controller);

        const url = `http://${this.icecastHost}/${stream.userId}`;

        (async () => {
            try {
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok || !res.body) return;

                const fileHandle = await fs.open(archivePath, "a");
                let fileSize = 0;

                const stat = await fs.stat(archivePath).catch(() => null);
                fileSize = stat?.size ?? 0;

                const reader = res.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (fileSize + value.length > STREAM_ARCHIVE_MAX_BYTES) {
                        break;
                    }
                    await fileHandle.appendFile(value);
                    fileSize += value.length;
                }
                await reader.cancel();
                await fileHandle.close();
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                console.error("Error while archiving stream:", err);
            } finally {
                this.archiveControllers.delete(stream.id);
            }
        })();
    }

    private stopArchiving(streamId: string): void {
        const controller = this.archiveControllers.get(streamId);
        if (controller) {
            controller.abort();
            this.archiveControllers.delete(streamId);
        }
    }

    async sourceConnected(streamId: string) {
        const stream = await Stream.findByPk(streamId);
        if (!stream) return;

        const oldState = stream.state;
        const isPendingOrDisconnected =
            oldState === StreamState.pending ||
            oldState === StreamState.disconnected;
        if (!isPendingOrDisconnected) return;

        if (stream.shouldArchive) {
            await this.startArchiving(stream);
        }

        const probe = await this.probeStream(stream);
        if (!probe) {
            console.error("Failed to probe stream source for stream", streamId);
            await this.stopArchiving(stream.id);
            await this.disconnectSource(stream.userId);
            return;
        }

        const expectedContentType =
            probe.codec === "mp3" ? "audio/mpeg" : "audio/aac";

        const url = `http://${this.icecastHost}/${stream.userId}`;
        let actualContentType: string | null = null;
        try {
            const controller = new AbortController();
            const res = await fetch(url, {
                method: "GET",
                signal: controller.signal,
            });
            actualContentType = res.headers.get("content-type");
            controller.abort();
        } catch (err) {
            console.error("Error fetching stream for content type check:", err);
        }

        if (
            actualContentType &&
            !actualContentType.toLowerCase().startsWith(expectedContentType)
        ) {
            await this.stopArchiving(stream.id);
            console.error(
                `Stream content type mismatch for stream ${streamId}: expected ${expectedContentType}, got ${actualContentType}`,
            );
            await this.disconnectSource(stream.userId);
            return;
        }

        const format: StreamFormat =
            probe.codec === "mp3" ? StreamFormat.mp3 : StreamFormat.aac;

        const [updated] = await Stream.update(
            { state: StreamState.active, format },
            {
                where: { id: streamId, state: oldState },
            },
        );

        if (updated) {
            this.notifyStateChanged(streamId, oldState, StreamState.active);
        }
    }

    async sourceDisconnected(streamId: string) {
        await this.stopArchiving(streamId);

        const stream = await Stream.findByPk(streamId);
        if (!stream) return;

        const oldState = stream.state;
        if (oldState !== StreamState.active) return;

        const [updated] = await Stream.update(
            { state: StreamState.disconnected, disconnectedAt: new Date() },
            {
                where: { id: streamId, state: StreamState.active },
            },
        );

        if (updated) {
            this.notifyStateChanged(
                streamId,
                oldState,
                StreamState.disconnected,
            );
        }
    }

    async listenerConnected(streamId: string) {
        await Stream.update(
            {
                activeListeners: Stream.sequelize!.literal(
                    "activeListeners + 1",
                ),
                peekListeners: Stream.sequelize!.literal(
                    "GREATEST(peekListeners, activeListeners + 1)",
                ),
            },
            { where: { id: streamId } },
        );

        const updated = await Stream.findByPk(streamId, {
            attributes: ["activeListeners", "peekListeners"],
        });
        if (!updated) return;

        this.notifyListenersChanged(
            streamId,
            updated.activeListeners,
            updated.peekListeners,
        );
    }

    async listenerDisconnected(streamId: string) {
        const [updated] = await Stream.update(
            {
                activeListeners: Stream.sequelize!.literal(
                    "activeListeners - 1",
                ),
            },
            {
                where: { id: streamId, activeListeners: { [Op.gt]: 0 } },
            },
        );

        if (updated) {
            const updatedStream = await Stream.findByPk(streamId, {
                attributes: ["activeListeners", "peekListeners"],
            });
            if (updatedStream) {
                this.notifyListenersChanged(
                    streamId,
                    updatedStream.activeListeners,
                    updatedStream.peekListeners,
                );
            }
        }
    }

    async disconnectSource(userId: string) {
        const url = `http://${this.icecastHost}/admin/killsource?mount=/${userId}`;
        const auth = Buffer.from(
            `${this.icecastAdminUser}:${this.icecastAdminPassword}`,
        ).toString("base64");

        try {
            await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            });
        } catch {}
    }

    private async fetchMounts(): Promise<string[]> {
        if (!this.icecastHost) return [];

        const url = `http://${this.icecastHost}/admin/listmounts`;
        const auth = Buffer.from(
            `${this.icecastAdminUser}:${this.icecastAdminPassword}`,
        ).toString("base64");

        try {
            const res = await fetch(url, {
                headers: { Authorization: `Basic ${auth}` },
            });
            const text = await res.text();

            const mounts: string[] = [];
            const matches = text.matchAll(/<source mount="([^"]+)"/g);
            for (const match of matches) {
                mounts.push(
                    match[1].startsWith("/") ? match[1].slice(1) : match[1],
                );
            }
            return mounts;
        } catch {
            return [];
        }
    }

    async syncStreams() {
        const mounts = await this.fetchMounts();
        const mountSet = new Set(mounts);

        const activeStreams = await Stream.findAll({
            where: { state: StreamState.active },
        });
        for (const stream of activeStreams) {
            if (!mountSet.has(stream.userId)) {
                await this.sourceDisconnected(stream.id);
            } else if (stream.shouldArchive) {
                await this.startArchiving(stream);
            }
        }

        const inactiveStreams = await Stream.findAll({
            where: {
                state: {
                    [Op.in]: [StreamState.pending, StreamState.disconnected],
                },
            },
        });
        for (const stream of inactiveStreams) {
            if (mountSet.has(stream.userId)) {
                await this.sourceConnected(stream.id);
            }
        }
    }

    async start(icecast: { host: string; adminUser: string; adminPassword: string }) {
        this.icecastHost = icecast.host;
        this.icecastAdminUser = icecast.adminUser;
        this.icecastAdminPassword = icecast.adminPassword;
        console.log("Starting streaming service...");
        await Stream.update(
            { activeListeners: 0 },
            { where: { state: { [Op.ne]: StreamState.finished } } },
        );
        this.syncStreams();
        this.poll();
        this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
        console.log(
            `Streaming service started with a poll interval of ${this.pollIntervalMs} ms`,
        );
    }

    stop() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    stopGracefulShutdown() {
        this.stop();
    }
}

export const streamingService = new StreamingService();

export const STREAM_STATE_CHANGED = "stream:state_changed";
export const STREAM_CHAT_SENT = "stream:chat_sent";
export const STREAM_CHAT_DELETED = "stream:chat_deleted";
export const STREAM_ARCHIVED = "stream:archived";
export const STREAM_DESTROYED = "stream:destroyed";
export const STREAM_LISTENERS_CHANGED = "stream:listeners_changed";
export const STREAM_MODERATION_CHANGED = "stream:moderation_changed";
export const STREAM_CHAT_REACTION = "stream:chat_reaction";

export interface StreamEvent {
    streamId: string;
}

export interface StreamStateChangedEvent extends StreamEvent {
    oldState: StreamState;
    newState: StreamState;
}

export interface StreamChatSentEvent extends StreamEvent {
    chat: ClientsideStreamChat;
}

export interface StreamChatDeletedEvent extends StreamEvent {
    chatId: string;
}

export interface StreamChatReactionEvent extends StreamEvent {
    chatId: string;
    /** Shared tally; the `reacted` flags in it are meaningless to other viewers. */
    reactions: ClientsideReaction[];
    actorId: string;
    /** The actor's reaction after the change, or null when they removed it. */
    emoji: string | null;
}

export interface StreamListenersChangedEvent extends StreamEvent {
    activeListeners: number;
    peekListeners: number;
}

export interface StreamModerationChangedEvent extends StreamEvent {
    kind: "mute" | "unmute" | "slowmode";
    userId?: string;
    slowModeSeconds?: number;
    mute?: ClientsideStreamMute;
}

export interface StreamArchivedEvent extends StreamEvent {
    audioId: string;
}

export interface StreamDestroyedEvent extends StreamEvent {
    reason: "pending_expired" | "owner_ended";
}
