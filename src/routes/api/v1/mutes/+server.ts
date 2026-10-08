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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { User, UserMute } from "$lib/server/database";
import {
    endpoint,
    getPage,
    PAGE_SIZE,
    pagination,
    requireUser,
} from "$lib/server/api";
import { canMute } from "$lib/server/mutes";

export const GET: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const page = getPage(event.url);
    const mutes = await UserMute.findAndCountAll({
        where: { muterId: user.id },
        include: [{ model: User, as: "muted", required: true }],
        order: [["createdAt", "DESC"]],
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
    });

    return json({
        // Admins cannot mute, but may still have mutes from before they were
        // promoted, which they can remove.
        canMute: canMute(user),
        mutes: mutes.rows.map((mute) => ({
            id: mute.id,
            createdAt: mute.createdAt.getTime(),
            user: mute.muted!.toClientside(),
        })),
        ...pagination(mutes.count, page),
    });
});
