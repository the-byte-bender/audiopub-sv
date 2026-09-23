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
  Renders a run of markdown text, turning mentions of the names SafeMarkdown
  was given into profile links. Used as the "rawtext" renderer, which only
  ever sees leaf text: code spans and blocks render their own content.
-->
<script lang="ts">
    import { getContext } from "svelte";
    import type { Readable } from "svelte/store";
    import {
        INSIDE_LINK_CONTEXT,
        MENTION_NAMES_CONTEXT,
        splitMentions,
        type MentionSegment,
    } from "$lib/mentions";

    export let text: string = "";

    const names = getContext<Readable<Set<string>>>(MENTION_NAMES_CONTEXT);
    const insideLink = getContext<boolean>(INSIDE_LINK_CONTEXT) ?? false;

    let segments: MentionSegment[];
    $: segments =
        !insideLink && $names.size > 0
            ? splitMentions(text ?? "", $names)
            : [{ kind: "text", text: text ?? "" }];
</script>

{#each segments as segment}{#if segment.kind === "mention"}<a href={`/user/@${encodeURIComponent(segment.name)}`}>{segment.text}</a>{:else}{segment.text}{/if}{/each}
