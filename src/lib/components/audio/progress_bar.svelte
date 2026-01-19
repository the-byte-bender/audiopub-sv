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
    import { formatTime } from '$lib/utils';
    import { createEventDispatcher } from 'svelte';

    export let currentTime: number = 0;
    export let duration: number = 0;
    export let showTime: boolean = true;
    export let variant: 'light' | 'dark' = 'light';

    const dispatch = createEventDispatcher<{ seek: number }>();

    $: progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    function handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        dispatch('seek', parseFloat(input.value));
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (duration <= 0) return;
        
        // Custom step behavior: 5 seconds, or 10 with shift
        const step = e.shiftKey ? 10 : 5;
        
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault();
                dispatch('seek', Math.max(0, currentTime - step));
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault();
                dispatch('seek', Math.min(duration, currentTime + step));
                break;
            case 'Home':
                e.preventDefault();
                dispatch('seek', 0);
                break;
            case 'End':
                e.preventDefault();
                dispatch('seek', duration);
                break;
        }
    }
</script>

<div 
    class="progress-bar"
    class:dark={variant === 'dark'}
>
    <input 
        type="range"
        min="0"
        max={duration}
        step="1"
        value={currentTime}
        on:input={handleInput}
        on:keydown={handleKeyDown}
        aria-label="Audio progress"
        aria-valuetext="{formatTime(currentTime)} of {formatTime(duration)}"
        class="progress-slider"
        style="--progress: {progress}%"
    />
    
    {#if showTime}
        <div class="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
        </div>
    {/if}
</div>

<style>
    .progress-bar {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        --track-bg: rgba(0, 0, 0, 0.15);
        --fill-bg: #007bff;
        --thumb-bg: #007bff;
        --text-color: #333;
    }

    .progress-bar.dark {
        --track-bg: rgba(255, 255, 255, 0.3);
        --fill-bg: white;
        --thumb-bg: white;
        --text-color: rgba(255, 255, 255, 0.9);
    }

    .progress-slider {
        width: 100%;
        height: 8px;
        -webkit-appearance: none;
        appearance: none;
        background: linear-gradient(
            to right,
            var(--fill-bg) 0%,
            var(--fill-bg) var(--progress),
            var(--track-bg) var(--progress),
            var(--track-bg) 100%
        );
        border-radius: 4px;
        cursor: pointer;
        transition: height 0.15s ease;
        outline: none;
    }

    .progress-slider:hover,
    .progress-slider:focus-visible {
        height: 10px;
    }

    /* Thumb Styles */
    .progress-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: var(--thumb-bg);
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transform: scale(0);
        transition: transform 0.15s ease;
    }

    .progress-slider:hover::-webkit-slider-thumb,
    .progress-slider:focus-visible::-webkit-slider-thumb,
    .progress-slider:active::-webkit-slider-thumb {
        transform: scale(1);
    }

    .progress-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: var(--thumb-bg);
        border: none;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transform: scale(0);
        transition: transform 0.15s ease;
    }

    .progress-slider:hover::-moz-range-thumb,
    .progress-slider:focus-visible::-moz-range-thumb,
    .progress-slider:active::-moz-range-thumb {
        transform: scale(1);
    }

    .time-display {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-color);
        font-variant-numeric: tabular-nums;
    }

    .progress-slider:focus-visible {
        outline: 2px solid var(--fill-bg);
        outline-offset: 4px;
        border-radius: 4px;
    }
</style>
