/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2024 the-byte-bender
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
import { Audio, User } from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import type { PageServerLoad } from "./$types";
import { type OrderItem, Sequelize } from "sequelize";


export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;
    const sortField = event.url.searchParams.get("sort") || "createdAt";
    const sortOrder = event.url.searchParams.get("order") || "DESC";

    const validSortFields = ["createdAt", "plays", "title", "random", "favoriteCount"];
    const validSortOrders = ["ASC", "DESC"];
    const validatedSortField = validSortFields.includes(sortField)
        ? sortField
        : "createdAt";
    const validatedSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

    const limit = 30;
    const offset = (page - 1) * limit;

    // Define the order based on validated parameters
    let order: OrderItem[] | undefined;
    if (validatedSortField === "random") {
        // Use Sequelize.fn('RAND') for MariaDB/MySQL random ordering
        order = [Sequelize.fn('RAND')];
    } else {
        order = [[validatedSortField, validatedSortOrder]];
    }

    const audios = await Audio.findAndCountAll({
        limit,
        offset,
        order,
        include: {
            model: User,
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
        },
    });

    // Query 2: Get favorite data efficiently 
    const audioIds = audios.rows.map(audio => audio.id);
    const currentUser = event.locals.user;
    
    let favoriteCounts = new Map<string, number>();
    let userFavorites = new Set<string>();

    if (audioIds.length > 0) {
        try {
            const [favoriteCountsData, userFavoritesData] = await Promise.all([
                // Get favorite counts for all audios in one query
                AudioFavorite.findAll({
                    where: { audioId: audioIds },
                    attributes: [
                        'audioId',
                        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
                    ],
                    group: ['audioId']
                }),
                // Get current user's favorites in one query
                currentUser ? AudioFavorite.findAll({
                    where: { 
                        userId: currentUser.id,
                        audioId: audioIds 
                    },
                    attributes: ['audioId']
                }) : Promise.resolve([])
            ]);

            // Process results into maps for easy lookup
            favoriteCounts = new Map(
                favoriteCountsData.map(item => [
                    item.audioId, 
                    parseInt((item as any).get('count')) || 0
                ])
            );
            userFavorites = new Set(userFavoritesData.map(item => item.audioId));
            
        } catch (err) {
            console.error('Error fetching favorite data:', err);
            // Continue with empty data
        }
    }

    return {
        audios: audios.rows.map((audio) => {
            const favoriteCount = favoriteCounts.get(audio.id) || 0;
            const isFavorited = userFavorites.has(audio.id);
            return audio.toClientside(true, favoriteCount, isFavorited);
        }),
        count: audios.count,
        page,
        limit,
        totalPages: Math.ceil(audios.count / limit),
        sortField: validatedSortField,
        sortOrder: validatedSortOrder,
    };
};
