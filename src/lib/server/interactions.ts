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
import { Audio, Comment, AudioFollow, Notification, User } from "$lib/server/database";
import type User_model from "$lib/server/database/models/user";
import type CommentModel from "$lib/server/database/models/comment";

export interface CreateCommentOptions {
    user: User_model;
    audioId: string;
    content: string;
    parentId?: string | null;
}

export interface CreateCommentResult {
    success: boolean;
    comment?: CommentModel;
    error?: string;
}

/**
 * Parses mentions in a text and creates notifications.
 * @param text The text to parse for @usernames
 * @param actorId The user who made the mention
 * @param targetType 'audio' or 'comment'
 * @param targetId The ID of the audio or comment
 * @param metadata Additional metadata (e.g. { audioId })
 */
export async function handleMentions(
    text: string, 
    actorId: string, 
    targetType: "audio" | "comment", 
    targetId: string, 
    metadata: any = {}
) {
    const mentionRegex = /@([a-zA-Z0-9_]{3,24})/g;
    const matches = text.matchAll(mentionRegex);
    const usernames = new Set<string>();
    
    for (const match of matches) {
        usernames.add(match[1]);
    }

    if (usernames.size === 0) return;

    const mentionedUsers = await User.findAll({
        where: { name: Array.from(usernames) }
    });

    const payloads = mentionedUsers
        .filter(u => u.id !== actorId) // Don't notify yourself
        .map(u => ({
            userId: u.id,
            actorId: actorId,
            type: "mention" as const,
            targetType,
            targetId,
            metadata,
        }));

    if (payloads.length > 0) {
        await Notification.bulkCreate(payloads as any);
    }
}

/**
 * Creates a comment and sends notifications to the audio owner and followers.
 * This is the centralized logic used by both Listen and Quickfeed.
 */
export async function createCommentWithNotifications(options: CreateCommentOptions): Promise<CreateCommentResult> {
    const { user, audioId, content, parentId } = options;

    // Check if audio exists
    const audio = await Audio.findByPk(audioId);
    if (!audio) {
        return { success: false, error: "Audio not found" };
    }

    try {
        const commentInDatabase = await Comment.create({
            userId: user.id,
            audioId: audio.id,
            parentId: parentId || null,
            content,
        });

        // Handle mentions
        await handleMentions(content, user.id, "comment", commentInDatabase.id, { audioId: audio.id });

        // Send notifications to followers and audio owner
        const followers = await AudioFollow.findAll({
            where: { audioId: audio.id } as any,
        });
        const followerIds = new Set<string>(followers.map((f) => f.userId));
        
        // Always notify audio owner
        if (audio.userId) {
            followerIds.add(audio.userId);
        }
        
        // Don't notify the commenter themselves
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

        return { success: true, comment: commentInDatabase };
    } catch (error) {
        console.error('Error creating comment:', error);
        return { success: false, error: "Failed to create comment" };
    }
}

/**
 * Validates comment content before creation.
 */
export function validateCommentContent(content: string): { valid: boolean; error?: string } {
    if (!content) {
        return { valid: false, error: "Comment is required" };
    }
    if (content.length < 3 || content.length > 4000) {
        return { valid: false, error: "Comment must be between 3 and 4000 characters" };
    }
    return { valid: true };
}
