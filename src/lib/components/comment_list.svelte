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
  import Comment from "./comment.svelte";
  import type { ClientsideComment, ClientsideUser } from "$lib/types";

  export let comments: ClientsideComment[];
  export let user: ClientsideUser | undefined = undefined;
  export let isAdmin: boolean = false;
  export let onReply: ((comment: ClientsideComment) => void) = comment => {};
  export let label: string = "comments";
</script>

{#if comments.length > 0}
<ul class="comments-list" aria-label={label}>
    {#each comments as comment (comment.id)}
      <li><Comment {comment} {user} {isAdmin} {onReply} /></li>
    {/each}
</ul>
{/if}


<style>
.comments-list {
    list-style-type: none;
    padding-left: 0;
    margin-left: 0;
}

</style>