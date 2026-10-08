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
import type { RequestHandler } from "./$types";
import {
    endpoint,
    getString,
    readJson,
    requireUser,
    serializeAccount,
} from "$lib/server/api";

export const POST: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    if (user.isVerified) {
        return json({ user: serializeAccount(user) });
    }

    const body = await readJson(event);
    const verificationToken = getString(body, "verificationToken")?.trim();
    if (!verificationToken) {
        return error(400, "Verification token is required");
    }
    if (verificationToken !== user.verificationToken) {
        return error(400, "Invalid verification token");
    }

    await user.verify(verificationToken);
    return json({ user: serializeAccount(user) });
});
