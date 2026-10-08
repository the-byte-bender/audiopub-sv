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
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { AudioEdit, AudioFollow } from "$lib/server/database";
import {
    endpoint,
    findVisibleAudio,
    getString,
    readJson,
    requireUser,
    serializeAudios,
} from "$lib/server/api";
import {
    AudioEditLimitError,
    AudioNotFoundError,
    MAX_USER_AUDIO_EDITS,
    updateAudioDetails,
} from "$lib/server/audio_edits";
import { deleteAudio } from "$lib/server/audios";

export const GET: RequestHandler = endpoint(async (event) => {
    const audio = await findVisibleAudio(event, event.params.id);
    const viewer = event.locals.user;
    const canEdit = Boolean(
        viewer && (viewer.isAdmin || viewer.id === audio.userId),
    );

    const [[serialized], isFollowing, userEditCount] = await Promise.all([
        serializeAudios([audio], viewer),
        viewer
            ? AudioFollow.count({
                  where: { userId: viewer.id, audioId: audio.id } as any,
              }).then((count) => count > 0)
            : Promise.resolve(false),
        canEdit && !viewer!.isAdmin
            ? AudioEdit.count({
                  where: { audioId: audio.id, isAdminEdit: false },
              })
            : Promise.resolve(0),
    ]);

    return json({
        audio: serialized,
        mimeType: audio.mimeType,
        archivedStreamId: audio.archivedStreamId,
        isFollowing,
        canEdit,
        // Admins edit without a limit, and null also covers everyone who
        // cannot edit at all.
        remainingEdits:
            canEdit && !viewer!.isAdmin
                ? Math.max(0, MAX_USER_AUDIO_EDITS - userEditCount)
                : null,
    });
});

export const PATCH: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const audio = await findVisibleAudio(event, event.params.id);
    if (!user.isAdmin && user.id !== audio.userId) {
        return error(403, "Forbidden");
    }
    if (!user.isAdmin && (user.isBanned || !user.isVerified)) {
        return error(403, "Forbidden");
    }

    const body = await readJson(event);
    const title = (getString(body, "title") ?? audio.title).trim();
    const description = getString(body, "description") ?? audio.description;
    if (title.length < 3 || title.length > 120) {
        return error(400, "Title must be between 3 and 120 characters");
    }
    if (description.length > 5000) {
        return error(400, "Description must not exceed 5000 characters");
    }

    try {
        await updateAudioDetails(audio.id, user, title, description);
    } catch (err) {
        if (err instanceof AudioEditLimitError) {
            return error(
                403,
                `You have reached the limit of ${MAX_USER_AUDIO_EDITS} edits`,
            );
        }
        if (err instanceof AudioNotFoundError) {
            return error(404, "Audio not found");
        }
        throw err;
    }

    await audio.reload();
    const [serialized] = await serializeAudios([audio], user);
    return json({ audio: serialized });
});

export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const audio = await findVisibleAudio(event, event.params.id);
    if (!user.isAdmin && user.id !== audio.userId) {
        return error(403, "Forbidden");
    }

    await deleteAudio(audio);
    return json({ success: true });
});
