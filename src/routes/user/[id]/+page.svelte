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
    import AudioList from "$lib/components/audio_list.svelte";
    import SafeMarkdown from "$lib/components/safe_markdown.svelte";
    import title from "$lib/title.js";
    import { onMount } from "svelte";
    import type { ActionData } from "./$types";

    export let data;
    export let form: ActionData;

    onMount(() => title.set(`${data.profileUser.displayName}'s Profile`));
</script>

<h1>{data.profileUser.displayName}'s Profile</h1>

{#if data.user && data.user.id === data.profileUser.id}
    <p class="edit-profile-notice">
        You can edit your profile at <a href="/profile">settings</a>.
    </p>
{/if}

{#if form?.message}
    <div class="error-message" role="alert">
        {form.message}
    </div>
{/if}

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

<div class="bio-section">
    <div class="bio-header">
        <h2>Bio</h2>
    </div>

    <div class="bio-content">
        {#if data.profileUser.bio}
            <SafeMarkdown source={data.profileUser.bio} />
        {:else}
            <p><i>No bio provided.</i></p>
        {/if}
    </div>
</div>

{#if data.isAdmin}
    {#if !data.profileUser.isTrusted}
        <form use:enhance action="?/trust" method="post">
            <button type="submit">Trust</button>
        </form>
    {/if}

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
        <form use:enhance action="?/warn" method="post">
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
    groupThreshold={0}
    page={data.page}
    totalPages={data.totalPages}
    paginationBaseUrl={`/user/${data.profileUser.id}`}
/>

<style>
    .error-message {
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 0.75rem;
        margin-bottom: 1rem;
        text-align: center;
    }

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

    .edit-profile-notice {
        background-color: #e7f3ff;
        border: 1px solid #b2d4ff;
        border-radius: 4px;
        padding: 0.75rem;
        margin-bottom: 1rem;
        font-size: 0.95rem;
    }

    .edit-profile-notice a {
        font-weight: bold;
        color: #0056b3;
    }

    .bio-section {
        margin: 2rem 0;
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        background-color: #fcfcfc;
    }

    .bio-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .bio-header h2 {
        margin: 0;
    }

    .bio-content {
        line-height: 1.6;
    }

    .small-button {
        padding: 0.4rem 0.8rem;
        font-size: 0.9rem;
    }
</style>
