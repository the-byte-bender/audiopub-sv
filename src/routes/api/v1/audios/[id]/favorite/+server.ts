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
import { AudioFavorite } from "$lib/server/database";
import { endpoint, findVisibleAudio, requireUser } from "$lib/server/api";

function requireFavoritingUser(event: RequestEvent) {
    const user = requireUser(event);
    if (user.isBanned) {
        return error(403, "You are banned");
    }
    if (!user.isTrusted) {
        return error(
            403,
            "Your account must be reviewed before you can favorite audios",
        );
    }
    return user;
}

export const PUT: RequestHandler = endpoint(async (event) => {
    const user = requireFavoritingUser(event);
    const audio = await findVisibleAudio(event, event.params.id);
    // Returns null when it was already a favorite, which is just as good.
    await AudioFavorite.createFavorite(user.id, audio.id);
    return json({ success: true });
});

export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = requireFavoritingUser(event);
    const audio = await findVisibleAudio(event, event.params.id);
    await AudioFavorite.removeFavorite(user.id, audio.id);
    return json({ success: true });
});
