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
import { error, json } from "@sveltejs/kit";
import { compare } from "bcrypt";
import type { RequestHandler } from "./$types";
import { User } from "$lib/server/database";
import {
    endpoint,
    getString,
    readJson,
    serializeAccount,
} from "$lib/server/api";

export const POST: RequestHandler = endpoint(async (event) => {
    const body = await readJson(event);
    const email = getString(body, "email");
    const password = getString(body, "password");
    if (!email || !password) {
        return error(400, "Email and password are required");
    }

    const user = await User.findOne({
        where: { email: email.trim().toLowerCase() },
    });
    if (!user || !(await compare(password, user.password))) {
        return error(401, "Invalid email or password");
    }
    if (user.isBanned) {
        return error(403, "You are banned.");
    }

    user.trySendVerificationEmail().catch((err) => console.error(err));
    return json({ token: user.generateToken(), user: serializeAccount(user) });
});
