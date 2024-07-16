import { Audio } from "$lib/server/database";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
  const user = event.locals.user;
  const audio = await Audio.findByPk(event.params.id);
  if (!user) {
    return error(401, "Unauthorized");
  }
  if (!audio) {
    return error(404, "Audio not found");
  }
  const result = await audio.registerPlay(user.id);
  return json(result);
};
