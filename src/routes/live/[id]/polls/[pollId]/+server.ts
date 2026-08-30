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
    castVote,
    closePoll,
    findPoll,
    serializePoll,
    serializePollForBroadcast,
} from "$lib/server/polls";
import { PollState } from "$lib/types";

/** Votes: one per user per poll, changeable while the poll is open. */
export const POST: RequestHandler = async (event) => {
    const user = event.locals.user;
    if (!user) {
        return json({ message: "You must be logged in to vote" }, { status: 401 });
    }
    if (user.isBanned) {
        return json({ message: "You are banned" }, { status: 403 });
    }
    if (!user.isVerified) {
        return json(
            { message: "Please verify your email before voting" },
            { status: 403 },
        );
    }

    const stream = await Stream.findByPk(event.params.id);
    if (!stream) {
        return json({ message: "Stream not found" }, { status: 404 });
    }
    const isHost = user.id === stream.userId || user.isAdmin;

    const poll = await findPoll(event.params.pollId, event.params.id);
    if (!poll) {
        return json({ message: "Poll not found" }, { status: 404 });
    }

    let body: any;
    try {
        body = await event.request.json();
    } catch {
        return json({ message: "Invalid request" }, { status: 400 });
    }

    const optionId = body?.optionId;
    if (typeof optionId !== "string" || !optionId) {
        return json({ message: "Missing option" }, { status: 400 });
    }

    try {
        const updated = await castVote(poll, user.id, optionId);
        if (!updated) {
            // Re-picking the same option changes nothing; report the current
            // tally so the client stays in sync anyway.
            return json({ poll: await serializePoll(poll, user.id, isHost) });
        }
        streamingService.notifyPollChanged(
            poll.streamId,
            "updated",
            await serializePollForBroadcast(updated),
        );
        return json({ poll: await serializePoll(updated, user.id, isHost) });
    } catch (err) {
        if (err instanceof PollValidationError) {
            return json({ message: err.message }, { status: 400 });
        }
        throw err;
    }
};

/** Closes a poll, freezing its result for the archive. */
export const PUT: RequestHandler = async (event) => {
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

    const poll = await findPoll(event.params.pollId, stream.id);
    if (!poll) {
        return json({ message: "Poll not found" }, { status: 404 });
    }
    if (poll.state === PollState.closed) {
        return json({ poll: await serializePoll(poll, user.id, true) });
    }

    const closed = await closePoll(poll);
    streamingService.notifyPollChanged(
        stream.id,
        "closed",
        await serializePollForBroadcast(closed),
    );
    return json({ poll: await serializePoll(closed, user.id, true) });
};

export const DELETE: RequestHandler = async (event) => {
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

    const poll = await findPoll(event.params.pollId, stream.id);
    if (!poll) {
        return json({ message: "Poll not found" }, { status: 404 });
    }

    await poll.destroy();
    streamingService.notifyPollDeleted(stream.id, poll.id);
    return json({ success: true });
};
