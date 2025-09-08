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
import fs from "fs/promises";
import {
    Audio,
    Comment,
    User,
    AudioFollow,
    Notification,
} from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import sendEmail from "$lib/server/email";
import { Op } from "sequelize";

export const load: PageServerLoad = async (event) => {
    const audio = await Audio.findByPk(event.params.id, { include: User });
    if (!audio) {
        return error(404, "Not found");
    }

    const comments = await Comment.findAll({
        where: { audioId: audio.id },
        include: {
            model: User,
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
        },
        order: [["createdAt", "ASC"]],
    });

    if (event.locals.user) {
        const relatedCommentIds = comments.map((c) => c.id);

        const whereClause: any = {
            userId: event.locals.user.id,
            readAt: null,
        };

        const orConditions: any[] = [
            {
                targetType: "audio",
                targetId: audio.id,
            },
        ];

        if (relatedCommentIds.length > 0) {
            orConditions.push({
                targetType: "comment",
                targetId: { [Op.in]: relatedCommentIds },
            });
        }

        whereClause[Op.or] = orConditions;

        await Notification.update(
            { readAt: new Date() },
            { where: whereClause }
        );
    }

    // Get following status and favorite data with error handling
    let isFollowing = false;
    let favoriteCount = 0;
    let isFavorited = false;

    try {
        const results = await Promise.all([
            event.locals.user
                ? AudioFollow.findOne({
                      where: { userId: event.locals.user.id, audioId: audio.id } as any,
                  }).then(result => !!result).catch(err => {
                      console.error('Error checking follow status:', err);
                      return false;
                  })
                : Promise.resolve(false),
            AudioFavorite.getFavoriteCount(audio.id).catch(err => {
                console.error('Error getting favorite count:', err);
                return 0;
            }),
            event.locals.user
                ? AudioFavorite.isUserFavorite(event.locals.user.id, audio.id).catch(err => {
                      console.error('Error checking user favorite:', err);
                      return false;
                  })
                : Promise.resolve(false)
        ]);

        isFollowing = results[0];
        favoriteCount = results[1];
        isFavorited = results[2];
    } catch (err) {
        console.error('Error fetching audio interaction data:', err);
        // Continue with default values
    }

    return {
        audio: audio.toClientside(true, favoriteCount, isFavorited),
        comments: comments.map((c) => c.toClientside(false)),
        mimeType: audio.mimeType,
        isFollowing,
    };
};

export const actions: Actions = {
    delete: async (event) => {
        const user = event.locals.user;
        const audio = await Audio.findByPk(event.params.id, { include: User });
        if (!audio) {
            return error(404, "Not found");
        }
        if (!user || (!user.isAdmin && user.id !== audio.userId)) {
            return error(403, "Forbidden");
        }
        await fs.unlink(audio.path);
        await audio.destroy();
        return redirect(303, "/");
    },
    add_comment: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned) {
            return error(403, "Forbidden");
        }
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) {
            return error(404, "Not found");
        }
        const form = await event.request.formData();
        const comment = form.get("comment") as string;
        if (!comment) {
            return fail(400, { comment });
        }
        if (comment.length < 3 || comment.length > 4000) {
            return fail(400, {
                comment,
                message: "Comment must be between 3 and 4000 characters",
            });
        }
        const commentInDatabase = await Comment.create({
            userId: user.id,
            audioId: audio.id,
            content: comment,
        });
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
        return { success: true };
    },
    delete_comment: async (event) => {
        // Only an admin, or the user who made the comment can delete a comment
        const user = event.locals.user;
        const form = await event.request.formData();
        const commentId = form.get("id") as string;
        if (!commentId) {
            return fail(400);
        }
        const comment = await Comment.findByPk(commentId, { include: User });
        if (!comment) {
            return error(404, "Not found");
        }
        if (!user || (!user.isAdmin && user.id !== comment.userId)) {
            return error(403, "Forbidden");
        }
        await comment.destroy();
        return { success: true };
    },
    follow: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned)
            return error(403, "Forbidden");
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) return error(404, "Not found");
        if (audio.userId === user.id) return { success: true };
        const existing = await AudioFollow.findOne({
            where: { userId: user.id, audioId: audio.id } as any,
        });
        if (!existing) {
            await AudioFollow.create({ userId: user.id, audioId: audio.id });
        }
        return { success: true };
    },
    unfollow: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned)
            return error(403, "Forbidden");
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) return error(404, "Not found");
        await AudioFollow.destroy({
            where: { userId: user.id, audioId: audio.id } as any,
        });
        return { success: true };
    },
    favorite: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned)
            return error(403, "Forbidden");
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) return error(404, "Not found");
        
        const favorite = await AudioFavorite.createFavorite(user.id, audio.id);
        if (!favorite) {
            // Already favorited, that's fine
            return { success: true };
        }
        return { success: true };
    },
    unfavorite: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned)
            return error(403, "Forbidden");
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) return error(404, "Not found");
        
        await AudioFavorite.removeFavorite(user.id, audio.id);
        return { success: true };
    },
};
