<!--
  This file is part of the audiopub project.
  
  Copyright (C) 2025 the-byte-bender
  
  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
  
  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.
  
  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
    export let data;

    import { enhance } from "$app/forms";
    import { onMount } from "svelte";
    import CommentList from "$lib/components/comment_list.svelte";
    import StreamChatList from "$lib/components/stream_chat_list.svelte";
    import title from "$lib/title";
    import SafeMarkdown from "$lib/components/safe_markdown.svelte";
    import type {
        ClientsideComment,
        ClientsideStreamChat,
    } from "$lib/types.js";
    import { invalidateAll } from "$app/navigation";
    import SubscribeButton from "$lib/components/subscribe_button.svelte";
    import AudioPlayer from "$lib/components/audio_player.svelte";
    import Modal from "$lib/components/modal.svelte";

    export let form: any;

    type Chapter = {
        time: number;
        label: string;
        timestamp: string;
    };

    type ChapterSection = {
        chapters: Chapter[];
        description: string;
    };

    let audioElement: HTMLAudioElement | undefined;
    let showEditDialog = false;
    let showHistoryDialog = false;

    onMount(() => title.set(data.audio.title));
    const handlePlay = () => {
        fetch(`/listen/${data.audio.id}/try_register_play`, { method: "POST" });
    };

    function parseTimestamp(timestamp: string): number | null {
        const parts = timestamp.split(":").map(Number);
        if (parts.some((part) => !Number.isInteger(part))) return null;
        if (parts.length === 2) {
            const [minutes, seconds] = parts;
            if (seconds > 59) return null;
            return minutes * 60 + seconds;
        }
        if (parts.length === 3) {
            const [hours, minutes, seconds] = parts;
            if (minutes > 59 || seconds > 59) return null;
            return hours * 3600 + minutes * 60 + seconds;
        }
        return null;
    }

    function parseChapterLines(lines: string[]): Chapter[] {
        return lines
            .map((line) => {
                const match = line.match(
                    /^\s*(?:[-*+]\s*|\d+[.)]\s*)?\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*(?:[-:]\s*)?(.*)$/,
                );
                if (!match) return null;

                const time = parseTimestamp(match[1]);
                if (time === null) return null;

                return {
                    time,
                    timestamp: match[1],
                    label: match[2].trim() || "Chapter",
                };
            })
            .filter((chapter): chapter is Chapter => chapter !== null)
            .sort((a, b) => a.time - b.time);
    }

    function extractChapterSection(description: string): ChapterSection {
        const lines = description.split("\n");
        const start = lines.findIndex((line) =>
            /^#{1,6}\s+chapters\s*$/i.test(line.trim()),
        );
        if (start === -1) {
            return { chapters: [], description };
        }

        const end = lines.findIndex(
            (line, index) =>
                index > start && /^#{1,6}\s+\S/.test(line.trim()),
        );
        const chapterLines = lines.slice(start + 1, end === -1 ? undefined : end);
        const renderedDescription = [
            ...lines.slice(0, start),
            ...(end === -1 ? [] : lines.slice(end)),
        ]
            .join("\n")
            .trim();

        return {
            chapters: parseChapterLines(chapterLines),
            description: renderedDescription,
        };
    }

    function seekToChapter(time: number) {
        if (!audioElement) return;
        audioElement.currentTime = time;
    }

    $: chapterSection = extractChapterSection(data.audio.description || "");
    $: chapters = chapterSection.chapters;
    $: renderedDescription = chapterSection.description;

    $: favoritesString = (() => {
        const count = data.audio.favoriteCount || 0;
        if (count === 0) return "No favorites";
        if (count === 1) return "1 favorite";
        return `${count} favorites`;
    })();

    let commentField: HTMLTextAreaElement;
    function onReply(comment: ClientsideComment) {
        commentField.focus();
    }

    async function onArchivedChatReact(
        chat: ClientsideStreamChat,
        emoji: string,
    ) {
        const res = await fetch(
            `/live/${data.archivedStreamId}/${chat.id}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            },
        );
        if (res.ok) {
            // The archived page has no live connection, so reload the tally.
            await invalidateAll();
        }
    }

    function onShareClick() {
        const url = window.location.href;
        if (navigator.share) {
            navigator
                .share({
                    title: data.audio.title,
                    url: url,
                })
                .catch((error) => console.log("Error sharing", error));
        } else {
            navigator.clipboard
                .writeText(url)
                .then(() => {
                    alert("Link copied to clipboard");
                })
                .catch((err) => {
                    console.error("Could not copy text: ", err);
                });
        }
    }
</script>

<h1>
    {data.audio.title}
    {#if data.audio.isAnnouncement}<span class="announcement-tag"
            >[announcement]</span
        >{/if}
    {#if data.hasEdits}<span class="edited-tag">[edited]</span>{/if}
</h1>

{#if data.audio.isAnnouncement}
    <p class="announcement-note" role="note">
        This audio is pinned to the top of the upload page as an announcement.
    </p>
{/if}

<div class="audio-player">
    <AudioPlayer
        autofocus
        bind:audioElement
        on:play={handlePlay}
        sources={[
            { src: `/${data.audio.path}`, type: data.mimeType },
            { src: `/${data.audio.transcodedPath}`, type: "audio/aac" },
        ]}
    />
    <a
        href="/{data.audio.path}"
        download={data.audio.title +
            (data.audio.extension.startsWith(".")
                ? data.audio.extension
                : "." + data.audio.extension)}
    >
        Download
    </a>
    <button on:click={onShareClick}>Share</button><br />
</div>

<div class="audio-details">
    <div class="audio-stats">
        <span>{data.audio.playsString}</span>
        <span>{favoritesString}</span>
        {#if data.user}
            {#if data.audio.isFavorited}
                <form use:enhance action="?/unfavorite" method="POST">
                    <button type="submit" class="favorite-button favorited">
                        <svg
                            class="heart-icon"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                            ></path>
                        </svg>
                        Remove from favorites
                    </button>
                </form>
            {:else}
                <form use:enhance action="?/favorite" method="POST">
                    <button type="submit" class="favorite-button">
                        <svg
                            class="heart-icon"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                            ></path>
                        </svg>
                        Add to favorites
                    </button>
                </form>
            {/if}
        {/if}
    </div>
    {#if data.audio.user}
        <p>
            Uploaded by: <a href="/user/@{encodeURIComponent(data.audio.user.name)}"
                >{data.audio.user.name}</a
            >
        </p>
        {#if data.user && data.user.id != data.audio.user.id}
            <SubscribeButton isSubscribed={data.isSubscribed}></SubscribeButton>
        {/if}
    {/if}
    <p>Upload date: {new Date(data.audio.createdAt).toLocaleDateString()}</p>
    {#if chapters.length > 0}
        <details class="chapters">
            <summary>Chapters</summary>
            <ol>
                {#each chapters as chapter}
                    <li>
                        <button
                            type="button"
                            on:click={() => seekToChapter(chapter.time)}
                        >
                            <span>{chapter.timestamp}</span>
                            {chapter.label}
                        </button>
                    </li>
                {/each}
            </ol>
        </details>
    {/if}
    {#if data.user}
        {#if data.audio.user && data.audio.user.id !== data.user.id}
            {#if data.isFollowing}
                <form use:enhance action="?/unfollow" method="POST">
                    <button type="submit"
                        >Unfollow notifications from this audio</button
                    >
                </form>
            {:else}
                <form use:enhance action="?/follow" method="POST">
                    <button type="submit"
                        >Follow notifications from this audio</button
                    >
                </form>
            {/if}
        {/if}
    {/if}
    {#if renderedDescription}
        <h2>Description:</h2>
        <SafeMarkdown source={renderedDescription} />
    {/if}

    {#if data.canEdit}
        <button
            type="button"
            on:click={() => (showEditDialog = true)}
            disabled={data.remainingEdits === 0}>Edit audio details</button
        >
        {#if data.remainingEdits === 0}
            <p>You have used all 3 available edits.</p>
        {/if}

        <Modal bind:visible={showEditDialog}>
            <h2>Edit audio details</h2>
            {#if form?.editMessage}
                <p class="form-message" role="alert">{form.editMessage}</p>
            {/if}
            <form
                class="edit-form"
                use:enhance={() => {
                    return async ({ result, update }) => {
                        await update();
                        if (result.type === "success") {
                            showEditDialog = false;
                        }
                    };
                }}
                action="?/edit"
                method="POST"
            >
                    <label for="edit-title">Title:</label>
                    <input
                        id="edit-title"
                        name="title"
                        type="text"
                        value={data.audio.title}
                        required
                        minlength="3"
                        maxlength="120"
                    />
                    <label for="edit-description">Description:</label>
                    <textarea
                        id="edit-description"
                        name="description"
                        maxlength="5000"
                        value={data.audio.description}
                    ></textarea>
                    {#if data.remainingEdits !== null}
                        <p>{data.remainingEdits} edit(s) remaining.</p>
                    {/if}
                    <button type="submit">Save changes</button>
                    <button
                        type="button"
                        on:click={() => (showEditDialog = false)}>Cancel</button
                    >
            </form>
        </Modal>

        {#if data.edits.length > 0}
            <button type="button" on:click={() => (showHistoryDialog = true)}
                >View edit history</button
            >
            <Modal bind:visible={showHistoryDialog}>
                <h2>Edit history</h2>
                <ol class="edit-history">
                    {#each data.edits as edit}
                        <li>
                            <strong>{new Date(edit.createdAt).toLocaleString()}</strong>
                            by @{edit.editor?.name || "unknown"}
                            {#if edit.isAdminEdit}(administrator){/if}
                            {#if edit.restoredEditId}(restoration){/if}
                            <details>
                                <summary>View changes</summary>
                                <p><strong>Title:</strong> {edit.previousTitle} → {edit.newTitle}</p>
                                <p><strong>Previous description:</strong></p>
                                <pre>{edit.previousDescription}</pre>
                                <p><strong>New description:</strong></p>
                                <pre>{edit.newDescription}</pre>
                                {#if data.isAdmin}
                                    <form
                                        use:enhance={() => {
                                            return async ({ result, update }) => {
                                                await update();
                                                if (result.type === "success") {
                                                    showHistoryDialog = false;
                                                }
                                            };
                                        }}
                                        action="?/revertEdit"
                                        method="POST"
                                    >
                                        <input
                                            type="hidden"
                                            name="editId"
                                            value={edit.id}
                                        />
                                        <button type="submit">Revert this edit</button>
                                    </form>
                                {/if}
                            </details>
                        </li>
                    {/each}
                </ol>
                <button type="button" on:click={() => (showHistoryDialog = false)}
                    >Close</button
                >
            </Modal>
        {/if}
    {/if}

    {#if data.isAdmin}
        <form use:enhance action="?/setAnnouncement" method="POST">
            <!-- A plain button that states the action it performs, rather
                 than a checkbox the admin has to remember to save. -->
            <input
                type="hidden"
                name="isAnnouncement"
                value={data.audio.isAnnouncement ? "off" : "on"}
            />
            <button type="submit">
                {#if data.audio.isAnnouncement}
                    Unpin as announcement
                {:else}
                    Pin as announcement on the upload page
                {/if}
            </button>
        </form>
    {/if}

    {#if data.user && (data.isAdmin || data.user.id === data.audio.user?.id)}
        <form
            use:enhance={({
                formElement,
                formData,
                action,
                cancel,
                submitter,
            }) => {
                if (!confirm("Are you sure you want to delete this audio?")) {
                    cancel();
                }
            }}
            action="?/delete"
            method="POST"
        >
            <button type="submit"> Permanently delete</button>
        </form>
    {/if}

    {#if data.archivedStreamChats && data.archivedStreamChats.length > 0 && data.archivedStreamId}
        <details class="chat-history">
            <summary>Stream Chat History</summary>
            <StreamChatList
                streamId={data.archivedStreamId}
                chats={data.archivedStreamChats}
                user={data.user ?? undefined}
                isAdmin={data.isAdmin}
                streamOwnerId={data.audio.user?.id ?? null}
                onReact={onArchivedChatReact}
                onDelete={async (chatId) => {
                    await fetch(`/live/${data.archivedStreamId}/${chatId}`, {
                        method: "DELETE",
                    });
                }}
            />
        </details>
    {/if}

    <section role="group" aria-label="Comments">
        <h2>Comments</h2>
        {#if data.comments.length > 0}
            <CommentList
                comments={data.comments}
                isAdmin={data.isAdmin}
                user={data.user ?? undefined}
                {onReply}
            />
        {:else}
            <p>No comments yet</p>
        {/if}
    </section>

    {#if data.user && !data.user.isBanned}
        <form use:enhance action="?/add_comment" method="POST">
            {#if form?.replyTo}
                <input type="hidden" name="parentId" value={form.replyTo.id} />
                <label for="comment">Reply to @{form.replyTo.user.name}:</label>
            {:else}
                <label for="comment">Add a comment:</label>
            {/if}
            <textarea
                bind:this={commentField}
                name="comment"
                id="comment"
                required
                maxlength="4000"
            ></textarea>
            <button type="submit">{form?.replyTo ? "Reply" : "Comment"}</button>
        </form>
    {/if}
</div>

<style>
    /* Styling for the main title */
    h1 {
        text-align: center;
        margin-bottom: 1rem;
        color: #333;
    }

    /* Styling for the audio player section */
    .audio-player {
        margin-bottom: 1rem;
    }

    /* Styling for the download link */
    .audio-player a {
        display: block;
        text-align: center;
        margin-top: 0.5rem;
        color: #007bff;
        text-decoration: none;
        font-weight: bold;
    }

    /* Styling for the audio details section */
    .audio-details {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        background-color: #f9f9f9;
    }

    /* Styling for the audio stats (plays and favorites) */
    .audio-stats {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 12px;
    }

    .audio-stats span {
        font-weight: 500;
        color: #666;
    }

    /* Favorite button styling */
    .favorite-button {
        display: flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        color: #666;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .favorite-button:hover {
        border-color: #ff6b6b;
        color: #ff6b6b;
        background-color: rgba(255, 107, 107, 0.1);
    }

    .favorite-button.favorited {
        color: #ff6b6b;
        border-color: #ff6b6b;
        background-color: rgba(255, 107, 107, 0.1);
    }

    .favorite-button .heart-icon {
        flex-shrink: 0;
    }

    /* Styling for the uploaded by link */
    .audio-details a {
        color: #007bff;
        text-decoration: none;
    }

    /* Styling for the description section */
    .audio-details h2 {
        margin-top: 1rem;
        color: #333;
    }

    .chapters {
        margin-top: 1rem;
    }

    .chapters summary {
        cursor: pointer;
        font-weight: 600;
        color: #333;
    }

    .chapters ol {
        margin: 0.5rem 0 0;
        padding-left: 1.5rem;
    }

    .chapters li {
        margin: 0.25rem 0;
    }

    .audio-details .chapters button {
        background: none;
        border: none;
        color: #007bff;
        cursor: pointer;
        margin: 0;
        padding: 0;
        text-align: left;
    }

    .audio-details .chapters button:hover {
        background: none;
        text-decoration: underline;
    }

    .chapters span {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        margin-right: 0.5rem;
    }

    /* Styling for the delete and move buttons */
    .audio-details form {
        margin-top: 1rem;
    }

    .audio-details button {
        margin-right: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        background-color: #007bff;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .audio-details button:hover {
        background-color: #0056b3;
    }

    /* Styling for the comment section */
    .audio-details form textarea {
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
    }

    .audio-details form button[type="submit"] {
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        background-color: #007bff;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .audio-details form button[type="submit"]:hover {
        background-color: #0056b3;
    }

    section[role="group"] {
        margin-top: 1rem;
        padding: 1rem;
        background-color: #f9f9f9;
        border: 1px solid #ccc;
        border-radius: 8px;
    }

    section[role="group"] h2 {
        color: #333;
        font-size: 1.5rem;
        margin-bottom: 1rem;
    }

    section[role="group"] p {
        margin-top: 1rem;
        color: #888;
    }

    .chat-history {
        margin-top: 1rem;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 0.5rem;
    }

    .chat-history summary {
        cursor: pointer;
        font-weight: 600;
        color: #333;
        padding: 0.25rem 0;
    }

    .edited-tag {
        font-size: 0.65em;
        font-weight: normal;
    }

    .announcement-tag {
        font-size: 0.65em;
        font-weight: normal;
        color: #856404;
    }

    .announcement-note {
        margin: 0 auto 1rem;
        max-width: 700px;
        padding: 0.5rem 0.75rem;
        background: #fff3cd;
        border: 1px solid #ffeeba;
        border-radius: 4px;
        color: #856404;
    }

    .edit-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .edit-form input,
    .edit-form textarea {
        padding: 0.5rem;
        box-sizing: border-box;
        width: 100%;
    }

    .edit-form textarea {
        min-height: 8rem;
    }

    .edit-history pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    .form-message {
        color: #a00;
    }

</style>
