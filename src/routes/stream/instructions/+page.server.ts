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
import { v4 as uuidv4 } from "uuid";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;

    if (user) {
        if (!user.streamKey) {
            user.streamKey = uuidv4();
            await user.save();
        }

        return {
            user: {
                id: user.id,
                name: user.name,
                streamKey: user.streamKey,
            },
        };
    }

    return {
        user: null,
    };
};
