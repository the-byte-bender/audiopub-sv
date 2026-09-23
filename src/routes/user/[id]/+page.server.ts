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
import { Audio, Comment, User, Stream, AudioFavorite } from "$lib/server/database";
import { error, redirect } from "@sveltejs/kit";
import { Op } from "sequelize";
import type { Actions, PageServerLoad } from "./$types";
import Subscription from "$lib/server/database/models/subscription";
import { subscribe, unsubscribe } from "$lib/server/subscriptions";
import {
    canBeMuted,
    canMute,
    isMuted as isUserMuted,
    mute,
    unmute,
} from "$lib/server/mutes";
import { findUserByProfileParam } from "$lib/server/profiles";

export const load: PageServerLoad = async (event) => {
    const pageString = event.url.searchParams.get("page");
    const page = pageString ? parseInt(pageString, 10) : 1;
    const limit = 30;
    const offset = (page - 1) * limit;
    const profileUser = await findUserByProfileParam(event.params.id);
    if (!profileUser) {
        return redirect(303, "/");
    }

    const [audios, activeStream] = await Promise.all([
        Audio.findAndCountAll({
            where: { userId: profileUser.id },
            include:
                profileUser.isTrusted ||
                event.locals.user?.isAdmin ||
                event.locals.user?.id === profileUser.id
                    ? []
                    : [
                          {
                              model: User,
                              required: true,
                              where: { isTrusted: true },
                          },
                      ],
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        }),
        Stream.findOne({
            where: { userId: profileUser.id, state: { [Op.ne]: "finished" } },
        }),
    ]);

    let clientsideAudios = [];
    for (const audio of audios.rows) {
        const favoriteCount = await AudioFavorite.count({ where: { audioId: audio.id } });
        clientsideAudios.push(audio.toClientside(true, favoriteCount));
    }

    const subscribers = await Subscription.count({
        where: { subscribedToId: profileUser.id }
    });

    const user = event.locals.user;
    let subscription;
    if (user) {
        subscription = await Subscription.findOne({
            where: { subscriberId: user.id, subscribedToId: profileUser.id }
        });
    }
    
    let isSubscribed: boolean;
    if (subscription) isSubscribed = true;
    else isSubscribed = false;

    const isMuted = user ? await isUserMuted(event, profileUser.id) : false;
    const canBeMutedByUser =
        !!user &&
        user.id !== profileUser.id &&
        canMute(user) &&
        canBeMuted(profileUser);

    return {
        isMuted,
        canBeMutedByUser,
        stream: activeStream?.toClientside(false) ?? null,
        audios: clientsideAudios,
        count: audios.count,
        page,
        limit,
        totalPages: Math.ceil(audios.count / limit),
        subscribers,
        isSubscribed,
        profileUser: profileUser.toClientside(),
    };
};
export const actions: Actions = {
    ban: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const userToBeBanned = await findUserByProfileParam(event.params.id);
        if (!userToBeBanned) {
            return error(404, "User not found");
        }
        const form = await event.request.formData();
        const reason = form.get("reason") as string;
        const message = form.get("message") as string;
        await userToBeBanned.ban(reason, message);
        if (!userToBeBanned.isTrusted) {
            // Delete all audios and comments of the user.
            await Audio.destroy({ where: { userId: userToBeBanned.id } });
            await Comment.destroy({ where: { userId: userToBeBanned.id } });
        }
        return redirect(303, `/user/@${encodeURIComponent(userToBeBanned.name)}`);
    },
    warn: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const userToBeWarned = await findUserByProfileParam(event.params.id);
        if (!userToBeWarned) {
            return error(404, "User not found");
        }
        const form = await event.request.formData();
        const reason = form.get("reason") as string;
        const message = form.get("message") as string;
        await userToBeWarned.warn(reason, message);
        return redirect(303, `/user/@${encodeURIComponent(userToBeWarned.name)}`);
    },
    trust: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const userToBeTrusted = await findUserByProfileParam(event.params.id);
        if (!userToBeTrusted) {
            return error(404, "User not found");
        }
        userToBeTrusted.isTrusted = true;
        await userToBeTrusted.save();
    },
    subscribe,
    unsubscribe,
    mute,
    unmute,
};
