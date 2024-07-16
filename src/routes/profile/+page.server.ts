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
