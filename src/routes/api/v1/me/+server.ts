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
    requireUser,
    serializeAccount,
} from "$lib/server/api";

export const GET: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    return json({ user: serializeAccount(user) });
});

/*
 * Every field is optional, and the whole request is validated before anything
 * is saved. Changing the email or password signs out every other session, so
 * the response always carries a fresh token for this one.
 */
export const PATCH: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const body = await readJson(event);
    const email = getString(body, "email")?.trim().toLowerCase();
    const displayName = getString(body, "displayName")?.trim();
    const bio = getString(body, "bio");
    const password = getString(body, "password");

    if (email !== undefined && !email) {
        return error(400, "Email must not be empty");
    }
    if (
        displayName !== undefined &&
        (displayName.length < 3 || displayName.length > 30)
    ) {
        return error(400, "Display name must be between 3 and 30 characters");
    }
    if (bio !== undefined && bio.length > 1000) {
        return error(400, "Bio can't be longer than 1000 characters");
    }
    if (
        password !== undefined &&
        (password.length < 8 || password.length > 64)
    ) {
        return error(400, "Password must be between 8 and 64 characters");
    }

    const emailChanged = email !== undefined && email !== user.email;
    if (emailChanged && (await User.count({ where: { email } }))) {
        return error(409, "Email already in use");
    }

    if (emailChanged) {
        await user.resetEmail(email);
        user.trySendVerificationEmail().catch((err) => console.error(err));
    }
    if (displayName !== undefined) {
        user.displayName = displayName;
    }
    if (bio !== undefined) {
        user.bio = bio;
    }
    if (password !== undefined) {
        user.password = await hash(password, 12);
        user.version++;
    }
    await user.save();

    return json({ token: user.generateToken(), user: serializeAccount(user) });
});
