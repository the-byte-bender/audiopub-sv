<!--
  This file is part of the audiopub project.
  
  Copyright (C) 2025 the-byte-bender
  
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
    import type { PageData } from "./$types";
    import type { ActionData } from "./$types";
    import AudioList from "$lib/components/audio_list.svelte";
    import title from "$lib/title";
    import { onMount } from "svelte";
    onMount(() => title.set("Your profile"));

    export let data: PageData;
    export let form: ActionData;
</script>

<h1>Your Profile</h1>

<div class="profile-info">
    <p>Public Profile: <a href={`/@${data.profileUser.name}`}>@{data.profileUser.name}</a></p>
</div>

<form use:enhance method="POST">
    {#if form?.message}
        <div class="error-message" role="alert">
            {form.message}
        </div>
    {/if}

    <label for="email">Email:</label>
    <input
        type="email"
        id="email"
        name="email"
        value={form?.email ?? data.email}
    />
    <label for="displayName">Display Name:</label>
    <input
        type="text"
        id="displayName"
        name="displayName"
        value={form?.displayName ?? data.displayName}
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
    <label for="bio">Bio:</label>
    <textarea
        id="bio"
        name="bio"
        placeholder="Write something about yourself..."
    >{data.profileUser.bio}</textarea>
    <button type="submit">Update</button>
</form>

<h2>Your Uploads</h2>

<AudioList
    audios={data.audios}
    groupThreshold={0}
    page={data.page}
    totalPages={data.totalPages}
    paginationBaseUrl={`/profile`}
/>

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
    input[type="email"],
    textarea {
        padding: 0.5rem;
        border: 1px solid #ccc;
    }

    textarea {
        min-height: 100px;
        font-family: inherit;
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
