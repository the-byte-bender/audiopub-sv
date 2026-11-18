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
import { Lexer, type Token } from "marked";
import { Op } from "sequelize";
import { User } from "$lib/server/database";
import { mentionCandidateGroups, mentionCandidates } from "$lib/mentions";
import type { ClientsideComment } from "$lib/types";

// Tokens whose text is never shown as plain text, so a mention in them is not
// one: code, link text and targets, and HTML (which SafeMarkdown does not
// render). Escapes cover "\@name", which is a way to write a name without
// mentioning anyone.
const SKIPPED_TOKENS = new Set(["code", "codespan", "link", "html", "escape", "image"]);

function collectText(tokens: Token[], out: string[]) {
    for (const token of tokens) {
        if (SKIPPED_TOKENS.has(token.type)) continue;
        const nested = token as any;
        if (nested.tokens?.length) {
            collectText(nested.tokens, out);
        } else if (nested.items) {
            for (const item of nested.items) collectText(item.tokens ?? [], out);
        } else if (token.type === "table") {
            for (const cell of [...nested.header, ...nested.rows.flat()]) {
                collectText(cell.tokens ?? [], out);
            }
        } else if (token.type === "text") {
            out.push(token.raw);
        }
    }
}

/**
 * The parts of a comment's markdown that render as plain text, one run per
 * line. These are exactly the runs SafeMarkdown's mention renderer sees, so
 * a name is notified only if it would also show up as a link.
 */
export function mentionableText(markdown: string): string {
    const out: string[] = [];
    collectText(Lexer.lex(markdown, { gfm: true, breaks: true }), out);
    return out.join("\n");
}

/**
 * The users the text @mentions, in the order they are first mentioned.
 * Candidates that are not accounts are dropped.
 */
export async function findMentionedUsers(markdown: string): Promise<User[]> {
    const text = mentionableText(markdown);
    const candidates = mentionCandidates(text);
    if (candidates.length === 0) return [];

    const users = await User.findAll({
        where: { name: { [Op.in]: candidates } },
        attributes: ["id", "name", "isAdmin", "isBanned", "isTrusted"],
    });
    const byName = new Map(users.map((user) => [user.name, user]));
    const ordered: User[] = [];
    // Resolved the way splitMentions links them: "@garo!" is garo, unless
    // someone is actually called "garo!".
    for (const group of mentionCandidateGroups(text)) {
        const name = group.find((candidate) => byName.has(candidate));
        const user = name ? byName.get(name)! : undefined;
        if (user && !ordered.includes(user)) ordered.push(user);
    }
    return ordered;
}

function flatten(comments: ClientsideComment[]): ClientsideComment[] {
    return comments.flatMap((comment) => [
        comment,
        ...flatten(comment.replies ?? []),
    ]);
}

/**
 * Fills in `mentions` on each comment, replies included, with the names it
 * mentions that belong to real accounts, so the browser can link exactly
 * those. One query for the whole list. Returns the same array.
 */
export async function attachMentions(
    comments: ClientsideComment[],
): Promise<ClientsideComment[]> {
    const all = flatten(comments);
    const candidatesByComment = new Map(
        all.map((comment) => [
            comment,
            mentionCandidates(mentionableText(comment.content)),
        ]),
    );
    const allCandidates = new Set([...candidatesByComment.values()].flat());
    if (allCandidates.size === 0) return comments;

    const existing = new Set(
        (
            await User.findAll({
                where: { name: { [Op.in]: [...allCandidates] } },
                attributes: ["name"],
            })
        ).map((user) => user.name),
    );
    for (const [comment, candidates] of candidatesByComment) {
        // Every existing candidate, not just the one each mention resolves
        // to: the browser runs the same resolution when it renders.
        const mentions = candidates.filter((name) => existing.has(name));
        if (mentions.length > 0) comment.mentions = mentions;
    }
    return comments;
}
