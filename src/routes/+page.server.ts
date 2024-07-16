import { Audio, User } from "$lib/server/database";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const pageString = event.url.searchParams.get("page");
  const page = pageString ? parseInt(pageString, 10) : 1;
  const limit = 30;
  const offset = (page - 1) * limit;
  const isFromAi = event.locals.isFromAi;
  const audios = await Audio.findAndCountAll({
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: User,
    where: { isFromAi },
  });
  return {
    audios: audios.rows.map((audio) => audio.toClientside()),
    count: audios.count,
    page,
    limit,
    totalPages: Math.ceil(audios.count / limit),
  };
};
