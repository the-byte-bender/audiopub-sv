import type { User } from "$lib/server/database";
import type { Locals } from "@sveltejs/kit";

declare global {
  namespace App {
    interface Locals {
      user?: User | null;
      isFromAi: boolean;
    }
  }
}
