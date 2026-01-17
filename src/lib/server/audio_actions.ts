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
import { Audio, AudioEditHistory } from "$lib/server/database";
import type User from "$lib/server/database/models/user";

export interface EditAudioOptions {
    user: User;
    audioId: string;
    title: string;
    description: string;
}

export interface EditAudioResult {
    success: boolean;
    error?: string;
}

/**
 * Edits an audio's title and description.
 * Users can edit up to 3 times. Admins have no limit.
 */
export async function editAudio(options: EditAudioOptions): Promise<EditAudioResult> {
    const { user, audioId, title, description } = options;

    const audio = await Audio.findByPk(audioId);
    if (!audio) {
        return { success: false, error: "Audio not found" };
    }

    // Check permissions: owner or admin
    const isAdmin = user.isAdmin;
    const isOwner = audio.userId === user.id;

    if (!isAdmin && !isOwner) {
        return { success: false, error: "Unauthorized" };
    }

    // Check edit limit (only for non-admins)
    if (!isAdmin && (audio.editCount ?? 0) >= 3) {
        return { success: false, error: "Edit limit reached (max 3 edits)" };
    }

    if (!title || title.trim().length < 3) {
        return { success: false, error: "Title must be at least 3 characters long" };
    }

    try {
        // Save history before updating
        await AudioEditHistory.create({
            audioId: audio.id,
            oldTitle: audio.title,
            oldDescription: audio.description,
            newTitle: title,
            newDescription: description,
        });

        audio.title = title;
        audio.description = description;
        if (!isAdmin) {
            audio.editCount = (audio.editCount ?? 0) + 1;
        }
        await audio.save();

        return { success: true };
    } catch (err) {
        console.error("Error editing audio:", err);
        return { success: false, error: "Internal server error" };
    }
}

/**
 * Reverts an audio to a previous state from history.
 * Only admins can do this.
 */
export async function revertAudio(adminUser: User, historyId: string): Promise<EditAudioResult> {
    if (!adminUser.isAdmin) {
        return { success: false, error: "Unauthorized" };
    }

    const history = await AudioEditHistory.findByPk(historyId);
    if (!history) {
        return { success: false, error: "History entry not found" };
    }

    const audio = await Audio.findByPk(history.audioId);
    if (!audio) {
        return { success: false, error: "Audio not found" };
    }

    try {
        // Create a new history entry for the revert action itself? 
        // Or just revert. Reverting is an edit too, but maybe admins shouldn't be limited by it.
        // Let's create a history entry for the revert.
        await AudioEditHistory.create({
            audioId: audio.id,
            oldTitle: audio.title,
            oldDescription: audio.description,
            newTitle: history.oldTitle,
            newDescription: history.oldDescription,
        });

        audio.title = history.oldTitle;
        audio.description = history.oldDescription;
        // Decrease editCount if we want to allow user to edit again, 
        // but typically revert is for fixing abuse, so maybe we keep the count?
        // User requested: "administradores devem ter um histórico para ver essas edições, e reverter caso abusarem dela."
        // If they abuse it, we revert and maybe decrease the count to let them "try again" properly, 
        // OR we just leave it. If they reached 3, they are done.
        // Let's not touch editCount here unless specifically requested.
        
        await audio.save();

        return { success: true };
    } catch (err) {
        console.error("Error reverting audio:", err);
        return { success: false, error: "Internal server error" };
    }
}
