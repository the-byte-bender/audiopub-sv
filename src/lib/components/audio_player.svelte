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
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import ProgressBar from './audio/progress_bar.svelte';
    import VolumeControl from './audio/volume_control.svelte';
    import { announceToScreenReader, clamp } from '$lib/utils';

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
    let volume = 1;
    let isBuffering = false;
    let hasPlayed = false;

    const VOLUME_STORAGE_KEY = 'audiopub_volume';
    let previousVolume = 1;

    let container: HTMLDivElement;
    let volumeAnnounceTimer: ReturnType<typeof setTimeout> | null = null;

    function isSliderElement(el: Element | null): boolean {
        if (!el) return false;
        if (el instanceof HTMLInputElement && el.type === 'range') return true;
        if ((el as HTMLElement).getAttribute?.('role') === 'slider') return true;
        // In case focus is inside a slider-like widget
        return !!(el as HTMLElement).closest?.('input[type="range"], [role="slider"]');
    }

    function shouldHandlePlayerShortcut(e: KeyboardEvent): boolean {
        if (e.defaultPrevented) return false;
        if (!browser) return false;
        if (!container) return false;

        const target = e.target as Element | null;
        if (!target) return false;

        // Don't capture when user is typing in form fields (buttons are OK)
        const tagName = (target as HTMLElement).tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
            return false;
        }

        if ((target as HTMLElement).isContentEditable) return false;

        // Only capture shortcuts when the player (or one of its controls) is focused
        const active = document.activeElement;
        if (active && !container.contains(active)) return false;

        return true;
    }

    // Keyboard shortcuts
    function handleKeyDown(e: KeyboardEvent) {
        // Allow mute/unmute even when focus is on a slider
        if ((e.key === 'm' || e.key === 'M') && browser && container) {
            const active = document.activeElement;
            if (active && container.contains(active)) {
                e.preventDefault();
                toggleMute();
            }
            return;
        }

        if (!shouldHandlePlayerShortcut(e)) return;

        switch (e.key) {
            case ' ':
            case 'k':
            case 'K':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) {
                    return;
                }
                e.preventDefault();
                seek((audio?.currentTime ?? currentTime) - (e.shiftKey ? 10 : 5));
                break;
            case 'ArrowRight':
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) {
                    return;
                }
                e.preventDefault();
                seek((audio?.currentTime ?? currentTime) + (e.shiftKey ? 10 : 5));
                break;
            case 'ArrowUp':
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) {
                    return;
                }
                e.preventDefault();
                setVolume(volume + (e.shiftKey ? 0.1 : 0.05), true);
                break;
            case 'ArrowDown':
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) {
                    return;
                }
                e.preventDefault();
                setVolume(volume - (e.shiftKey ? 0.1 : 0.05), true);
                break;
            case '0':
            case 'Home':
                e.preventDefault();
                seek(0);
                break;
            case 'End':
                if (audio && isFinite(audio.duration) && audio.duration > 0) {
                    e.preventDefault();
                    seek(audio.duration);
                }
                break;
        }
    }

    function togglePlay() {
        if (paused) {
            audio?.play();
        } else {
            audio?.pause();
        }
    }

    function setVolume(next: number, announce: boolean = false) {
        volume = clamp(next, 0, 1);
        if (volume > 0) previousVolume = volume;

        if (browser) {
            try {
                localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
            } catch {
                // ignore
            }
        }

        if (!announce) return;
        if (volumeAnnounceTimer) clearTimeout(volumeAnnounceTimer);
        volumeAnnounceTimer = setTimeout(() => {
            announceToScreenReader(`Volume ${Math.round(volume * 100)}%`);
        }, 150);
    }

    function toggleMute() {
        if (volume === 0) {
            setVolume(previousVolume || 0.5, true);
        } else {
            previousVolume = volume;
            setVolume(0, true);
        }
    }

    function seek(time: number) {
        if (audio) {
            const maxTime = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number.POSITIVE_INFINITY;
            const nextTime = clamp(time, 0, maxTime);
            audio.currentTime = nextTime;
            currentTime = nextTime;
        }
    }

    function handlePlay() {
        paused = false;
        isBuffering = false;
        
        if (!hasPlayed) {
            hasPlayed = true;
            dispatch('play');
        }
        
        announceToScreenReader(`Playing: ${title}`);
    }

    function handlePause() {
        paused = true;
        announceToScreenReader('Paused');
    }

    function handleEnded() {
        paused = true;
        dispatch('ended');
        announceToScreenReader('Audio ended');
    }

    function handleTimeUpdate() {
        if (audio) {
            currentTime = audio.currentTime;
            duration = audio.duration || 0;
            dispatch('timeupdate', { currentTime, duration });
        }
    }

    function handleLoadedMetadata() {
        if (audio) {
            duration = audio.duration || 0;
        }
    }

    function handleWaiting() {
        isBuffering = true;
    }

    function handleCanPlay() {
        isBuffering = false;
    }

    function handleSeek(e: CustomEvent<number>) {
        seek(e.detail);
    }

    // Sync volume changes
    $: if (audio && browser) {
        audio.volume = volume;
    }

    // Initialize volume from persisted preference
    $: if (browser && previousVolume === 1 && volume === 1) {
        try {
            const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
            if (saved !== null) {
                const parsed = parseFloat(saved);
                if (!isNaN(parsed)) {
                    volume = clamp(parsed, 0, 1);
                    if (volume > 0) previousVolume = volume;
                }
            }
        } catch {
            // ignore
        }
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div 
    class="audio-player"
    bind:this={container}
    role="region"
    aria-label="Audio player for {title}"
    tabindex="0"
>
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

    <div class="player-controls">
        <!-- Play/Pause Button -->
        <button 
            class="play-button"
            on:click={togglePlay}
            aria-label={paused ? 'Play' : 'Pause'}
            title="{paused ? 'Play' : 'Pause'} (Space or K)"
        >
            {#if isBuffering}
                <div class="loading-spinner" aria-label="Loading"></div>
            {:else if paused}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                </svg>
            {:else}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                </svg>
            {/if}
        </button>

        <!-- Progress Bar -->
        <div class="progress-container">
            <ProgressBar 
                {currentTime} 
                {duration} 
                showTime={true}
                variant="light"
                on:seek={handleSeek}
            />
        </div>

        <!-- Volume Control -->
        <div class="volume-container">
            <VolumeControl bind:volume variant="light" />
        </div>

        <!-- Download Button -->
        {#if downloadUrl}
            <a 
                href={downloadUrl}
                download={downloadFilename}
                class="download-button"
                aria-label="Download audio"
                title="Download"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </a>
        {/if}
    </div>

    <!-- Keyboard Shortcuts Help (visually hidden) -->
    <div class="sr-only">
        Keyboard shortcuts: Space or K to play/pause, Left/Right arrows to seek (Shift for bigger steps), Up/Down arrows to change volume (Shift for bigger steps), M to mute/unmute
    </div>
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

    .player-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .play-button {
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        background: #007bff;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s ease, transform 0.1s ease;
    }

    .play-button:hover {
        background: #0056b3;
    }

    .play-button:active {
        transform: scale(0.95);
    }

    .play-button:focus-visible {
        outline: 2px solid #007bff;
        outline-offset: 2px;
    }

    .progress-container {
        flex: 1;
        min-width: 0;
    }

    .volume-container {
        flex-shrink: 0;
    }

    .download-button {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: transparent;
        color: #333;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        transition: background-color 0.15s ease;
    }

    .download-button:hover {
        background: rgba(0, 0, 0, 0.1);
    }

    .download-button:focus-visible {
        outline: 2px solid #007bff;
        outline-offset: 2px;
    }

    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    /* Responsive adjustments */
    @media (max-width: 480px) {
        .player-controls {
            flex-wrap: wrap;
        }

        .progress-container {
            order: 3;
            width: 100%;
            flex-basis: 100%;
        }

        .volume-container {
            order: 2;
        }

        .download-button {
            order: 4;
        }
    }
</style>
