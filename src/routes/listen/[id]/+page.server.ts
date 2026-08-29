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
    Stream,
    StreamChat,
    Subscription,
    AudioEdit,
} from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import sendEmail from "$lib/server/email";
import { json, Op, Sequelize } from "sequelize";
import { Json } from "sequelize/lib/utils";
import { subscribe, unsubscribe } from "$lib/server/subscriptions";
import {
    AudioEditLimitError,
    AudioNotFoundError,
    MAX_USER_AUDIO_EDITS,
    updateAudioDetails,
} from "$lib/server/audio_edits";
import {
    InvalidReactionError,
    deleteReactionsFor,
    summarizeReactions,
    toggleReaction,
} from "$lib/server/reactions";
import { ReactionTargetType } from "$lib/types";

export const load: PageServerLoad = async (event) => {
    const audio = await Audio.findByPk(event.params.id, {
        include: [{ model: Stream, as: "archivedStream" }, User],
    });

    if (!audio) {
        const stream = await Stream.findByPk(event.params.id);
        if (stream && stream.state !== "finished") {
            return redirect(302, `/live/${event.params.id}`);
        }
        return error(404, "Not found");
    }

    const viewer = event.locals.user;
    if (
        audio.user &&
        !audio.user.isTrusted &&
        !viewer?.isAdmin &&
        viewer?.id !== audio.userId
    ) {
        return error(404, "Not found");
    }

    const comments = await Comment.findAll({
        where: { audioId: audio.id },
        include: {
            model: User,
        },
        // order: [["createdAt", "ASC"]],
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
            { where: whereClause },
        );
    }

    const commentReactions = await summarizeReactions(
        ReactionTargetType.comment,
        comments.map((c) => c.id),
        viewer?.id,
    );

    const sortedComments = Comment.constructThreads(comments);
    const canEdit = Boolean(
        viewer && (viewer.isAdmin || viewer.id === audio.userId),
    );
    const edits = canEdit
        ? await AudioEdit.findAll({
              where: { audioId: audio.id },
              include: [{ model: User, as: "editor" }],
              order: [["createdAt", "DESC"]],
          })
        : [];
    const userEditCount = edits.filter((edit) => !edit.isAdminEdit).length;

    // Query 2: Get interaction data (following status, favorite count, user favorite status)
    let isFollowing = false;
    let favoriteCount = 0;
    let isFavorited = false;

    try {
        const results = await Promise.all([
            // Check if user is following this audio
            event.locals.user
                ? AudioFollow.findOne({
                      where: {
                          userId: event.locals.user.id,
                          audioId: audio.id,
                      } as any,
                  })
                      .then((result) => !!result)
                      .catch((err) => {
                          console.error("Error checking follow status:", err);
                          return false;
                      })
                : Promise.resolve(false),
            AudioFavorite.count({
                where: { audioId: audio.id },
            }).catch((err) => {
                console.error("Error getting favorite count:", err);
                return 0;
            }),
            // Check if user has favorited this audio
            event.locals.user
                ? AudioFavorite.findOne({
                      where: {
                          userId: event.locals.user.id,
                          audioId: audio.id,
                      },
                  })
                      .then((result) => !!result)
                      .catch((err) => {
                          console.error("Error checking user favorite:", err);
                          return false;
                      })
                : Promise.resolve(false),
        ]);

        isFollowing = results[0];
        favoriteCount = results[1];
        isFavorited = results[2];
    } catch (err) {
        console.error("Error fetching audio interaction data:", err);
        // Continue with default values
    }

    const subscribers = await Subscription.count({
        where: { subscribedToId: audio.userId },
    });
    
    const user = event.locals.user;
    let subscription;
    if (user) {
        subscription = await Subscription.findOne({
            where: { subscriberId: user.id, subscribedToId: audio.userId },
        });
    }
        
    let isSubscribed: boolean;
    if (subscription) isSubscribed = true;
    else isSubscribed = false;

    return {
        audio: audio.toClientside(true, favoriteCount, isFavorited),
        comments: sortedComments.map((c) =>
            c.toClientside(false, true, commentReactions),
        ),
        mimeType: audio.mimeType,
        isFollowing,
        archivedStreamId: audio.archivedStreamId,
        archivedStreamChats: audio.archivedStreamId
            ? await StreamChat.findAll({
                  where: { streamId: audio.archivedStreamId },
                  include: { model: User },
                  order: [["createdAt", "ASC"]],
              }).then(async (chats) => {
                  const reactions = await summarizeReactions(
                      ReactionTargetType.streamChat,
                      chats.map((c) => c.id),
                      viewer?.id,
                  );
                  return chats.map((c) =>
                      c.toClientside(false, reactions.get(c.id) ?? []),
                  );
              })
            : null,
        isSubscribed,
        canEdit,
        hasEdits: Boolean(viewer?.isAdmin && edits.length > 0),
        remainingEdits: viewer?.isAdmin
            ? null
            : Math.max(0, MAX_USER_AUDIO_EDITS - userEditCount),
        edits: edits.map((edit) => ({
            id: edit.id,
            previousTitle: edit.previousTitle,
            previousDescription: edit.previousDescription,
            newTitle: edit.newTitle,
            newDescription: edit.newDescription,
            isAdminEdit: edit.isAdminEdit,
            restoredEditId: edit.restoredEditId,
            createdAt: edit.createdAt.toISOString(),
            editor: edit.editor?.toClientside(),
        })),
    };
};

export const actions: Actions = {
    revertEdit: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const form = await event.request.formData();
        const editId = form.get("editId");
        if (typeof editId !== "string" || !editId) {
            return error(400, "Missing edit id");
        }

        const edit = await AudioEdit.findByPk(editId);
        if (!edit || edit.audioId !== event.params.id) {
            return error(404, "Edit not found");
        }

        await updateAudioDetails(
            edit.audioId,
            user,
            edit.previousTitle,
            edit.previousDescription,
            edit.id,
        );
        return { revertSuccess: true };
    },
    edit: async (event) => {
        const user = event.locals.user;
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) {
            return error(404, "Not found");
        }
        if (!user || (!user.isAdmin && user.id !== audio.userId)) {
            return error(403, "Forbidden");
        }
        if (!user.isAdmin && (user.isBanned || !user.isVerified)) {
            return error(403, "Forbidden");
        }

        const form = await event.request.formData();
        const titleValue = form.get("title");
        const descriptionValue = form.get("description");
        const title = typeof titleValue === "string" ? titleValue.trim() : "";
        const description =
            typeof descriptionValue === "string" ? descriptionValue : "";

        if (title.length < 3 || title.length > 120) {
            return fail(400, {
                editMessage: "Title must be between 3 and 120 characters",
            });
        }
        if (description.length > 5000) {
            return fail(400, {
                editMessage: "Description must not exceed 5000 characters",
            });
        }

        try {
            const edit = await updateAudioDetails(
                audio.id,
                user,
                title,
                description,
            );
            if (!edit) {
                return fail(400, { editMessage: "No changes were made" });
            }
        } catch (err) {
            if (err instanceof AudioEditLimitError) {
                return fail(403, {
                    editMessage: "You have reached the limit of 3 edits",
                });
            }
            if (err instanceof AudioNotFoundError) {
                return error(404, "Not found");
            }
            throw err;
        }

        return { editSuccess: true };
    },
    react_comment: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned) {
            return error(403, "Forbidden");
        }

        const form = await event.request.formData();
        const targetId = form.get("targetId");
        const emoji = form.get("emoji");
        if (typeof targetId !== "string" || typeof emoji !== "string") {
            return fail(400, { reactionMessage: "Invalid reaction" });
        }

        const comment = await Comment.findByPk(targetId);
        if (!comment || comment.audioId !== event.params.id) {
            return error(404, "Not found");
        }

        try {
            await toggleReaction(
                user.id,
                ReactionTargetType.comment,
                comment.id,
                emoji,
            );
        } catch (err) {
            if (err instanceof InvalidReactionError) {
                return fail(400, { reactionMessage: "Unknown reaction" });
            }
            throw err;
        }

        return { success: true };
    },
    setAnnouncement: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) {
            return error(404, "Not found");
        }
        const form = await event.request.formData();
        // The button posts the state it wants, so the action stays idempotent
        // and a double submit cannot flip it back.
        audio.isAnnouncement = form.get("isAnnouncement") === "on";
        await audio.save();
        return { announcementSuccess: true };
    },
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
        const parentId = form.get("parentId") as string | null;
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
            parentId,
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
            await Notification.bulkCreate(payloads as any, { individualHooks: true });
        }

        return { success: true };
    },
    reply_to_comment: async ({ request }) => {
        const form = await request.formData();
        const parentId = form.get("parentId") as string;
        const parentComment = await Comment.findByPk(parentId, {
            include: User,
        });

        if (!parentComment) {
            return error(404, "The comment you are replying to was not found");
        }
        return {
            replyTo: parentComment.toClientside(false),
        };
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

        // You must be an admin or the comment owner to delete
        if (!user || (!user.isAdmin && user.id !== comment.userId)) {
            return error(403, "Forbidden");
        }

        // We should be able to use mixin methods here, but even after declaring their types
        // explicitly, they just don't work.
        const replyCount = await Comment.count({
            where: { parentId: comment.id },
        });
        if (replyCount > 0) {
            // Comment cannot be deleted, clear its content instead
            comment.content = "[deleted]";
            await comment.save();
            return { success: true };
        }

        // Otherwise we can just delete it
        await comment.destroy();
        await deleteReactionsFor(ReactionTargetType.comment, comment.id);
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
        if (!user || !user.isTrusted || user.isBanned)
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
        if (!user || !user.isTrusted || user.isBanned)
            return error(403, "Forbidden");
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) return error(404, "Not found");

        await AudioFavorite.removeFavorite(user.id, audio.id);
        return { success: true };
    },
    subscribe,
    unsubscribe
};
