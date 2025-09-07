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
    import type { ClientsideAudio } from "$lib/types";
    import SafeMarkdown from "./safe_markdown.svelte";

    export let audio: ClientsideAudio;
</script>

<article class="audio-item">
    <h3>
        {#if audio.user && !audio.user.isTrusted}
            <span style="color: red">(Pending review)</span> |{" "}
        {/if}
        <a href={`/listen/${audio.id}`}>{audio.title}</a>| {audio.playsString}
    </h3>
    {#if audio.user}
        <p>
            By <a href={`/user/${audio.user.id}`}>{audio.user.displayName}</a>
        </p>
    {/if}
    <SafeMarkdown source={audio.description} />
</article>
<!--
 Copyright 2025 the-byte-bender.
 SPDX-License-Identifier: MPL-2.0
-->

<style>
    .audio-item {
        margin-bottom: 20px;
        border: 1px solid #ccc;
        padding: 10px;
    }
</style>
