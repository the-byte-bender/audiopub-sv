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
    import { formatRelative } from "date-fns";
    import SafeMarkdown from "./safe_markdown.svelte";
    import Modal from "./modal.svelte";
    import ReactionBar from "./reaction_bar.svelte";

    export let chat: ClientsideStreamChat;
    export let isAdmin: boolean = false;
    export let onDelete: ((chatId: string) => void) | null = null;
    export let onMute:
        | ((chat: ClientsideStreamChat, durationMinutes: number | null) => void)
        | null = null;
    export let streamOwnerId: string | null = null;
    export let currentUser: ClientsideUser | null = null;
    export let onReact:
        | ((chat: ClientsideStreamChat, emoji: string) => void)
        | null = null;

    let isDeletionModalVisible: boolean = false;
    let isMuteModalVisible: boolean = false;
    let muteDuration: string = "5";

    $: isOwnMessage = currentUser !== null && currentUser.id === chat.user.id;
    $: isStreamOwner = currentUser !== null && streamOwnerId === currentUser.id;
    $: canDelete =
        onDelete !== null && (isOwnMessage || isStreamOwner || isAdmin);
    $: canMute = onMute !== null && (isStreamOwner || isAdmin);
    $: chatDate = formatRelative(new Date(chat.createdAt), new Date());
    $: canReact = Boolean(
        onReact && currentUser && currentUser.isVerified && !currentUser.isBanned,
    );

    function confirmMute() {
        const duration =
            muteDuration === "permanent" ? null : Number(muteDuration);
        if (onMute) onMute(chat, duration);
        isMuteModalVisible = false;
        muteDuration = "5";
    }
</script>

<article class="chat-message">
    <h3 class="chat-header">
        <a href="/user/@{encodeURIComponent(chat.user.name)}" class="username"
            >{chat.user.displayName}</a
        >
        <span class="chat-date">{chatDate}</span>
    </h3>
    <SafeMarkdown source={chat.content} />

    <ReactionBar
        targetId={chat.id}
        reactions={chat.reactions ?? []}
        onReact={(emoji) => {
            onReact?.(chat, emoji);
        }}
        {canReact}
        label="Reactions to this message"
    />

    {#if canMute}
        <button on:click={() => (isMuteModalVisible = true)}>Mute Sender</button>
        <Modal bind:visible={isMuteModalVisible}>
            <h2>Mute this user?</h2>
            <p>
                They won't be able to send messages in this stream for the
                chosen duration. Choose "Permanent" to ban them from this
                chat entirely.
            </p>
            <label class="mute-duration" for="mute-duration-select">
                Duration:
            </label>
            <select
                id="mute-duration-select"
                bind:value={muteDuration}
            >
                <option value="5">5 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="300">5 hours</option>
                <option value="600">10 hours</option>
                <option value="permanent">Permanent</option>
            </select>
            <button on:click={() => (isMuteModalVisible = false)}
                >Cancel</button
            >
            <button on:click={confirmMute}>Confirm mute</button>
        </Modal>
    {/if}

    {#if canDelete}
        <button on:click={() => (isDeletionModalVisible = true)}>Delete</button>
        <Modal bind:visible={isDeletionModalVisible}>
            <h2>Delete this message?</h2>
            <p>Are you sure? This action cannot be undone.</p>
            <button on:click={() => (isDeletionModalVisible = false)}
                >Cancel</button
            >
            <button
                on:click={() => {
                    if (onDelete) onDelete(chat.id);
                    isDeletionModalVisible = false;
                }}>Confirm delete</button
            >
        </Modal>
    {/if}
</article>

<style>
    .chat-message {
        padding: 0.5rem;
        border-bottom: 1px solid #eee;
    }

    .chat-message:last-child {
        border-bottom: none;
    }

    .chat-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
    }

    .username {
        font-weight: 600;
        color: #007bff;
        text-decoration: none;
    }

    .username:hover {
        text-decoration: underline;
    }

    .chat-date {
        font-size: 0.8em;
        color: #999;
    }

    .mute-duration {
        margin-right: 0.5rem;
    }
</style>
