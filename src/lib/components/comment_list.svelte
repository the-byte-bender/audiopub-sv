<script lang="ts">
  import type { ClientsideComment } from "$lib/types";

  export let comments: ClientsideComment[];
</script>

<section role="group" aria-label="Comments">
  <h2>Comments</h2>
  {#if comments.length > 0}
    {#each comments as comment (comment.id)}
      <div>
        <h3><a href={`/user/${comment.user.id}`}>{comment.user.displayName}</a></h3>
        <pre>{comment.content}</pre>
      </div>
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

  section[role="group"] div {
    margin-top: 1rem;
    padding: 0.5rem;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  section[role="group"] div h3 a {
    color: #007bff;
    text-decoration: none;
  }

  section[role="group"] div pre {
    white-space: pre-wrap;
    background-color: #fff;
    padding: 0.5rem;
    border: none;
    margin-top: 0.5rem;
  }

  section[role="group"] p {
    margin-top: 1rem;
    color: #888;
  }
</style>
