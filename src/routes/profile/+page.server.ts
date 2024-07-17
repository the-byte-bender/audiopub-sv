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
import { fail, redirect, type Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { User } from "$lib/server/database";
import { hash } from "bcrypt";

export const load: PageServerLoad = async (event) => {
  const user = event.locals.user;
  if (!user) {
    return redirect(303, "/login");
  }
  return {
    name: user.name,
    email: user.email,
    displayName: user.displayName,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const user = event.locals.user;
    const data = await event.request.formData();
    if (!user) {
      return redirect(303, "/login");
    }
    let email = data.get("email") as string;
    let displayName = data.get("displayName") as string;
    let password = data.get("password") as string;
    if (email) {
      email = email.trim().toLowerCase();
      if (
        email !== user.email &&
        (await User.count({ where: { email: email } }))
      ) {
        return fail(400, {
          email,
          displayName,
          message: "Email already in use",
        });
      }
      await user.resetEmail(email);
      await user.trySendVerificationEmail();
    }
    if (displayName) {
      if (displayName.length < 3 || displayName.length > 30) {
        return fail(400, {
          email,
          displayName,
          message: "Display name must be between 3 and 30 characters",
        });
      }
      user.displayName = displayName;
    }
    if (password) {
      if (password.length < 8 || password.length > 64) {
        return fail(400, {
          email,
          displayName,
          message: "Password must be between 8 and 64 characters",
        });
      }
      user.password = await hash(password, 12);
      user.version++;
    }
    await user.save();
    event.cookies.set("token", await user.generateToken(), { path: "/" });
    return redirect(303, "/");
  },
};
