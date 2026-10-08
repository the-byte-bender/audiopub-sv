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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { StreamChat, User } from "$lib/server/database";
import { StreamState } from "$lib/types";
import { endpoint, findStream } from "$lib/server/api";
import { streamListenUrl } from "$lib/streaming_config";

/*
 * A stream, by id or by "@username", with its chat so far. listenUrl is where
 * the audio plays from while the stream is live. Once it finishes, an archived
 * stream is an audio with the same id.
 */
export const GET: RequestHandler = endpoint(async (event) => {
    const stream = await findStream(event.params.id);
    const chats = await StreamChat.findAll({
        where: { streamId: stream.id },
        include: [User],
        order: [["createdAt", "ASC"]],
    });

    return json({
        stream: stream.toClientside(true),
        chats: chats.map((chat) => chat.toClientside()),
        format: stream.format,
        slowModeSeconds: stream.slowModeSeconds,
        listenUrl:
            stream.state === StreamState.finished
                ? null
                : `${streamListenUrl}/${stream.userId}`,
    });
});
