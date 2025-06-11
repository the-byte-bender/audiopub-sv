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
import { hash } from "bcrypt";

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    let email = form.get("email") as string;
    let username = form.get("username") as string;
    let password = form.get("password") as string;
    if (!email || !username || !password) {
      return fail(400, { email, username, message: "Missing required fields" });
    }
    email = email.trim().toLowerCase();
    username = username.trim();
    // do we trust the email?
    const emailDomain = email.split("@")[1];
    if (password.length < 8 || password.length > 64) {
      return fail(400, {
        email,
        username,
        message: "Password must be between 8 and 64 characters.",
      });
    }
    if (username.length < 3 || username.length > 24) {
      return fail(400, {
        email,
        username,
        message: "Username must be between 3 and 24 characters.",
      });
    }
    if (await User.count({ where: { email: email } })) {
      return fail(400, {
        email,
        username,
        message: "Email address is already in use.",
      });
    }
    if (await User.count({ where: { name: username } })) {
      return fail(400, {
        email,
        username,
        message: "Username is already in use.",
      });
    }
    const user = await User.create({
      name: username,
      email: email,
      password: await hash(password, 12),
      isTrusted: false,
    });
    event.cookies.set("token", await user.generateToken(), { path: "/", maxAge: 60 * 60 * 24 * 365});
    user.trySendVerificationEmail();
    event.locals.user = user;
    return redirect(303, "/");
  },
};
