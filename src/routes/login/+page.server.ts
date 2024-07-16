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
