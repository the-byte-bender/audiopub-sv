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
 * Shared plumbing for the /api/v1 endpoints that native clients talk to.
 * Handlers throw SvelteKit's error() like the rest of the codebase, and
 * endpoint() turns whatever comes out into a JSON body of the form
 * { error: string }, so clients only ever have to parse one shape.
 */
import { error, isHttpError, json, type RequestEvent } from "@sveltejs/kit";
import { Sequelize } from "sequelize";
import { Audio, AudioFavorite, Stream, User } from "$lib/server/database";
import { resolveLiveUsername } from "$lib/server/live_links";
import { isUsernameParam } from "$lib/live_links";
import type { ClientsideAccount, ClientsideAudio } from "$lib/types";

export const PAGE_SIZE = 30;

/**
 * Wraps an API handler so that every failure reaches the client as JSON.
 * SvelteKit only renders a thrown error as JSON when the request asks for it
 * in its Accept header, which native HTTP clients usually leave out.
 */
export function endpoint<Event extends RequestEvent>(
    handler: (event: Event) => Promise<Response>,
): (event: Event) => Promise<Response> {
    return async (event) => {
        try {
            return await handler(event);
        } catch (err) {
            if (isHttpError(err)) {
                return json(
                    { error: err.body.message },
                    { status: err.status },
                );
            }
            console.error(
                `API error on ${event.request.method} ${event.url.pathname}:`,
                err,
            );
            return json({ error: "Internal error" }, { status: 500 });
        }
    };
}

export function requireUser(event: RequestEvent): User {
    const user = event.locals.user;
    if (!user) {
        return error(401, "You must be logged in");
    }
    return user;
}

/** Parses the request body, which every JSON endpoint expects to be an object. */
export async function readJson(
    event: RequestEvent,
): Promise<Record<string, unknown>> {
    let body: unknown;
    try {
        body = await event.request.json();
    } catch {
        return error(400, "The request body must be valid JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return error(400, "The request body must be a JSON object");
    }
    return body as Record<string, unknown>;
}

/** Reads an optional string field, rejecting any other type. */
export function getString(
    body: Record<string, unknown>,
    key: string,
): string | undefined {
    const value = body[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "string") {
        return error(400, `"${key}" must be a string`);
    }
    return value;
}

/** Query string flags are only on when explicitly set to "true". */
export function getFlag(url: URL, key: string): boolean {
    return url.searchParams.get(key) === "true";
}

export function getPage(url: URL): number {
    const value = url.searchParams.get("page");
    if (value === null) {
        return 1;
    }
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1) {
        return error(400, '"page" must be a positive integer');
    }
    return page;
}

/** The pagination fields every list endpoint returns next to its items. */
export function pagination(count: number, page: number, limit = PAGE_SIZE) {
    return {
        count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
    };
}

/**
 * Looks up an audio the way the listen page does: uploads by accounts still
 * awaiting review are only visible to their uploader and to admins, and are
 * reported as missing to everyone else.
 */
export async function findVisibleAudio(
    event: RequestEvent,
    id: string,
): Promise<Audio> {
    const audio = await Audio.findByPk(id, { include: [User] });
    const viewer = event.locals.user;
    if (
        !audio ||
        (audio.user &&
            !audio.user.isTrusted &&
            !viewer?.isAdmin &&
            viewer?.id !== audio.userId)
    ) {
        return error(404, "Audio not found");
    }
    return audio;
}

/**
 * Looks up a stream by its id, or by "@username" for whatever that account is
 * broadcasting right now, the same way /live/[id] does.
 */
export async function findStream(param: string): Promise<Stream> {
    let streamId = param;
    if (isUsernameParam(param)) {
        const resolved = await resolveLiveUsername(param);
        if (resolved.kind === "no_user") {
            return error(404, "There is no account with that name.");
        }
        if (resolved.kind === "not_live") {
            return error(
                404,
                `${resolved.displayName} is not broadcasting right now.`,
            );
        }
        streamId = resolved.streamId;
    }

    const stream = await Stream.findByPk(streamId, { include: [User] });
    if (!stream) {
        return error(404, "Stream not found");
    }
    return stream;
}

export function serializeAccount(user: User): ClientsideAccount {
    return {
        ...user.toClientside(),
        email: user.email,
        isAdmin: user.isAdmin,
    };
}

/**
 * Converts audios for the client, filling in favorite counts and whether the
 * viewer favorited each one with two queries for the whole list.
 */
export async function serializeAudios(
    audios: Audio[],
    viewer: User | null | undefined,
): Promise<ClientsideAudio[]> {
    if (audios.length === 0) {
        return [];
    }

    const audioIds = audios.map((audio) => audio.id);
    const [favoriteCountsData, viewerFavoritesData] = await Promise.all([
        AudioFavorite.findAll({
            where: { audioId: audioIds },
            attributes: [
                "audioId",
                [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
            ],
            group: ["audioId"],
        }),
        viewer
            ? AudioFavorite.findAll({
                  where: { userId: viewer.id, audioId: audioIds },
                  attributes: ["audioId"],
              })
            : Promise.resolve([]),
    ]);

    const favoriteCounts = new Map(
        favoriteCountsData.map((item) => [
            item.audioId,
            parseInt((item as any).get("count")) || 0,
        ]),
    );
    const viewerFavorites = new Set(
        viewerFavoritesData.map((item) => item.audioId),
    );

    return audios.map((audio) =>
        audio.toClientside(
            true,
            favoriteCounts.get(audio.id) ?? 0,
            viewer ? viewerFavorites.has(audio.id) : undefined,
        ),
    );
}
