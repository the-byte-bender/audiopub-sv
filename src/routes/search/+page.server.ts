import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { Audio } from "$lib/server/database";

export const load: PageServerLoad = async (event) => {
  let query = event.url.searchParams.get("q") as string;
  const pageString = event.url.searchParams.get("page") as string;
  const page = pageString ? parseInt(pageString) : 1;
  query = query?.trim();
  if (!query || query.length < 5) {
    return error(400, "Query must be at least 5 characters long");
  }
  const audios = await Audio.search(query, page, event.locals.isFromAi);
  return {
    audios: audios.map((audio) => audio.toClientside()),
    query,
    page,
  };
};
