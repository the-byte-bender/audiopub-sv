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
import fs from "fs/promises";
import path from "path";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { Audio } from "$lib/server/database";
import transcode from "$lib/server/transcode";

export const load: PageServerLoad = (event) => {
    const user = event.locals.user;
    if (!user) {
        return redirect(303, "/login");
    }
};

export const actions: Actions = {
    default: async (event) => {
        const user = event.locals.user;
        if (!user) {
            return redirect(303, "/login");
        }
        if (user.isBanned) {
            return error(403, "You are banned");
        }
        if (!user.isVerified) {
            return error(403, "Please verify your email first.");
        }
        if (!user.isTrusted) {
            const userAudioCount = await Audio.count({
                where: { userId: user.id },
            });
            if (userAudioCount >= 1) {
                return error(
                    403,
                    "Please wait for your account to be reviewed."
                );
            }
        }
        const form = await event.request.formData();
        const file = form.get("file") as File;
        const title = form.get("title") as string;
        const description = form.get("description") as string;
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
        if (file.size > 1024 * 1024 * 500) {
            // 500 MB
            return fail(400, { title, description });
        }
        const audio = await Audio.create({
            title,
            description,
            hasFile: true,
            userId: user.id,
            extension: path.extname(file.name),
        });
        await fs.writeFile(audio.path, Buffer.from(await file.arrayBuffer()));
        transcode(audio.path).catch(async (err) => {
            console.error(err);
            await audio.destroy();
            await fs.unlink(audio.path);
        });
        return redirect(303, `/listen/${audio.id}`);
    },
};
