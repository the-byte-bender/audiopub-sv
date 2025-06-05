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
    import { onMount } from "svelte";
    import type { LayoutData } from "./$types";

    export let data: LayoutData;
</script>

<svelte head>
    <title>{$title} | audiopub</title>
</svelte>

<header>
    <nav>
        <a href="/">Home</a>
        {#if data.user}
            {#if !data.user.isVerified}
                <p>
                    <b>WARNING:</b> Your account is not verified. Please verify your
                    account to access all features.
                </p>
                <a href="/verify">Verify</a>
            {:else}
                <a href="/upload">Upload</a>
                <a href="/profile">Profile</a>
                <a href="/logout">Logout</a>
            {/if}
        {:else}
            <a href="/login">Login</a>
            <a href="/register">Register</a>
        {/if}
    </nav>
    <form use:enhance action="/search" method="get">
        <input type="text" name="q" placeholder="Search..." />
        <button type="submit">Search</button>
    </form>
</header>
<main>
    <slot />
</main>

<hr />
<footer>
    <div class="copyright">
        <p>
            All rights to the audio files and associated content uploaded to
            this platform remain with their respective creators or rightful
            owners.
        </p>
        <p>
            For inquiries regarding content ownership or usage, please contact:
            <a href="mailto:cccefg2@gmail.com"> cccefg2@gmail.com</a>
            I'm sorry for the unprofessional email address, I'm still working on
            it.
        </p>
        <a href="/agreement">Our Agreement</a>
        <p>
            Audiopub is open source software. The code is licensed under the GNU
            AFFERO GENERAL PUBLIC LICENSE. You can find the source code on
            <a href="https://github.com/the-byte-bender/audiopub-sv">GitHub</a>.
        </p>
    </div>
</footer>

<style>
    header {
        background-color: #f0f0f0;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    nav a {
        margin-right: 10px;
        text-decoration: none;
        color: #333;
    }

    nav a:hover {
        color: #000;
    }

    main {
        padding: 20px;
    }

    footer {
        background-color: #eee;
        padding: 20px;
        text-align: center;
    }
</style>
