import fs from "fs/promises";
import path from "path";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { Audio } from "$lib/server/database";
import transcode from "$lib/server/transcode";

export const load: PageServerLoad = (event) => {
  const user = event.locals.user;
  if (!user) {
    return redirect(303, "/login");
  }
};

export const actions: Actions = {
  default: async (event) => {
    const user = event.locals.user;
    if (!user) {
      return redirect(303, "/login");
    }
    if (user.isBanned) {
      return error(403, "You are banned");
    }
    if (!user.isVerified) {
      return error(403, "Please verify your email first.");
    }
    const form = await event.request.formData();
    const file = form.get("file") as File;
    const title = form.get("title") as string;
    const description = form.get("description") as string;
    if (!file) {
      return fail(400, { title, description });
    }
    if (!title) {
      return fail(400, { title, description });
    }
    if (title.length < 3 || title.length > 120) {
      return fail(400, { title, description });
    }
    if (description && description.length > 5000) {
      return fail(400, { title, description });
    }
    if (file.size > 1024 * 1024 * 50) {
      return fail(400, { title, description });
    }
    const audio = await Audio.create({
      title,
      description,
      hasFile: true,
      userId: user.id,
      extension: path.extname(file.name),
    });
    await fs.writeFile(audio.path, Buffer.from(await file.arrayBuffer()));
    try{
      await transcode(audio.path);
    }catch(err){
      console.error(err);
      await audio.destroy();
      await fs.unlink(audio.path);
      return fail(500, { title, description });
    }
    return redirect(303, `/listen/${audio.id}`);
  },
};
