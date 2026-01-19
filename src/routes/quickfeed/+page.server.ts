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
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { getQuickfeedPage } from "$lib/server/quickfeed";
import { createCommentWithNotifications, validateCommentContent } from "$lib/server/interactions";

export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;

    const result = await getQuickfeedPage({
        page,
        isAdmin: event.locals.user?.isAdmin || false,
        currentUser: event.locals.user || null,
    });

    return {
        audios: result.audios,
        count: result.count,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        user: event.locals.user?.toClientside() || null,
        isAdmin: event.locals.user?.isAdmin || false,
    };
};

export const actions: Actions = {
    favorite: async (event) => {
        const user = event.locals.user;
        if (!user) {
            return fail(401, { message: "Must be logged in" });
        }
        if (!user.isTrusted || user.isBanned) {
            return fail(403, { message: "Forbidden" });
        }

        const formData = await event.request.formData();
        const audioId = formData.get('audioId') as string;

        if (!audioId) {
            return fail(400, { message: "Missing audioId" });
        }

        try {
            // Use the model method that handles notifications
            const favorite = await AudioFavorite.createFavorite(user.id, audioId);
            if (!favorite) {
                // Already favorited, that's fine
                return { success: true };
            }
            return { success: true };
        } catch (error) {
            console.error('Error favoriting audio:', error);
            return fail(500, { message: "Failed to favorite audio" });
        }
    },

    unfavorite: async (event) => {
        const user = event.locals.user;
        if (!user) {
            return fail(401, { message: "Must be logged in" });
        }
        if (!user.isTrusted || user.isBanned) {
            return fail(403, { message: "Forbidden" });
        }

        const formData = await event.request.formData();
        const audioId = formData.get('audioId') as string;

        if (!audioId) {
            return fail(400, { message: "Missing audioId" });
        }

        try {
            // Use the model method that cleans up notifications
            await AudioFavorite.removeFavorite(user.id, audioId);
            return { success: true };
        } catch (error) {
            console.error('Error unfavoriting audio:', error);
            return fail(500, { message: "Failed to unfavorite audio" });
        }
    },

    add_comment: async (event) => {
        const user = event.locals.user;
        if (!user) {
            return fail(401, { message: "Must be logged in" });
        }

        if (user.isBanned) {
            return fail(403, { message: "Banned users cannot comment" });
        }

        const formData = await event.request.formData();
        const audioId = formData.get("audioId") as string;
        const comment = formData.get("comment") as string;

        if (!audioId) {
            return fail(400, { message: "Missing audioId" });
        }

        const validation = validateCommentContent(comment);
        if (!validation.valid) {
            return fail(400, { comment, message: validation.error });
        }

        const result = await createCommentWithNotifications({
            user,
            audioId,
            content: comment,
        });

        if (!result.success) {
            if (result.error === "Audio not found") {
                return fail(404, { comment, message: result.error });
            }
            return fail(500, { message: result.error });
        }

        return { success: true, comment: result.comment?.toClientside() };
    }
};