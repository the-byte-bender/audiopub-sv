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
import type { RequestHandler } from "./$types";
import { StreamState } from "$lib/types";
import { endpoint, findStream } from "$lib/server/api";
import { streamEventsResponse } from "$lib/server/stream_events";

/*
 * The same server-sent events the stream page listens to. A finished stream
 * answers 204, which tells EventSource clients to stop reconnecting.
 */
export const GET: RequestHandler = endpoint(async (event) => {
    const stream = await findStream(event.params.id);
    if (stream.state === StreamState.finished) {
        return new Response(null, { status: 204 });
    }
    return streamEventsResponse(event.request, stream);
});
