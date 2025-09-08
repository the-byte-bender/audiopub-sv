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
    export let currentUser: ClientsideUser | null = null;

    $: favoritesString = (() => {
        const count = audio.favoriteCount || 0;
        if (count === 0) return "No favorites";
        if (count === 1) return "1 favorite";
        return `${count} favorites`;
    })();
</script>

<article class="audio-item">
    <div class="audio-header">
        <h3 aria-describedby="audio-stats-{audio.id}">
            {#if audio.user && !audio.user.isTrusted}
                <span style="color: red">(Pending review)</span> |{" "}
            {/if}
            <a href={`/listen/${audio.id}`}>{audio.title}</a>
        </h3>
        <div class="audio-stats" id="audio-stats-{audio.id}">
            <span class="plays">{audio.playsString}</span>
            with <span class="favorites">{favoritesString}</span>
        </div>
    </div>
    {#if audio.user}
        <p>
            By <a href={`/user/${audio.user.id}`}>{audio.user.displayName}</a>
        </p>
    {/if}
    <SafeMarkdown source={audio.description} />
</article>

<!--
 Copyright 2025 the-byte-bender.
 SPDX-License-Identifier: MPL-2.0
-->

<style>
    .audio-item {
        margin-bottom: 20px;
        border: 1px solid #ccc;
        padding: 10px;
    }

    .audio-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 8px;
    }

    .audio-header h3 {
        margin: 0;
        flex: 1;
        min-width: 200px;
    }

    .audio-stats {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
    }

    .plays,
    .favorites {
        color: #666;
        font-size: 14px;
        white-space: nowrap;
    }
</style>
