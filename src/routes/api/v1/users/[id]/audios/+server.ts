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
import { Audio, User } from "$lib/server/database";
import {
    endpoint,
    getPage,
    PAGE_SIZE,
    pagination,
    serializeAudios,
} from "$lib/server/api";
import { findUserByParam } from "$lib/server/users";

export const GET: RequestHandler = endpoint(async (event) => {
    const profileUser = await findUserByParam(event.params.id);
    if (!profileUser) {
        return error(404, "User not found");
    }
    const page = getPage(event.url);
    const viewer = event.locals.user;

    // Uploads by an account awaiting review are only shown to the uploader
    // and to admins.
    const isVisible =
        profileUser.isTrusted ||
        viewer?.isAdmin ||
        viewer?.id === profileUser.id;
    const audios = isVisible
        ? await Audio.findAndCountAll({
              where: { userId: profileUser.id },
              include: [User],
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
              order: [["createdAt", "DESC"]],
          })
        : { rows: [], count: 0 };

    return json({
        audios: await serializeAudios(audios.rows, viewer),
        ...pagination(audios.count, page),
    });
});
