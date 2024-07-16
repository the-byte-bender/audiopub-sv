import fs from "fs/promises";
import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";

export const GET: RequestHandler = async (event) => {
  let id = event.params.id;
  // serve ./audio/{id} if exists, as octet stream.
  if (id.startsWith(".") || id.includes("/")) {
    return error(400, "Invalid id");
  }
  const path = `./audio/${id}`;
  try {
    const file = await fs.readFile(path);
    return new Response(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": file.byteLength.toString(),
      },
    });
  } catch (e) {
    return error(404, "Not found");
  }
};
