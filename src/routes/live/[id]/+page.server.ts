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
import { ReactionTargetType, type ClientsideStreamMute } from "$lib/types";
import { summarizeReactions } from "$lib/server/reactions";
import { getPollsForStream } from "$lib/server/polls";

export const load: PageServerLoad = async (event) => {
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

    const chats = stream.streamChats ?? [];
    const chatReactions = await summarizeReactions(
        ReactionTargetType.streamChat,
        chats.map((c) => c.id),
        viewer?.id,
    );

    return {
        stream: stream.toClientside(true),
        chats: chats.map((c) =>
            c.toClientside(false, chatReactions.get(c.id) ?? []),
        ),
        mutes,
        slowModeSeconds: stream.slowModeSeconds,
        polls: await getPollsForStream(
            stream.id,
            viewer?.id,
            Boolean(canModerate),
        ),
    };
};
