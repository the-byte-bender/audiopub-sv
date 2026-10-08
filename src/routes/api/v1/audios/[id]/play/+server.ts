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
import type { RequestHandler } from "./$types";
import { endpoint, findVisibleAudio } from "$lib/server/api";

/*
 * Counts a play. Each address counts once per audio every twelve hours, so
 * clients may call this every time playback starts; "registered" says whether
 * this call was the one that counted.
 */
export const POST: RequestHandler = endpoint(async (event) => {
    const audio = await findVisibleAudio(event, event.params.id);
    // In production, the reverse proxy in front of the app sets the header.
    const ip =
        event.request.headers.get("x-forwarded-for") ??
        event.getClientAddress();
    return json({ registered: await audio.registerPlay(ip) });
});
