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
import fs from "fs/promises";
import { createReadStream } from "node:fs";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import Mime from "mime-types";

// WARNING! WARNING! WARNING!
// This endpoint should never ever ever ever ever be modified to let it be used in production.
// Not in a million years. Not if you're the last developer on Earth. Not even if aliens threaten to destroy the planet unless you do.
// Instead, PLEASE just configure your reverse proxy to host your audio directory under /audio.
// This endpoint exists SOLELY for local dev runs where a reverse proxy is not practical.
// If you modify this to make it run in production instead of a reverse proxy, you're practically begging for a disaster.
// The ghost of Alan Turing will haunt your dreams, whispering "Why? Why did you do this?" for all eternity.
// So please, I'm begging you, with tears in my eyes and trembling fingers on the keyboard: DO NOT USE THIS IN PRODUCTION.
export const GET: RequestHandler = async (event) => {
  if (!dev) {
    return error(403, "forbidden");
  }
  let id = event.params.id;
  // serve ./audio/{id} if exists, as octet stream.
  if (id.startsWith(".") || id.includes("/")) {
    return error(400, "Invalid id");
  }
  const path = `./audio/${id}`;
  try {
    const stat = await fs.stat(path);
    const size = stat.size;

    const rangeHeader = event.request.headers.get("range");
    const contentType = (Mime.lookup(id) || "application/octet-stream").toString();

    // No range header: return full file
    if (!rangeHeader) {
      return new Response(createReadStream(path) as any, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": size.toString(),
          "Accept-Ranges": "bytes",
        },
      });
    }

    // Range request: bytes=start-end
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : size - 1;

    if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || start > end) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    // Clamp within file
    start = Math.min(start, size - 1);
    end = Math.min(end, size - 1);
    const chunkSize = end - start + 1;

    return new Response(createReadStream(path, { start, end }) as any, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": chunkSize.toString(),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (e) {
    return error(404, "Not found");
  }
};
