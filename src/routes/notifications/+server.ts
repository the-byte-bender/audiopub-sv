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
import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { Notification, User } from "$lib/server/database";
import { Op } from "sequelize";

export const GET: RequestHandler = async ({ locals }) => {
    const user = locals.user;
    if (!user) return json({ unread: 0 });
    const unread = await Notification.count({
        where: {
            userId: user.id,
            readAt: null,
            [Op.or]: [{ "$actor.isTrusted$": true }, { actorId: null }],
        },
        include: [
            {
                model: User,
                as: "actor",
                required: false,
                attributes: ["isTrusted"],
            },
        ],
    });
    return json({ unread });
};
