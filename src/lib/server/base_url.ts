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
import * as dotenv from "dotenv";

dotenv.config();

/**
 * The public URL of this instance, without a trailing slash. Used wherever we
 * hand out an absolute link that leaves the site: emails, RSS feeds.
 */
export const baseUrl = (process.env.BASE_URL || "https://audiopub.site").replace(
    /\/+$/,
    "",
);
