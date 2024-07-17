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
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { Audio } from "$lib/server/database";

export const load: PageServerLoad = async (event) => {
  let query = event.url.searchParams.get("q") as string;
  const pageString = event.url.searchParams.get("page") as string;
  const page = pageString ? parseInt(pageString) : 1;
  query = query?.trim();
  if (!query || query.length < 5) {
    return error(400, "Query must be at least 5 characters long");
  }
  const audios = await Audio.search(query, page, event.locals.isFromAi);
  return {
    audios: audios.map((audio) => audio.toClientside()),
    query,
    page,
  };
};
