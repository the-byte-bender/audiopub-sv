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
    import type { ClientsideAudio } from "$lib/types";
    import SafeMarkdown from "./safe_markdown.svelte";
    export let audios: ClientsideAudio[];

    export let paginationBaseUrl: string = "/";
    export let page: number = 1;
    export let totalPages: number = 0;
</script>

<section class="audio-list">
    {#each audios as audio}
        <article class="audio-item">
            <h3>
                {#if audio.user && !audio.user.isTrusted}
                    <span style="color: red">(Pending review)</span> |{" "}
                {/if}
                <a href={`/listen/${audio.id}`}>{audio.title}</a>| {audio.playsString}
            </h3>
            {#if audio.user}
                <p>
                    By <a href={`/user/${audio.user.id}`}
                        >{audio.user.displayName}</a
                    >
                </p>
            {/if}
            <SafeMarkdown source={audio.description} />
        </article>
    {/each}
</section>

{#if totalPages > 1}
    <div class="pagination">
        {#if page > 1}
            <a
                href={`${paginationBaseUrl}${paginationBaseUrl.includes("?") ? "&" : "?"}page=${page - 1}`}
                >Previous</a
            >
        {/if}
        <span aria-live="polite">Page {page} of {totalPages}</span>
        {#if page < totalPages}
            <a
                href={`${paginationBaseUrl}${paginationBaseUrl.includes("?") ? "&" : "?"}page=${page + 1}`}
                >Next</a
            >
        {/if}
    </div>
{/if}

<style>
    .warning {
        background-color: #ffe8e8;
        border: 1px solid #ff8888;
        padding: 10px;
        margin-bottom: 20px;
    }

    .audio-list {
        margin-top: 20px;
    }

    .audio-item {
        margin-bottom: 20px;
        border: 1px solid #ccc;
        padding: 10px;
    }

    .pagination {
        margin-top: 20px;
    }

    .pagination a {
        margin-right: 10px;
    }
</style>
