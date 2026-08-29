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
import type { RequestHandler } from "./$types";
import { Stream } from "$lib/server/database";
import { streamingService } from "$lib/server/streaming";
import {
    STREAM_STATE_CHANGED,
    STREAM_LISTENERS_CHANGED,
    STREAM_CHAT_SENT,
    STREAM_CHAT_DELETED,
    STREAM_ARCHIVED,
    STREAM_MODERATION_CHANGED,
} from "$lib/server/streaming";
import type {
    StreamStateChangedEvent,
    StreamListenersChangedEvent,
    StreamChatSentEvent,
    StreamChatDeletedEvent,
    StreamArchivedEvent,
    StreamModerationChangedEvent,
} from "$lib/server/streaming";

export const GET: RequestHandler = async (event) => {
    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        return new Response(null, { status: 204 });
    }
    if (stream.state === "finished") {
        return new Response(null, { status: 204 });
    }

    const encoder = new TextEncoder();

    const onStateChanged = (data: StreamStateChangedEvent) => {
        if (data.streamId === stream.id) {
            send("state", { state: data.newState });
            if (data.newState === "finished") {
                send("finish", {});
                try {
                    controllerRef?.close();
                } catch {
                    /* already closed */
                }
                cleanup();
            }
        }
    };

    const onListenersChanged = (data: StreamListenersChangedEvent) => {
        if (data.streamId === stream.id) {
            send("listeners", {
                activeListeners: data.activeListeners,
                peekListeners: data.peekListeners,
            });
        }
    };

    const onChatSent = (data: StreamChatSentEvent) => {
        if (data.streamId === stream.id) {
            send("chat", data.chat);
        }
    };

    const onChatDeleted = (data: StreamChatDeletedEvent) => {
        if (data.streamId === stream.id) {
            send("chat_delete", { chatId: data.chatId });
        }
    };

    const onModerationChanged = (data: StreamModerationChangedEvent) => {
        if (data.streamId === stream.id) {
            send("moderation", {
                kind: data.kind,
                userId: data.userId,
                slowModeSeconds: data.slowModeSeconds,
                mute: data.mute,
            });
        }
    };

    const onArchived = (data: StreamArchivedEvent) => {
        if (data.streamId === stream.id) {
            send("archived", {});
        }
    };

    let keepalive: ReturnType<typeof setInterval> | null = null;

    let controllerRef: ReadableStreamDefaultController | null = null;

    const listener = {};

    function send(eventName: string, data: unknown) {
        if (!controllerRef) return;
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
            controllerRef.enqueue(encoder.encode(payload));
        } catch {
            controllerRef = null;
            cleanup();
        }
    }

    // A client can go away without cancel() firing, so everything that notices
    // ends up here. Calling it more than once is harmless
    const cleanup = () => {
        clearInterval(keepalive ?? undefined);
        keepalive = null;
        streamingService.off(STREAM_STATE_CHANGED, onStateChanged);
        streamingService.off(STREAM_LISTENERS_CHANGED, onListenersChanged);
        streamingService.off(STREAM_CHAT_SENT, onChatSent);
        streamingService.off(STREAM_CHAT_DELETED, onChatDeleted);
        streamingService.off(STREAM_ARCHIVED, onArchived);
        streamingService.off(STREAM_MODERATION_CHANGED, onModerationChanged);
        streamingService.listenerDisconnected(stream.id, listener);
    };

    const stream2 = new ReadableStream({
        start(controller) {
            controllerRef = controller;

            send("listeners", {
                activeListeners: stream.activeListeners,
                peekListeners: stream.peekListeners,
            });

            send("state", { state: stream.state });

            streamingService.on(STREAM_STATE_CHANGED, onStateChanged);
            streamingService.on(STREAM_LISTENERS_CHANGED, onListenersChanged);
            streamingService.on(STREAM_CHAT_SENT, onChatSent);
            streamingService.on(STREAM_CHAT_DELETED, onChatDeleted);
            streamingService.on(STREAM_ARCHIVED, onArchived);
            streamingService.on(STREAM_MODERATION_CHANGED, onModerationChanged);

            streamingService.listenerConnected(stream.id, listener);

            keepalive = setInterval(() => {
                try {
                    controllerRef?.enqueue(encoder.encode(": keepalive\n\n"));
                } catch {
                    cleanup();
                }
            }, 30000);
        },
        cancel() {
            cleanup();
        },
    });

    event.request.signal.addEventListener("abort", cleanup);

    return new Response(stream2, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
};
