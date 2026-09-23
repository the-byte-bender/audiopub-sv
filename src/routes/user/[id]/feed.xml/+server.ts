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
import { Audio } from "$lib/server/database";
import { findUserByProfileParam } from "$lib/server/profiles";
import { FEED_ITEM_LIMIT, renderUserFeed } from "$lib/server/rss";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
    const user = await findUserByProfileParam(event.params.id);

    /*
     * Feed readers fetch anonymously, and a feed gets copied into apps we
     * cannot take it back from, so this is deliberately stricter than the
     * profile page: nothing from accounts still waiting to be trusted, and
     * nothing from banned accounts, even though the profile page still shows
     * a banned user's old uploads.
     */
    if (!user || user.isBanned || !user.isTrusted) {
        return error(404, "Not found");
    }

    const audios = await Audio.findAll({
        where: { userId: user.id, hasFile: true },
        order: [["createdAt", "DESC"]],
        limit: FEED_ITEM_LIMIT,
    });

    return new Response(await renderUserFeed(user, audios), {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            // Feed readers poll; a short shared cache keeps that cheap.
            "Cache-Control": "public, max-age=900",
        },
    });
};
