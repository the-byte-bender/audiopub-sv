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
    import { dialog } from "$lib/stores/dialog";

    export let data;
    export let form;

    onMount(() => title.set(`History: ${data.audio.title}`));

    async function confirmRevert(historyId: string) {
        return await dialog.confirm({
            title: "Revert Changes?",
            message: "Are you sure you want to revert the audio to the state BEFORE this edit?",
            confirmText: "Revert",
            cancelText: "Cancel",
            danger: true
        });
    }
</script>

<h1>Edit History: {data.audio.title}</h1>

<div class="history-container">
    <a href="/audio/{data.audio.id}/edit" class="back-link">← Back to Edit</a>

    {#if form?.message}
        <div class="error-message" role="alert">
            {form.message}
        </div>
    {/if}
    
    {#if form?.success}
        <div class="success-message" role="alert">
            Reverted successfully!
        </div>
    {/if}

    {#if data.history.length === 0}
        <p>No edit history found for this audio.</p>
    {:else}
        <ul class="history-list">
            {#each data.history as item}
                <li class="history-item">
                    <div class="history-header">
                        <span class="date">{new Date(item.createdAt).toLocaleString()}</span>
                        <form method="POST" action="?/revert" use:enhance={() => {
                            return async ({ result, update }) => {
                                if (await confirmRevert(item.id)) {
                                    update();
                                }
                            };
                        }}>
                            <input type="hidden" name="historyId" value={item.id} />
                            <button type="submit" class="revert-button">Revert to Before This</button>
                        </form>
                    </div>
                    
                    <div class="diff-grid">
                        <div class="diff-box old">
                            <h3>Old State</h3>
                            <p><strong>Title:</strong> {item.oldTitle}</p>
                            <p><strong>Description:</strong> {item.oldDescription || "(none)"}</p>
                        </div>
                        <div class="diff-box new">
                            <h3>New State</h3>
                            <p><strong>Title:</strong> {item.newTitle}</p>
                            <p><strong>Description:</strong> {item.newDescription || "(none)"}</p>
                        </div>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .history-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
    }

    .back-link {
        display: inline-block;
        margin-bottom: 20px;
        text-decoration: none;
        color: #007bff;
    }

    .history-list {
        list-style: none;
        padding: 0;
    }

    .history-item {
        border: 1px solid #ddd;
        border-radius: 8px;
        margin-bottom: 20px;
        background: #fff;
        overflow: hidden;
    }

    .history-header {
        background: #f8f9fa;
        padding: 10px 15px;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .date {
        font-weight: bold;
        color: #555;
    }

    .revert-button {
        background: #dc3545;
        color: white;
        border: none;
        padding: 5px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .revert-button:hover {
        background: #c82333;
    }

    .diff-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        background: #ddd;
    }

    .diff-box {
        padding: 15px;
        background: #fff;
    }

    .diff-box h3 {
        margin-top: 0;
        font-size: 1rem;
        color: #777;
        border-bottom: 1px solid #eee;
        padding-bottom: 5px;
    }

    .old {
        background: #fff8f8;
    }

    .new {
        background: #f8fff8;
    }

    .error-message {
        background: #f8d7da;
        color: #721c24;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 20px;
    }

    .success-message {
        background: #d4edda;
        color: #155724;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 20px;
    }
</style>
