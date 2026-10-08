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
import { Audio, Stream, Subscription, User } from "$lib/server/database";
import { StreamState } from "$lib/types";
import {
    endpoint,
    getPage,
    PAGE_SIZE,
    pagination,
    requireUser,
    serializeAudios,
} from "$lib/server/api";

/*
 * The feed of everyone the viewer is subscribed to, like the subscriptions
 * page: their uploads, newest first, and on the first page whoever of them is
 * live right now.
 */
export const GET: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const page = getPage(event.url);

    const subscriptions = await Subscription.findAll({
        where: { subscriberId: user.id },
    });
    const subscribedToIds = subscriptions.map(
        (subscription) => subscription.subscribedToId,
    );

    const [audios, streams] = await Promise.all([
        Audio.findAndCountAll({
            where: { userId: { [Op.in]: subscribedToIds } },
            include: [User],
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            order: [["createdAt", "DESC"]],
        }),
        page === 1
            ? Stream.findAll({
                  where: {
                      state: StreamState.active,
                      userId: { [Op.in]: subscribedToIds },
                  },
                  include: [User],
                  order: [["createdAt", "DESC"]],
              })
            : Promise.resolve([]),
    ]);

    return json({
        streams: streams.map((stream) => stream.toClientside(true)),
        audios: await serializeAudios(audios.rows, user),
        ...pagination(audios.count, page),
    });
});
