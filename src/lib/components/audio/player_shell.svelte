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
  Shared Player Shell: provides the common UI wrapper (region, keyboard shortcuts,
  volume persistence, sr-only help) used by both Listen and Quickfeed players.
  The actual audio engine (HTMLAudioElement or WebAudio pool) is handled externally;
  this shell just receives state and emits commands.
-->
<script lang="ts">
    import { browser } from '$app/environment';
    import PlayerControls from './player_controls.svelte';
    import { announceToScreenReader, clamp } from '$lib/utils';
    import { persistVolume } from './engine';

    // --- Props ---
    export let title: string = 'Audio';
    export let isPlaying: boolean = false;
    export let isBuffering: boolean = false;
    export let hasEnded: boolean = false;
    export let currentTime: number = 0;
    export let duration: number = 0;
    export let volume: number = 1;

    export let downloadUrl: string | undefined = undefined;
    export let downloadFilename: string | undefined = undefined;

    export let progressVariant: 'light' | 'dark' = 'light';
    export let volumeVariant: 'light' | 'dark' = 'light';

    /** If true, arrow keys won't adjust volume (e.g., Quickfeed uses arrows for navigation). */
    export let disableArrowVolume: boolean = false;
    
    /** If true, PlayerShell will announce play/pause/ended to screen readers. */
    export let announceStateChanges: boolean = true;

    // --- Callbacks (commands to the engine) ---
    export let onTogglePlay: () => void = () => {};
    export let onSeek: (time: number) => void = () => {};
    export let onVolumeChange: (vol: number) => void = () => {};

    // --- Internal state ---
    let container: HTMLDivElement;
    let previousVolume = volume > 0 ? volume : 1;
    let volumeAnnounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    // Track previous state for announcements
    let prevIsPlaying: boolean | null = null;
    let prevHasEnded: boolean = false;

    // Announce play/pause state changes
    $: if (announceStateChanges && browser && prevIsPlaying !== null && prevIsPlaying !== isPlaying) {
        if (isPlaying) {
            announceToScreenReader(`Playing: ${title}`);
        } else if (!hasEnded) {
            // Only announce pause if not ended (ended has its own announcement)
            announceToScreenReader('Paused');
        }
    }
    $: prevIsPlaying = isPlaying;
    
    // Announce ended
    $: if (announceStateChanges && browser && hasEnded && !prevHasEnded) {
        announceToScreenReader('Audio ended');
    }
    $: prevHasEnded = hasEnded;



    function isSliderElement(el: Element | null): boolean {
        if (!el) return false;
        if (el instanceof HTMLInputElement && el.type === 'range') return true;
        if ((el as HTMLElement).getAttribute?.('role') === 'slider') return true;
        return !!(el as HTMLElement).closest?.('input[type="range"], [role="slider"]');
    }

    function shouldHandleShortcut(e: KeyboardEvent): boolean {
        if (e.defaultPrevented) return false;
        if (!browser || !container) return false;

        const target = e.target as Element | null;
        if (!target) return false;

        const tagName = (target as HTMLElement).tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return false;
        if ((target as HTMLElement).isContentEditable) return false;

        const active = document.activeElement;
        if (active && !container.contains(active)) return false;

        return true;
    }

    function handleKeyDown(e: KeyboardEvent) {
        // Mute works even on slider focus
        if ((e.key === 'm' || e.key === 'M') && browser && container) {
            const active = document.activeElement;
            if (active && container.contains(active)) {
                e.preventDefault();
                toggleMute();
            }
            return;
        }

        if (!shouldHandleShortcut(e)) return;

        switch (e.key) {
            case ' ':
            case 'k':
            case 'K':
                e.preventDefault();
                onTogglePlay();
                break;
            case 'ArrowLeft':
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) return;
                e.preventDefault();
                onSeek(currentTime - (e.shiftKey ? 10 : 5));
                break;
            case 'ArrowRight':
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) return;
                e.preventDefault();
                onSeek(currentTime + (e.shiftKey ? 10 : 5));
                break;
            case 'ArrowUp':
                if (disableArrowVolume) return;
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) return;
                e.preventDefault();
                setVolume(volume + (e.shiftKey ? 0.1 : 0.05), true);
                break;
            case 'ArrowDown':
                if (disableArrowVolume) return;
                if (isSliderElement(document.activeElement) || isSliderElement(e.target as Element | null)) return;
                e.preventDefault();
                setVolume(volume - (e.shiftKey ? 0.1 : 0.05), true);
                break;
            case ']':
            case '}':
            case '=':
            case '+':
                e.preventDefault();
                setVolume(volume + (e.shiftKey ? 0.1 : 0.05), true);
                break;
            case '[':
            case '{':
            case '-':
            case '_':
                e.preventDefault();
                setVolume(volume - (e.shiftKey ? 0.1 : 0.05), true);
                break;
            case '0':
            case 'Home':
                e.preventDefault();
                onSeek(0);
                break;
            case 'End':
                if (isFinite(duration) && duration > 0) {
                    e.preventDefault();
                    onSeek(duration);
                }
                break;
        }
    }

    function setVolume(next: number, announce: boolean = false) {
        volume = clamp(next, 0, 1);
        if (volume > 0) previousVolume = volume;
        persistVolume(volume);
        onVolumeChange(volume);

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

    function handleVolumeFromSlider(next: number) {
        setVolume(next, false);
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

<section
    class="player-shell"
    class:dark={progressVariant === 'dark'}
    bind:this={container}
    aria-label="Audio player for {title}"
>
    <PlayerControls
        {title}
        {isPlaying}
        {isBuffering}
        {currentTime}
        {duration}
        bind:volume
        {progressVariant}
        {volumeVariant}
        showTime={true}
        {downloadUrl}
        {downloadFilename}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
    />

    <!-- Keyboard Shortcuts Help (visually hidden) -->
    <div class="sr-only">
        Keyboard shortcuts: Space or K to play/pause, Left/Right arrows to seek (Shift for bigger steps),
        {#if !disableArrowVolume}Up/Down arrows or{/if} +/- or [/] to change volume (Shift for bigger steps), M to mute/unmute
    </div>
</section>

<style>
    .player-shell {
        width: 100%;
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
</style>
