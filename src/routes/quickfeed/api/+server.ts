/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2025 the-byte-bender
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
import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getQuickfeedPage } from "$lib/server/quickfeed";

export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        const pageString = url.searchParams.get("page");
        const page = pageString ? parseInt(pageString, 10) : 1;

        // Validate page parameter
        if (isNaN(page) || page < 1) {
            return json({ error: "Invalid page parameter" }, { status: 400 });
        }

        const result = await getQuickfeedPage({
            page,
            isAdmin: locals.user?.isAdmin || false,
            currentUser: locals.user || null,
        });

        return json({
            audios: result.audios,
            count: result.count,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
            hasMore: result.hasMore
        });

    } catch (err) {
        console.error('Quickfeed API error:', err);
        return json({ error: "Failed to fetch audios" }, { status: 500 });
    }
};