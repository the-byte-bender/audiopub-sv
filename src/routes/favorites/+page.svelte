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
    import title from "$lib/title";
    import AudioList from "$lib/components/audio_list.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
    title.set("My Favorites");
</script>

<h1>My Favorites</h1>

{#if data.audios.length === 0}
    <div class="empty-state">
        <p>You haven't favorited any audio yet.</p>
    </div>
{:else}
    <p>You have {data.count} favorite{data.count === 1 ? '' : 's'}.</p>
    
    <AudioList
        audios={data.audios}
        currentUser={data.user}
        page={data.page}
        totalPages={data.totalPages}
        groupThreshold={0}
        paginationBaseUrl="/favorites"
    />
{/if}

<style>
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #666;
    }

    .empty-state p {
        margin: 16px 0;
        font-size: 16px;
        line-height: 1.5;
    }
</style>