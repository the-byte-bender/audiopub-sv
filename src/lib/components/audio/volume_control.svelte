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
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    export let volume: number = 1;
    export let variant: 'light' | 'dark' = 'light';
    
    const STORAGE_KEY = 'audiopub_volume';
    
    let previousVolume = 1;
    let isMuted = false;

    onMount(() => {
        if (browser) {
            const savedVolume = localStorage.getItem(STORAGE_KEY);
            if (savedVolume !== null) {
                volume = parseFloat(savedVolume);
                previousVolume = volume;
            }
        }
    });

    function saveVolume(vol: number) {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, vol.toString());
        }
    }

    function handleVolumeChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const nextPercent = parseInt(input.value, 10);
        volume = isNaN(nextPercent) ? volume : nextPercent / 100;
        isMuted = volume === 0;
        if (volume > 0) {
            previousVolume = volume;
        }
        saveVolume(volume);
    }

    function toggleMute() {
        if (isMuted || volume === 0) {
            volume = previousVolume || 0.5;
            isMuted = false;
        } else {
            previousVolume = volume;
            volume = 0;
            isMuted = true;
        }
        saveVolume(volume);
    }

    function handleKeyDown(e: KeyboardEvent) {
        switch (e.key) {
            case 'm':
            case 'M':
                e.preventDefault();
                toggleMute();
                break;
        }
    }

    $: volumeIcon = isMuted || volume === 0 ? 'muted' : volume < 0.5 ? 'low' : 'high';
    $: volumePercent = Math.round(volume * 100);
</script>

<div 
    class="volume-control"
    class:dark={variant === 'dark'}
>
    <button 
        class="mute-button"
        on:click={toggleMute}
        on:keydown={handleKeyDown}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
    >
        {#if volumeIcon === 'muted'}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
        {:else if volumeIcon === 'low'}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
        {:else}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
        {/if}
    </button>

    <input 
        type="range"
        min="0"
        max="100"
        step="1"
        value={volumePercent}
        on:input={handleVolumeChange}
        on:keydown={handleKeyDown}
        class="volume-slider"
        style="--volume-percent: {volumePercent}"
        aria-label="Volume"
        aria-valuetext="{volumePercent}%"
    />
</div>

<style>
    .volume-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        --track-bg: rgba(0, 0, 0, 0.15);
        --fill-bg: #007bff;
        --icon-color: #333;
    }

    .volume-control.dark {
        --track-bg: rgba(255, 255, 255, 0.3);
        --fill-bg: white;
        --icon-color: white;
    }

    .mute-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        color: var(--icon-color);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.15s ease;
    }

    .mute-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }

    .dark .mute-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .mute-button:focus-visible {
        outline: 2px solid var(--fill-bg);
        outline-offset: 2px;
    }

    .volume-slider {
        width: 80px;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--track-bg);
        border-radius: 3px;
        cursor: pointer;
        transition: height 0.15s ease;
    }

    .volume-slider:hover {
        height: 8px;
    }

    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: var(--fill-bg);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        transition: transform 0.15s ease;
    }

    .volume-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    .volume-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: var(--fill-bg);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .volume-slider:focus-visible {
        outline: 2px solid var(--fill-bg);
        outline-offset: 2px;
    }

    /* Track fill effect using gradient */
    .volume-slider {
        background: linear-gradient(
            to right,
            var(--fill-bg) 0%,
            var(--fill-bg) calc(var(--volume-percent, 100) * 1%),
            var(--track-bg) calc(var(--volume-percent, 100) * 1%),
            var(--track-bg) 100%
        );
    }
</style>
