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
import { StreamChat, Stream } from "$lib/server/database";
import { streamingService } from "$lib/server/streaming";
import {
    InvalidReactionError,
    deleteReactionsFor,
    toggleReaction,
} from "$lib/server/reactions";
import { ReactionTargetType } from "$lib/types";

export const DELETE: RequestHandler = async (event) => {
    const user = event.locals.user;
    const chatId = event.params.chatId;

    if (!chatId) {
        return json({ error: "Missing chat ID" }, { status: 400 });
    }

    const chat = await StreamChat.findByPk(chatId, { include: Stream });
    if (!chat) {
        return json({ error: "Not found" }, { status: 404 });
    }

    const stream = chat.stream!;
    const isOwnerOrAdmin = user && (user.id === stream?.userId || user.isAdmin);

    if (!user || (!isOwnerOrAdmin && user.id !== chat.userId)) {
        return json({ error: "Forbidden" }, { status: 403 });
    }

    await chat.destroy();
    await deleteReactionsFor(ReactionTargetType.streamChat, chat.id);
    streamingService.notifyChatDeleted(stream.id, chat.id);
    return json({ success: true });
};

/**
 * Toggles the caller's reaction on a chat message. This also works after the
 * stream is archived, so the chat history on the audio page stays interactive.
 */
export const POST: RequestHandler = async (event) => {
    const user = event.locals.user;
    if (!user) {
        return json({ message: "You must be logged in" }, { status: 401 });
    }
    if (user.isBanned) {
        return json({ message: "You are banned" }, { status: 403 });
    }
    if (!user.isVerified) {
        return json(
            { message: "Please verify your email before reacting" },
            { status: 403 },
        );
    }

    const chatId = event.params.chatId;
    if (!chatId) {
        return json({ message: "Missing chat ID" }, { status: 400 });
    }

    const chat = await StreamChat.findByPk(chatId, { include: Stream });
    if (!chat) {
        return json({ message: "Not found" }, { status: 404 });
    }

    let body: any;
    try {
        body = await event.request.json();
    } catch {
        return json({ message: "Invalid request" }, { status: 400 });
    }

    try {
        const reactions = await toggleReaction(
            user.id,
            ReactionTargetType.streamChat,
            chat.id,
            body?.emoji,
        );
        const mine = reactions.find((r) => r.reacted)?.emoji ?? null;
        streamingService.notifyChatReaction(
            chat.streamId,
            chat.id,
            reactions,
            user.id,
            mine,
        );
        return json({ reactions });
    } catch (err) {
        if (err instanceof InvalidReactionError) {
            return json({ message: "Unknown reaction" }, { status: 400 });
        }
        throw err;
    }
};
