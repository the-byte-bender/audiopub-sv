/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2026 the-byte-bender
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
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Notification } from "$lib/server/database";
import { endpoint, requireUser } from "$lib/server/api";

export const DELETE: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const deletedCount = await Notification.destroy({
        where: { id: event.params.id, userId: user.id },
    });
    if (deletedCount === 0) {
        return error(404, "Notification not found");
    }
    return json({ success: true });
});
