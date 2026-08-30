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
import { env } from "$env/dynamic/public";

// The public address of the icecast server, as seen by listeners and by
// broadcasters. This is not the same as `ICECAST_HOST`, which is the address
// the server itself uses to reach icecast, and is usually not reachable from
// the outside.

// Base URL listeners play a stream from. The mount point, which is the user
// id, is appended to it.
export const streamListenUrl = (
    env.PUBLIC_STREAM_LISTEN_URL || "https://live.audiopub.site"
).replace(/\/+$/, "");

// Host and port broadcasting software sends audio to.
export const streamIngestHost =
    env.PUBLIC_STREAM_INGEST_HOST || "live.audiopub.site";
export const streamIngestPort = env.PUBLIC_STREAM_INGEST_PORT || "8000";
