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

  export let data: PageData;
  title.set("Home");
</script>

<h1>Welcome to {data.isFromAi ? "Audiopub AI trash mirror" : "Audiopub"}</h1>

<h2>Audio list sorted by recent first</h2>

<AudioList
  isFromAi={data.isFromAi}
  audios={data.audios}
  page={data.page}
  totalPages={data.totalPages}
  paginationBaseUrl="/"
/>
