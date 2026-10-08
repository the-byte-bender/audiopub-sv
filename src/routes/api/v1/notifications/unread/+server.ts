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
import { Notification } from "$lib/server/database";
import { endpoint, requireUser } from "$lib/server/api";
import { excludeMutedActors, getMutedUserIds } from "$lib/server/mutes";

// Cheap enough to poll for a badge.
export const GET: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const mutedUserIds = await getMutedUserIds(event);
    const unread = await Notification.count({
        where: {
            userId: user.id,
            readAt: null,
            ...excludeMutedActors(mutedUserIds),
        },
    });
    return json({ unread });
});
