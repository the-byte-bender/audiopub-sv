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
import fs from "fs/promises";
import path from "path";
import { Audio, Notification, Subscription, User } from "./database";
import transcode from "./transcode";
import { NotificationTargetType, NotificationType } from "$lib/types";

export const MAX_AUDIO_FILE_SIZE = 1024 * 1024 * 500; // 500 MB

/**
 * Why the user may not upload right now, or null if they may. Accounts still
 * awaiting review get a single upload, so admins have something to review.
 */
export async function getUploadRestriction(user: User): Promise<string | null> {
    if (user.isBanned) {
        return "You are banned";
    }
    if (!user.isVerified) {
        return "Please verify your email first.";
    }
    if (!user.isTrusted) {
        const userAudioCount = await Audio.count({
            where: { userId: user.id },
        });
        if (userAudioCount >= 1) {
            return "Please wait for your account to be reviewed.";
        }
    }
    return null;
}

/**
 * Stores an uploaded file, starts transcoding it in the background and lets
 * the uploader's subscribers know. The input is expected to be validated.
 */
export async function publishAudio(
    user: User,
    file: File,
    title: string,
    description: string,
    isAnnouncement: boolean,
): Promise<Audio> {
    const audio = await Audio.create({
        title,
        description,
        hasFile: true,
        userId: user.id,
        extension: path.extname(file.name),
        isAnnouncement,
    });
    await fs.writeFile(audio.path, Buffer.from(await file.arrayBuffer()));
    transcode(audio.path).catch(async (err) => {
        console.error(err);
        // The audio may have been deleted while it was transcoding, and a
        // failure to clean up must not take the whole server down with it.
        try {
            await audio.destroy();
            await fs.unlink(audio.path);
        } catch (cleanupErr) {
            console.error(cleanupErr);
        }
    });

    const subscriptions = await Subscription.findAll({ where: { subscribedToId: user.id } });
    for (const subscription of subscriptions) {
        await Notification.create({
            userId: subscription.subscriberId,
            actorId: user.id,
            type: NotificationType.upload,
            targetType: NotificationTargetType.audio,
            targetId: audio.id,
        });
    }

    return audio;
}

export async function deleteAudio(audio: Audio): Promise<void> {
    await fs.unlink(audio.path);
    await audio.destroy();
}
