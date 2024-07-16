<script lang="ts">
  import { enhance } from "$app/forms";
  import title from "$lib/title";
  import { onMount } from "svelte";
  onMount(() => title.set("Verify your email"));
</script>

<h1>Verify your email</h1>

<p>
  Go to your email inbox. We've sent you a verification token there. Enter it
  below to verify your email address.
</p>

<form use:enhance method="post">
  <div class="form-group">
    <label for="token">Verification token</label>
    <input
      type="text"
      id="token"
      name="token"
      placeholder="Verification token"
      class="form-control"
    />
  </div>
  <button type="submit" class="btn">Verify</button>
</form>

<style>
  h1 {
    text-align: center;
    margin-bottom: 1rem;
    color: #333;
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
