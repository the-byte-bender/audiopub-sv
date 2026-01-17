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
    import type { ClientsideComment } from "$lib/types.js";

export let form: any;

    onMount(() => title.set(data.audio.title));
    
    const handlePlay = () => {
        fetch(`/listen/${data.audio.id}/try_register_play`, { method: "POST" });
    };

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

    async function handleDeleteAudio() {
        const confirmed = await dialog.confirm({
            title: "Delete audio?",
            message: "Are you sure you want to permanently delete this audio? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true
        });

        if (confirmed) {
            const form = document.querySelector('form[action="?/delete"]') as HTMLFormElement;
            form?.submit();
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
    on:play={handlePlay}
/>

<div class="audio-details">
    <div class="audio-stats">
        <span>{data.audio.playsString}</span>
        <span>{favoritesString}</span>
{#if data.user}
            {#if data.audio.isFavorited}
                <form use:enhance action="?/unfavorite" method="POST">
                    <button type="submit" class="favorite-button favorited">
                        <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        Remove from favorites
                    </button>
                </form>
            {:else}
                <form use:enhance action="?/favorite" method="POST">
                    <button type="submit" class="favorite-button">
                        <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        Add to favorites
                    </button>
                </form>
            {/if}
        {/if}
    </div>
    {#if data.audio.user}
        <p>
            Uploaded by: <a href="/user/{data.audio.user.id}"
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
        <form action="?/delete" method="POST">
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
            {#if form?.replyTo}
            <input type="hidden" name="parentId" value={form.replyTo.id} />
            <label for="comment">Reply to @{form.replyTo.user.name}:</label>
            {:else}
            <label for="comment">Add a comment:</label>
            {/if}
            <textarea bind:this={commentField} name="comment" id="comment" required maxlength="4000"></textarea>
            <button type="submit">{form?.replyTo ? 'Reply' : 'Comment'}</button>
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
