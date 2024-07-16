<script lang="ts">
  export let data;
  import AudioList from "$lib/components/audio_list.svelte";
  import title from "$lib/title";
  title.set(`${data.query} | search`);
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
