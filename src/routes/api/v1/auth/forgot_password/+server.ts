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
import { User } from "$lib/server/database";
import { endpoint, getString, readJson } from "$lib/server/api";

export const POST: RequestHandler = endpoint(async (event) => {
    const body = await readJson(event);
    const email = getString(body, "email")?.trim().toLowerCase();
    if (!email) {
        return error(400, "Email is required");
    }

    // The answer is the same whether or not the address has an account, so
    // this cannot be used to find out who is registered.
    const user = await User.findOne({ where: { email } });
    if (user) {
        await user.generateResetPasswordToken();
    }
    return json({ success: true });
});
