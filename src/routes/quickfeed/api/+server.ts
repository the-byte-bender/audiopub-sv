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
import { Audio, User, Comment } from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import type { RequestHandler } from "./$types";
import { type OrderItem, Sequelize } from "sequelize";
import { json, error } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        const pageString = url.searchParams.get("page");
        const page = pageString ? parseInt(pageString, 10) : 1;

        // Validate page parameter
        if (isNaN(page) || page < 1) {
            return json({ error: "Invalid page parameter" }, { status: 400 });
        }

        // Same logic as page.server.ts load function
        const limit = 50; // Load more items for scrolling
        const offset = (page - 1) * limit;

        // Use random ordering for TikTok-like experience
        const order: OrderItem[] = [Sequelize.fn('RAND')];

        const audios = await Audio.findAndCountAll({
            limit,
            offset,
            order,
            include: {
                model: User,
                where: locals.user?.isAdmin ? {} : { isTrusted: true },
            },
        });

        const audioIds = audios.rows.map(audio => audio.id);
        const currentUser = locals.user;
        
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

        // Get comments for all audios
        const allComments = await Comment.findAll({
            where: { 
                audioId: audioIds 
            },
            include: {
                model: User,
                where: locals.user?.isAdmin ? {} : { isTrusted: true },
            },
            order: [["createdAt", "ASC"]],
        });

        // Group comments by audioId
        const commentsByAudio = new Map<string, typeof allComments>();
        allComments.forEach(comment => {
            const audioId = (comment as any).audioId;
            if (!commentsByAudio.has(audioId)) {
                commentsByAudio.set(audioId, []);
            }
            commentsByAudio.get(audioId)?.push(comment);
        });

        // Process audios with clientside data
        const processedAudios = audios.rows.map((audio) => {
            const favoriteCount = favoriteCounts.get(audio.id) || 0;
            const isFavorited = userFavorites.has(audio.id);
            return {
                ...audio.toClientside(true, favoriteCount, isFavorited),
                comments: (commentsByAudio.get(audio.id) || []).map(comment => comment.toClientside())
            };
        });

        const totalPages = Math.ceil(audios.count / limit);
        const hasMore = page < totalPages;

        return json({
            audios: processedAudios,
            count: audios.count,
            page,
            limit,
            totalPages,
            hasMore
        });

    } catch (err) {
        console.error('Quickfeed API error:', err);
        return json({ error: "Failed to fetch audios" }, { status: 500 });
    }
};