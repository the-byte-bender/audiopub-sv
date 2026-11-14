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
 * Of the users a comment would ping directly (by mentioning them or replying
 * to them), the ones it is allowed to reach.
 */
async function reachableBy(
    users: User[],
    audio: Audio,
    actor: User,
): Promise<User[]> {
    let recipients = users.filter(
        (user) => user.id !== actor.id && !user.isBanned,
    );

    // An untrusted uploader's audio is hidden from everyone but its uploader
    // and admins, so nobody else could open the comment they are pinged about.
    if (recipients.length > 0) {
        const uploader = audio.user ?? (await User.findByPk(audio.userId));
        if (uploader && !uploader.isTrusted) {
            recipients = recipients.filter(
                (user) => user.isAdmin || user.id === uploader.id,
            );
        }
    }

    // A direct ping respects mutes. Admins cannot be muted, and mutes an
    // admin made before a promotion no longer count (see getMutedUserIds).
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

    return recipients;
}

/**
 * Of the users a comment mentions, the ones who should hear about it.
 */
async function mentionRecipients(
    comment: Comment,
    audio: Audio,
    actor: User,
): Promise<User[]> {
    let recipients = await reachableBy(
        await findMentionedUsers(comment.content),
        audio,
        actor,
    );

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
 * The author of the comment this one replies to, if they should hear about it.
 * Unlike mentions, replies are not throttled: each one answers something the
 * recipient wrote, the same as the comment notifications an uploader gets.
 */
async function replyRecipient(
    comment: Comment,
    audio: Audio,
    actor: User,
): Promise<User | undefined> {
    if (!comment.parentId) return undefined;

    const parent = await Comment.findByPk(comment.parentId, {
        attributes: ["userId", "audioId", "content"],
    });
    // A deleted comment with replies is kept as "[deleted]"; its author took
    // it back, so replies to it no longer concern them.
    if (
        !parent ||
        parent.audioId !== audio.id ||
        !parent.userId ||
        parent.content === "[deleted]"
    ) {
        return undefined;
    }

    const author = await User.findByPk(parent.userId, {
        attributes: ["id", "isAdmin", "isBanned", "isTrusted"],
    });
    if (!author) return undefined;

    const [recipient] = await reachableBy([author], audio, actor);
    return recipient;
}

/**
 * Notifies everyone who should hear about a new comment. Each person gets one
 * notification at most, the most specific that applies: a mention if the
 * comment @mentions them, else a reply if it answers their comment, else the
 * usual comment notification if they uploaded or follow the audio.
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
    const [mentioned, repliedTo, followers] = await Promise.all([
        mentionRecipients(comment, audio, actor),
        // A failed reply lookup shouldn't cost the mentions and followers
        // their notifications too.
        replyRecipient(comment, audio, actor).catch((err) => {
            console.error("Error finding reply recipient:", err);
            return undefined;
        }),
        AudioFollow.findAll({ where: { audioId: audio.id } as any }),
    ]);
    const mentionedIds = new Set(mentioned.map((user) => user.id));
    const replyRecipientId =
        repliedTo && !mentionedIds.has(repliedTo.id) ? repliedTo.id : undefined;

    const commentRecipientIds = new Set<string>(
        followers.map((follow) => follow.userId),
    );
    if (audio.userId) commentRecipientIds.add(audio.userId);
    commentRecipientIds.delete(actor.id);
    for (const id of mentionedIds) commentRecipientIds.delete(id);
    if (replyRecipientId) commentRecipientIds.delete(replyRecipientId);

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
        ...(replyRecipientId
            ? [notificationFor(replyRecipientId, NotificationType.reply)]
            : []),
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
