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
  export let data;
  import AudioList from "$lib/components/audio_list.svelte";
  import title from "$lib/title";
  import { onMount } from "svelte";
  onMount(() => {
    if (data.message) {
      title.set("Search");
    } else {
      title.set(data.query ? `Search results for: ${data.query}` : "Search");
    }
  });
</script>

{#if data.message}
  <h1>Search</h1>
  <div class="error-message" role="alert">
    {data.message}
  </div>
{:else if data.query}
  <h1>Search results for: {data.query}</h1>
  {#if data.audios.length > 0}
    <AudioList 
      audios={data.audios} 
      page={data.page} 
      totalPages={data.totalPages} 
      paginationBaseUrl={`/search?q=${encodeURIComponent(data.query)}`} 
    />
  {:else}
    <p class="no-results">No results found for "{data.query}".</p>
  {/if}
{:else}
  <h1>Search</h1>
  <p class="info">Enter a query to search for audio.</p>
{/if}

<style>
  h1 {
    text-align: center;
    margin-bottom: 1rem;
    color: #333;
  }
  .error-message {
    color: #721c24;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    width: 100%;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
    text-align: center;
  }
  .no-results, .info {
    text-align: center;
    margin-top: 2rem;
    color: #666;
    font-style: italic;
  }
</style>
