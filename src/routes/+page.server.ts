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
import type { PageServerLoad } from "./$types";
import { type OrderItem, Sequelize } from "sequelize";

export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;
    const sortField = event.url.searchParams.get("sort") || "createdAt";
    const sortOrder = event.url.searchParams.get("order") || "DESC";

    const validSortFields = ["createdAt", "plays", "title", "random"];
    const validSortOrders = ["ASC", "DESC"];
    const validatedSortField = validSortFields.includes(sortField)
        ? sortField
        : "createdAt";
    const validatedSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

    const limit = 30;
    const offset = (page - 1) * limit;
    const isFromAi = event.locals.isFromAi;

    // Define the order based on validated parameters
    let order: OrderItem[] | undefined;
    if (validatedSortField === "random") {
        // Use Sequelize.fn('RAND') for MariaDB/MySQL random ordering
        order = [Sequelize.fn('RAND')];
    } else {
        order = [[validatedSortField, validatedSortOrder]];
    }

    const audios = await Audio.findAndCountAll({
        limit,
        offset,
        order,
        include: {
            model: User,
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
        },
        where: { isFromAi },
    });
    return {
        audios: audios.rows.map((audio) => audio.toClientside()),
        count: audios.count,
        page,
        limit,
        totalPages: Math.ceil(audios.count / limit),
        sortField: validatedSortField,
        sortOrder: validatedSortOrder,
    };
};
