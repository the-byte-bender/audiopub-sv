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
import { Stream, User } from "$lib/server/database";
import { StreamState } from "$lib/types";
import { endpoint } from "$lib/server/api";
import { excludeMutedUsers, getMutedUserIds } from "$lib/server/mutes";

// Everyone broadcasting right now, newest first.
export const GET: RequestHandler = endpoint(async (event) => {
    const mutedUserIds = await getMutedUserIds(event);
    const streams = await Stream.findAll({
        where: {
            state: StreamState.active,
            ...excludeMutedUsers(mutedUserIds),
        },
        include: [User],
        order: [["createdAt", "DESC"]],
    });
    return json({ streams: streams.map((stream) => stream.toClientside(true)) });
});
