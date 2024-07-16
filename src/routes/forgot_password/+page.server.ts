import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { User } from "$lib/server/database";

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const email = form.get("email") as string;
    if (!email) {
      return fail(400);
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return fail(404);
    }
    await user.generateResetPasswordToken();
    return {
      status: 200,
      body: { message: "Reset password email sent" },
    };
  },
};
