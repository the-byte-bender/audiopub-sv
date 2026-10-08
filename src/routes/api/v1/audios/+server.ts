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
import { Op, Sequelize, type OrderItem } from "sequelize";
import type { RequestHandler } from "./$types";
import { Audio, User } from "$lib/server/database";
import {
    endpoint,
    getFlag,
    getPage,
    PAGE_SIZE,
    pagination,
    requireUser,
    serializeAudios,
} from "$lib/server/api";
import {
    getUploadRestriction,
    MAX_AUDIO_FILE_SIZE,
    publishAudio,
} from "$lib/server/audios";
import { excludeMutedUsers, getMutedUserIds } from "$lib/server/mutes";

const SORT_FIELDS = ["createdAt", "plays", "title", "random", "favoriteCount"];

// The home feed, with the same sorting and filtering as the front page.
export const GET: RequestHandler = endpoint(async (event) => {
    const page = getPage(event.url);
    const sort = event.url.searchParams.get("sort") ?? "createdAt";
    const order = (event.url.searchParams.get("order") ?? "desc").toUpperCase();
    const excludeArchives = getFlag(event.url, "excludeArchives");
    if (!SORT_FIELDS.includes(sort)) {
        return error(400, `"sort" must be one of: ${SORT_FIELDS.join(", ")}`);
    }
    if (order !== "ASC" && order !== "DESC") {
        return error(400, '"order" must be "asc" or "desc"');
    }

    let orderBy: OrderItem[];
    if (sort === "random") {
        orderBy = [Sequelize.fn("RAND")];
    } else if (sort === "favoriteCount") {
        orderBy = [
            [
                Sequelize.literal(
                    "(SELECT COUNT(*) FROM AudioFavorites WHERE audioId = Audio.id)",
                ),
                order,
            ],
        ];
    } else {
        orderBy = [[sort, order]];
    }

    const mutedUserIds = await getMutedUserIds(event);
    const audios = await Audio.findAndCountAll({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        order: orderBy,
        where: {
            ...(excludeArchives ? { archivedStreamId: { [Op.is]: null } } : {}),
            ...excludeMutedUsers(mutedUserIds),
        },
        include: {
            model: User,
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
        },
    });

    return json({
        audios: await serializeAudios(audios.rows, event.locals.user),
        ...pagination(audios.count, page),
    });
});

// Uploads take multipart/form-data, as the file cannot travel in JSON.
export const POST: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    const restriction = await getUploadRestriction(user);
    if (restriction) {
        return error(403, restriction);
    }

    let form: FormData;
    try {
        form = await event.request.formData();
    } catch {
        return error(400, "The request body must be multipart/form-data");
    }
    const file = form.get("file");
    const titleValue = form.get("title");
    const descriptionValue = form.get("description");
    const title = typeof titleValue === "string" ? titleValue.trim() : "";
    const description =
        typeof descriptionValue === "string" ? descriptionValue : "";
    // Only admins may pin an audio as an announcement.
    const isAnnouncement =
        user.isAdmin && form.get("isAnnouncement") === "true";

    if (!(file instanceof File) || file.size === 0) {
        return error(400, "An audio file is required");
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
        return error(413, "The audio file must not exceed 500 MB");
    }
    if (title.length < 3 || title.length > 120) {
        return error(400, "Title must be between 3 and 120 characters");
    }
    if (description.length > 5000) {
        return error(400, "Description must not exceed 5000 characters");
    }

    const audio = await publishAudio(
        user,
        file,
        title,
        description,
        isAnnouncement,
    );
    await audio.reload({ include: [User] });

    const [serialized] = await serializeAudios([audio], user);
    return json({ audio: serialized }, { status: 201 });
});
