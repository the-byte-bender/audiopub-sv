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
  export let audios: ClientsideAudio[];
  export let isFromAi: boolean = false;

  export let paginationBaseUrl: string = "/";
  export let page: number = 1;
  export let totalPages: number = 0;
</script>

{#if isFromAi}
  <div class="warning">
    <p>
      <b>WARNING!</b> Every audio you find here was AI-generated and uploaded by
      other users. We cannot guarantee the quality of the content. It is
      recommended to visit
      <a href="https://audiopub.site"
        >The main audiopub.site for human or mostly human content.</a
      >
    </p>
    <p>
      If your valid work somehow ended up here by mistake, I deeply apologize.
      Contact me immediately, and I'll rectify the situation.
    </p>
  </div>
{/if}

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
          By <a href={`/user/${audio.user.id}`}>{audio.user.displayName}</a>
        </p>
      {/if}
      <pre>{audio.description}</pre>
    </article>
  {/each}
</section>

{#if totalPages > 1}
  <div class="pagination">
    {#if page > 1}
      <a href={`${paginationBaseUrl}?page=${page - 1}`}>Previous</a>
    {/if}
    <span aria-live="polite">Page {page} of {totalPages}</span>
    {#if page < totalPages}
      <a href={`${paginationBaseUrl}?page=${page + 1}`}>Next</a>
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
