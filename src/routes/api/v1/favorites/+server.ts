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
import { AudioFavorite, type Audio } from "$lib/server/database";
import {
    endpoint,
    getPage,
    PAGE_SIZE,
    pagination,
    requireUser,
    serializeAudios,
} from "$lib/server/api";

// The viewer's favorites, most recently favorited first.
export const GET: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const page = getPage(event.url);
    const favorites = await AudioFavorite.getUserFavorites(
        user.id,
        page,
        PAGE_SIZE,
    );
    const audios = favorites.rows
        .map((favorite) => favorite.audio)
        .filter((audio): audio is Audio => !!audio);

    return json({
        audios: await serializeAudios(audios, user),
        ...pagination(favorites.count, page),
    });
});
