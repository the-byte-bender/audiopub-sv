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
    import type { ClientsideAudio, ClientsideUser, ClientsideComment } from "$lib/types";
    import SafeMarkdown from "./safe_markdown.svelte";
    import CommentList from "./comment_list.svelte";
    import { onMount, onDestroy } from "svelte";
    import { enhance } from "$app/forms";

    export let audios: ClientsideAudio[];
    export let currentUser: ClientsideUser | null = null;

    let currentIndex = 0;
    let audioElement: HTMLAudioElement | null = null;
    let isPlaying = false;
    let currentTime = 0;
    let duration = 0;
    let scrollContainer: HTMLElement;
    let isBuffering = false;
    let commentsDialog: HTMLDialogElement;
    let statusAnnouncement: HTMLElement;
    
    // Play tracking variables
    let playStartTime = 0;
    let hasRegisteredPlay = false;
    
    // Touch gesture support
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;
    let isTouching = false;

    // Browser detection for SSR compatibility
    const browser = typeof window !== 'undefined';
    
    // Track if audio listeners have been set up
    let audioListenersSetup = false;
    
    // Create audio element using new Audio() constructor
    function getAudioElement(): HTMLAudioElement {
        if (!audioElement && browser) {
            console.log('🆕 Creating new Audio() element');
            audioElement = new Audio();
            audioElement.preload = 'metadata';
            
            // Set up event listeners immediately
            if (!audioListenersSetup) {
                setupAudioListeners();
                audioListenersSetup = true;
            }
        }
        
        return audioElement!;
    }

    $: currentAudio = audios[currentIndex];
    $: favoritesString = (() => {
        const count = currentAudio?.favoriteCount || 0;
        if (count === 0) return "No favorites";
        if (count === 1) return "1 favorite";
        return `${count} favorites`;
    })();

    // Reactive statement to load audio when current index changes
    $: if (audios[currentIndex] && browser) {
        console.log('🔄 Current audio index changed to:', currentIndex, '-', audios[currentIndex].title);
        console.log('  - Preserving isPlaying state:', isPlaying);
        // Reset audio metrics but preserve playback state
        currentTime = 0;
        duration = 0;
        isBuffering = false;
        resetPlayTracking();
        loadAudio();
    }

    function loadAudio() {
        if (!currentAudio || !browser) return;
        
        console.log('📻 Loading audio:', currentAudio.title);
        console.log('Transcoded path:', currentAudio.transcodedPath);
        console.log('Original path:', currentAudio.path);
        
        const audio = getAudioElement();
        
        // Stop current playback if any
        if (!audio.paused) {
            console.log('⏹️ Stopping current playback');
            audio.pause();
        }
        
        // Reset audio element
        audio.currentTime = 0;
        isBuffering = true;
        
        // Try transcoded first, with fallback to original
        tryLoadAudioWithFallback(audio);
        
        // Register play count when starting to play
        fetch(`/listen/${currentAudio.id}/try_register_play`, { method: "POST" })
            .catch(err => console.error('Failed to register play:', err));
    }
    
    function tryLoadAudioWithFallback(audio: HTMLAudioElement) {
        // Prioritize transcoded path for bandwidth optimization
        if (currentAudio.transcodedPath) {
            const transcodedSrc = `/${currentAudio.transcodedPath}`;
            console.log('🎯 Trying transcoded audio:', transcodedSrc);
            
            // Set up one-time error handler for fallback
            const handleTranscodedError = () => {
                console.log('❌ Transcoded audio failed, falling back to original');
                audio.removeEventListener('error', handleTranscodedError);
                
                // Try original audio as fallback
                const originalSrc = `/${currentAudio.path}`;
                console.log('🔄 Trying original audio:', originalSrc);
                audio.src = originalSrc;
                audio.load();
            };
            
            audio.addEventListener('error', handleTranscodedError, { once: true });
            audio.src = transcodedSrc;
            audio.load();
        } else {
            // No transcoded version, use original directly
            const originalSrc = `/${currentAudio.path}`;
            console.log('⚠️ Using original audio (no transcoded):', originalSrc);
            audio.src = originalSrc;
            audio.load();
        }
        
        console.log('📻 Audio load() called, src:', audio.src);
    }

    function openCommentsDialog(index: number) {
        currentIndex = index;
        if (commentsDialog && browser) {
            commentsDialog.showModal();
        }
    }

    function closeCommentsDialog() {
        if (commentsDialog && browser) {
            commentsDialog.close();
        }
    }

    function startPlayTracking() {
        playStartTime = Date.now();
        hasRegisteredPlay = false;
        console.log('▶️ Started play tracking for:', currentAudio?.title);
    }

    function stopPlayTracking() {
        playStartTime = 0;
        console.log('⏹️ Stopped play tracking');
    }

    function resetPlayTracking() {
        stopPlayTracking();
        hasRegisteredPlay = false;
        console.log('🔄 Reset play tracking');
    }

    async function tryRegisterPlay() {
        if (!currentAudio || hasRegisteredPlay || !browser) return;
        
        const playTime = Date.now() - playStartTime;
        if (playTime >= 10000) { // 10 seconds
            hasRegisteredPlay = true;
            console.log('📊 Registering play for:', currentAudio.title);
            
            try {
                const response = await fetch(`/listen/${currentAudio.id}/try_register_play`, {
                    method: 'POST'
                });
                if (response.ok) {
                    console.log('✅ Play registered successfully');
                } else {
                    console.warn('⚠️ Failed to register play');
                }
            } catch (error) {
                console.error('❌ Error registering play:', error);
            }
        }
    }

    function togglePlay() {
        console.log('🎵 TOGGLE PLAY CALLED!');
        console.log('  - browser:', browser);
        console.log('  - isPlaying (component state):', isPlaying);
        console.log('  - currentAudio:', currentAudio?.title);
        
        if (!browser) {
            console.error('❌ Toggle play blocked - browser:', browser);
            return;
        }
        
        const audio = getAudioElement();
        console.log('✅ Toggle play proceeding with audio element:', audio);
        console.log('  - audio.src:', audio.src);
        console.log('  - audio.paused (actual state):', audio.paused);
        console.log('  - audio.readyState:', audio.readyState);
        
        // Use actual audio state instead of component state for more reliability
        if (!audio.paused) {
            console.log('⏸️ Pausing audio (audio was playing)');
            audio.pause();
        } else {
            console.log('▶️ Playing audio (audio was paused)');
            
            // Check if audio is ready to play
            if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
                audio.play().catch(error => {
                    console.error('❌ Failed to play audio:', error);
                    isBuffering = false;
                });
            } else {
                console.log('⏳ Audio not ready, waiting for canplay event');
                isBuffering = true;
                
                // Wait for audio to be ready, then play
                const handleCanPlay = () => {
                    console.log('✅ Audio now ready, attempting play');
                    audio.removeEventListener('canplay', handleCanPlay);
                    audio.play().catch(error => {
                        console.error('❌ Failed to play audio after canplay:', error);
                        isBuffering = false;
                    });
                };
                
                audio.addEventListener('canplay', handleCanPlay, { once: true });
            }
        }
    }

    function seek(seconds: number) {
        if (!browser) return;
        const audio = getAudioElement();
        audio.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
        console.log('⏭️ Seeking to:', audio.currentTime);
    }

    function goToNext() {
        if (currentIndex < audios.length - 1) {
            console.log('➡️ Going to next track, preserving playback state:', isPlaying);
            currentIndex++;
            scrollToCurrentItem();
        }
    }

    function goToPrevious() {
        if (currentIndex > 0) {
            console.log('⬅️ Going to previous track, preserving playback state:', isPlaying);
            currentIndex--;
            scrollToCurrentItem();
        }
    }

    function scrollToCurrentItem() {
        if (!scrollContainer || !browser) return;
        const itemHeight = window.innerHeight;
        scrollContainer.scrollTo({
            top: currentIndex * itemHeight,
            behavior: 'smooth'
        });
    }

    function handleScroll() {
        if (!scrollContainer || !browser) return;
        const scrollTop = scrollContainer.scrollTop;
        const itemHeight = window.innerHeight;
        const newIndex = Math.round(scrollTop / itemHeight);
        
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < audios.length) {
            console.log('📱 Scroll navigation: track', currentIndex, '→', newIndex, ', preserving playback state:', isPlaying);
            currentIndex = newIndex;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        console.log('⌨️ KEY PRESSED:', event.key);
        
        switch (event.key) {
            case 'ArrowUp':
                console.log('⬆️ Arrow Up - going to previous');
                event.preventDefault();
                goToPrevious();
                break;
            case 'ArrowDown':
                console.log('⬇️ Arrow Down - going to next');
                event.preventDefault();
                goToNext();
                break;
            case ' ':
                console.log('⏯️ Spacebar - toggling play');
                event.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                console.log('⬅️ Arrow Left - seeking backward');
                event.preventDefault();
                seek(-10);
                break;
            case 'ArrowRight':
                console.log('➡️ Arrow Right - seeking forward');
                event.preventDefault();
                seek(10);
                break;
            case 'c':
            case 'C':
                console.log('💬 C key - opening comments');
                event.preventDefault();
                openCommentsDialog(currentIndex);
                break;
            case 'l':
            case 'L':
                console.log('❤️ L key - toggling favorite');
                console.log('  - currentIndex:', currentIndex);
                console.log('  - currentAudio:', currentAudio?.title);
                console.log('  - audio element paused:', audioElement?.paused);
                event.preventDefault();
                if (currentUser) {
                    toggleFavorite();
                }
                break;
            default:
                console.log('🔘 Unhandled key:', event.key);
        }
    }

    function announceStatus(message: string) {
        if (statusAnnouncement && browser) {
            statusAnnouncement.textContent = message;
            // Clear the message after a short delay to allow for repeated announcements
            setTimeout(() => {
                if (statusAnnouncement) {
                    statusAnnouncement.textContent = '';
                }
            }, 1000);
        }
    }

    async function toggleFavorite() {
        if (!currentUser || !currentAudio) return;
        
        console.log('🔄 toggleFavorite called');
        console.log('  - currentIndex:', currentIndex);
        console.log('  - currentAudio:', currentAudio.title);
        console.log('  - isFavorited before:', currentAudio.isFavorited);
        console.log('  - audio playing before:', !audioElement?.paused);
        
        const formData = new FormData();
        formData.append('audioId', currentAudio.id);
        
        const action = currentAudio.isFavorited ? '/quickfeed?/unfavorite' : '/quickfeed?/favorite';
        
        try {
            const response = await fetch(action, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                // Update local state
                const wasFavorited = currentAudio.isFavorited;
                audios[currentIndex].isFavorited = !currentAudio.isFavorited;
                if (currentAudio.isFavorited) {
                    audios[currentIndex].favoriteCount++;
                } else {
                    audios[currentIndex].favoriteCount--;
                }
                audios = audios; // Trigger reactivity
                
                console.log('  - isFavorited after:', audios[currentIndex].isFavorited);
                console.log('  - audio playing after:', !audioElement?.paused);
                
                // Announce the change for accessibility
                const message = wasFavorited ? 'Removed from favorites' : 'Added to favorites';
                announceStatus(message);
                console.log('🔊 Announced:', message);
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    }

    function formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // Touch gesture handlers
    function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            touchStartY = touch.clientY;
            touchStartX = touch.clientX;
            touchStartTime = Date.now();
            isTouching = true;
        }
    }

    function handleTouchMove(event: TouchEvent) {
        if (!isTouching || event.touches.length !== 1) return;
        
        // Prevent default scrolling behavior for our custom gestures
        const touch = event.touches[0];
        const deltaY = touch.clientY - touchStartY;
        const deltaX = touch.clientX - touchStartX;
        const timeDelta = Date.now() - touchStartTime;
        
        // If it's a clear vertical swipe gesture, prevent scroll
        if (Math.abs(deltaY) > 50 && Math.abs(deltaX) < 100 && timeDelta < 300) {
            event.preventDefault();
        }
    }

    function handleTouchEnd(event: TouchEvent) {
        if (!isTouching) return;
        
        const touch = event.changedTouches[0];
        const deltaY = touch.clientY - touchStartY;
        const deltaX = touch.clientX - touchStartX;
        const timeDelta = Date.now() - touchStartTime;
        
        // Reset touch state
        isTouching = false;
        
        // Minimum swipe distance and maximum time for gesture recognition
        const minSwipeDistance = 80;
        const maxSwipeTime = 300;
        
        if (timeDelta < maxSwipeTime) {
            // Vertical swipe (navigate between audios)
            if (Math.abs(deltaY) > minSwipeDistance && Math.abs(deltaX) < Math.abs(deltaY)) {
                event.preventDefault();
                if (deltaY < 0) {
                    // Swipe up - next audio
                    goToNext();
                } else {
                    // Swipe down - previous audio
                    goToPrevious();
                }
                return;
            }
            
            // Horizontal swipe (seek audio)
            if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < Math.abs(deltaX)) {
                event.preventDefault();
                if (deltaX > 0) {
                    // Swipe right - seek forward
                    seek(10);
                } else {
                    // Swipe left - seek backward
                    seek(-10);
                }
                return;
            }
        }
        
        // Single tap to play/pause (if not a swipe gesture)
        if (Math.abs(deltaY) < 20 && Math.abs(deltaX) < 20 && timeDelta < 200) {
            togglePlay();
        }
    }

    function setupAudioListeners() {
        if (!audioElement || !browser) return;
        
        console.log('🎧 Setting up audio event listeners');
        
        audioElement.addEventListener('loadstart', () => { 
            console.log('🎵 Audio loading started');
            isBuffering = true; 
        });
        
        audioElement.addEventListener('canplay', () => { 
            console.log('✅ Audio can play');
            isBuffering = false;
            
            // Auto-play if user was previously playing audio
            if (isPlaying && audioElement && audioElement.paused) {
                console.log('🎵 Auto-playing new track (continuing playback state)');
                audioElement.play().catch(error => {
                    console.error('❌ Auto-play failed:', error);
                    // Don't change isPlaying state - let user try manually
                });
            }
        });
        
        audioElement.addEventListener('canplaythrough', () => { 
            console.log('✅ Audio can play through completely');
            
            // Fallback auto-play if canplay didn't trigger it
            if (isPlaying && audioElement && audioElement.paused) {
                console.log('🎵 Fallback auto-play (canplaythrough)');
                audioElement.play().catch(error => {
                    console.error('❌ Fallback auto-play failed:', error);
                });
            }
        });
        
        audioElement.addEventListener('play', () => { 
            console.log('▶️ Audio playing event fired');
            isPlaying = true;
            isBuffering = false;
            startPlayTracking();
        });
        
        audioElement.addEventListener('pause', () => { 
            console.log('⏸️ Audio paused event fired');
            isPlaying = false;
            stopPlayTracking();
        });
        
        audioElement.addEventListener('timeupdate', () => { 
            const newCurrentTime = audioElement!.currentTime;
            const newDuration = audioElement!.duration;
            
            if (currentTime !== newCurrentTime || duration !== newDuration) {
                console.log('⏰ Time update:', newCurrentTime.toFixed(2), '/', newDuration.toFixed(2));
                currentTime = newCurrentTime;
                duration = newDuration;
            }
            
            // Check if we should register a play
            if (playStartTime > 0 && !hasRegisteredPlay) {
                tryRegisterPlay();
            }
        });
        
        audioElement.addEventListener('loadedmetadata', () => { 
            console.log('📊 Audio metadata loaded, duration:', audioElement!.duration);
            duration = audioElement!.duration || 0;
            currentTime = 0;
        });
        
        audioElement.addEventListener('durationchange', () => { 
            console.log('⏱️ Duration changed:', audioElement!.duration);
            duration = audioElement!.duration || 0;
        });
        
        audioElement.addEventListener('error', (e) => {
            console.error('❌ Audio error:', e);
            if (audioElement!.error) {
                const errorCode = audioElement!.error.code;
                const errorMessage = audioElement!.error.message;
                console.error('Audio error details:', errorCode, errorMessage);
                
                // Don't handle 404 errors here since they're handled by tryLoadAudioWithFallback
                if (errorCode !== 4) { // 4 = MEDIA_ELEMENT_ERROR_SRC_NOT_SUPPORTED (includes 404)
                    console.error('Non-404 audio error, cannot recover');
                }
            }
            isBuffering = false;
        });
        
        audioElement.addEventListener('stalled', () => {
            console.warn('⚠️ Audio stalled');
        });
        
        audioElement.addEventListener('waiting', () => {
            console.log('⏳ Audio waiting for data');
            isBuffering = true;
        });
        
        console.log('✅ Audio event listeners set up successfully');
    }

    onMount(() => {
        console.log('🚀 QuickfeedPlayer onMount called');
        console.log('Browser detection:', browser);
        console.log('CurrentAudio on mount:', currentAudio);
        console.log('Audios array length:', audios?.length);
        
        if (browser) {
            console.log('✅ Adding keyboard event listener');
            document.addEventListener('keydown', handleKeydown);
        } else {
            console.error('❌ Browser detection failed - no keyboard events');
        }
        
        // Initialize audio element right away
        if (browser) {
            console.log('🎧 Initializing audio element');
            getAudioElement(); // This will create and set up the audio element
        }
        
        // Debug check every second for the first 5 seconds
        let debugCount = 0;
        const debugInterval = setInterval(() => {
            debugCount++;
            console.log(`🔍 Debug check ${debugCount}: audioElement =`, audioElement, 'currentAudio =', currentAudio?.title);
            if (debugCount >= 5) {
                clearInterval(debugInterval);
            }
        }, 1000);
    });

    onDestroy(() => {
        if (browser) {
            document.removeEventListener('keydown', handleKeydown);
        }
    });
</script>

<div class="quickfeed-container">
    
    <div 
        class="scroll-container" 
        bind:this={scrollContainer} 
        on:scroll={handleScroll}
        on:touchstart={handleTouchStart}
        on:touchmove={handleTouchMove}
        on:touchend={handleTouchEnd}
    >
        {#each audios as audio, index (audio.id)}
            <div class="audio-item" class:active={index === currentIndex}>
                <div class="background-blur">
                    <!-- Add a subtle background pattern or blur effect -->
                </div>
                
                <div class="content-overlay">
                    <!-- Audio Controls (Center) -->
                    <div class="audio-controls">
                        <div class="waveform-container">
                            <div class="play-button" class:playing={isPlaying && index === currentIndex}>
                                <button on:click={() => {console.log('🖱️ PLAY BUTTON CLICKED!'); togglePlay();}} aria-label={isPlaying ? "Pause" : "Play"}>
                                    {#if isBuffering && index === currentIndex}
                                        <div class="loading-spinner"></div>
                                    {:else if isPlaying && index === currentIndex}
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                                            <rect x="6" y="4" width="4" height="16" />
                                            <rect x="14" y="4" width="4" height="16" />
                                        </svg>
                                    {:else}
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                                            <polygon points="5,3 19,12 5,21" />
                                        </svg>
                                    {/if}
                                </button>
                            </div>
                            
                            {#if index === currentIndex}
                                <div class="progress-bar">
                                    <div class="progress-track">
                                        <div 
                                            class="progress-fill" 
                                            style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
                                            title="Progress: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s ({duration > 0 ? ((currentTime / duration) * 100).toFixed(1) : 0}%)"
                                        ></div>
                                    </div>
                                    <div class="time-display">
                                        <span title="Current time: {currentTime}">{formatTime(currentTime)}</span>
                                        <span title="Duration: {duration}">{formatTime(duration)}</span>
                                    </div>
                                    <!-- Debug info (remove in production) -->
                                    {#if duration === 0 && currentTime === 0}
                                        <div class="debug-info" style="font-size: 0.7rem; color: #ff6666; margin-top: 0.2rem;">
                                            Debug: duration={duration}, currentTime={currentTime}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                    
                    <!-- Content Info (Bottom Left) -->
                    <div class="content-info">
                        <h2>{audio.title}</h2>
                        {#if audio.user}
                            <p class="author">
                                <a href="/user/{audio.user.id}">@{audio.user.displayName}</a>
                            </p>
                        {/if}
                        <div class="description">
                            <SafeMarkdown source={audio.description} />
                        </div>
                        <div class="stats">
                            <span>{audio.playsString}</span>
                            <span>•</span>
                            <span>{index === currentIndex ? favoritesString : `${audio.favoriteCount || 0} favorites`}</span>
                        </div>
                    </div>
                    
                    <!-- Action Buttons (Right Side) -->
                    <div class="action-buttons">
                        {#if currentUser}
                            <button 
                                class="action-btn favorite-btn" 
                                class:favorited={audio.isFavorited}
                                on:click={() => {currentIndex = index; toggleFavorite();}}
                                aria-label={audio.isFavorited ? "Remove from favorites" : "Add to favorites"}
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill={audio.isFavorited ? "#ff6b6b" : "none"} stroke="white" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span>{audio.favoriteCount || 0}</span>
                            </button>
                        {/if}
                        
                        <button 
                            class="action-btn comment-btn"
                            on:click={() => openCommentsDialog(index)}
                            aria-label="Comments"
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                        </button>
                        
                        <button 
                            class="action-btn share-btn"
                            on:click={() => {
                                currentIndex = index; 
                                if (browser) {
                                    if (navigator.share) {
                                        navigator.share({url: `/listen/${audio.id}`});
                                    } else if (navigator.clipboard) {
                                        navigator.clipboard.writeText(window.location.origin + `/listen/${audio.id}`);
                                    }
                                }
                            }}
                            aria-label="Share"
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        {/each}
    </div>
    
    <!-- Comments Dialog -->
    <dialog bind:this={commentsDialog} class="comments-dialog">
        {#if currentAudio}
            <div class="comments-header">
                <h3>Comments</h3>
                <button class="close-btn" on:click={closeCommentsDialog} aria-label="Close comments dialog">✕</button>
            </div>
                <div class="comments-content">
                    {#if currentAudio.comments && currentAudio.comments.length > 0}
                        <CommentList 
                            comments={currentAudio.comments} 
                            user={currentUser} 
                            isAdmin={false}
                        />
                    {:else}
                        <p class="no-comments">No comments yet. Be the first to comment!</p>
                    {/if}
                    
                    {#if currentUser && !currentUser.isBanned}
                        <form 
                            use:enhance={browser ? ({ formData }) => {
                                formData.append('audioId', currentAudio.id);
                                return async ({ result, update }) => {
                                    if (result.type === 'success' && result.data?.comment) {
                                        // Add the new comment to the local state
                                        if (!currentAudio.comments) {
                                            audios[currentIndex].comments = [];
                                        }
                                        audios[currentIndex].comments = [...(audios[currentIndex].comments || []), result.data.comment];
                                        audios = audios; // Trigger reactivity
                                    }
                                    await update();
                                };
                            } : undefined}
                            action="/quickfeed?/add_comment" 
                            method="POST"
                            class="comment-form"
                        >
                            {#if !currentUser.isTrusted}
                                <p class="warning">
                                    You're not trusted yet. Your comments will be reviewed before being shown.
                                </p>
                            {/if}
                            <textarea 
                                name="comment" 
                                placeholder="Add a comment..." 
                                required 
                                maxlength="4000"
                                rows="3"
                            ></textarea>
                            <button type="submit">Post Comment</button>
                        </form>
                    {:else if !currentUser}
                        <p class="login-prompt">
                            <a href="/login">Login</a> to comment
                        </p>
                    {/if}
                </div>
        {/if}
    </dialog>
    
    <!-- Status announcements for screen readers -->
    <div aria-live="polite" class="sr-only" bind:this={statusAnnouncement}></div>

    <!-- Keyboard Hints (Desktop) / Touch Hints (Mobile) -->
    <div class="control-hints">
        <div class="desktop-hints">
            <div class="hint">↑↓ Navigate</div>
            <div class="hint">Space Play/Pause</div>
            <div class="hint">←→ Seek</div>
            <div class="hint">C Comments</div>
            {#if currentUser}<div class="hint">L Like</div>{/if}
        </div>
        <div class="mobile-hints">
            <div class="hint">Swipe ↑↓ Navigate</div>
            <div class="hint">Tap Play/Pause</div>
            <div class="hint">Swipe ←→ Seek</div>
        </div>
    </div>
</div>

<style>
    .quickfeed-container {
        position: relative;
        width: 100vw;
        height: 100vh;
        background: #000;
        overflow: hidden;
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

    .scroll-container {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        scroll-snap-type: y mandatory;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .scroll-container::-webkit-scrollbar {
        display: none;
    }

    .audio-item {
        width: 100%;
        height: 100vh;
        scroll-snap-align: start;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    }

    .audio-item:nth-child(even) {
        background: linear-gradient(135deg, #614385 0%, #516395 100%);
    }

    .audio-item:nth-child(3n) {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .background-blur {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%);
        pointer-events: none;
    }

    .content-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: grid;
        grid-template-areas: 
            ". . actions"
            ". controls actions"
            "info info actions";
        grid-template-columns: 1fr 2fr 120px;
        grid-template-rows: 1fr 1fr 1fr;
        padding: 2rem;
        gap: 1rem;
    }

    .audio-controls {
        grid-area: controls;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .waveform-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
    }

    .play-button button {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }

    .play-button button:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }

    .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .progress-bar {
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .progress-track {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: white;
        transition: width 0.1s ease;
    }

    .time-display {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.8);
    }

    .content-info {
        grid-area: info;
        color: white;
        max-width: 70%;
    }

    .content-info h2 {
        font-size: 1.5rem;
        margin: 0 0 0.5rem 0;
        font-weight: 600;
    }

    .author {
        font-size: 1rem;
        margin: 0 0 1rem 0;
        opacity: 0.9;
    }

    .author a {
        color: white;
        text-decoration: none;
        font-weight: 500;
    }

    .description {
        font-size: 0.9rem;
        line-height: 1.4;
        margin-bottom: 1rem;
        opacity: 0.8;
    }

    .stats {
        display: flex;
        gap: 0.5rem;
        font-size: 0.8rem;
        opacity: 0.7;
    }

    .action-buttons {
        grid-area: actions;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        align-items: center;
        justify-content: center;
    }

    .action-btn {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        color: white;
        font-size: 0.7rem;
        font-weight: 600;
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }

    .favorite-btn.favorited {
        background: rgba(255, 107, 107, 0.3);
    }

    .action-btn span {
        margin-top: 0.2rem;
    }

    .comments-dialog {
        width: 100%;
        max-width: 100vw;
        height: 70vh;
        margin: auto 0 0 0;
        padding: 1.5rem;
        background: white;
        border: none;
        border-radius: 1rem 1rem 0 0;
        display: flex;
        flex-direction: column;
    }

    .comments-dialog::backdrop {
        background: rgba(0, 0, 0, 0.8);
    }

    .comments-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        border-bottom: 1px solid #eee;
        padding-bottom: 1rem;
    }

    .comments-header h3 {
        margin: 0;
        color: #333;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
    }

    .comments-content {
        flex: 1;
        overflow-y: auto;
        color: #333;
        display: flex;
        flex-direction: column;
    }

    .no-comments {
        text-align: center;
        color: #666;
        font-style: italic;
        margin: 2rem 0;
    }

    .comment-form {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }

    .comment-form .warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 0.5rem;
        border-radius: 0.25rem;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .comment-form textarea {
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 0.5rem;
        padding: 0.75rem;
        font-family: inherit;
        font-size: 0.9rem;
        resize: vertical;
        margin-bottom: 0.5rem;
    }

    .comment-form textarea:focus {
        outline: none;
        border-color: #007bff;
    }

    .comment-form button {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .comment-form button:hover {
        background: #0056b3;
    }

    .login-prompt {
        text-align: center;
        margin: 2rem 0;
        color: #666;
    }

    .login-prompt a {
        color: #007bff;
        text-decoration: none;
        font-weight: 600;
    }

    .login-prompt a:hover {
        text-decoration: underline;
    }

    .control-hints {
        position: fixed;
        top: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 100;
    }

    .mobile-hints {
        display: none;
    }

    .desktop-hints {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .hint {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 0.3rem 0.6rem;
        border-radius: 1rem;
        font-size: 0.7rem;
        font-weight: 500;
    }

    @media (max-width: 768px) {
        .content-overlay {
            grid-template-columns: 1fr 80px;
            grid-template-areas: 
                ". actions"
                "controls actions"
                "info actions";
            padding: 1rem;
        }

        .progress-bar {
            width: 200px;
        }

        .content-info h2 {
            font-size: 1.2rem;
        }

        .desktop-hints {
            display: none;
        }

        .mobile-hints {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .scroll-container {
            /* Improve touch scrolling on mobile */
            -webkit-overflow-scrolling: touch;
            touch-action: pan-y;
        }

        .audio-item {
            /* Ensure full viewport coverage on mobile */
            height: 100dvh; /* Use dynamic viewport height for mobile */
        }
    }
</style>