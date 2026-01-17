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
    import AudioItem from "./audio_item.svelte";
    export let audios: ClientsideAudio[];
    export let groupThreshold: number = 3;
    export let currentUser: ClientsideUser | null = null;

    export let paginationBaseUrl: string = "/";
    export let page: number = 1;
    export let totalPages: number = 0;

    type AudioGroup = {
        isGroup: true;
        user: NonNullable<ClientsideAudio["user"]>;
        audios: ClientsideAudio[];
        id: string;
    };

    let processedList: (ClientsideAudio | AudioGroup)[] = [];

    let expandedGroups = new Map<string, boolean>();

    function toggleGroup(id: string) {
        expandedGroups.set(id, !expandedGroups.get(id));
        expandedGroups = expandedGroups;
    }

    $: paginationQuerySeparator = paginationBaseUrl.includes("?") ? "&" : "?";

    $: {
        if (groupThreshold > 0 && audios?.length > 0) {
            const newList: (ClientsideAudio | AudioGroup)[] = [];
            let i = 0;
            while (i < audios.length) {
                const currentAudio = audios[i];
                const currentUser = currentAudio.user;

                if (!currentUser) {
                    newList.push(currentAudio);
                    i++;
                    continue;
                }

                let j = i + 1;
                while (
                    j < audios.length &&
                    audios[j].user?.id === currentUser.id
                ) {
                    j++;
                }

                const consecutiveAudios = audios.slice(i, j);
                const count = consecutiveAudios.length;

                if (count > groupThreshold) {
                    const itemsToShow = Math.max(1, groupThreshold - 1);

                    newList.push(...consecutiveAudios.slice(0, itemsToShow));

                    const groupId = `${currentUser.id}-${i}`;
                    newList.push({
                        isGroup: true,
                        user: currentUser,
                        audios: consecutiveAudios.slice(itemsToShow),
                        id: groupId,
                    });

                    if (!expandedGroups.has(groupId)) {
                        expandedGroups.set(groupId, false);
                    }
                } else {
                    newList.push(...consecutiveAudios);
                }
                i = j;
            }
            processedList = newList;
        } else {
            processedList = audios || [];
        }
    }
</script>

<section class="audio-list">
    {#each processedList as item (item.id)}
        {#if "isGroup" in item}
            <div class="audio-group">
                <h4>
                    <button
                        class="expand-button"
                        on:click={() => toggleGroup(item.id)}
                        aria-expanded={expandedGroups.get(item.id)
                            ? "true"
                            : "false"}
                    >
                        And {item.audios.length} more by {item.user.displayName}
                    </button>
                </h4>
                {#if expandedGroups.get(item.id)}
                    {#each item.audios as audio (audio.id)}
                        <AudioItem {audio} {currentUser} />
                    {/each}
                {/if}
            </div>
        {:else}
            {@const audio = item}
            <AudioItem {audio} {currentUser} />
        {/if}
    {/each}
</section>

{#if totalPages > 1}
    <nav class="pagination" aria-label="Pagination">
        {#if page > 1}
            <a
                href={`${paginationBaseUrl}${paginationQuerySeparator}page=${page - 1}`}
                >Previous</a
            >
        {/if}
        <span aria-live="polite">Page {page} of {totalPages}</span>
        {#if page < totalPages}
            <a
                href={`${paginationBaseUrl}${paginationQuerySeparator}page=${page + 1}`}
                >Next</a
            >
        {/if}
    </nav>
{/if}

<style>
    .audio-list {
        margin-top: 20px;
    }

    .pagination {
        margin-top: 20px;
    }

    .pagination a {
        margin-right: 10px;
    }

    .audio-group h4 {
        margin-bottom: 10px;
        font-weight: normal;
    }

    .expand-button {
        background: none;
        border: none;
        color: var(--text-link-color);
        cursor: pointer;
        padding: 0;
        font-size: inherit;
        font-weight: bold;
    }

    .expand-button:hover {
        text-decoration: underline;
    }
</style>
