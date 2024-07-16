import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = (event) => {
  return {
    user: event.locals.user?.toClientside(),
    isFromAi: event.locals.isFromAi,
    isAdmin: (event.locals.user?.isAdmin) ?? false,
  };
};
