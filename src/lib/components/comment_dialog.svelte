<!--
  This file is part of the audiopub project.
  
  Copyright (C) 2026 the-byte-bender
  
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
    import Modal from "./modal.svelte";
    import CommentList from "./comment_list.svelte";
    import { enhance } from "$app/forms";
    import type { ClientsideAudio, ClientsideUser, ClientsideComment } from "$lib/types";
    import { browser } from "$app/environment";
    import { createEventDispatcher } from "svelte";

    export let visible = false;
    export let audio: ClientsideAudio | null = null;
    export let user: ClientsideUser | null = null;

    const dispatch = createEventDispatcher<{
        commentAdded: { comment: ClientsideComment };
    }>();

    let touchStartY = 0;
    let dialogScrollTop = 0;
    let scrollContainer: HTMLDivElement;

    function handleTouchStart(event: TouchEvent) {
        touchStartY = event.touches[0].clientY;
        dialogScrollTop = scrollContainer?.scrollTop || 0;
    }

    function handleTouchEnd(event: TouchEvent) {
        const touchEndY = event.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;
        
        // If swipe down more than 100px and dialog is at top, close it
        if (deltaY > 100 && dialogScrollTop <= 0) {
            close();
        }
    }

    function close() {
        visible = false;
    }
</script>

<Modal bind:visible labelledBy="comments-title">
    <div 
        class="comment-dialog-inner"
        on:touchstart={handleTouchStart}
        on:touchend={handleTouchEnd}
        role="presentation"
    >
        {#if audio}
            <div class="comments-header">
                <h3 id="comments-title">Comments</h3>
                <button class="close-btn" on:click={close} aria-label="Close comments dialog">✕</button>
            </div>
            
            <div class="comments-content" bind:this={scrollContainer}>
                {#if audio.comments && audio.comments.length > 0}
                    <CommentList 
                        comments={audio.comments} 
                        user={user ?? undefined} 
                        isAdmin={false}
                    />
                {:else}
                    <p class="no-comments">No comments yet. Be the first to comment!</p>
                {/if}
                
                {#if user && !user.isBanned}
                    <div class="comment-form">
                        <form 
                            use:enhance={browser ? ({ formData }) => {
                                formData.append('audioId', audio?.id || '');
                                return async ({ result, update }) => {
                                    await update();
                                    if (result.type === 'success' && result.data?.comment) {
                                        dispatch('commentAdded', { comment: result.data.comment as ClientsideComment });
                                    }
                                };
                            } : undefined}
                            action="/quickfeed?/add_comment"
                            method="POST"
                        >
                            {#if !user.isTrusted}
                                <p class="warning">
                                    You're not trusted yet. Your comments will be reviewed before being shown.
                                </p>
                            {/if}
                            <textarea 
                                name="comment" 
                                placeholder="Add a comment..." 
                                required 
                                maxlength="4000"
                                rows="3"
                            ></textarea>
                            <button type="submit">Post Comment</button>
                        </form>
                    </div>
                {:else if !user}
                    <p class="login-prompt">
                        <a href="/login">Login</a> to comment
                    </p>
                {/if}
            </div>
        {/if}
    </div>
</Modal>

<style>
    .comment-dialog-inner {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 80vh;
        width: 100%;
        min-width: min(90vw, 500px);
    }

    .comments-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        border-bottom: 1px solid #eee;
        padding-bottom: 1rem;
    }

    .comments-header h3 {
        margin: 0;
        color: #333;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
    }

    .comments-content {
        flex: 1;
        overflow-y: auto;
        color: #333;
        display: flex;
        flex-direction: column;
    }

    .no-comments {
        text-align: center;
        color: #666;
        font-style: italic;
        margin: 2rem 0;
    }

    .comment-form {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }

    .comment-form .warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 0.5rem;
        border-radius: 0.25rem;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .comment-form textarea {
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 0.5rem;
        padding: 0.75rem;
        font-family: inherit;
        font-size: 0.9rem;
        resize: vertical;
        margin-bottom: 0.5rem;
    }

    .comment-form textarea:focus {
        outline: none;
        border-color: #007bff;
    }

    .comment-form button {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .comment-form button:hover {
        background: #0056b3;
    }

    .login-prompt {
        text-align: center;
        margin: 2rem 0;
        color: #666;
    }

    .login-prompt a {
        color: #007bff;
        text-decoration: none;
        font-weight: 600;
    }

    .login-prompt a:hover {
        text-decoration: underline;
    }
</style>
