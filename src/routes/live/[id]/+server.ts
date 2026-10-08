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
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Stream, User, StreamMute } from "$lib/server/database";
import { streamingService } from "$lib/server/streaming";
import { sendStreamChat } from "$lib/server/stream_chats";

export const DELETE: RequestHandler = async (event) => {
    if (!event.locals.user) {
        throw error(401, "You must be logged in");
    }

    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        throw error(404, "Stream not found");
    }

    if (stream.userId !== event.locals.user.id && !event.locals.user.isAdmin) {
        throw error(403, "Not authorized");
    }

    if (stream.state === "finished") {
        throw error(400, "Stream already ended");
    }

    await streamingService.endStream(stream.id);
    return json({ success: true });
};

export const POST: RequestHandler = async (event) => {
    if (!event.locals.user) {
        throw error(401, "You must be logged in to send messages");
    }

    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        throw error(404, "Stream not found");
    }

    const body = await event.request.json();
    return json(await sendStreamChat(event.locals.user, stream, body.content));
};

// Moderation controls for the stream owner (or an admin)
export const PUT: RequestHandler = async (event) => {
    const user = event.locals.user;
    if (!user) {
        throw error(401, "You must be logged in");
    }

    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        throw error(404, "Stream not found");
    }

    if (stream.state === "finished") {
        throw error(400, "Stream already ended");
    }

    if (user.id !== stream.userId && !user.isAdmin) {
        throw error(403, "Not authorized");
    }

    const body = await event.request.json();
    const action = body?.action as string | undefined;

    if (action === "mute") {
        const targetId = body.userId as string | undefined;
        if (!targetId || typeof targetId !== "string") {
            throw error(400, "Missing user id");
        }
        const target = await User.findByPk(targetId);
        if (!target) {
            throw error(404, "User not found");
        }
        if (target.id === stream.userId) {
            throw error(400, "You cannot mute the stream owner");
        }
        if (target.isAdmin) {
            throw error(400, "You cannot mute an admin");
        }

        // durationMinutes null means permanent (a ban from this stream)
        const durationMinutes = body.durationMinutes;
        const duration =
            durationMinutes == null ? null : Number(durationMinutes);
        if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) {
            throw error(400, "Invalid mute duration");
        }
        const expiresAt =
            duration === null
                ? null
                : new Date(Date.now() + duration * 60 * 1000);

        const existing = await StreamMute.findOne({
            where: { streamId: stream.id, userId: targetId },
        });
        if (existing) {
            existing.expiresAt = expiresAt;
            await existing.save();
        } else {
            await StreamMute.create({
                streamId: stream.id,
                userId: targetId,
                expiresAt,
                createdBy: user.id,
            });
        }
        streamingService.notifyModerationChanged(stream.id, "mute", targetId, undefined, {
            id: existing?.id ?? crypto.randomUUID(),
            userId: target.id,
            userName: target.name,
            displayName: target.displayName,
            expiresAt: expiresAt ? expiresAt.getTime() : null,
            reason: null,
            createdAt: Date.now(),
        });
        return json({ success: true });
    }

    if (action === "unmute") {
        const targetId = body.userId as string | undefined;
        if (!targetId) {
            throw error(400, "Missing user id");
        }
        await StreamMute.destroy({
            where: { streamId: stream.id, userId: targetId },
        });
        streamingService.notifyModerationChanged(stream.id, "unmute", targetId);
        return json({ success: true });
    }

    if (action === "slowmode") {
        const seconds = Number(body.seconds);
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
            throw error(400, "Invalid slow mode duration");
        }
        stream.slowModeSeconds = seconds;
        await stream.save();
        streamingService.notifyModerationChanged(
            stream.id,
            "slowmode",
            undefined,
            seconds,
        );
        return json({ success: true });
    }

    throw error(400, "Unknown action");
};