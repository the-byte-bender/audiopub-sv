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
import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { User } from "$lib/server/database";

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const email = form.get("email") as string;
    if (!email) {
      return fail(400, { email, message: "Email is required" });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return fail(404, { email, message: "User not found" });
    }
    await user.generateResetPasswordToken();
    return {
      message: "Reset password email sent",
    };
  },
};
