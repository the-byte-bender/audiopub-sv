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
import { error, json, type RequestEvent } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { endpoint, requireUser } from "$lib/server/api";
import { muteUser, unmuteUser } from "$lib/server/mutes";
import { findUserByParam } from "$lib/server/users";

/*
 * Muting hides a user's uploads and streams from the viewer's feeds, and
 * their actions from the viewer's notifications.
 */

async function findMutedUser(event: RequestEvent<{ id: string }>) {
    requireUser(event);
    const user = await findUserByParam(event.params.id);
    if (!user) {
        return error(404, "User not found");
    }
    return user;
}

export const PUT: RequestHandler = endpoint(async (event) => {
    const user = await findMutedUser(event);
    return json(await muteUser(event, user));
});

export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = await findMutedUser(event);
    return json(await unmuteUser(event, user));
});
