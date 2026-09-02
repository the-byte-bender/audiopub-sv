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
<!--
  Scoped to /live/[id] on purpose. What lands here is almost always a shared
  /live/@username link that did not lead anywhere: the page load attaches a
  "live" object to the error saying which of the two cases it is, so the reader
  gets a way onwards instead of a bare 404.
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import title from "$lib/title";

    $: live = $page.error?.live;
    $: userName = live?.userName ?? "";
    $: displayName = live?.displayName || userName;

    $: heading =
        live?.reason === "not_live"
            ? `${displayName} is not live`
            : live?.reason === "no_user"
              ? "No such account"
              : "Nothing to listen to here";

    // The search page rejects anything shorter than three characters, so a
    // badly mistyped name gets the profile link only.
    $: canSearch = userName.length >= 3;

    onMount(() => title.set(heading));
</script>

<div class="not-live">
    <h1>{heading}</h1>

    {#if live?.reason === "not_live"}
        <p>
            There is no broadcast running on this account at the moment. It may
            have just ended, or it may not have started yet.
        </p>
        <p class="tip">
            Keep the link anyway: <code>/live/@{userName}</code> always leads to
            whatever this person has on the air, so it will bring you straight
            there next time they go live.
        </p>
        <div class="actions">
            <a class="btn" href="/user/@{encodeURIComponent(userName)}">
                View {displayName}'s profile
            </a>
            <a class="btn btn-secondary" href="/">Back to the home page</a>
        </div>
    {:else if live?.reason === "no_user"}
        <p>
            There is no account called <code>{userName}</code>. The link most
            likely has a typo in it.
        </p>
        <div class="actions">
            {#if canSearch}
                <a class="btn" href="/search?q={encodeURIComponent(userName)}">
                    Search for "{userName}"
                </a>
            {/if}
            <a class="btn btn-secondary" href="/">Back to the home page</a>
        </div>
    {:else}
        <p>{$page.error?.message ?? "Something went wrong."}</p>
        <div class="actions">
            <a class="btn" href="/">Back to the home page</a>
        </div>
    {/if}
</div>

<style>
    .not-live {
        max-width: 40rem;
        margin: 2rem auto;
        padding: 1.5rem;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        background-color: #fafafa;
    }

    h1 {
        margin-top: 0;
        font-size: 1.5rem;
    }

    p {
        line-height: 1.5;
        color: #444;
    }

    .tip {
        font-size: 0.9rem;
        color: #666;
    }

    code {
        background-color: #eee;
        border-radius: 3px;
        padding: 0.1rem 0.3rem;
        font-size: 0.9em;
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1.5rem;
    }

    .btn {
        display: inline-block;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        background-color: #007bff;
        color: #fff;
        text-decoration: none;
    }

    .btn:hover {
        background-color: #0056b3;
    }

    .btn-secondary {
        background-color: #6c757d;
    }

    .btn-secondary:hover {
        background-color: #545b62;
    }
</style>
