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
import { Op } from "sequelize";
import type { RequestHandler } from "./$types";
import { Stream, Subscription } from "$lib/server/database";
import { StreamState } from "$lib/types";
import { endpoint } from "$lib/server/api";
import { canBeMuted, canMute, isMuted } from "$lib/server/mutes";
import { findUserByParam } from "$lib/server/users";

// A profile, looked up by id or by "@name", and how the viewer relates to it.
export const GET: RequestHandler = endpoint(async (event) => {
    const profileUser = await findUserByParam(event.params.id);
    if (!profileUser) {
        return error(404, "User not found");
    }
    const viewer = event.locals.user;

    const [subscribers, stream, isSubscribed, isProfileUserMuted] =
        await Promise.all([
            Subscription.count({
                where: { subscribedToId: profileUser.id },
            }),
            Stream.findOne({
                where: {
                    userId: profileUser.id,
                    state: { [Op.ne]: StreamState.finished },
                },
            }),
            viewer
                ? Subscription.count({
                      where: {
                          subscriberId: viewer.id,
                          subscribedToId: profileUser.id,
                      },
                  }).then((count) => count > 0)
                : Promise.resolve(false),
            viewer ? isMuted(event, profileUser.id) : Promise.resolve(false),
        ]);

    return json({
        user: profileUser.toClientside(),
        subscribers,
        isSubscribed,
        isMuted: isProfileUserMuted,
        canBeMuted:
            !!viewer &&
            viewer.id !== profileUser.id &&
            canMute(viewer) &&
            canBeMuted(profileUser),
        stream: stream?.toClientside(false) ?? null,
    });
});
