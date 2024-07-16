<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageData } from "./$types";
  import title from "$lib/title";
  import { onMount } from "svelte";
  onMount(() => title.set("Your profile"));

  export let data: PageData;
</script>

<h1>Your Profile</h1>

<form use:enhance method="POST">
  <label for="email">Email:</label>
  <input type="email" id="email" name="email" value={data.email} />
  <label for="displayName">Display Name:</label>
  <input
    type="text"
    id="displayName"
    name="displayName"
    value={data.displayName}
    minlength="3"
    maxlength="30"
  />
  <label for="password">New Password:</label>
  <input
    type="password"
    id="password"
    name="password"
    minlength="8"
    maxlength="64"
  />
  <button type="submit">Update</button>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: fit-content;
    margin: auto;
  }

  label {
    font-weight: bold;
  }

  input[type="text"],
  input[type="email"] {
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
