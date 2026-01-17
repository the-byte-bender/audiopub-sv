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
  import title from "$lib/title";
  import type { ActionData } from "./$types";
  import { onMount } from "svelte";

  export let form: ActionData;

  onMount(() => title.set("Forgot Password"));
</script>

<h1>Forgot password</h1>

<p>
  You forgot your password? No problem! Just enter your email address and we'll
  send you a link to reset your password.
</p>

<form use:enhance method="POST">
  {#if form?.message}
    <div
      class={form.success !== false ? "success-message" : "error-message"}
      role="alert"
    >
      {form.message}
    </div>
  {/if}

  <div class="form-group">
    <label for="email">Email</label>
    <input
      type="email"
      id="email"
      name="email"
      placeholder="Email"
      class="form-control"
      required
      value={form?.email ?? ""}
    />
  </div>
  <button type="submit" class="btn">Send reset link</button>
</form>

<style>
  .error-message {
    color: #721c24;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    width: 100%;
    text-align: center;
  }

  .success-message {
    color: #155724;
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    width: 100%;
    text-align: center;
  }

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
