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

    let progressTrack: HTMLDivElement;
    let isDragging = false;

    $: progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    function getSeekPosition(clientX: number): number {
        if (!progressTrack) return 0;
        const rect = progressTrack.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        return percentage * duration;
    }

    function handleMouseDown(e: MouseEvent) {
        if (duration <= 0) return;
        isDragging = true;
        const newTime = getSeekPosition(e.clientX);
        dispatch('seek', newTime);
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging || duration <= 0) return;
        const newTime = getSeekPosition(e.clientX);
        dispatch('seek', newTime);
    }

    function handleMouseUp() {
        isDragging = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }

    function handleTouchStart(e: TouchEvent) {
        if (duration <= 0) return;
        isDragging = true;
        const touch = e.touches[0];
        const newTime = getSeekPosition(touch.clientX);
        dispatch('seek', newTime);
    }

    function handleTouchMove(e: TouchEvent) {
        if (!isDragging || duration <= 0) return;
        const touch = e.touches[0];
        const newTime = getSeekPosition(touch.clientX);
        dispatch('seek', newTime);
    }

    function handleTouchEnd() {
        isDragging = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (duration <= 0) return;
        
        const step = e.shiftKey ? 10 : 5; // 5 seconds, or 10 with shift
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                dispatch('seek', Math.max(0, currentTime - step));
                break;
            case 'ArrowRight':
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
    role="slider"
    aria-label="Audio progress"
    aria-valuemin={0}
    aria-valuemax={Math.floor(duration)}
    aria-valuenow={Math.floor(currentTime)}
    aria-valuetext="{formatTime(currentTime)} of {formatTime(duration)}"
    tabindex="0"
    on:keydown={handleKeyDown}
>
    <div 
        class="progress-track"
        bind:this={progressTrack}
        on:mousedown={handleMouseDown}
        on:touchstart|preventDefault={handleTouchStart}
        on:touchmove|preventDefault={handleTouchMove}
        on:touchend={handleTouchEnd}
    >
        <div 
            class="progress-fill" 
            style="width: {progress}%"
        ></div>
        <div 
            class="progress-thumb"
            style="left: {progress}%"
            class:visible={isDragging}
        ></div>
    </div>
    
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

    .progress-track {
        width: 100%;
        height: 8px;
        background: var(--track-bg);
        border-radius: 4px;
        overflow: visible;
        cursor: pointer;
        position: relative;
        transition: height 0.15s ease;
    }

    .progress-track:hover,
    .progress-track:focus-within {
        height: 10px;
    }

    .progress-fill {
        height: 100%;
        background: var(--fill-bg);
        border-radius: 4px;
        transition: width 0.1s linear;
        position: relative;
    }

    .progress-thumb {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 16px;
        height: 16px;
        background: var(--thumb-bg);
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: transform 0.15s ease;
        pointer-events: none;
    }

    .progress-track:hover .progress-thumb,
    .progress-thumb.visible {
        transform: translate(-50%, -50%) scale(1);
    }

    .time-display {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-color);
        font-variant-numeric: tabular-nums;
    }

    .progress-bar:focus {
        outline: none;
    }

    .progress-bar:focus-visible .progress-track {
        outline: 2px solid var(--fill-bg);
        outline-offset: 2px;
    }
</style>
