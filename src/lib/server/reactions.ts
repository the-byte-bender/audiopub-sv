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
import { Reaction } from "$lib/server/database";
import { Op } from "sequelize";
import { isValidReactionEmoji } from "$lib/reactions";
import { ReactionTargetType, type ClientsideReaction } from "$lib/types";

export class InvalidReactionError extends Error {
    constructor() {
        super("Unknown reaction");
        this.name = "InvalidReactionError";
    }
}

/**
 * Applies a user's reaction to a target.
 *
 * Passing the emoji the user already reacted with removes the reaction, which
 * is what makes each reaction button a toggle. Passing a different emoji
 * replaces the previous one, since a user holds at most one reaction per
 * target. Returns the fresh summary from that user's point of view.
 */
export async function toggleReaction(
    userId: string,
    targetType: ReactionTargetType,
    targetId: string,
    emoji: string,
): Promise<ClientsideReaction[]> {
    if (!isValidReactionEmoji(emoji)) {
        throw new InvalidReactionError();
    }

    const existing = await Reaction.findOne({
        where: { userId, targetType, targetId },
    });

    if (existing && existing.emoji === emoji) {
        await existing.destroy();
    } else if (existing) {
        existing.emoji = emoji;
        await existing.save();
    } else {
        try {
            await Reaction.create({ userId, targetType, targetId, emoji });
        } catch (error) {
            // Two rapid clicks can race on the unique index; the first one won,
            // and that is a perfectly good outcome.
            if ((error as any)?.name !== "SequelizeUniqueConstraintError") {
                throw error;
            }
        }
    }

    const summaries = await summarizeReactions(targetType, [targetId], userId);
    return summaries.get(targetId) ?? [];
}

/**
 * Aggregates reactions for a batch of targets in a single query, so a page
 * full of comments does not turn into one query per comment.
 */
export async function summarizeReactions(
    targetType: ReactionTargetType,
    targetIds: string[],
    viewerId?: string | null,
): Promise<Map<string, ClientsideReaction[]>> {
    const result = new Map<string, ClientsideReaction[]>();
    if (targetIds.length === 0) {
        return result;
    }

    const rows = await Reaction.findAll({
        where: { targetType, targetId: { [Op.in]: targetIds } },
        attributes: ["targetId", "emoji", "userId"],
        raw: true,
    });

    const counts = new Map<string, Map<string, number>>();
    const mine = new Map<string, string>();

    for (const row of rows as unknown as {
        targetId: string;
        emoji: string;
        userId: string;
    }[]) {
        let perTarget = counts.get(row.targetId);
        if (!perTarget) {
            perTarget = new Map<string, number>();
            counts.set(row.targetId, perTarget);
        }
        perTarget.set(row.emoji, (perTarget.get(row.emoji) ?? 0) + 1);
        if (viewerId && row.userId === viewerId) {
            mine.set(row.targetId, row.emoji);
        }
    }

    for (const [targetId, perTarget] of counts) {
        const summary: ClientsideReaction[] = [...perTarget.entries()]
            .map(([emoji, count]) => ({
                emoji,
                count,
                reacted: mine.get(targetId) === emoji,
            }))
            // Most reacted first, then alphabetically so the order is stable
            // between renders.
            .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
        result.set(targetId, summary);
    }

    return result;
}

/**
 * Drops reactions whose target no longer exists. Reactions are polymorphic and
 * therefore have no foreign key to cascade from.
 */
export async function deleteReactionsFor(
    targetType: ReactionTargetType,
    targetId: string,
): Promise<void> {
    await Reaction.destroy({ where: { targetType, targetId } });
}
