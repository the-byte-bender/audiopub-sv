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
  onMount(() => title.set(`Search results for: ${data.query}`));
</script>
<h1>Search results for: {data.query}</h1>

<AudioList audios={data.audios} page={data.page} totalPages={0} paginationBaseUrl={`/search`} />

<style>
  h1 {
    text-align: center;
    margin-bottom: 1rem;
    color: #333;
  }
</style>
