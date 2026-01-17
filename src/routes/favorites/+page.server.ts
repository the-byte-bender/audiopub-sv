/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2025 the-byte-bender
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
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import AudioFavorite from "$lib/server/database/models/audio_favorite";

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;
    
    // Require authentication to view favorites
    if (!user) {
        throw redirect(302, "/login");
    }

    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;
    const limit = 30;

    try {
        const favorites = await AudioFavorite.getUserFavorites(user.id, page, limit, user.isAdmin);
        
        // Get favorite counts for each audio
        const audioIds = favorites.rows.map(fav => fav.audioId);
        const favoriteCounts = await AudioFavorite.count({
            attributes: ['audioId'],
            where: { audioId: audioIds },
            group: 'audioId'
        }).then(results => {
            const countsMap = new Map();
            results.forEach((result: any) => {
                countsMap.set(result.audioId, result.count);
            });
            return countsMap;
        });

        return {
            audios: favorites.rows
                .filter(fav => fav.audio) // Filter out any favorites where audio was deleted
                .map(fav => {
                    const favoriteCount = favoriteCounts.get(fav.audioId) || 0;
                    return fav.audio!.toClientside(true, favoriteCount, true); // isFavorited is always true for favorites page
                }),
            count: favorites.count,
            page,
            limit,
            totalPages: Math.ceil(favorites.count / limit),
        };
    } catch (error) {
        console.error("Error loading user favorites:", error);
        return {
            audios: [],
            count: 0,
            page: 1,
            limit,
            totalPages: 0,
        };
    }
};