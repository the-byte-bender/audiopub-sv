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
import { error } from "@sveltejs/kit";
import { Op } from "sequelize";
import { Stream, StreamChat, StreamMute, User } from "./database";
import { streamingService } from "./streaming";
import type { ClientsideStreamChat } from "$lib/types";

/**
 * Posts a chat message to a live stream, enforcing stream mutes and slow mode,
 * and pushes it to everyone watching.
 */
export async function sendStreamChat(
    user: User,
    stream: Stream,
    content: unknown,
): Promise<ClientsideStreamChat> {
    if (user.isBanned) {
        throw error(403, "You are banned");
    }

    if (!user.isVerified) {
        throw error(403, "Please verify your email before sending messages");
    }

    if (stream.state === "finished") {
        throw error(400, "Stream has ended");
    }

    const activeMute = await StreamMute.findOne({
        where: {
            streamId: stream.id,
            userId: user.id,
            [Op.or]: [
                { expiresAt: null },
                { expiresAt: { [Op.gt]: new Date() } },
            ],
        },
    });
    if (activeMute) {
        throw error(403, "You are muted in this stream");
    }

    if (stream.slowModeSeconds > 0) {
        const lastMessage = await StreamChat.findOne({
            where: { streamId: stream.id, userId: user.id },
            order: [["createdAt", "DESC"]],
        });
        if (lastMessage) {
            const elapsed = Date.now() - lastMessage.createdAt.getTime();
            if (elapsed < stream.slowModeSeconds * 1000) {
                const waitSeconds = Math.ceil(
                    (stream.slowModeSeconds * 1000 - elapsed) / 1000,
                );
                throw error(
                    429,
                    `Slow mode is on. Please wait ${waitSeconds} second${
                        waitSeconds === 1 ? "" : "s"
                    }.`,
                );
            }
        }
    }

    if (!content || typeof content !== "string") {
        throw error(400, "Message content required");
    }

    const trimmedContent = content.trim();
    if (!trimmedContent || trimmedContent.length > 2000) {
        throw error(400, "Invalid message content");
    }

    const chat = await StreamChat.create({
        streamId: stream.id,
        userId: user.id,
        content: trimmedContent,
    });

    const chatWithUser = await StreamChat.findByPk(chat.id, {
        include: User,
    });

    const clientsideChat = chatWithUser!.toClientside();
    streamingService.notifyChatSent(stream.id, clientsideChat);

    return clientsideChat;
}
