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
import { error, type RequestEvent } from "@sveltejs/kit";
import { Op, type WhereOptions } from "sequelize";
import { Audio, Subscription, User, UserMute } from "./database";
import { findUserByParam } from "./users";

/**
 * Muting is a tool for regular users to curate their own feeds. Admins are
 * exempt on both sides: they moderate instead of muting, and their posts have
 * to stay visible to everyone.
 */
export function canMute(muter: User | null | undefined): boolean {
    return !!muter && !muter.isAdmin;
}

export function canBeMuted(muted: User | null | undefined): boolean {
    return !!muted && !muted.isAdmin;
}

/**
 * The ids of everyone the current user has muted, cached for the request.
 * Empty for logged out users and for admins, who cannot mute.
 */
export async function getMutedUserIds(
    event: RequestEvent | { locals: App.Locals },
): Promise<string[]> {
    const locals = event.locals;
    if (locals.mutedUserIds) {
        return locals.mutedUserIds;
    }
    if (!canMute(locals.user)) {
        locals.mutedUserIds = [];
        return locals.mutedUserIds;
    }
    // Admins are filtered out here rather than only at mute time, so that a
    // muted user who is later promoted stops being hidden from anyone.
    const mutes = await UserMute.findAll({
        where: { muterId: locals.user!.id },
        attributes: ["mutedId"],
        include: [
            {
                model: User,
                as: "muted",
                attributes: [],
                required: true,
                where: { isAdmin: false },
            },
        ],
    });
    locals.mutedUserIds = mutes.map((mute) => mute.mutedId);
    return locals.mutedUserIds;
}

/**
 * A where clause fragment excluding muted uploaders, to be spread into an
 * Audio or Stream query. Empty when nothing is muted, so the SQL stays clean.
 */
export function excludeMutedUsers(
    mutedIds: string[],
    column: string = "userId",
): WhereOptions {
    if (mutedIds.length === 0) {
        return {};
    }
    return { [column]: { [Op.notIn]: mutedIds } };
}

async function findTargetUser(event: RequestEvent): Promise<User | null> {
    if (event.route.id === "/user/[id]") {
        return findUserByParam(event.params.id!);
    }
    if (event.route.id === "/listen/[id]") {
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) {
            return null;
        }
        return User.findByPk(audio.userId);
    }
    return null;
}

export const mute = async (event: RequestEvent): Promise<any> => {
    if (!canMute(event.locals.user)) {
        return error(403, "Forbidden");
    }

    const userToMute = await findTargetUser(event);
    if (!userToMute) {
        return error(404, "User not found");
    }
    return muteUser(event, userToMute);
};

export async function muteUser(
    event: RequestEvent,
    userToMute: User,
): Promise<{ success: true }> {
    const user = event.locals.user;
    if (!canMute(user)) {
        return error(403, "Forbidden");
    }
    if (user!.id === userToMute.id) {
        return error(403, "Forbidden");
    }
    if (!canBeMuted(userToMute)) {
        return error(403, "Administrators cannot be muted");
    }

    try {
        await UserMute.findOrCreate({
            where: { muterId: user!.id, mutedId: userToMute.id },
        });
    } catch {
        return error(500, "Internal error");
    }

    // A subscription you never see the uploads of is just a lie in your
    // subscription list, so muting drops it.
    await Subscription.destroy({
        where: { subscriberId: user!.id, subscribedToId: userToMute.id },
    });

    event.locals.mutedUserIds = undefined;
    return { success: true };
}

export const unmute = async (event: RequestEvent): Promise<any> => {
    if (!event.locals.user) {
        return error(403, "Forbidden");
    }

    const userToUnmute = await findTargetUser(event);
    if (!userToUnmute) {
        return error(404, "User not found");
    }
    return unmuteUser(event, userToUnmute);
};

export async function unmuteUser(
    event: RequestEvent,
    userToUnmute: User,
): Promise<{ success: true }> {
    const user = event.locals.user;
    if (!user) {
        return error(403, "Forbidden");
    }

    const deletedCount = await UserMute.destroy({
        where: { muterId: user.id, mutedId: userToUnmute.id },
    });

    event.locals.mutedUserIds = undefined;

    if (deletedCount > 0) return { success: true };
    else return error(404, "Mute not found");
}

export async function isMuted(
    event: RequestEvent,
    otherUserId: string,
): Promise<boolean> {
    const mutedIds = await getMutedUserIds(event);
    return mutedIds.includes(otherUserId);
}
