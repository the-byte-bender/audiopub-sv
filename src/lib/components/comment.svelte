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
  import { enhance } from "$app/forms";
  import type { ClientsideComment, ClientsideUser } from "$lib/types";
  import Modal from "./modal.svelte";
  export let comment: ClientsideComment;
  export let user: ClientsideUser | undefined = undefined;
  export let isAdmin: boolean = false;
  let isDeletionModalVisible: boolean = false;
</script>

<div class="comment">
  <h3>
    <a href={`/user/${comment.user.id}`}>{comment.user.displayName}</a>
  </h3>
  <pre>{comment.content}</pre>
  {#if isAdmin || (user && user.id === comment.user.id)}
    <div id="comment-actions">
      <button on:click={() => (isDeletionModalVisible = true)}>Delete</button>
      <Modal bind:visible={isDeletionModalVisible}>
        <h2>Delete this comment?</h2>
        <p>Are you sure? This action cannot be undone.</p>
        <p>Comment content:</p>
        <pre>{comment.content}</pre>
        <button on:click={() => (isDeletionModalVisible = false)}>Cancel</button
        >
        <form use:enhance action="?/delete_comment" method="post">
          <input type="hidden" name="id" value={comment.id} />
          <button type="submit">Confirm delete</button>
        </form>
      </Modal>
    </div>
  {/if}
</div>

<style>
  .comment {
    margin-top: 1rem;
    padding: 0.5rem;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .comment h3 a {
    color: #007bff;
    text-decoration: none;
  }

  .comment pre {
    white-space: pre-wrap;
    background-color: #fff;
    padding: 0.5rem;
    border: none;
    margin-top: 0.5rem;
  }

  .comment #comment-actions {
    margin-top: 0.5rem;
  }
</style>
