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
import { Audio, User } from "$lib/server/database";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;
    const limit = 30;
    const offset = (page - 1) * limit;
    const isFromAi = event.locals.isFromAi;
    const profileUser = await User.findByPk(event.params.id);
    if (!profileUser) {
        return redirect(303, "/");
    }
    const audios = await Audio.findAndCountAll({
        where: { userId: profileUser.id, isFromAi },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
    });
    return {
        audios: audios.rows.map((audio) => audio.toClientside()),
        count: audios.count,
        page,
        limit,
        totalPages: Math.ceil(audios.count / limit),
        profileUser: profileUser.toClientside(),
    };
};
export const actions: Actions = {
    ban: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const userToBeBanned = await User.findByPk(event.params.id);
        if (!userToBeBanned) {
            return error(404, "User not found");
        }
        const form = await event.request.formData();
        const reason = form.get("reason") as string;
        const message = form.get("message") as string;
        await userToBeBanned.ban(reason, message);
        return redirect(303, `/user/${userToBeBanned.id}`);
    },
    warn: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const userToBeWarned = await User.findByPk(event.params.id);
        if (!userToBeWarned) {
            return error(404, "User not found");
        }
        const form = await event.request.formData();
        const reason = form.get("reason") as string;
        const message = form.get("message") as string;
        await userToBeWarned.warn(reason, message);
        return redirect(303, `/user/${userToBeWarned.id}`);
    },
    trust: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const userToBeTrusted = await User.findByPk(event.params.id);
        if (!userToBeTrusted) {
            return error(404, "User not found");
        }
        userToBeTrusted.isTrusted = true;
        await userToBeTrusted.save();
    },
};
