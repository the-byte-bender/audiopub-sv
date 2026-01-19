<!--
  This file is part of the audiopub project.
  
  Copyright (C) 2026 the-byte-bender
  
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
    import { onMount } from "svelte";
    import title from "$lib/title";

    export let data;
    export let form;

    onMount(() => title.set(`Edit: ${data.audio.title}`));
</script>

<h1>Edit Audio</h1>

<div class="edit-container">
    <p class="edit-info">
        {#if data.user?.isAdmin}
            Admin editing. No limit.
        {:else}
            You have used {data.audio.editCount} of 3 available edits.
        {/if}
    </p>

    {#if form?.message}
        <div class="error-message" role="alert">
            {form.message}
        </div>
    {/if}

    <form method="POST" action="?/edit" use:enhance>
        <div class="form-group">
            <label for="title">Title</label>
            <input 
                type="text" 
                id="title" 
                name="title" 
                required 
                minlength="3" 
                value={form?.title ?? data.audio.title} 
            />
        </div>

        <div class="form-group">
            <label for="description">Description</label>
            <textarea 
                id="description" 
                name="description" 
                rows="5"
            >{form?.description ?? data.audio.description}</textarea>
        </div>

        <div class="actions">
            <button type="submit">Save Changes</button>
            <a href="/listen/{data.audio.id}" class="cancel-button">Cancel</a>
        </div>
    </form>
    
    {#if data.user?.isAdmin}
        <div class="admin-actions">
            <hr />
            <h2>Admin Tools</h2>
            <a href="/audio/{data.audio.id}/history" class="history-link">View Edit History</a>
        </div>
    {/if}
</div>

<style>
    .edit-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background: #f9f9f9;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .edit-info {
        color: #666;
        margin-bottom: 20px;
        font-style: italic;
    }

    .form-group {
        margin-bottom: 20px;
    }

    label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
    }

    input[type="text"],
    textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
    }

    .actions {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    button {
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }

    button:hover {
        background: #0056b3;
    }

    .cancel-button {
        text-decoration: none;
        color: #666;
    }

    .error-message {
        background: #f8d7da;
        color: #721c24;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 20px;
    }
    
    .admin-actions {
        margin-top: 30px;
    }
    
    .history-link {
        display: inline-block;
        margin-top: 10px;
        color: #6f42c1;
        font-weight: 500;
        text-decoration: none;
    }
    
    .history-link:hover {
        text-decoration: underline;
    }
</style>
