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

/*
 * @mentions in comments. Shared by the server, which notifies the people a
 * comment mentions, and the browser, which turns those mentions into profile
 * links.
 *
 * Usernames can contain almost anything but whitespace (registration only
 * checks the length), so a mention is "@" followed by a run of non-whitespace.
 * Punctuation after a name ("thanks @garo!") is part of that run, so each
 * mention yields two candidates: the run as typed, and the run with trailing
 * punctuation removed, plus one without a possessive "'s". Whichever names an
 * account wins, the full run first.
 *
 * Two kinds of name cannot be mentioned: ones with a space, and ones with an
 * "@" in them ("@a@b" is read as a mention of "a").
 */

/** The most people a single comment can notify, so it cannot be used to spam. */
export const MAX_MENTIONS_PER_COMMENT = 10;

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 24;

/*
 * The "@" has to start the text or follow whitespace or an opening bracket or
 * quote. That keeps email addresses (me@example.com) from reading as mentions.
 */
const MENTION_PATTERN = /(^|[\s(\[{"'*_~\u201C\u2018])@([^\s@]+)/g;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}"'*_~\u201D\u2019\u2026]+$/;
const POSSESSIVE = /['\u2019]s$/i;

export type MentionSegment =
    | { kind: "text"; text: string }
    | { kind: "mention"; text: string; name: string };

// Registration checks the length of the name as typed, so this does too;
// lowercasing can change it.
function isPlausibleName(typed: string): boolean {
    return typed.length >= MIN_NAME_LENGTH && typed.length <= MAX_NAME_LENGTH;
}

/**
 * The possible names for a run of text after an "@", most specific first,
 * each with the text as typed (lowercasing can change a string's length).
 */
function namesFor(run: string): { typed: string; name: string }[] {
    const typedForms = [run];
    const trimmed = run.replace(TRAILING_PUNCTUATION, "");
    if (trimmed && trimmed !== run) {
        typedForms.push(trimmed);
    }
    // "@garo's upload": each form is a prefix of the one before, which
    // splitMentions relies on.
    const unpossessive = trimmed.replace(POSSESSIVE, "");
    if (unpossessive && unpossessive !== trimmed) {
        typedForms.push(unpossessive);
    }
    return typedForms
        .filter(isPlausibleName)
        .map((typed) => ({ typed, name: typed.toLowerCase() }));
}

/**
 * For each mention in the text, in order, the names it could be, most
 * specific first. The mention is of the first one that is a real account.
 */
export function mentionCandidateGroups(text: string): string[][] {
    return [...text.matchAll(MENTION_PATTERN)]
        .map((match) => namesFor(match[2]).map(({ name }) => name))
        .filter((group) => group.length > 0);
}

/**
 * Every name the text might mention, lowercased and without duplicates. Most
 * will not be real accounts; the caller looks them up.
 */
export function mentionCandidates(text: string): string[] {
    return [...new Set(mentionCandidateGroups(text).flat())];
}

/**
 * Splits text into plain runs and mentions of the given (lowercase) names.
 * An "@name" that is not in the set stays plain text.
 */
export function splitMentions(
    text: string,
    names: ReadonlySet<string>,
): MentionSegment[] {
    const segments: MentionSegment[] = [];
    let plainStart = 0;

    for (const match of text.matchAll(MENTION_PATTERN)) {
        const found = namesFor(match[2]).find(({ name }) => names.has(name));
        if (!found) continue;

        // Only the part of the run that is the name becomes the mention; any
        // trailing punctuation stays in the plain text after it.
        const atIndex = match.index! + match[1].length;
        if (atIndex > plainStart) {
            segments.push({ kind: "text", text: text.slice(plainStart, atIndex) });
        }
        segments.push({
            kind: "mention",
            text: `@${found.typed}`,
            name: found.name,
        });
        plainStart = atIndex + 1 + found.typed.length;
    }

    if (plainStart < text.length) {
        segments.push({ kind: "text", text: text.slice(plainStart) });
    }
    return segments;
}

/** Context holding a store of the names SafeMarkdown may turn into links. */
export const MENTION_NAMES_CONTEXT = Symbol("mentionNames");

/** Context set inside a rendered link, where a nested link is not allowed. */
export const INSIDE_LINK_CONTEXT = Symbol("insideLink");
