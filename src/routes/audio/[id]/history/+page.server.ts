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
import { Audio, AudioEditHistory } from "$lib/server/database";
import { revertAudio } from "$lib/server/audio_actions";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user || !locals.user.isAdmin) {
        throw error(403, "Unauthorized");
    }

    const audio = await Audio.findByPk(params.id);
    if (!audio) {
        throw error(404, "Audio not found");
    }

    const history = await AudioEditHistory.findAll({
        where: { audioId: params.id },
        order: [["createdAt", "DESC"]],
    });

    return {
        audio: audio.toClientside(),
        history: history.map(h => ({
            id: h.id,
            oldTitle: h.oldTitle,
            oldDescription: h.oldDescription,
            newTitle: h.newTitle,
            newDescription: h.newDescription,
            createdAt: h.createdAt.getTime(),
        })),
    };
};

export const actions: Actions = {
    revert: async ({ request, locals }) => {
        if (!locals.user || !locals.user.isAdmin) {
            return fail(403, { message: "Unauthorized" });
        }

        const formData = await request.formData();
        const historyId = formData.get("historyId") as string;

        const result = await revertAudio(locals.user, historyId);

        if (!result.success) {
            return fail(400, { message: result.error });
        }

        return { success: true };
    }
};
