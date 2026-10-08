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
import { Op } from "sequelize";
import type { RequestHandler } from "./$types";
import { Notification } from "$lib/server/database";
import {
    endpoint,
    getPage,
    PAGE_SIZE,
    pagination,
    requireUser,
} from "$lib/server/api";
import { excludeMutedActors, getMutedUserIds } from "$lib/server/mutes";

/*
 * Newest first. Unlike the notifications page, reading the list does not mark
 * anything as read; clients do that explicitly with POST notifications/read.
 */
export const GET: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const page = getPage(event.url);
    const mutedUserIds = await getMutedUserIds(event);

    const notifications = await Notification.findAndCountAll({
        where: {
            [Op.and]: [
                { [Op.or]: [{ userId: user.id }, { userId: null }] },
                excludeMutedActors(mutedUserIds),
            ],
        },
        order: [["createdAt", "DESC"]],
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
    });

    return json({
        notifications: await Notification.resolveMany(notifications.rows),
        ...pagination(notifications.count, page),
    });
});

export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    await Notification.destroy({ where: { userId: user.id } });
    return json({ success: true });
});
