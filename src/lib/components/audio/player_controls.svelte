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
    import ProgressBar from './progress_bar.svelte';
    import VolumeControl from './volume_control.svelte';

    export let title: string = 'Audio';

    export let isPlaying: boolean = false;
    export let isBuffering: boolean = false;

    export let currentTime: number = 0;
    export let duration: number = 0;

    export let volume: number = 1;

    export let progressVariant: 'light' | 'dark' = 'light';
    export let volumeVariant: 'light' | 'dark' = 'light';

    export let showTime: boolean = true;

    export let downloadUrl: string | undefined = undefined;
    export let downloadFilename: string | undefined = undefined;

    export let onTogglePlay: () => void;
    export let onSeek: (time: number) => void;

    function handleSeek(e: CustomEvent<number>) {
        onSeek?.(e.detail);
    }
</script>

<div 
    class="player-controls"
    aria-label="Audio player controls for {title}"
>
    <button 
        class="play-button"
        on:click={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
    >
        {#if isBuffering}
            <div class="loading-spinner" aria-label="Loading"></div>
        {:else if !isPlaying}
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

    <div class="progress-container">
        <ProgressBar 
            {currentTime} 
            {duration} 
            {showTime}
            variant={progressVariant}
            on:seek={handleSeek}
        />
    </div>

    <div class="volume-container">
        <VolumeControl bind:volume variant={volumeVariant} />
    </div>

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

<style>
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
