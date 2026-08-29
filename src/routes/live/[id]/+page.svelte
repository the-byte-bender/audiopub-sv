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
    export let data;

    import { onMount, tick } from "svelte";
    import StreamChatList from "$lib/components/stream_chat_list.svelte";
    import AudioPlayer from "$lib/components/audio_player.svelte";
    import ChatReader from "$lib/components/chat_reader.svelte";
    import SafeMarkdown from "$lib/components/safe_markdown.svelte";
    import Modal from "$lib/components/modal.svelte";
    import { fade, slide } from "svelte/transition";
    import { enhance } from "$app/forms";
    import title from "$lib/title";
    import type {
        ClientsideStreamChat,
        ClientsideStreamMute,
        ClientsideReaction,
    } from "$lib/types";

    onMount(() => title.set(data.stream.title));

    $: isOwnerOrAdmin =
        data.user && (data.user.id === data.stream.user?.id || data.isAdmin);

    let audioEl: HTMLAudioElement;
    let streamEnded = false;
    let isPlaying = false;
    interface IcecastPlayer {
        play(): void;
        stop(): void;
        detachAudioElement(): void;
    }

    let player: IcecastPlayer | null = null;

    let activeListeners = data.stream.activeListeners;
    let peekListeners = data.stream.peekListeners;

    let chats = (data.chats ?? []) as ClientsideStreamChat[];
    let latestChat: ClientsideStreamChat | null = null;
    let eventSource: EventSource | null = null;

    let mutes = (data.mutes ?? []) as ClientsideStreamMute[];
    let slowModeSeconds = data.slowModeSeconds ?? 0;
    let slowModeValue = String(slowModeSeconds);
    let chatNotice = "";
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;

    function setChatNotice(message: string, durationMs = 4000) {
        if (noticeTimer) {
            clearTimeout(noticeTimer);
            noticeTimer = null;
        }
        chatNotice = message;
        if (!message) return;
        noticeTimer = setTimeout(() => {
            chatNotice = "";
            noticeTimer = null;
        }, durationMs);
    }

    async function handleChatReaction(
        chat: ClientsideStreamChat,
        emoji: string,
    ) {
        try {
            const res = await fetch(`/live/${data.stream.id}/${chat.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) {
                setChatNotice("Could not save your reaction.");
                return;
            }
            const body = await res.json();
            applyChatReactions(chat.id, body.reactions as ClientsideReaction[]);
        } catch {
            setChatNotice("Could not save your reaction.");
        }
    }

    function applyChatReactions(
        chatId: string,
        reactions: ClientsideReaction[],
    ) {
        chats = chats.map((c) =>
            c.id === chatId ? { ...c, reactions } : c,
        );
    }

    function connectSSE() {
        eventSource = new EventSource(`/live/${data.stream.id}/events`);

        eventSource.addEventListener("listeners", (e) => {
            const d = JSON.parse(e.data);
            activeListeners = d.activeListeners;
            peekListeners = d.peekListeners;
        });

        eventSource.addEventListener("state", (e) => {
            const d = JSON.parse(e.data);
            if (d.state === "finished") {
                streamEnded = true;
                player?.stop();
                eventSource?.close();
            }
        });

        eventSource.addEventListener("archived", () => {
            streamEnded = true;
            player?.stop();
            eventSource?.close();
            window.location.href = `/listen/${data.stream.id}`;
        });

        eventSource.addEventListener("chat", (e) => {
            const chat = JSON.parse(e.data) as ClientsideStreamChat;
            chats = [...chats.filter((c) => c.id !== chat.id), chat];
            handleNewChat(chat);
        });

        eventSource.addEventListener("chat_reaction", (e) => {
            const d = JSON.parse(e.data);
            const reactions = (d.reactions ?? []) as ClientsideReaction[];
            // The broadcast tally has no notion of "mine"; recompute it from
            // the actor when it was us, and keep our previous flags otherwise.
            const mine =
                d.actorId === data.user?.id
                    ? (d.emoji as string | null)
                    : (chats
                          .find((c) => c.id === d.chatId)
                          ?.reactions?.find((r) => r.reacted)?.emoji ?? null);
            applyChatReactions(
                d.chatId,
                reactions.map((r) => ({ ...r, reacted: r.emoji === mine })),
            );
        });

        eventSource.addEventListener("chat_delete", (e) => {
            const { chatId } = JSON.parse(e.data);
            chats = chats.filter((c) => c.id !== chatId);
        });

        eventSource.addEventListener("moderation", (e) => {
            const d = JSON.parse(e.data);
            if (d.kind === "mute") {
                if (d.userId === data.user?.id) {
                    setChatNotice("You have been muted in this stream.");
                }
                if (d.mute) {
                    mutes = [
                        d.mute,
                        ...mutes.filter((m) => m.userId !== d.mute.userId),
                    ];
                }
            } else if (d.kind === "unmute") {
                if (d.userId === data.user?.id) {
                    setChatNotice("");
                }
                mutes = mutes.filter((m) => m.userId !== d.userId);
            } else if (d.kind === "slowmode") {
                slowModeSeconds = d.slowModeSeconds ?? 0;
                slowModeValue = String(slowModeSeconds);
                setChatNotice(
                    d.slowModeSeconds > 0
                        ? `Slow mode is on: ${d.slowModeSeconds} second${
                              d.slowModeSeconds === 1 ? "" : "s"
                          } between messages.`
                        : "",
                );
            }
        });

        eventSource.onerror = () => {
            if (eventSource?.readyState === EventSource.CLOSED) {
                streamEnded = true;
                player?.stop();
                eventSource = null;
            }
            // Otherwise EventSource is retrying automatically
        };
    }

    let showEndConfirm = false;

    function handleEndStream() {
        showEndConfirm = false;
        fetch(`/live/${data.stream.id}`, { method: "DELETE" });
    }

    async function handleSendMessage(content: string): Promise<boolean> {
        let res: Response;
        try {
            res = await fetch(`/live/${data.stream.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
        } catch {
            setChatNotice("Could not send message.");
            return false;
        }
        if (!res.ok) {
            let message = "Could not send message.";
            try {
                const body = await res.json();
                if (typeof body?.message === "string") {
                    message = body.message;
                }
            } catch {}
            setChatNotice(message);
            return false;
        }
        return true;
    }

    function handleMute(
        chat: ClientsideStreamChat,
        durationMinutes: number | null,
    ) {
        fetch(`/live/${data.stream.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "mute",
                userId: chat.user.id,
                durationMinutes,
            }),
        });
    }

    async function unmuteUser(userId: string) {
        // The moderation SSE event removes the user from the list everywhere.
        await fetch(`/live/${data.stream.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "unmute", userId }),
        });
    }

    async function saveSlowMode() {
        const seconds = Number(slowModeValue);
        if (slowModeSeconds === seconds) return;
        const res = await fetch(`/live/${data.stream.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "slowmode", seconds }),
        });
        if (res.ok) {
            slowModeSeconds = seconds;
        }
    }

    function handleDeleteChat(chatId: string) {
        fetch(`/live/${data.stream.id}/${chatId}`, { method: "DELETE" });
    }

    function handleNewChat(chat: ClientsideStreamChat) {
        latestChat = chat;
    }

    function iOS(): boolean {
        return (
            [
                "iPad Simulator",
                "iPhone Simulator",
                "iPod Simulator",
                "iPad",
                "iPhone",
                "iPod",
            ].includes(navigator.platform) ||
            (navigator.userAgent.includes("Mac") && "ontouchend" in document)
        );
    }

    async function handlePlay() {
        isPlaying = true;
        await tick();
        const IcecastMetadataPlayer = (await import("icecast-metadata-player"))
            .default;
        player = new IcecastMetadataPlayer(
            `https://live.audiopub.site/${data.stream.user?.id}`,
            {
                audioElement: audioEl,
                playbackMethod: iOS() ? "html5" : undefined,
                metadataTypes: [],
                onRetryTimeout: () => {
                    streamEnded = true;
                    player?.stop();
                },
            },
        );
        player.play();
    }

    onMount(() => {
        connectSSE();
        return () => {
            if (noticeTimer) {
                clearTimeout(noticeTimer);
                noticeTimer = null;
            }
            player?.stop();
            player?.detachAudioElement();
            eventSource?.close();
        };
    });
</script>

<h1>{data.stream.title}</h1>

<div class="stream-player">
    {#if streamEnded}
        <p class="stream-ended">
            Stream has ended or is temporarily unavailable.
        </p>
    {:else if !isPlaying}
        <button
            class="play-button"
            on:click={handlePlay}
            transition:fade={{ duration: 200 }}
        >
            Play
        </button>
    {:else}
        <div transition:slide={{ duration: 300 }}>
            <AudioPlayer live bind:audioElement={audioEl} />
        </div>
    {/if}
</div>

<div class="stream-details">
    <div class="stream-stats">
        <span>
            <strong>{activeListeners}</strong> listener{activeListeners === 1
                ? ""
                : "s"}
        </span>
        <span>Peak: {peekListeners}</span>
    </div>

    {#if data.stream.user}
        <p>
            Streaming by: <a
                href="/user/@{encodeURIComponent(data.stream.user.name)}"
                >{data.stream.user.displayName}</a
            >
        </p>
    {/if}

    <p>Started: {new Date(data.stream.createdAt).toLocaleString()}</p>

    {#if isOwnerOrAdmin}
        <button
            class="end-stream-button"
            on:click={() => (showEndConfirm = true)}
        >
            End Stream
        </button>
    {/if}

    <Modal bind:visible={showEndConfirm}>
        <h2>End stream?</h2>
        <p>
            This will end the stream immediately. This action cannot be undone.
        </p>
        <div class="modal-actions">
            <button type="button" on:click={() => (showEndConfirm = false)}
                >Cancel</button
            >
            <button type="button" on:click={handleEndStream}>End Stream</button>
        </div>
    </Modal>

    {#if isOwnerOrAdmin}
        <details class="moderation-panel">
            <summary>Moderation</summary>

            <div class="mod-setting">
                <label for="slowmode-select">Slow mode</label>
                <select
                    id="slowmode-select"
                    bind:value={slowModeValue}
                    on:change={saveSlowMode}
                >
                    <option value="0">Off</option>
                    <option value="5">5 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">60 seconds</option>
                </select>
                <span class="mod-hint">
                    Minimum time each user must wait between messages.
                </span>
            </div>

            <div class="mod-mutes">
                <h3>Muted users</h3>
                {#if mutes.length === 0}
                    <p class="mod-empty">No muted users.</p>
                {:else}
                    <ul>
                        {#each mutes as mute}
                            <li>
                                <a
                                    href="/user/@{encodeURIComponent(
                                        mute.userName,
                                    )}">{mute.displayName}</a
                                >
                                <span class="mute-info">
                                    {#if mute.expiresAt}
                                        until {new Date(
                                            mute.expiresAt,
                                        ).toLocaleString()}
                                    {:else}
                                        permanently
                                    {/if}
                                </span>
                                <button
                                    type="button"
                                    class="unmute-button"
                                    on:click={() => unmuteUser(mute.userId)}
                                    >Unmute</button
                                >
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </details>
    {/if}

    {#if data.stream.description}
        <h2>Description:</h2>
        <SafeMarkdown source={data.stream.description} />
    {/if}
</div>

<StreamChatList
    streamId={data.stream.id}
    {chats}
    user={data.user}
    isAdmin={data.isAdmin}
    onDelete={handleDeleteChat}
    onMute={handleMute}
    onReact={handleChatReaction}
    streamOwnerId={data.stream.user?.id ?? null}
    onSendMessage={handleSendMessage}
    notice={chatNotice}
/>

<ChatReader chat={latestChat} />

<style>
    h1 {
        text-align: center;
        margin-bottom: 1rem;
        color: #333;
    }

    .stream-player {
        margin-bottom: 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .play-button {
        padding: 1rem 2rem;
        font-size: 1.25rem;
        border: none;
        border-radius: 8px;
        background-color: #007bff;
        color: white;
        cursor: pointer;
        transition:
            background-color 0.3s ease,
            transform 0.2s ease;
    }

    .play-button:hover {
        background-color: #0056b3;
        transform: scale(1.05);
    }

    .stream-ended {
        padding: 1rem;
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        color: #721c24;
        text-align: center;
    }

    .stream-details {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        background-color: #f9f9f9;
        margin-bottom: 1rem;
    }

    .stream-stats {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 12px;
    }

    .stream-stats span {
        font-weight: 500;
        color: #666;
    }

    .stream-details a {
        color: #007bff;
        text-decoration: none;
    }

    .stream-details a:hover {
        text-decoration: underline;
    }

    .stream-details h2 {
        margin-top: 1rem;
        color: #333;
    }

    .stream-details p {
        margin: 0.25rem 0;
        color: #555;
    }

    .end-stream-button {
        margin-top: 0.75rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        background-color: #dc3545;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .end-stream-button:hover {
        background-color: #a71d2a;
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .moderation-panel {
        margin-top: 1rem;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 0.5rem 1rem 1rem;
        background-color: #f9f9f9;
    }

    .moderation-panel summary {
        cursor: pointer;
        font-weight: 600;
        color: #333;
        padding: 0.25rem 0;
    }

    .mod-setting {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }

    .mod-setting label {
        font-weight: 600;
        color: #555;
    }

    .mod-setting select {
        padding: 0.25rem 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    .mod-hint {
        color: #888;
        font-size: 0.85rem;
    }

    .mod-mutes {
        margin-top: 1rem;
    }

    .mod-mutes h3 {
        margin: 0 0 0.5rem;
        color: #333;
        font-size: 1rem;
    }

    .mod-mutes ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .mod-mutes li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0;
        border-bottom: 1px solid #eee;
    }

    .mod-mutes li:last-child {
        border-bottom: none;
    }

    .mod-mutes a {
        color: #007bff;
        text-decoration: none;
        font-weight: 600;
    }

    .mute-info {
        color: #888;
        font-size: 0.85rem;
    }

    .unmute-button {
        margin-left: auto;
        padding: 0.25rem 0.75rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        color: #333;
        cursor: pointer;
    }

    .unmute-button:hover {
        background: #f1f1f1;
    }

    .mod-empty {
        color: #999;
        font-style: italic;
        margin: 0;
    }
</style>
