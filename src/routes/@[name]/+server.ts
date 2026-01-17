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
import { User } from "$lib/server/database";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
    const name = params.name;
    
    const user = await User.findOne({
        where: { name }
    });

    if (!user) {
        throw error(404, "User not found");
    }

    const searchParams = url.searchParams.toString();
    const destination = `/user/${user.id}${searchParams ? `?${searchParams}` : ""}`;
    
    throw redirect(302, destination);
};
