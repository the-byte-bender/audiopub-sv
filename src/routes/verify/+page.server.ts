import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const user = event.locals.user;
    const token = form.get("token") as string;
    if (!user) {
      return redirect(303, "/login");
    }
    if (!token) {
      return fail(400, { message: "Token is required" });
    }
    if (token !== user.verificationToken) {
      return fail(400, { message: "Invalid token" });
    }
    await user.verify(token);
    event.cookies.set("token", await user.generateToken(), { path: "/" });
    return redirect(303, "/");
  },
};
