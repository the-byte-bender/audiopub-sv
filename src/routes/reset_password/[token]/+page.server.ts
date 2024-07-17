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
import { User } from "$lib/server/database";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { hash } from "bcrypt";

export const load: PageServerLoad = async (event) => {
  const token = event.params.token;
  const user = await User.findOne({
    where: { resetPasswordToken: token },
  });
  if (!user) {
    return error(404, "Invalid token");
  }
  event.locals.user = user;

  return {
    token,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const token = event.params.token;
    const form = await event.request.formData();
    const password = form.get("password") as string;
    if (!password) {
      return fail(400);
    }
    if (!token) {
      return fail(400);
    }
    const user = await User.findOne({
      where: { resetPasswordToken: token },
    });
    if (!user) {
      return fail(404);
    }
    if (password.length < 8 || password.length > 64) {
      return fail(400, {
        message: "Password must be between 8 and 64 characters",
      });
    }
    user.password = await hash(password, 12);
    user.resetPasswordToken = null;
    await user.save();
    event.cookies.set("token", await user.generateToken(), {path: "/"});
    event.locals.user = user;
    return redirect(303, "/");
  },
};
