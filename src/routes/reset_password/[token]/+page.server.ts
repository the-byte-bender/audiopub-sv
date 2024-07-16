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
