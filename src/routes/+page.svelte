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
