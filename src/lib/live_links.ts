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
 * The shape of the shareable live link, /live/@username, kept apart from the
 * lookup that resolves it. Pages have to build one of these to show it to a
 * broadcaster, and that runs in the browser -- so the string half lives out
 * here where client code may import it, and only the database half sits in
 * $lib/server/live_links.
 *
 * The "@" follows the convention /user/[id] already uses for profiles, so
 * /live/@alice reads the same way as /user/@alice.
 */

/** Marks a /live/... segment as a username rather than a stream id. */
export const USERNAME_PREFIX = "@";

export function isUsernameParam(param: string): boolean {
    return param.startsWith(USERNAME_PREFIX);
}

/** The shareable path for a broadcaster, e.g. "/live/@alice". */
export function liveUsernamePath(userName: string): string {
    return `/live/${USERNAME_PREFIX}${encodeURIComponent(userName)}`;
}
