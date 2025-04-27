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
  import title from "$lib/title";
  import AudioList from "$lib/components/audio_list.svelte";
  import type { PageData } from "./$types";
  import { onMount } from "svelte";
    import { enhance } from "$app/forms";

  export let data: PageData;
  title.set("Home");

  $: sortDescription = (() => {
    let fieldDesc = "";
    switch (data.sortField) {
      case "createdAt": fieldDesc = "date"; break;
      case "plays": fieldDesc = "play count"; break;
      case "title": fieldDesc = "title"; break;
      case "random": fieldDesc = "random"; break;
      default: fieldDesc = "date";
    }
    const orderDesc = data.sortField === "random" ? "" : data.sortOrder === "DESC" ? "descending" : "ascending";
    return `${fieldDesc} ${orderDesc}`.trim();
  })();
</script>

<h1>Welcome to {data.isFromAi ? "Audiopub AI trash mirror" : "Audiopub"}</h1>

<form use:enhance  method="GET" action="/">
  <label for="sort">Sort by:</label>
  <select name="sort" id="sort">
    <option value="createdAt" selected={data.sortField === 'createdAt'}>Date</option>
    <option value="plays" selected={data.sortField === 'plays'}>Play Count</option>
    <option value="title" selected={data.sortField === 'title'}>Title</option>
    <option value="random" selected={data.sortField === 'random'}>Random</option>
  </select>
  <br />
  {#if data.sortField !== 'random'}
    <label for="order">Order:</label>
    <select name="order" id="order">
      <option value="DESC" selected={data.sortOrder === 'DESC'}>Descending</option>
      <option value="ASC" selected={data.sortOrder === 'ASC'}>Ascending</option>
    </select>
    <br />
  {/if}
  <button type="submit">Sort</button>
</form>

<h2>Audio list sorted by {sortDescription}</h2>

<AudioList
  isFromAi={data.isFromAi}
  audios={data.audios}
  page={data.page}
  totalPages={data.totalPages}
  paginationBaseUrl={`/?sort=${data.sortField}${data.sortField === 'random' ? '' : '&order=' + data.sortOrder}`}
/>
