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
    import type { ClientsideStreamChat, ClientsideUser } from "$lib/types";
    import StreamChat from "./stream_chat.svelte";

    export let streamId: string;
    export let chats: ClientsideStreamChat[] = [];
    export let user: ClientsideUser | null = null;
    export let onSendMessage:
        | ((content: string) => Promise<boolean> | boolean)
        | null = null;
    export let isAdmin: boolean = false;
    export let onDelete: ((chatId: string) => void) | null = null;
    export let onMute:
        | ((chat: ClientsideStreamChat, durationMinutes: number | null) => void)
        | null = null;
    export let streamOwnerId: string | null = null;
    export let onReact:
        | ((chat: ClientsideStreamChat, emoji: string) => void)
        | null = null;
    export let notice: string = "";

    let messageText = "";
    async function submitChat() {
        const text = messageText.trim();
        if (!text || !onSendMessage) return;
        try {
            // Only clear the input once the message was actually sent, so the
            // text survives rejections like slow mode.
            if (await onSendMessage(text)) {
                messageText = "";
            }
        } catch {
            // Keep the text so the user can retry.
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitChat();
        }
    }
</script>

<section role="group" aria-label="Live Chat" class="chat-section">
    <h2>Live Chat</h2>

    <div class="chat-messages">
        {#each chats as chat (chat.id)}
            <StreamChat
                {chat}
                {isAdmin}
                {onDelete}
                {onMute}
                {streamOwnerId}
                {onReact}
                currentUser={user}
            />
        {:else}
            <p class="no-chats">No messages yet</p>
        {/each}
    </div>

    {#if notice}
        <p class="chat-notice" role="status">{notice}</p>
    {/if}

    {#if onSendMessage && user && !user.isBanned}
        <form class="chat-form" on:submit|preventDefault={submitChat}>
            <label for="chat-input-{streamId}">Send a message:</label>
            <textarea
                id="chat-input-{streamId}"
                placeholder="Type your message here..."
                maxlength="1024"
                bind:value={messageText}
                on:keydown={handleKeydown}
            ></textarea>
            <button type="submit">Send</button>
        </form>
    {:else if !user}
        <p class="login-prompt">
            <a href="/login">Log in</a> to send messages
        </p>
    {/if}
</section>

<style>
    .chat-section {
        margin-top: 1.5rem;
        padding: 1rem;
        background: #f9f9f9;
        border-radius: 8px;
    }

    .chat-section h2 {
        margin-top: 0;
        font-size: 1.2rem;
    }

    .chat-messages {
        max-height: 400px;
        overflow-y: auto;
        margin-bottom: 1rem;
    }

    .no-chats {
        color: #999;
        font-style: italic;
    }

    .chat-notice {
        margin: 0 0 0.5rem;
        padding: 0.5rem;
        background: #fff3cd;
        border: 1px solid #ffeeba;
        border-radius: 4px;
        color: #856404;
        font-size: 0.9rem;
    }

    .login-prompt {
        text-align: center;
        color: #666;
    }

    .chat-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .chat-form textarea {
        resize: vertical;
        min-height: 60px;
    }
</style>
