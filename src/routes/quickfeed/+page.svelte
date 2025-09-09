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
    import title from "$lib/title";
    import QuickfeedPlayer from "$lib/components/quickfeed_player.svelte";
    import { beforeNavigate, afterNavigate } from "$app/navigation";
    import type { PageData } from "./$types";

    export let data: PageData;
    title.set("Quickfeed");

    let quickfeedPlayerRef: QuickfeedPlayer;

    // Auto-pause audio when navigating away from quickfeed page
    beforeNavigate((navigation) => {
        // Only pause if navigating away from quickfeed page
        if (navigation.to?.route?.id !== '/quickfeed') {
            quickfeedPlayerRef?.pauseAudio();
        }
    });

    // Auto-play audio when navigating to quickfeed page
    afterNavigate((navigation) => {
        // Only auto-play if we just navigated TO the quickfeed page
        if (navigation.to?.route?.id === '/quickfeed' && navigation.from?.route?.id !== '/quickfeed') {
            // Small delay to ensure component is fully mounted
            setTimeout(() => {
                quickfeedPlayerRef?.startAutoPlay();
            }, 100);
        }
    });
</script>

<QuickfeedPlayer bind:this={quickfeedPlayerRef} audios={data.audios} currentUser={data.user} />

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    :global(main) {
        padding: 0;
        /* Account for sticky header - use calc to subtract header height from viewport */
        height: calc(100vh - 80px);
        overflow: hidden;
    }
</style>