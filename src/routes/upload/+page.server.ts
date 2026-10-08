/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2024 the-byte-bender
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
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { Audio, User } from "$lib/server/database";
import {
    getUploadRestriction,
    MAX_AUDIO_FILE_SIZE,
    publishAudio,
} from "$lib/server/audios";

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;
    if (!user) {
        return redirect(303, "/login");
    }

    // Admin notices are pinned above the form so uploaders read them before
    // submitting anything.
    const announcements = await Audio.findAll({
        where: { isAnnouncement: true, hasFile: true },
        include: [User],
        order: [["createdAt", "DESC"]],
    });

    return {
        announcements: announcements.map((audio) => ({
            ...audio.toClientside(),
            mimeType: audio.mimeType,
        })),
    };
};

export const actions: Actions = {
    default: async (event) => {
        const user = event.locals.user;
        if (!user) {
            return redirect(303, "/login");
        }
        const restriction = await getUploadRestriction(user);
        if (restriction) {
            return error(403, restriction);
        }

        const form = await event.request.formData();
        const file = form.get("file") as File;
        const title = form.get("title") as string;
        const description = form.get("description") as string;
        // Only admins may pin an audio; the checkbox is not rendered for others
        // and is ignored here even if it is forged.
        const isAnnouncement = user.isAdmin && form.get("isAnnouncement") === "on";
        if (!file) {
            return fail(400, { title, description });
        }
        if (!title) {
            return fail(400, { title, description });
        }
        if (title.length < 3 || title.length > 120) {
            return fail(400, { title, description });
        }
        if (description && description.length > 5000) {
            return fail(400, { title, description });
        }
        if (file.size > MAX_AUDIO_FILE_SIZE) {
            return fail(400, { title, description });
        }
        const audio = await publishAudio(
            user,
            file,
            title,
            description,
            isAnnouncement,
        );

        return redirect(303, `/listen/${audio.id}`);
    },
};
