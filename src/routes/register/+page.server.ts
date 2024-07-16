import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import trustedEmailProviders from "$lib/server/trusted_email_providers";
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
    if (!trustedEmailProviders.includes(emailDomain)) {
      return fail(400, {
        email,
        username,
        message: "The domain of the email address you provided is not trusted.",
      });
    }
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
    });
    event.cookies.set("token", await user.generateToken(), { path: "/" });
    user.trySendVerificationEmail();
    event.locals.user = user;
    return redirect(303, "/");
  },
};
