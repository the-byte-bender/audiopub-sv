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
import { Audio, User, Comment, AudioFollow, Notification } from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import type { Actions, PageServerLoad } from "./$types";
import { type OrderItem, Sequelize } from "sequelize";
import { fail, error } from "@sveltejs/kit";

export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;

    // Default to random order for quickfeed to make it more engaging
    const sortField = "random";
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
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
        },
    });

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

    // Get comments for all audios
    const allComments = await Comment.findAll({
        where: { 
            audioId: audioIds 
        },
        include: {
            model: User,
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
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

    return {
        audios: audios.rows.map((audio) => {
            const favoriteCount = favoriteCounts.get(audio.id) || 0;
            const isFavorited = userFavorites.has(audio.id);
            return {
                ...audio.toClientside(true, favoriteCount, isFavorited),
                comments: (commentsByAudio.get(audio.id) || []).map(comment => comment.toClientside())
            };
        }),
        count: audios.count,
        page,
        limit,
        totalPages: Math.ceil(audios.count / limit),
        user: event.locals.user?.toClientside() || null,
        isAdmin: event.locals.user?.isAdmin || false,
    };
};

export const actions: Actions = {
    favorite: async (event) => {
        if (!event.locals.user) {
            return fail(401, { message: "Must be logged in" });
        }

        const formData = await event.request.formData();
        const audioId = formData.get('audioId') as string;

        if (!audioId) {
            return fail(400, { message: "Missing audioId" });
        }

        try {
            // Check if already favorited
            const existingFavorite = await AudioFavorite.findOne({
                where: { userId: event.locals.user.id, audioId }
            });

            if (existingFavorite) {
                return fail(400, { message: "Already favorited" });
            }

            await AudioFavorite.create({
                userId: event.locals.user.id,
                audioId
            });

            return { success: true };
        } catch (error) {
            console.error('Error favoriting audio:', error);
            return fail(500, { message: "Failed to favorite audio" });
        }
    },

    unfavorite: async (event) => {
        if (!event.locals.user) {
            return fail(401, { message: "Must be logged in" });
        }

        const formData = await event.request.formData();
        const audioId = formData.get('audioId') as string;

        if (!audioId) {
            return fail(400, { message: "Missing audioId" });
        }

        try {
            const deleted = await AudioFavorite.destroy({
                where: { userId: event.locals.user.id, audioId }
            });

            if (deleted === 0) {
                return fail(404, { message: "Favorite not found" });
            }

            return { success: true };
        } catch (error) {
            console.error('Error unfavoriting audio:', error);
            return fail(500, { message: "Failed to unfavorite audio" });
        }
    },

    add_comment: async (event) => {
        const user = event.locals.user;
        if (!user) {
            return fail(401, { message: "Must be logged in" });
        }

        if (user.isBanned) {
            return fail(403, { message: "Banned users cannot comment" });
        }

        const formData = await event.request.formData();
        const audioId = formData.get("audioId") as string;
        const comment = formData.get("comment") as string;

        if (!audioId) {
            return fail(400, { message: "Missing audioId" });
        }

        if (!comment) {
            return fail(400, { comment, message: "Comment is required" });
        }

        if (comment.length < 3 || comment.length > 4000) {
            return fail(400, {
                comment,
                message: "Comment must be between 3 and 4000 characters",
            });
        }

        // Check if audio exists
        const audio = await Audio.findByPk(audioId);
        if (!audio) {
            return error(404, "Audio not found");
        }

        try {
            const commentInDatabase = await Comment.create({
                userId: user.id,
                audioId: audio.id,
                content: comment,
            });

            // Send notifications to followers
            const followers = await AudioFollow.findAll({
                where: { audioId: audio.id } as any,
            });
            const followerIds = new Set<string>(followers.map((f) => f.userId));
            if (audio.userId) followerIds.add(audio.userId);
            followerIds.delete(user.id);
            
            const payloads = Array.from(followerIds).map((uid) => ({
                userId: uid,
                actorId: user.id,
                type: "comment" as const,
                targetType: "comment" as const,
                targetId: commentInDatabase.id,
                metadata: { audioId: audio.id },
            }));
            
            if (payloads.length) {
                await Notification.bulkCreate(payloads as any);
            }

            return { success: true, comment: commentInDatabase.toClientside() };
        } catch (error) {
            console.error('Error adding comment:', error);
            return fail(500, { message: "Failed to add comment" });
        }
    }
};