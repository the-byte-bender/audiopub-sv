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
import { Audio, AudioFollow, Comment, Notification, User } from "./database";

/**
 * Posts a comment and notifies the uploader and everyone following the audio,
 * except the commenter themselves.
 */
export async function addComment(
    user: User,
    audio: Audio,
    content: string,
    parentId: string | null,
): Promise<Comment> {
    const comment = await Comment.create({
        userId: user.id,
        audioId: audio.id,
        parentId,
        content,
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
        targetId: comment.id,
        metadata: { audioId: audio.id },
    }));
    if (payloads.length) {
        await Notification.bulkCreate(payloads as any, { individualHooks: true });
    }

    return comment;
}

/**
 * Removes a comment. One that has replies is blanked instead, so the thread
 * under it stays readable.
 */
export async function deleteComment(comment: Comment): Promise<void> {
    // We should be able to use mixin methods here, but even after declaring their types
    // explicitly, they just don't work.
    const replyCount = await Comment.count({
        where: { parentId: comment.id },
    });
    if (replyCount > 0) {
        comment.content = "[deleted]";
        await comment.save();
        return;
    }

    await comment.destroy();
}
