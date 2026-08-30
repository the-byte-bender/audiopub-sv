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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { Stream } from "$lib/server/database";
import { streamingService } from "$lib/server/streaming";
import {
    PollValidationError,
    createPoll,
    getPollsForStream,
    serializePoll,
    serializePollForBroadcast,
} from "$lib/server/polls";
import { StreamState } from "$lib/types";

export const GET: RequestHandler = async (event) => {
    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        return json({ message: "Stream not found" }, { status: 404 });
    }
    const user = event.locals.user;
    const isHost = Boolean(user && (user.id === stream.userId || user.isAdmin));
    return json({
        polls: await getPollsForStream(stream.id, user?.id, isHost),
    });
};

/** Only the broadcaster and admins run polls. */
export const POST: RequestHandler = async (event) => {
    const user = event.locals.user;
    if (!user) {
        return json({ message: "You must be logged in" }, { status: 401 });
    }

    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        return json({ message: "Stream not found" }, { status: 404 });
    }
    if (user.id !== stream.userId && !user.isAdmin) {
        return json({ message: "Not authorized" }, { status: 403 });
    }

    if (stream.state === StreamState.finished) {
        return json({ message: "Stream has ended" }, { status: 400 });
    }

    let body: any;
    try {
        body = await event.request.json();
    } catch {
        return json({ message: "Invalid request" }, { status: 400 });
    }

    try {
        const poll = await createPoll(stream.id, user.id, {
            question: body?.question ?? "",
            options: body?.options,
            allowMultiple: body?.allowMultiple,
            hideResultsUntilVote: body?.hideResultsUntilVote,
        });
        streamingService.notifyPollChanged(
            stream.id,
            "created",
            await serializePollForBroadcast(poll),
        );
        return json({ poll: await serializePoll(poll, user.id, true) });
    } catch (err) {
        if (err instanceof PollValidationError) {
            return json({ message: err.message }, { status: 400 });
        }
        throw err;
    }
};
