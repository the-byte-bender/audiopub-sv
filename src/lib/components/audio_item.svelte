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
    import type { ClientsideAudio, ClientsideUser } from "$lib/types";
    import SafeMarkdown from "./safe_markdown.svelte";

    export let audio: ClientsideAudio;
    /** @deprecated current user is not used in audio_item anymore */
    export let currentUser: ClientsideUser | null = null;
    currentUser; // silence unused export warning

    $: favoritesString = (() => {
        const count = audio.favoriteCount || 0;
        if (count === 0) return "No favorites";
        if (count === 1) return "1 favorite";
        return `${count} favorites`;
    })();
</script>

<article class="audio-item">
    <h3>
        {#if audio.user && !audio.user.isTrusted}
            <span style="color: red">(Pending review)</span> |{" "}
        {/if}
        <a href={`/listen/${audio.id}`}>{audio.title}</a>
        <span class="stats"> | {audio.playsString} | {favoritesString}</span>
    </h3>
    {#if audio.user}
        <p>
            By <a href={`/user/${audio.user.id}`}>{audio.user.displayName}</a>
        </p>
    {/if}
    <SafeMarkdown source={audio.description} />
</article>

<style>
    .audio-item {
        margin-bottom: 20px;
        border: 1px solid #ccc;
        padding: 10px;
    }

    h3 {
        margin: 0 0 8px 0;
    }

    .stats {
        color: #666;
        font-size: 0.9em;
        font-weight: normal;
        margin-left: 0.5em;
        white-space: nowrap;
    }
</style>
