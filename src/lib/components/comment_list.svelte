<script lang="ts">
  import Comment from "./comment.svelte";
  import type { ClientsideComment, ClientsideUser } from "$lib/types";

  export let comments: ClientsideComment[];
  export let user: ClientsideUser | undefined = undefined;
  export let isAdmin: boolean = false;
</script>

<section role="group" aria-label="Comments">
  <h2>Comments</h2>
  {#if comments.length > 0}
    {#each comments as comment (comment.id)}
      <Comment {comment} {user} {isAdmin} />
    {/each}
  {:else}
    <p>No comments yet</p>
  {/if}
</section>

<style>
  section[role="group"] {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f9f9f9;
    border: 1px solid #ccc;
    border-radius: 8px;
  }

  section[role="group"] h2 {
    color: #333;
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  section[role="group"] p {
    margin-top: 1rem;
    color: #888;
  }
</style>
