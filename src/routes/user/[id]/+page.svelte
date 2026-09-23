<!--
  This file is part of the audiopub project.
  
  Copyright (C) 2024 the-byte-bender
  
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
    import { enhance } from "$app/forms";
    import AudioList from "$lib/components/audio_list.svelte";
    import SafeMarkdown from "$lib/components/safe_markdown.svelte";
    import StreamCard from "$lib/components/stream_card.svelte";
    import SubscribeButton from "$lib/components/subscribe_button.svelte";
    import MuteButton from "$lib/components/mute_button.svelte";
    import title from "$lib/title.js";
    import { onMount } from "svelte";
    export let data;
    onMount(() => title.set(`${data.profileUser.displayName}'s Profile`));

    // The feed only exists for accounts a logged-out visitor could see.
    $: hasFeed = data.profileUser.isTrusted && !data.profileUser.isBanned;
    $: feedUrl = `/user/@${encodeURIComponent(data.profileUser.name)}/feed.xml`;

    function onShareClick() {
        const url = `${window.location.origin}/user/@${encodeURIComponent(data.profileUser.name)}`;
        if (navigator.share) {
            navigator
                .share({
                    title: `${data.profileUser.displayName}'s Profile`,
                    url,
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

    // A browser downloads the feed instead of showing it, so rather than link
    // to it, hand over the address to paste into a podcast app.
    function onCopyFeedClick() {
        navigator.clipboard
            .writeText(`${window.location.origin}${feedUrl}`)
            .then(() => {
                alert("RSS feed link copied to clipboard");
            })
            .catch((err) => {
                console.error("Could not copy text: ", err);
            });
    }
</script>

<svelte:head>
    {#if hasFeed}
        <link
            rel="alternate"
            type="application/rss+xml"
            title={`${data.profileUser.displayName} on Audiopub`}
            href={feedUrl}
        />
    {/if}
</svelte:head>

<h1>{data.profileUser.displayName}'s Profile</h1>
<button on:click={onShareClick}>Share profile</button>
{#if hasFeed}
    <button on:click={onCopyFeedClick}>Copy RSS feed link</button>
{/if}

<table>
    <tbody>
        <tr>
            <td>Username</td>
            <td>{data.profileUser.name}</td>
        </tr>
        <tr>
            <td>Display Name</td>
            <td>{data.profileUser.displayName}</td>
        </tr>
        <tr>
            <td>Uploads</td>
            <td>{data.count}</td>
        </tr>
        <tr>
            <td>Subscribers</td>
            <td>{data.subscribers}</td>
        </tr>
    </tbody>
</table>

{#if data.user && data.user.id != data.profileUser.id}
    {#if !data.isMuted}
        <SubscribeButton isSubscribed={data.isSubscribed}></SubscribeButton>
    {/if}
    {#if data.canBeMutedByUser}
        <MuteButton
            isMuted={data.isMuted}
            isSubscribed={data.isSubscribed}
            displayName={data.profileUser.displayName}
        />
    {/if}
{/if}

{#if data.profileUser.bio != ""}
<h2>Bio</h2>

<SafeMarkdown source={data.profileUser.bio} />
{/if}

{#if data.isAdmin}
    {#if !data.profileUser.isTrusted}
        <form use:enhance action="?/trust" method="post">
            <button type="submit">Trust</button>
        </form>
    {/if}

    <details>
        <summary>administrative actions</summary>
        {#if !data.profileUser.isBanned}
            <form use:enhance action="?/ban" method="post">
                <label for="ban-reason">Reason</label>
                <input type="text" name="reason" id="ban-reason" required />
                <br />
                <label for="ban-message">Message</label>
                <textarea name="message" id="ban-message"></textarea>
                <button type="submit">Ban</button>
            </form>
        {/if}
        <br />
        <form use:enhance action="?/warn" method="post">
            <label for="warn-reason">Reason</label>
            <input type="text" name="reason" id="warn-reason" required />
            <br />
            <label for="warn-message">Message</label>
            <textarea name="message" id="warn-message"></textarea>
            <button type="submit">Warn</button>
        </form>
    </details>
{/if}

<h2>Uploads</h2>

{#if data.stream}
        <h3 id="stream-heading">Currently Streaming</h3>
        <StreamCard stream={data.stream} />
{/if}

<AudioList
    audios={data.audios}
    groupThreshold={0}
    page={data.page}
    totalPages={data.totalPages}
    paginationBaseUrl={`/user/@${encodeURIComponent(data.profileUser.name)}`}
/>

<style>
    details {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 1rem;
        margin-bottom: 1rem;
    }

    summary {
        cursor: pointer;
        font-weight: bold;
    }

    form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    label {
        font-weight: bold;
    }

    input[type="text"],
    textarea {
        padding: 0.5rem;
        border: 1px solid #ccc;
    }

    button {
        background-color: #333;
        color: #fff;
        padding: 0.75rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover {
        background-color: #444;
    }
</style>
