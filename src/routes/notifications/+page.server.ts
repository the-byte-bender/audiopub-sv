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

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;
    if (!user) {
        return { notifications: [] };
    }

    const list = await Notification.findAll({
        where: { [Op.or]: [{ userId: user.id }, { userId: null }] } as any,
        order: [["createdAt", "DESC"]],
        limit: 100,
    });

    const resolved = await Notification.resolveMany(list);

    const now = new Date();
    await Notification.update(
        { readAt: now },
        { where: { userId: user.id, readAt: null } as any }
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
        const id = form.get('id') as string;
        if (!id) return { success: false };

        await Notification.destroy({ where: { id, userId: user.id } as any });
        return { success: true };
    }
};
