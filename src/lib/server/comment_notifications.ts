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
import { Op } from "sequelize";
import {
    Audio,
    AudioFollow,
    Comment,
    Notification,
    User,
    UserMute,
} from "$lib/server/database";
import { findMentionedUsers } from "$lib/server/mentions";
import { MAX_MENTIONS_PER_COMMENT } from "$lib/mentions";
import { NotificationTargetType, NotificationType } from "$lib/types";

/**
 * Of the users a comment mentions, the ones who should hear about it.
 */
async function mentionRecipients(
    comment: Comment,
    audio: Audio,
    actor: User,
): Promise<User[]> {
    let recipients = (await findMentionedUsers(comment.content)).filter(
        (user) => user.id !== actor.id && !user.isBanned,
    );

    // An untrusted uploader's audio is hidden from everyone but its uploader
    // and admins, so nobody else could open the comment they are pinged about.
    const uploader = audio.user ?? (await User.findByPk(audio.userId));
    if (uploader && !uploader.isTrusted) {
        recipients = recipients.filter(
            (user) => user.isAdmin || user.id === uploader.id,
        );
    }

    // A mention is the most direct ping there is, so it respects mutes. Admins
    // cannot be muted, and mutes an admin made before a promotion no longer
    // count (see getMutedUserIds).
    if (!actor.isAdmin && recipients.length > 0) {
        const muterIds = new Set(
            (
                await UserMute.findAll({
                    where: {
                        mutedId: actor.id,
                        muterId: { [Op.in]: recipients.map((user) => user.id) },
                    },
                    attributes: ["muterId"],
                })
            ).map((mute) => mute.muterId),
        );
        recipients = recipients.filter(
            (user) => user.isAdmin || !muterIds.has(user.id),
        );
    }

    // Anyone can mention anyone, so keep it to one unread mention per author:
    // until the last one is read, more from the same person add nothing.
    if (recipients.length > 0) {
        const alreadyPinged = new Set(
            (
                await Notification.findAll({
                    where: {
                        type: NotificationType.mention,
                        actorId: actor.id,
                        readAt: null,
                        userId: { [Op.in]: recipients.map((user) => user.id) },
                    },
                    attributes: ["userId"],
                })
            ).map((notification) => notification.userId),
        );
        recipients = recipients.filter((user) => !alreadyPinged.has(user.id));
    }

    return recipients.slice(0, MAX_MENTIONS_PER_COMMENT);
}

/**
 * Notifies everyone who should hear about a new comment: the people it
 * @mentions get a mention, and the audio's uploader and followers get the
 * usual comment notification, unless they were already mentioned.
 *
 * Never throws: the comment is already saved by the time this runs, and
 * failing the request would only make the author post it again.
 */
export async function notifyAboutComment(
    comment: Comment,
    audio: Audio,
    actor: User,
): Promise<void> {
    try {
        await sendCommentNotifications(comment, audio, actor);
    } catch (err) {
        console.error("Error sending comment notifications:", err);
    }
}

async function sendCommentNotifications(
    comment: Comment,
    audio: Audio,
    actor: User,
): Promise<void> {
    const mentioned = await mentionRecipients(comment, audio, actor);
    const mentionedIds = new Set(mentioned.map((user) => user.id));

    const followers = await AudioFollow.findAll({
        where: { audioId: audio.id } as any,
    });
    const commentRecipientIds = new Set<string>(
        followers.map((follow) => follow.userId),
    );
    if (audio.userId) commentRecipientIds.add(audio.userId);
    commentRecipientIds.delete(actor.id);
    for (const id of mentionedIds) commentRecipientIds.delete(id);

    const notificationFor = (userId: string, type: NotificationType) => ({
        userId,
        actorId: actor.id,
        type,
        targetType: NotificationTargetType.comment,
        targetId: comment.id,
        metadata: { audioId: audio.id },
    });
    const payloads = [
        ...[...mentionedIds].map((id) =>
            notificationFor(id, NotificationType.mention),
        ),
        ...[...commentRecipientIds].map((id) =>
            notificationFor(id, NotificationType.comment),
        ),
    ];

    if (payloads.length) {
        // individualHooks runs the push notification hook for each row.
        await Notification.bulkCreate(payloads as any, {
            individualHooks: true,
        });
    }
}
