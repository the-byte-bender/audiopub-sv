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
import {
    Stream,
    User,
    StreamChat,
    Audio,
    StreamMute,
} from "$lib/server/database";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { Op } from "sequelize";
import type { ClientsideStreamMute } from "$lib/types";
import { isUsernameParam } from "$lib/live_links";
import { resolveLiveUsername } from "$lib/server/live_links";

export const load: PageServerLoad = async (event) => {
    /*
     * "@username" is the shareable alias for whatever this account is
     * broadcasting right now; it redirects to the uuid link rather than
     * rendering here, so there stays exactly one canonical page per stream and
     * the chat, SSE and moderation endpoints -- which all address a stream by
     * id -- need no changes. Checked before the findByPk below because a name
     * is not a stream id and would simply miss.
     */
    if (isUsernameParam(event.params.id)) {
        const resolved = await resolveLiveUsername(event.params.id);
        if (resolved.kind === "live") {
            return redirect(302, `/live/${resolved.streamId}`);
        }
        if (resolved.kind === "not_live") {
            return error(404, {
                message: `${resolved.displayName} is not broadcasting right now.`,
                live: {
                    reason: "not_live",
                    userName: resolved.userName,
                    displayName: resolved.displayName,
                },
            });
        }
        return error(404, {
            message: "There is no account with that name.",
            live: { reason: "no_user", userName: resolved.userName },
        });
    }

    const stream = await Stream.findByPk(event.params.id, {
        include: [
            User,
            {
                model: StreamChat,
                include: [User],
                separate: true,
                order: [["createdAt", "ASC"]],
            },
        ],
    });

    if (!stream || stream.state === "finished") {
        return redirect(302, `/listen/${event.params.id}`);
    }

    const viewer = event.locals.user;
    const canModerate =
        viewer && (viewer.id === stream.userId || viewer.isAdmin);

    let mutes: ClientsideStreamMute[] = [];
    if (canModerate) {
        const muteRows = await StreamMute.findAll({
            where: {
                streamId: stream.id,
                [Op.or]: [
                    { expiresAt: null },
                    { expiresAt: { [Op.gt]: new Date() } },
                ],
            },
            include: [User],
            order: [["createdAt", "DESC"]],
        });
        mutes = muteRows.map((m) => ({
            id: m.id,
            userId: m.userId,
            userName: m.user?.name ?? "unknown",
            displayName: m.user?.displayName ?? "Unknown",
            expiresAt: m.expiresAt ? m.expiresAt.getTime() : null,
            reason: m.reason,
            createdAt: m.createdAt.getTime(),
        }));
    }

    return {
        stream: stream.toClientside(true),
        chats: stream.streamChats?.map((c) => c.toClientside()),
        mutes,
        slowModeSeconds: stream.slowModeSeconds,
    };
};
