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
    import { enhance } from "$app/forms";
    import { browser } from "$app/environment";
    import { announceToScreenReader } from "$lib/utils";
    import type { ClientsideUser, ClientsideAudio } from "$lib/types";

    export let audio: ClientsideAudio;
    export let user: ClientsideUser | null = null;
    
    /** Variant changes styling: 'default' for Listen page, 'compact' for lists, 'dark' for quickfeed */
    export let variant: 'default' | 'compact' | 'dark' = 'default';
    
    /** Show the share button */
    export let showShare: boolean = true;
    
    /** Show favorite count */
    export let showFavoriteCount: boolean = true;

    let shareAnnounced = false;

    $: favoritesString = (() => {
        const count = audio.favoriteCount || 0;
        if (count === 0) return "No favorites";
        if (count === 1) return "1 favorite";
        return `${count} favorites`;
    })();

    async function handleShare() {
        if (!browser) return;
        
        const url = `${window.location.origin}/listen/${audio.id}`;
        const shareData = {
            title: audio.title,
            text: audio.description ? `${audio.title} - ${audio.description.substring(0, 100)}` : audio.title,
            url,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                announceToScreenReader("Shared successfully");
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                announceToScreenReader("Link copied to clipboard");
                shareAnnounced = true;
                setTimeout(() => { shareAnnounced = false; }, 2000);
            }
        } catch (err) {
            // User cancelled or share failed
            if ((err as Error).name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        }
    }

    function canFavorite(user: ClientsideUser | null): boolean {
        return !!user && user.isTrusted && !user.isBanned;
    }
</script>

<div class="audio-actions" class:compact={variant === 'compact'} class:dark={variant === 'dark'}>
    {#if showFavoriteCount && variant === 'default'}
        <span class="favorites-count">{favoritesString}</span>
    {/if}
    
    {#if user}
        {#if canFavorite(user)}
            {#if audio.isFavorited}
                <form use:enhance action="?/unfavorite" method="POST" class="action-form">
                    <button type="submit" class="favorite-button favorited" aria-label="Remove from favorites">
                        <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        <span class="button-text">Remove from favorites</span>
                    </button>
                </form>
            {:else}
                <form use:enhance action="?/favorite" method="POST" class="action-form">
                    <button type="submit" class="favorite-button" aria-label="Add to favorites">
                        <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        <span class="button-text">Add to favorites</span>
                    </button>
                </form>
            {/if}
        {:else}
            <button type="button" class="favorite-button disabled" disabled aria-label="You must be trusted to favorite" title="You must be trusted to favorite">
                <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span class="button-text">Add to favorites</span>
            </button>
        {/if}
    {/if}
    
    {#if showShare}
        <button 
            type="button" 
            class="share-button"
            on:click={handleShare}
            aria-label="Share this audio"
        >
            <svg class="share-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span class="button-text">Share</span>
        </button>
        {#if shareAnnounced}
            <span class="share-feedback" role="status">Link copied!</span>
        {/if}
    {/if}
</div>

<style>
    .audio-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .audio-actions.compact {
        gap: 8px;
    }

    .favorites-count {
        font-weight: 500;
        color: #666;
    }

    .action-form {
        display: inline;
    }

    .favorite-button,
    .share-button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        color: #666;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .favorite-button:hover:not(.disabled),
    .share-button:hover {
        border-color: #007bff;
        color: #007bff;
        background-color: rgba(0, 123, 255, 0.1);
    }

    .favorite-button:hover:not(.disabled) {
        border-color: #ff6b6b;
        color: #ff6b6b;
        background-color: rgba(255, 107, 107, 0.1);
    }

    .favorite-button.favorited {
        color: #ff6b6b;
        border-color: #ff6b6b;
        background-color: rgba(255, 107, 107, 0.1);
    }

    .favorite-button.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .heart-icon,
    .share-icon {
        flex-shrink: 0;
    }

    .share-feedback {
        font-size: 12px;
        color: #28a745;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .compact .button-text {
        display: none;
    }

    .compact .favorite-button,
    .compact .share-button {
        padding: 6px;
    }

    /* Dark variant for quickfeed */
    .dark {
        flex-direction: column;
        gap: 1rem;
    }

    .dark .button-text {
        display: none;
    }

    .dark .favorite-button,
    .dark .share-button {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        padding: 0;
    }

    .dark .favorite-button:hover:not(.disabled),
    .dark .share-button:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
        border: none;
    }

    .dark .favorite-button.favorited {
        background: rgba(255, 107, 107, 0.3);
        color: white;
        border: none;
    }

    .dark .heart-icon,
    .dark .share-icon {
        width: 32px;
        height: 32px;
    }

    .dark .favorites-count {
        color: white;
        font-size: 0.8rem;
        margin-top: 0.2rem;
    }
</style>
