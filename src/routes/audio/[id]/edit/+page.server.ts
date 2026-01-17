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
import { error, redirect, fail } from "@sveltejs/kit";
import { Audio } from "$lib/server/database";
import { editAudio } from "$lib/server/audio_actions";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        throw redirect(303, "/login");
    }

    const audio = await Audio.findByPk(params.id);
    if (!audio) {
        throw error(404, "Audio not found");
    }

    const isAdmin = locals.user.isAdmin;
    const isOwner = audio.userId === locals.user.id;

    if (!isAdmin && !isOwner) {
        throw error(403, "Unauthorized");
    }

    if (!isAdmin && (audio.editCount ?? 0) >= 3) {
        throw error(403, "Edit limit reached");
    }

    return {
        audio: audio.toClientside(),
    };
};

export const actions: Actions = {
    edit: async ({ request, params, locals }) => {
        if (!locals.user) {
            return fail(401, { message: "Unauthorized" });
        }

        const formData = await request.formData();
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;

        const result = await editAudio({
            user: locals.user,
            audioId: params.id,
            title,
            description,
        });

        if (!result.success) {
            return fail(400, { message: result.error, title, description });
        }

        throw redirect(303, `/listen/${params.id}`);
    }
};
