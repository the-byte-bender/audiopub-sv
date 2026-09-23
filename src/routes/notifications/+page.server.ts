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

import type { Actions, PageServerLoad } from "./$types";
import { Notification } from "$lib/server/database";
import { Op } from "sequelize";
import { getMutedUserIds } from "$lib/server/mutes";
import { attachMentions } from "$lib/server/mentions";
import { NotificationTargetType, type ClientsideComment } from "$lib/types";

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;
    if (!user) {
        return { notifications: [] };
    }

    const mutedUserIds = await getMutedUserIds(event);

    const list = await Notification.findAll({
        where: {
            [Op.and]: [
                { [Op.or]: [{ userId: user.id }, { userId: null }] },
                // actorId is null on system notifications, which are never muted.
                ...(mutedUserIds.length > 0
                    ? [
                          {
                              [Op.or]: [
                                  { actorId: null },
                                  { actorId: { [Op.notIn]: mutedUserIds } },
                              ],
                          },
                      ]
                    : []),
            ],
        },
        order: [["createdAt", "DESC"]],
        limit: 100,
    });

    const resolved = await Notification.resolveMany(list);
    await attachMentions(
        resolved
            .filter(
                (n) => n.targetType === NotificationTargetType.comment && n.target,
            )
            .map((n) => n.target as ClientsideComment),
    );

    const now = new Date();
    await Notification.update(
        { readAt: now },
        { where: { userId: user.id, readAt: null } }
    );

    return { notifications: resolved };
};

export const actions: Actions = {
    clear_all: async (event) => {
        const user = event.locals.user;
        if (!user) return { success: false };
        await Notification.destroy({ where: { userId: user.id } as any });
        return { success: true };
    },
    delete: async (event) => {
        const user = event.locals.user;
        if (!user) return { success: false };
        const form = await event.request.formData();
        const id = form.get("id") as string;
        if (!id) return { success: false };

        await Notification.destroy({ where: { id, userId: user.id } as any });
        return { success: true };
    },
};
