import type { Handle } from "@sveltejs/kit";
import jwt from "jsonwebtoken";
import { User } from "$lib/server/database";
import dotenv from "dotenv";
dotenv.config();

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  const fromAiHeader = event.request.headers.get("x-from-ai");
  event.locals.isFromAi = fromAiHeader ? true : false;
  const token = event.cookies.get("token");
  if (!token) {
    return resolve(event);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      version: number;
    };

    if (!decoded || !decoded.id) {
      return resolve(event);
    }

    const user = await User.findByPk(decoded.id);

    if (!user || user.version !== decoded.version) {
      return resolve(event);
    }

    event.locals.user = user;

    if (user.isBanned) {
      return new Response("You are banned.", { status: 403 });
    }
  } catch (e) {
    return resolve(event);
    // You may want to log the error or handle it differently
  }

  return resolve(event);
};
