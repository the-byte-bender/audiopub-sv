import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = (event) => {
  event.cookies.delete("token", { path: "/" });
  event.locals.user = null;
  return redirect(303, "/");
};
