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
import type { Handle } from "@sveltejs/kit";
import jwt from "jsonwebtoken";
import { User } from "$lib/server/database";
import dotenv from "dotenv";
dotenv.config();

export const handle: Handle = async ({ event, resolve }) => {
    const host = event.request.headers.get("x-forwarded-host") || event.url.hostname;

    if (host.split(".")[0] === "upload") {
        // Prepend "/upload" to the pathname if it's not already there
        if (!event.url.pathname.startsWith("/upload")) {
            event.url.pathname = `/upload${event.url.pathname}`;
        }
    }
    
    event.locals.user = null;
    const fromAiHeader = event.request.headers.get("x-from-ai");
    event.locals.isFromAi = fromAiHeader ? true : false;
    const token = event.cookies.get("token");
    if (!token) {
        return resolve(event);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            id: number;
            version: number;
        };

        if (!decoded || !decoded.id) {
            return resolve(event);
        }

        const user = await User.findByPk(decoded.id);

        if (!user || user.version !== decoded.version) {
            return resolve(event);
        }

        event.locals.user = user;

        if (user.isBanned) {
            return new Response("You are banned.", { status: 403 });
        }
    } catch (e) {
        return resolve(event);
        // You may want to log the error or handle it differently
    }

    return resolve(event);
};
