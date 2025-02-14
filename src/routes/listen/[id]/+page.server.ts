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
import fs from "fs/promises";
import { Audio, Comment, User } from "$lib/server/database";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import sendEmail from "$lib/server/email";

export const load: PageServerLoad = async (event) => {
    const isFromAi = event.locals.isFromAi;
    const audio = await Audio.findByPk(event.params.id, { include: User });
    if (!audio) {
        return error(404, "Not found");
    }
    if (audio.isFromAi !== isFromAi) {
        return error(
            404,
            `this audio is not in this mirror.
      Please go to ${
          audio.isFromAi ? "AI trash" : "normal"
      } website to listen to this audio.`
        );
    }
    const comments = await Comment.findAll({
        where: { audioId: audio.id },
        include: {
            model: User,
            where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
        },

        order: [["createdAt", "ASC"]],
    });
    return {
        audio: audio.toClientside(),
        comments: comments.map((c) => c.toClientside(false)),
        mimeType: audio.mimeType,
    };
};

export const actions: Actions = {
    delete: async (event) => {
        const user = event.locals.user;
        const audio = await Audio.findByPk(event.params.id, { include: User });
        if (!audio) {
            return error(404, "Not found");
        }
        if (!user || (!user.isAdmin && user.id !== audio.userId)) {
            return error(403, "Forbidden");
        }
        await fs.unlink(audio.path);
        await audio.destroy();
        return redirect(303, "/");
    },
    move_to_ai: async (event) => {
        const user = event.locals.user;
        const audio = await Audio.findByPk(event.params.id, { include: User });
        if (!audio) {
            return error(404, "Not found");
        }
        if (!user || (!user.isAdmin && user.id !== audio.userId)) {
            return error(403, "Forbidden");
        }
        audio.isFromAi = true;
        await audio.save();
        if (user.isAdmin && audio.user) {
            await sendEmail(
                audio.user.email,
                "One of your uploads was sent to the AI trash mirror",
                `<p>Your audio, "${audio.title}" was moved to the AI trash mirror by an admin.</p>
        <p>It is now available at <a href="https://ai-trash.audiopub.site/listen/${audio.id}">https://ai-trash.audiopub.site/listen/${audio.id}</a></p>
      <p>If you think this is a mistake, please contact me.</p>
      <p> Please note that this is not punishment, but rather a way to keep the main site clean. You can still access your audio and it will still be available to the public, just from a different address.</p>`
            );
        }
        return redirect(
            303,
            `https://ai-trash.audiopub.site/listen/${audio.id}`
        );
    },
    move_to_main: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isAdmin) {
            return error(403, "Forbidden");
        }
        const audio = await Audio.findByPk(event.params.id, { include: User });
        if (!audio) {
            return error(404, "Not found");
        }
        audio.isFromAi = false;
        await audio.save();
        if (audio.user) {
            await sendEmail(
                audio.user.email,
                "One of your uploads was moved back to the main audiopub",
                `<p>Your audio, "${audio.title}" was moved back to the main mirror by an admin.</p>
        <p>It is now available at <a href="https://audiopub.site/listen/${audio.id}">https://audiopub.site/listen/${audio.id}</a></p>
        <p>We are very sorry for the previous false positive and any inconvenience the move to the AI trash mirror may have caused.</p>`
            );
        }
        return redirect(303, `https://audiopub.site/listen/${audio.id}`);
    },
    add_comment: async (event) => {
        const user = event.locals.user;
        if (!user || !user.isVerified || user.isBanned) {
            return error(403, "Forbidden");
        }
        const audio = await Audio.findByPk(event.params.id);
        if (!audio) {
            return error(404, "Not found");
        }
        const form = await event.request.formData();
        const comment = form.get("comment") as string;
        if (!comment) {
            return fail(400, { comment });
        }
        if (comment.length < 3 || comment.length > 4000) {
            return fail(400, {
                comment,
                message: "Comment must be between 3 and 4000 characters",
            });
        }
        const commentInDatabase = await Comment.create({
            userId: user.id,
            audioId: audio.id,
            content: comment,
        });
        return { success: true };
    },
    delete_comment: async (event) => {
        // Only an admin, or the user who made the comment can delete a comment
        const user = event.locals.user;
        const form = await event.request.formData();
        const commentId = form.get("id") as string;
        if (!commentId) {
            return fail(400);
        }
        const comment = await Comment.findByPk(commentId, { include: User });
        if (!comment) {
            return error(404, "Not found");
        }
        if (!user || (!user.isAdmin && user.id !== comment.userId)) {
            return error(403, "Forbidden");
        }
        await comment.destroy();
        return { success: true };
    },
};
