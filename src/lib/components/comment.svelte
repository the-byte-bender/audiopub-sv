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
          import { formatRelative } from "date-fns";
  import type { ClientsideComment, ClientsideUser } from "$lib/types";
  import Modal from "./modal.svelte";
  import { enhance } from "$app/forms";
  import SafeMarkdown from "./safe_markdown.svelte";
  import { updated } from "$app/state";

  export let comment: ClientsideComment;
  export let user: ClientsideUser | undefined = undefined;
  export let isAdmin: boolean = false;
  export let onReply: ((comment: ClientsideComment) => void) = comment => {};
  let isDeletionModalVisible: boolean = false;
  let replyDisabled: boolean = false;

  $: commentDate = comment
    ? formatRelative(new Date(comment.createdAt), new Date())
    : "";
</script>

<div class="comment">
  <h3>
    {#if comment.user && !comment.user.isTrusted}
      <span style="color: red">(Pending review)</span> |{" "}
    {/if}

    <a href={`/user/${comment.user.id}`}>{comment.user.displayName}</a>
    <span class="comment-date"> - {commentDate}</span>
  </h3>
  <SafeMarkdown source={comment.content} />

  <div id="comment-actions">
    {#if user}
      <form method="post" action="?/reply_to_comment" use:enhance={() => {
        replyDisabled = true;
        return async ({ update }) => {
            await update({ invalidateAll: false });
            onReply(comment);
            replyDisabled = false;
        };
      }}>
        <input type="hidden" name="parentId" value={comment.id} />
        <button type="submit" disabled={replyDisabled}>Reply</button>
      </form>
    {/if}

    {#if isAdmin || (user && user.id === comment.user.id)}
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
    {/if}
  </div>
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

  .comment .comment-date {
    color: #6c757d; /* A muted color for the date */
    font-size: 0.9em;
    margin-left: 0.5em;
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
    display: flex;
    gap: 0.5rem;
    align-items: center; /* So they're all at same height */
    flex-wrap: wrap; /* allow wrapping on very small screens */
  }

  /* prevent direct child forms inside the actions area from adding extra vertical spacing
     (this avoids changing layouts inside nested components like the Modal) */
  .comment #comment-actions > form {
    margin: 0;
  }
</style>
