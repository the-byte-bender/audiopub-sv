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
import { AudioFollow } from "$lib/server/database";
import { endpoint, findVisibleAudio, requireUser } from "$lib/server/api";

/*
 * Following an audio subscribes to notifications about new comments on it.
 * Uploaders always get those for their own audios.
 */

function requireFollowingUser(event: RequestEvent) {
    const user = requireUser(event);
    if (user.isBanned) {
        return error(403, "You are banned");
    }
    if (!user.isVerified) {
        return error(403, "Please verify your email before following audios");
    }
    return user;
}

export const PUT: RequestHandler = endpoint(async (event) => {
    const user = requireFollowingUser(event);
    const audio = await findVisibleAudio(event, event.params.id);
    if (audio.userId !== user.id) {
        await AudioFollow.findOrCreate({
            where: { userId: user.id, audioId: audio.id } as any,
        });
    }
    return json({ success: true });
});

export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = requireFollowingUser(event);
    const audio = await findVisibleAudio(event, event.params.id);
    await AudioFollow.destroy({
        where: { userId: user.id, audioId: audio.id } as any,
    });
    return json({ success: true });
});
