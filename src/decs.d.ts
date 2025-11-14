/*
 * This file is part of the audiopub project.
 * 
 * Copyright (C) 2024 the-byte-bender
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
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

declare module "../build/handler.js" {
  import type { RequestHandler } from "express";

  export const handler: RequestHandler;
}
