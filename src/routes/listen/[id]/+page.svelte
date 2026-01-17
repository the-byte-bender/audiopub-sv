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
    import title from "$lib/title";
    import SafeMarkdown from "$lib/components/safe_markdown.svelte";
    import { dialog } from "$lib/stores/dialog";
    import AudioPlayer from "$lib/components/audio_player.svelte";
    import AudioActions from "$lib/components/audio_actions.svelte";
    import { registerPlay } from "$lib/utils";
    import type { ClientsideComment } from "$lib/types.js";

export let form: any;

    onMount(() => title.set(data.audio.title));
    
    let hasRegisteredPlay = false;
    const handleTimeUpdate = (e: CustomEvent<{currentTime: number, duration: number}>) => {
        if (!hasRegisteredPlay) {
            registerPlay(data.audio.id, e.detail.currentTime, e.detail.duration).then(success => {
                if (success) hasRegisteredPlay = true;
            });
        }
    };

    let commentField: HTMLTextAreaElement;
    function onReply(comment: ClientsideComment) {
commentField.focus();
    }

    let deleteAudioForm: HTMLFormElement;

    async function handleDeleteAudio() {
        const confirmed = await dialog.confirm({
            title: "Delete audio?",
            message: "Are you sure you want to permanently delete this audio? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true
        });

        if (confirmed && deleteAudioForm) {
            deleteAudioForm.submit();
        }
    }
</script>

<h1>{data.audio.title}</h1>

<AudioPlayer 
    sources={[
        { src: `/${data.audio.path}`, type: data.mimeType },
        { src: `/${data.audio.transcodedPath}`, type: 'audio/aac' }
    ]}
    title={data.audio.title}
    downloadUrl={`/${data.audio.path}`}
    downloadFilename={data.audio.title + (data.audio.extension.startsWith(".") ? data.audio.extension : "." + data.audio.extension)}
    on:timeupdate={handleTimeUpdate}
/>

<div class="audio-details">
    {#if form?.message && !form?.comment}
        <div class="error-message" role="alert">
            {form.message}
        </div>
    {/if}
    <div class="audio-stats">
        <span>{data.audio.playsString}</span>
        <AudioActions audio={data.audio} user={data.user} />
    </div>
    {#if data.audio.user}
        <p>
            Uploaded by: <a href="/@{data.audio.user.name}"
                >{data.audio.user.name}</a
            >
        </p>
    {/if}
    <p>Upload date: {new Date(data.audio.createdAt).toLocaleDateString()}</p>
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
    {#if data.audio.description}
        <h2>Description:</h2>
        <SafeMarkdown source={data.audio.description} />
    {/if}

    {#if data.user && (data.isAdmin || data.user.id === data.audio.user?.id)}
        <form bind:this={deleteAudioForm} action="?/delete" method="POST">
            <button type="button" on:click={handleDeleteAudio}> Permanently delete</button>
        </form>
    {/if}
<section role="group" aria-label="Comments">
  <h2>Comments</h2>
  {#if data.comments.length > 0}
    <CommentList
        comments={data.comments}
        isAdmin={data.isAdmin}
        user={data.user}
        {onReply}
    />
    {:else}
    <p>No comments yet</p>
  {/if}
</section>

    {#if data.user && !data.user.isBanned}
        {#if !data.user.isTrusted}
            <p role="alert">
                You're not trusted yet. Your comments will be reviewed before
                being shown. If you submit a comment, it will not be displayed
                until it's reviewed.
            </p>
        {/if}
        <form use:enhance action="?/add_comment" method="POST" aria-label="Add a comment">
            {#if form?.message}
                <p class="error-message" role="alert">{form.message}</p>
            {/if}
            {#if form?.replyTo}
            <input type="hidden" name="parentId" value={form.replyTo.id} />
            <label for="comment">Reply to @{form.replyTo.user.name}:</label>
            {:else if form?.parentId}
            <input type="hidden" name="parentId" value={form.parentId} />
            <label for="comment">Reply (ID: {form.parentId}):</label>
            {:else}
            <label for="comment">Add a comment:</label>
            {/if}
            <textarea bind:this={commentField} name="comment" id="comment" required maxlength="4000">{form?.comment ?? ""}</textarea>
            <button type="submit">{form?.replyTo || form?.parentId ? 'Reply' : 'Comment'}</button>
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

    /* Styling for the uploaded by link */
    .audio-details a {
        color: #007bff;
        text-decoration: none;
    }

    .error-message {
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 0.75rem;
        margin-bottom: 1rem;
        text-align: center;
    }

    /* Styling for the description section */
    .audio-details h2 {
        margin-top: 1rem;
        color: #333;
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
</style>
