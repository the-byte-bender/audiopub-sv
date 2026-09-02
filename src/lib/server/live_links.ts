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

/*
 * The stable, shareable form of a live link: /live/@alice instead of
 * /live/<uuid>. A broadcaster can only have one unfinished stream at a time
 * (enforced in /live/new), so the name is enough to identify "whatever they are
 * broadcasting right now" -- which means the link survives from one broadcast
 * to the next and can sit in a bio or a signature unchanged.
 *
 * The "@" is what keeps this from colliding with the uuid links that listeners
 * already hold: a uuid can never start with one, so the same [id] route can
 * tell the two apart without a lookup, and the old links keep resolving exactly
 * as they did.
 */
import { Op } from "sequelize";
import { Stream, User } from "$lib/server/database";
import { StreamState } from "$lib/types";
import { USERNAME_PREFIX } from "$lib/live_links";

export type LiveUsernameResolution =
    /** The account exists and has a stream that has not finished. */
    | { kind: "live"; streamId: string; userName: string; displayName: string }
    /** No account by that name. */
    | { kind: "no_user"; userName: string }
    /** The account exists but is not broadcasting at the moment. */
    | { kind: "not_live"; userName: string; displayName: string };

/**
 * Resolves the "@username" form of a /live/[id] parameter to the broadcaster's
 * current stream. Takes the parameter with its "@" still attached, as it
 * arrives from the router.
 */
export async function resolveLiveUsername(
    param: string,
): Promise<LiveUsernameResolution> {
    // Names are stored lowercase (User.normalizeData), so the link is
    // case-insensitive without the caller having to think about it.
    const userName = param.slice(USERNAME_PREFIX.length).toLowerCase();
    if (!userName) {
        return { kind: "no_user", userName };
    }

    const user = await User.findOne({ where: { name: userName } });
    if (!user) {
        return { kind: "no_user", userName };
    }

    /*
     * Every state but "finished" counts as current -- the same test /live/new
     * and the profile page use. A stream sitting in "pending" or "disconnected"
     * is one whose page is still worth showing: the source may not have
     * connected yet, or may be on its way back.
     *
     * Ordered newest-first purely as a belt-and-braces measure. There should
     * only ever be one row here, but if a stale one ever survives, the link
     * should lead to the broadcast that is actually going on.
     */
    const stream = await Stream.findOne({
        where: {
            userId: user.id,
            state: { [Op.ne]: StreamState.finished },
        },
        order: [["createdAt", "DESC"]],
    });

    if (!stream) {
        return {
            kind: "not_live",
            userName: user.name,
            displayName: user.displayName,
        };
    }

    return {
        kind: "live",
        streamId: stream.id,
        userName: user.name,
        displayName: user.displayName,
    };
}
