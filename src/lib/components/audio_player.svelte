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
<!--
  Simplified AudioPlayer: uses PlayerShell for keyboard/volume/a11y and a native
  HTMLAudioElement for playback. This is the player used on the Listen page.
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import PlayerShell from './audio/player_shell.svelte';
    import { clamp } from '$lib/utils';
    import { loadPersistedVolume } from './audio/engine';

    export let sources: { src: string; type: string }[] = [];
    export let title: string = 'Audio';
    export let autoplay: boolean = false;
    export let downloadUrl: string | undefined = undefined;
    export let downloadFilename: string | undefined = undefined;

    const dispatch = createEventDispatcher<{
        play: void;
        pause: void;
        ended: void;
        timeupdate: { currentTime: number; duration: number };
    }>();

    let audio: HTMLAudioElement;
    let currentTime = 0;
    let duration = 0;
    let paused = true;
    let volume = loadPersistedVolume();
    let isBuffering = false;
    let hasPlayed = false;
    let hasEnded = false;

    function togglePlay() {
        if (paused) {
            audio?.play();
        } else {
            audio?.pause();
        }
    }

    function seek(time: number) {
        if (audio) {
            const max = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity;
            audio.currentTime = clamp(time, 0, max);
            currentTime = audio.currentTime;
        }
    }

    function handleVolumeChange(vol: number) {
        volume = vol;
        if (audio) audio.volume = vol;
    }

    function handlePlay() {
        paused = false;
        isBuffering = false;
        hasEnded = false;
        if (!hasPlayed) {
            hasPlayed = true;
            dispatch('play');
        }
    }

    function handlePause() {
        paused = true;
    }

    function handleEnded() {
        paused = true;
        hasEnded = true;
        dispatch('ended');
    }

    function handleTimeUpdate() {
        if (audio) {
            currentTime = audio.currentTime;
            duration = audio.duration || 0;
            dispatch('timeupdate', { currentTime, duration });
        }
    }

    function handleLoadedMetadata() {
        if (audio) duration = audio.duration || 0;
    }

    function handleWaiting() {
        isBuffering = true;
    }

    function handleCanPlay() {
        isBuffering = false;
    }

    // Sync volume when shell reports changes
    $: if (audio && browser) {
        audio.volume = volume;
    }
</script>

<div class="audio-player">
    <!-- Hidden native audio element -->
    <audio
        bind:this={audio}
        preload="metadata"
        {autoplay}
        on:play={handlePlay}
        on:pause={handlePause}
        on:ended={handleEnded}
        on:timeupdate={handleTimeUpdate}
        on:loadedmetadata={handleLoadedMetadata}
        on:waiting={handleWaiting}
        on:canplay={handleCanPlay}
    >
        {#each sources as source}
            <source src={source.src} type={source.type} />
        {/each}
        <p>Your browser doesn't support the audio element.</p>
    </audio>

    <PlayerShell
        {title}
        isPlaying={!paused}
        {isBuffering}
        {hasEnded}
        {currentTime}
        {duration}
        bind:volume
        progressVariant="light"
        volumeVariant="light"
        {downloadUrl}
        {downloadFilename}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onVolumeChange={handleVolumeChange}
    />
</div>

<style>
    .audio-player {
        width: 100%;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 1rem;
    }

    audio {
        display: none;
    }
</style>
