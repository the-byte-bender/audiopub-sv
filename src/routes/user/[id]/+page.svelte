<script lang="ts">
  import { enhance } from "$app/forms";
  import AudioList from "$lib/components/audio_list.svelte";
  import title from "$lib/title.js";
  import { onMount } from "svelte";
  export let data;
  onMount(() => title.set(`${data.profileUser.displayName}'s Profile`));
</script>

<h1>{data.profileUser.displayName}'s Profile</h1>

<table>
  <tbody>
    <tr>
      <td>Username</td>
      <td>{data.profileUser.name}</td>
    </tr>
    <tr>
      <td>Display Name</td>
      <td>{data.profileUser.displayName}</td>
    </tr>
    <tr>
      <td>Uploads</td>
      <td>{data.count}</td>
    </tr>
  </tbody>
</table>

{#if data.isAdmin}
  <details>
    <summary>administrative actions</summary>
    {#if !data.profileUser.isBanned}
      <form use:enhance action="?/ban" method="post">
        <label for="ban-reason">Reason</label>
        <input type="text" name="reason" id="ban-reason" required />
        <br />
        <label for="ban-message">Message</label>
        <textarea name="message" id="ban-message"></textarea>
        <button type="submit">Ban</button>
      </form>
    {/if}
    <br />
    <form use:enhance  action="?/warn" method="post">
      <label for="warn-reason">Reason</label>
      <input type="text" name="reason" id="warn-reason" required />
      <br />
      <label for="warn-message">Message</label>
      <textarea name="message" id="warn-message"></textarea>
      <button type="submit">Warn</button>
    </form>
  </details>
{/if}

<h2>Uploads</h2>

<AudioList
  audios={data.audios}
  page={data.page}
  totalPages={data.totalPages}
  paginationBaseUrl={`/user/${data.profileUser.id}`}
/>

<style>
  details {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  summary {
    cursor: pointer;
    font-weight: bold;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  label {
    font-weight: bold;
  }

  input[type="text"],
  textarea {
    padding: 0.5rem;
    border: 1px solid #ccc;
  }

  button {
    background-color: #333;
    color: #fff;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background-color: #444;
  }
</style>
