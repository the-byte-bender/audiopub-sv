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
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { StreamChat } from "$lib/server/database";
import { endpoint, findStream, requireUser } from "$lib/server/api";
import { streamingService } from "$lib/server/streaming";

// Authors may delete their own messages; the broadcaster and admins any.
export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const stream = await findStream(event.params.id);
    const chat = await StreamChat.findByPk(event.params.chatId);
    if (!chat || chat.streamId !== stream.id) {
        return error(404, "Message not found");
    }

    if (!user.isAdmin && user.id !== stream.userId && user.id !== chat.userId) {
        return error(403, "Forbidden");
    }

    await chat.destroy();
    streamingService.notifyChatDeleted(stream.id, chat.id);
    return json({ success: true });
});
