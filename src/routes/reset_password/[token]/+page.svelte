<script lang="ts">
  import { enhance } from "$app/forms";
  import title from "$lib/title";
  import { onMount } from "svelte";
  onMount(() => title.set("Reset Password"));
  export let data;
</script>

<h1>Reset your password</h1>

<p>
  This is the last step. Just enter your new password and you're good to go.
</p>

<form use:enhance method="post">
  <input type="hidden" name="token" value={data.token} />
  <div class="form-group">
    <label for="password">New password</label>
    <input
      type="password"
      id="password"
      name="password"
      placeholder="New password"
      class="form-control"
      minlength="8"
      maxlength="64"
      required
    />
  </div>
  <button type="submit" class="btn">Reset password</button>
</form>

<style>
  h1 {
    text-align: center;
    margin-bottom: 1rem;
    color: #333;
  }

  p {
    text-align: center;
    margin-bottom: 1.5rem;
    color: #666;
  }

  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    max-width: 400px;
    margin: 0 auto;
    padding: 2rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    background-color: #f9f9f9;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .form-group {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  label {
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #555;
  }

  .form-control {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.3s ease-in-out;
    width: 100%; /* Ensures input fills its container */
  }

  .form-control:focus {
    border-color: #007bff;
    outline: none;
    box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    background-color: #007bff;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s ease-in-out;
  }

  .btn:hover {
    background-color: #0056b3;
  }
</style>
