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
import { Op, Sequelize } from "sequelize";
import { createCommentWithNotifications, validateCommentContent } from "$lib/server/interactions";

export const load: PageServerLoad = async (event) => {
  // Query 1: Get audio with user
  const audio = await Audio.findByPk(event.params.id, { include: User });
  if (!audio) {
    return error(404, "Not found");
  }

  // Visibility check: Filter audios by { isTrusted: true } unless user is admin or owner
  const isAdmin = event.locals.user?.isAdmin;
  const isOwner = event.locals.user?.id === audio.userId;
  if (audio.user && !audio.user.isTrusted && !isAdmin && !isOwner) {
    throw error(403, "This audio is from an untrusted user and is not visible yet.");
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

    await Notification.update({ readAt: new Date() }, { where: whereClause });
  }

  // Construct list of comment thread trees, for UI rendering
  const sortedComments = Comment.constructThreads(comments);

  // Query 2: Get interaction data (following status, favorite count, user favorite status)
  let isFollowing = false;
  let favoriteCount = 0;
  let isFavorited = false;

  try {
    const results = await Promise.all([
      // Check if user is following this audio
      event.locals.user
        ? AudioFollow.findOne({
            where: { userId: event.locals.user.id, audioId: audio.id } as any,
          })
            .then((result) => !!result)
            .catch((err) => {
              console.error("Error checking follow status:", err);
              return false;
            })
        : Promise.resolve(false),
      // Get favorite count for this audio
      AudioFavorite.count({
        where: { audioId: audio.id },
      }).catch((err) => {
        console.error("Error getting favorite count:", err);
        return 0;
      }),
      // Check if user has favorited this audio
      event.locals.user
        ? AudioFavorite.findOne({
            where: { userId: event.locals.user.id, audioId: audio.id },
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

  return {
    audio: audio.toClientside(true, favoriteCount, isFavorited),
    comments: sortedComments.map((c) => c.toClientside(false, true)),
    mimeType: audio.mimeType,
    isFollowing,
  };
};

export const actions: Actions = {
  delete: async (event) => {
    const user = event.locals.user;
    const audio = await Audio.findByPk(event.params.id, { include: User });
    if (!audio) {
      return fail(404, { message: "Audio not found" });
    }
    if (!user || (!user.isAdmin && user.id !== audio.userId)) {
      return fail(403, {
        message: "You do not have permission to delete this audio.",
      });
    }
    try {
      await fs.unlink(audio.path);
    } catch (err) {
      console.warn(`Could not delete audio file ${audio.path}:`, err);
    }
    try {
      await fs.unlink(audio.transcodedPath);
    } catch (err) {}
    try {
      await audio.destroy();
    } catch (err) {
      console.error(`Could not delete audio record ${audio.id}:`, err);
      return fail(500, {
        message:
          "Could not delete audio from database. It might have comments or other dependencies.",
      });
    }
    return redirect(303, "/");
  },
  add_comment: async (event) => {
    const user = event.locals.user;
    const formData = await event.request.formData();
    const parentId = formData.get("parentId") as string | null;
    const comment = formData.get("comment") as string;

    if (!user) {
      return fail(401, { comment, parentId, message: "Unauthorized" });
    }
    if (!user.isVerified) {
      return fail(403, {
        comment,
        parentId,
        message: "Please verify your email first.",
      });
    }
    if (user.isBanned) {
      return fail(403, { comment, parentId, message: "You are banned" });
    }

    const validation = validateCommentContent(comment);
    if (!validation.valid) {
      return fail(400, { comment, parentId, message: validation.error });
    }

    const result = await createCommentWithNotifications({
      user,
      audioId: event.params.id,
      content: comment,
      parentId,
    });

    if (!result.success) {
      if (result.error === "Audio not found") {
        return fail(404, { comment, parentId, message: result.error });
      }
      return fail(500, { comment, parentId, message: result.error });
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
      return fail(404, {
        message: "The comment you are replying to was not found",
      });
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
      return fail(400, { message: "Comment ID is required" });
    }

    const comment = await Comment.findByPk(commentId, { include: User });
    if (!comment) {
      return fail(404, { message: "Comment not found" });
    }

    // You must be an admin or the comment owner to delete
    if (!user || (!user.isAdmin && user.id !== comment.userId)) {
      return fail(403, {
        message: "You do not have permission to delete this comment.",
      });
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
};
