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
 * Builds the per-user RSS feeds served at /user/<@name|id>/feed.xml, so people
 * can follow a creator from a podcast app or feed reader instead of checking
 * their profile.
 */
import fs from "fs/promises";
import type Audio from "$lib/server/database/models/audio";
import type User from "$lib/server/database/models/user";
import { baseUrl } from "$lib/server/base_url";

/** How many of a user's newest uploads a feed carries. */
export const FEED_ITEM_LIMIT = 50;

/*
 * Formats podcast apps reliably play. An original in one of these is served
 * as-is; anything else (wav, ogg, flac...) falls back to the transcoded AAC
 * copy, which every upload gets.
 */
const PODCAST_FRIENDLY_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a"]);

interface Enclosure {
    url: string;
    length: number;
    type: string;
}

// Characters XML 1.0 does not allow at all, even escaped. User text can
// contain them (pasted control characters), and one is enough to make a
// strict feed reader reject the whole document.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(text: string): string {
    return text
        .replace(INVALID_XML_CHARS, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

async function fileSize(path: string): Promise<number | null> {
    try {
        return (await fs.stat(path)).size;
    } catch {
        return null;
    }
}

async function findEnclosure(audio: Audio): Promise<Enclosure | null> {
    const original = {
        path: audio.path,
        type: audio.mimeType,
    };
    const transcoded = {
        path: audio.transcodedPath,
        type: "audio/aac",
    };
    const candidates = PODCAST_FRIENDLY_TYPES.has(original.type)
        ? [original, transcoded]
        : [transcoded, original];

    for (const candidate of candidates) {
        const length = await fileSize(candidate.path);
        if (length !== null) {
            return {
                url: `${baseUrl}/${candidate.path}`,
                length,
                type: candidate.type,
            };
        }
    }
    return null;
}

/*
 * Readers treat <description> as HTML, so the line breaks people type would
 * collapse into one paragraph. Turn them into <br> tags, escaped like the
 * rest of the text.
 */
function descriptionHtml(text: string): string {
    return escapeXml(text).replace(/\r?\n/g, "&lt;br /&gt;");
}

/**
 * Renders one upload, or nothing if its file is not on disk yet (an upload
 * still being written). Leaving it out beats listing it without audio: many
 * podcast apps remember an episode by its guid and never look again for an
 * enclosure that shows up later.
 */
async function renderItem(audio: Audio, author: string): Promise<string | null> {
    const enclosure = await findEnclosure(audio);
    if (!enclosure) {
        return null;
    }
    const link = `${baseUrl}/listen/${audio.id}`;
    return [
        "    <item>",
        `      <title>${escapeXml(audio.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        // Not the link: a guid built from the base URL would change if the
        // instance ever moved, and every subscriber would get the whole feed
        // again as new episodes.
        `      <guid isPermaLink="false">audiopub:${audio.id}</guid>`,
        `      <pubDate>${audio.createdAt.toUTCString()}</pubDate>`,
        `      <description>${descriptionHtml(audio.description || audio.title)}</description>`,
        `      <itunes:author>${escapeXml(author)}</itunes:author>`,
        `      <enclosure url="${escapeXml(enclosure.url)}" length="${enclosure.length}" type="${escapeXml(enclosure.type)}" />`,
        "    </item>",
    ].join("\n");
}

/**
 * Renders the feed for a user. The caller decides whether the user's uploads
 * may be shown at all; this only formats them.
 */
export async function renderUserFeed(user: User, audios: Audio[]): Promise<string> {
    const author = user.displayName || user.name;
    const profileUrl = `${baseUrl}/user/@${encodeURIComponent(user.name)}`;
    const feedUrl = `${profileUrl}/feed.xml`;
    const description = user.bio.trim() || `Audio shared by ${author} on Audiopub.`;
    const items = (
        await Promise.all(audios.map((audio) => renderItem(audio, author)))
    ).filter((item): item is string => item !== null);
    const lastBuildDate = audios.length
        ? audios[0].createdAt.toUTCString()
        : new Date().toUTCString();

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
        "  <channel>",
        `    <title>${escapeXml(`${author} on Audiopub`)}</title>`,
        `    <link>${escapeXml(profileUrl)}</link>`,
        `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
        `    <description>${escapeXml(description)}</description>`,
        `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
        "    <generator>Audiopub</generator>",
        `    <itunes:author>${escapeXml(author)}</itunes:author>`,
        "    <itunes:explicit>false</itunes:explicit>",
        ...items,
        "  </channel>",
        "</rss>",
        "",
    ].join("\n");
}
