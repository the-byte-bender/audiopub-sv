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
import { Op, Sequelize } from "sequelize";
import type { RequestHandler } from "./$types";
import { Audio, User } from "$lib/server/database";
import {
    endpoint,
    getFlag,
    getPage,
    PAGE_SIZE,
    pagination,
    serializeAudios,
} from "$lib/server/api";
import { getMutedUserIds } from "$lib/server/mutes";

/*
 * Full text search over audio titles and descriptions.
 * As on the search page, muted uploaders are left out unless includeMuted is
 * set, and hiddenByMutes says how many matches that kept out.
 */
export const GET: RequestHandler = endpoint(async (event) => {
    const query = event.url.searchParams.get("q")?.trim();
    if (!query || query.length < 3) {
        return error(400, "Query must be at least 3 characters long");
    }
    const page = getPage(event.url);
    const includeMuted = getFlag(event.url, "includeMuted");
    const mutedUserIds = await getMutedUserIds(event);
    const mutesApply = !includeMuted && mutedUserIds.length > 0;

    const matchesQuery = Sequelize.literal(
        `MATCH(title, description) AGAINST(:query IN NATURAL LANGUAGE MODE)`,
    );
    const userFilter = {
        model: User,
        where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
    };

    // count() forwards replacements at runtime, but sequelize's CountOptions
    // type does not list them, hence the cast on its options object.
    const [audios, hiddenByMutes] = await Promise.all([
        Audio.findAndCountAll({
            where: mutesApply
                ? {
                      [Op.and]: [
                          matchesQuery,
                          { userId: { [Op.notIn]: mutedUserIds } },
                      ],
                  }
                : matchesQuery,
            replacements: { query },
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            include: userFilter,
        }),
        mutesApply
            ? Audio.count({
                  where: {
                      [Op.and]: [
                          matchesQuery,
                          { userId: { [Op.in]: mutedUserIds } },
                      ],
                  },
                  replacements: { query },
                  include: userFilter,
              } as Parameters<typeof Audio.count>[0])
            : Promise.resolve(0),
    ]);

    return json({
        audios: await serializeAudios(audios.rows, event.locals.user),
        ...pagination(audios.count, page),
        hiddenByMutes,
    });
});
