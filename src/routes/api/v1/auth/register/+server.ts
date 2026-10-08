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
import { hash } from "bcrypt";
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
    const email = getString(body, "email")?.trim().toLowerCase();
    const username = getString(body, "username")?.trim();
    const password = getString(body, "password");
    if (!email || !username || !password) {
        return error(400, "Email, username and password are required");
    }
    if (password.length < 8 || password.length > 64) {
        return error(400, "Password must be between 8 and 64 characters.");
    }
    if (username.length < 3 || username.length > 24) {
        return error(400, "Username must be between 3 and 24 characters.");
    }
    if (await User.count({ where: { email } })) {
        return error(409, "Email address is already in use.");
    }
    if (await User.count({ where: { name: username.toLowerCase() } })) {
        return error(409, "Username is already in use.");
    }

    const user = await User.create({
        name: username,
        email,
        password: await hash(password, 12),
        isTrusted: false,
    });
    user.trySendVerificationEmail().catch((err) => console.error(err));

    return json(
        { token: user.generateToken(), user: serializeAccount(user) },
        { status: 201 },
    );
});
