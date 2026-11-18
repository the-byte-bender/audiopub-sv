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
    import SvelteMarkdown from "@humanspeak/svelte-markdown";
    import {
        excludeRenderersOnly,
        buildUnsupportedHTML,
    } from "@humanspeak/svelte-markdown";
    import { setContext } from "svelte";
    import { writable } from "svelte/store";
    import { MENTION_NAMES_CONTEXT } from "$lib/mentions";
    import UntrustedLink from "./untrusted_link.svelte";
    import MentionText from "./mention_text.svelte";

    export let source: string;
    /** Lowercase usernames whose @mentions in the source become profile links. */
    export let mentions: string[] = [];

    const mentionNames = writable(new Set<string>());
    $: mentionNames.set(new Set(mentions));
    setContext(MENTION_NAMES_CONTEXT, mentionNames);
</script>

<SvelteMarkdown
    {source}
    renderers={{
        ...excludeRenderersOnly(["heading", "image"]),
        html: buildUnsupportedHTML(),
        link: UntrustedLink,
        rawtext: MentionText,
    }}
    options={{
        gfm: true,
        breaks: true,
    }}
/>
