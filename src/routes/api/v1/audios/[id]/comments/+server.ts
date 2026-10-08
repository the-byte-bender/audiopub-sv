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
import { Comment, User } from "$lib/server/database";
import {
    endpoint,
    findVisibleAudio,
    getString,
    readJson,
    requireUser,
} from "$lib/server/api";
import { addComment } from "$lib/server/comments";

// The whole discussion, as threads of replies, oldest first.
export const GET: RequestHandler = endpoint(async (event) => {
    const audio = await findVisibleAudio(event, event.params.id);
    const comments = await Comment.findAll({
        where: { audioId: audio.id },
        include: { model: User },
    });

    return json({
        comments: Comment.constructThreads(comments).map((comment) =>
            comment.toClientside(false, true),
        ),
    });
});

export const POST: RequestHandler = endpoint(async (event) => {
    const user = requireUser(event);
    if (user.isBanned) {
        return error(403, "You are banned");
    }
    if (!user.isVerified) {
        return error(403, "Please verify your email before commenting");
    }
    const audio = await findVisibleAudio(event, event.params.id);

    const body = await readJson(event);
    const content = getString(body, "content") ?? "";
    const parentId = getString(body, "parentId") || null;
    if (content.length < 3 || content.length > 4000) {
        return error(400, "Comment must be between 3 and 4000 characters");
    }
    if (parentId) {
        const parent = await Comment.findByPk(parentId);
        if (!parent || parent.audioId !== audio.id) {
            return error(404, "The comment you are replying to was not found");
        }
    }

    const comment = await addComment(user, audio, content, parentId);
    await comment.reload({ include: [User] });
    return json({ comment: comment.toClientside() }, { status: 201 });
});
