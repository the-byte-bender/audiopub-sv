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

/**
 * The fixed set of reactions users can leave on comments and stream chat
 * messages. Keeping it fixed keeps the UI predictable for screen reader users
 * and avoids having to sanitize arbitrary user supplied emoji.
 */
export interface ReactionKind {
    emoji: string;
    /** Used as the accessible name of the reaction button. */
    label: string;
}

export const REACTION_KINDS: ReactionKind[] = [
    { emoji: "\u{1F44D}", label: "Like" },
    { emoji: "\u{2764}\u{FE0F}", label: "Love" },
    { emoji: "\u{1F602}", label: "Funny" },
    { emoji: "\u{1F62E}", label: "Wow" },
    { emoji: "\u{1F622}", label: "Sad" },
    { emoji: "\u{1F525}", label: "Fire" },
];

export const REACTION_EMOJIS: string[] = REACTION_KINDS.map((k) => k.emoji);

export function isValidReactionEmoji(emoji: unknown): emoji is string {
    return typeof emoji === "string" && REACTION_EMOJIS.includes(emoji);
}

export function reactionLabel(emoji: string): string {
    return REACTION_KINDS.find((k) => k.emoji === emoji)?.label ?? emoji;
}
