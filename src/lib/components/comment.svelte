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
    import { enhance } from "$app/forms";
    import SafeMarkdown from "./safe_markdown.svelte";
    import { dialog } from "$lib/stores/dialog";
    import CommentList from "./comment_list.svelte";

    export let comment: ClientsideComment;
    export let user: ClientsideUser | undefined = undefined;
    export let isAdmin: boolean = false;
    export let onReply: ((comment: ClientsideComment) => void) = comment => {};
    let replyDisabled: boolean = false;
    let deleteDisabled: boolean = false;

    $: commentDate = comment
        ? formatRelative(new Date(comment.createdAt), new Date())
        : "";

    async function handleDeleteComment() {
        const confirmed = await dialog.confirm({
            title: "Delete comment?",
            message: `Are you sure you want to delete this comment? This action cannot be undone.\n\nComment: "${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}"`,
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true
        });

        if (confirmed) {
            const form = document.getElementById(`delete-comment-form-${comment.id}`) as HTMLFormElement;
            if (form) {
                form.requestSubmit();
            }
        }
    }
</script>

<div class="comment">
  <h3>
    {#if comment.user && !comment.user.isTrusted}
      <span style="color: red">(Pending review)</span> |{" "}
    {/if}

    <a href={`/@${comment.user.name}`}>{comment.user.displayName}</a>
    <span class="comment-date"> - {commentDate}</span>
  </h3>
  <SafeMarkdown source={comment.content} />

  <div class="comment-actions">
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
      <form
        id={`delete-comment-form-${comment.id}`}
        method="post"
        action="?/delete_comment"
        use:enhance={() => {
          deleteDisabled = true;
          return async ({ update }) => {
            await update();
            deleteDisabled = false;
          };
        }}
        style="display: none;"
      >
        <input type="hidden" name="id" value={comment.id} />
      </form>
      <button on:click={handleDeleteComment} disabled={deleteDisabled}>Delete</button>
    {/if}
  </div>
</div>

{#if comment.replies}
<CommentList comments={comment.replies} {user} {isAdmin} {onReply} label="Replies" />
{/if}

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

  .comment .comment-actions {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.5rem;
    align-items: center; /* So they're all at same height */
    flex-wrap: wrap; /* allow wrapping on very small screens */
  }

  /* prevent direct child forms inside the actions area from adding extra vertical spacing
     (this avoids changing layouts inside nested components like the Modal) */
  .comment .comment-actions > form {
    margin: 0;
  }
</style>
