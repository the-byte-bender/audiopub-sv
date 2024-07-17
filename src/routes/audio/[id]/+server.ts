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
import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";

export const GET: RequestHandler = async (event) => {
  let id = event.params.id;
  // serve ./audio/{id} if exists, as octet stream.
  if (id.startsWith(".") || id.includes("/")) {
    return error(400, "Invalid id");
  }
  const path = `./audio/${id}`;
  try {
    const file = await fs.readFile(path);
    return new Response(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.byteLength.toString(),
      },
    });
  } catch (e) {
    return error(404, "Not found");
  }
};
