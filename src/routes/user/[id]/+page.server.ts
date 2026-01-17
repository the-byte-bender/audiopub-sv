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
import { Audio, Comment, User } from "$lib/server/database";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;
    const limit = 30;
    const offset = (page - 1) * limit;
    const profileUser = await User.findByPk(event.params.id);
    if (!profileUser) {
        return redirect(303, "/");
    }
    const audios = await Audio.findAndCountAll({
        where: { userId: profileUser.id},
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
            return fail(403, { message: "Forbidden" });
        }
        const userToBeBanned = await User.findByPk(event.params.id);
        if (!userToBeBanned) {
            return fail(404, { message: "User not found" });
        }
        const form = await event.request.formData();
        const reason = form.get("reason") as string;
        const message = form.get("message") as string;
        await userToBeBanned.ban(reason, message);
        if (!userToBeBanned.isTrusted){
            // Delete all audios and comments of the user.
            await Audio.destroy({ where: { userId: userToBeBanned.id } });
            await Comment.destroy({ where: { userId: userToBeBanned.id } });
        }
        return redirect(303, `/user/${userToBeBanned.id}`);
    },
    warn: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return fail(403, { message: "Forbidden" });
        }
        const userToBeWarned = await User.findByPk(event.params.id);
        if (!userToBeWarned) {
            return fail(404, { message: "User not found" });
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
            return fail(403, { message: "Forbidden" });
        }
        const userToBeTrusted = await User.findByPk(event.params.id);
        if (!userToBeTrusted) {
            return fail(404, { message: "User not found" });
        }
        userToBeTrusted.isTrusted = true;
        await userToBeTrusted.save();
    },
};
