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
import database, {
    StreamPoll,
    StreamPollOption,
    StreamPollVote,
} from "$lib/server/database";
import { Op } from "sequelize";
import { PollState, type ClientsidePoll } from "$lib/types";

export const MAX_POLL_OPTIONS = 6;
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_QUESTION_LENGTH = 300;
export const MAX_POLL_OPTION_LENGTH = 200;
/** Guards against a stream page turning into an endless wall of polls. */
export const MAX_OPEN_POLLS_PER_STREAM = 3;

export class PollValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PollValidationError";
    }
}

export interface CreatePollInput {
    question: string;
    options: string[];
    allowMultiple?: boolean;
    hideResultsUntilVote?: boolean;
}

const pollInclude = [{ model: StreamPollOption, as: "options" }];

async function reload(pollId: string): Promise<StreamPoll> {
    const poll = await StreamPoll.findByPk(pollId, { include: pollInclude });
    if (!poll) {
        throw new PollValidationError("Poll not found");
    }
    return poll;
}

/** Distinct voters, which is the denominator the percentages use. */
async function countVoters(pollId: string): Promise<number> {
    return StreamPollVote.count({
        where: { pollId },
        distinct: true,
        col: "userId",
    });
}

async function votedOptionIds(
    pollId: string,
    userId: string | null | undefined,
): Promise<string[]> {
    if (!userId) return [];
    const rows = await StreamPollVote.findAll({
        where: { pollId, userId },
        attributes: ["optionId"],
        raw: true,
    });
    return (rows as unknown as { optionId: string }[]).map((r) => r.optionId);
}

/**
 * A hidden tally opens up once the poll closes, and is always visible to the
 * host and to anyone who has already voted.
 */
function canSeeResults(
    poll: StreamPoll,
    hasVoted: boolean,
    isHost: boolean,
): boolean {
    if (!poll.hideResultsUntilVote) return true;
    if (poll.state === PollState.closed) return true;
    return hasVoted || isHost;
}

/** Serializes a poll from one viewer's point of view. */
export async function serializePoll(
    poll: StreamPoll,
    viewerId: string | null | undefined,
    isHost: boolean = false,
): Promise<ClientsidePoll> {
    const [mine, voters] = await Promise.all([
        votedOptionIds(poll.id, viewerId),
        countVoters(poll.id),
    ]);
    return poll.toClientside(
        mine,
        voters,
        canSeeResults(poll, mine.length > 0, isHost),
    );
}

/**
 * Serializes a poll for the SSE broadcast, which every listener receives.
 * It carries no viewer specific state, and withholds the tally of a
 * hidden-results poll from everyone: viewers entitled to see it refresh
 * through their own request instead.
 */
export async function serializePollForBroadcast(
    poll: StreamPoll,
): Promise<ClientsidePoll> {
    const voters = await countVoters(poll.id);
    return poll.toClientside(
        [],
        voters,
        canSeeResults(poll, false, false),
    );
}

export async function createPoll(
    streamId: string,
    createdById: string,
    input: CreatePollInput,
): Promise<StreamPoll> {
    const trimmedQuestion = (input.question ?? "").trim();
    if (
        trimmedQuestion.length < 3 ||
        trimmedQuestion.length > MAX_POLL_QUESTION_LENGTH
    ) {
        throw new PollValidationError(
            `The question must be between 3 and ${MAX_POLL_QUESTION_LENGTH} characters`,
        );
    }

    const options = (Array.isArray(input.options) ? input.options : [])
        .map((text) => (typeof text === "string" ? text.trim() : ""))
        .filter((text) => text.length > 0);

    if (options.length < MIN_POLL_OPTIONS || options.length > MAX_POLL_OPTIONS) {
        throw new PollValidationError(
            `A poll needs between ${MIN_POLL_OPTIONS} and ${MAX_POLL_OPTIONS} options`,
        );
    }
    if (options.some((text) => text.length > MAX_POLL_OPTION_LENGTH)) {
        throw new PollValidationError(
            `Each option must be at most ${MAX_POLL_OPTION_LENGTH} characters`,
        );
    }

    const openPolls = await StreamPoll.count({
        where: { streamId, state: PollState.open },
    });
    if (openPolls >= MAX_OPEN_POLLS_PER_STREAM) {
        throw new PollValidationError(
            `You already have ${MAX_OPEN_POLLS_PER_STREAM} open polls. Close one first.`,
        );
    }

    const pollId = await database.transaction(async (transaction) => {
        const poll = await StreamPoll.create(
            {
                streamId,
                createdById,
                question: trimmedQuestion,
                state: PollState.open,
                allowMultiple: Boolean(input.allowMultiple),
                hideResultsUntilVote: Boolean(input.hideResultsUntilVote),
            },
            { transaction },
        );
        await StreamPollOption.bulkCreate(
            options.map((text, index) => ({
                pollId: poll.id,
                text,
                position: index,
                voteCount: 0,
            })),
            { transaction },
        );
        return poll.id;
    });

    return reload(pollId);
}

export async function closePoll(poll: StreamPoll): Promise<StreamPoll> {
    if (poll.state !== PollState.closed) {
        poll.state = PollState.closed;
        poll.closedAt = new Date();
        await poll.save();
    }
    return reload(poll.id);
}

/**
 * Records a vote. Single choice polls move the user's vote to the given
 * option; multiple choice polls toggle it. Returns the refreshed poll, or
 * null when nothing changed (re-picking the only option already selected in a
 * single choice poll).
 */
export async function castVote(
    poll: StreamPoll,
    userId: string,
    optionId: string,
): Promise<StreamPoll | null> {
    if (poll.state !== PollState.open) {
        throw new PollValidationError("This poll is closed");
    }

    const option = await StreamPollOption.findOne({
        where: { id: optionId, pollId: poll.id },
    });
    if (!option) {
        throw new PollValidationError("Unknown option");
    }

    const changed = await database.transaction(async (transaction) => {
        const existing = await StreamPollVote.findAll({
            where: { pollId: poll.id, userId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (poll.allowMultiple) {
            const already = existing.find((v) => v.optionId === optionId);
            if (already) {
                await already.destroy({ transaction });
                await StreamPollOption.decrement("voteCount", {
                    by: 1,
                    where: { id: optionId, voteCount: { [Op.gt]: 0 } },
                    transaction,
                });
                return true;
            }
            await StreamPollVote.create(
                { pollId: poll.id, optionId, userId },
                { transaction },
            );
            await StreamPollOption.increment("voteCount", {
                by: 1,
                where: { id: optionId },
                transaction,
            });
            return true;
        }

        const current = existing[0];
        if (current && current.optionId === optionId) {
            return false;
        }

        if (current) {
            await StreamPollOption.decrement("voteCount", {
                by: 1,
                where: { id: current.optionId, voteCount: { [Op.gt]: 0 } },
                transaction,
            });
            current.optionId = optionId;
            await current.save({ transaction });
        } else {
            await StreamPollVote.create(
                { pollId: poll.id, optionId, userId },
                { transaction },
            );
        }

        await StreamPollOption.increment("voteCount", {
            by: 1,
            where: { id: optionId },
            transaction,
        });
        return true;
    });

    return changed ? reload(poll.id) : null;
}

export async function getPollsForStream(
    streamId: string,
    viewerId?: string | null,
    isHost: boolean = false,
): Promise<ClientsidePoll[]> {
    const polls = await StreamPoll.findAll({
        where: { streamId },
        include: pollInclude,
        order: [["createdAt", "DESC"]],
    });

    return Promise.all(
        polls.map((poll) => serializePoll(poll, viewerId, isHost)),
    );
}

export async function findPoll(
    pollId: string,
    streamId: string,
): Promise<StreamPoll | null> {
    const poll = await StreamPoll.findByPk(pollId, { include: pollInclude });
    if (!poll || poll.streamId !== streamId) {
        return null;
    }
    return poll;
}
