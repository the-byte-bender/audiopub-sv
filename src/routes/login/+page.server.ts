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
import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { User } from "$lib/server/database";
import { compare } from "bcrypt";

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    if (!email || !password) {
      return fail(400, { email, message: "Email and password are required" });
    }
    const user = await User.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user || !(await compare(password, user.password))) {
      return fail(401, { email, message: "Invalid email or password" });
    }
    user.trySendVerificationEmail();
    event.cookies.set("token", await user.generateToken(), {path: "/"});
    event.locals.user = user;
    return redirect(303, "/");
  },
};
