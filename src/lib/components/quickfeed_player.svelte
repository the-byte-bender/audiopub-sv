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
    let isPlaying = false;
    let isTransitioning = false;
    let currentTime = 0;
    let duration = 0;
    let scrollContainer: HTMLElement;
    let isBuffering = false;
    let commentsDialog: HTMLDialogElement;
    let statusAnnouncement: HTMLElement;
    
    // Play tracking variables
    let playStartTime = 0;
    let hasRegisteredPlay = false;
    
    // Pagination variables
    let isLoadingMore = false;
    let currentPage = 1;
    let hasMoreContent = true;
    
    // Debug flag (can be toggled in console: window.debugQuickfeed = true)
    let showDebugInfo = false;
    
    // Dynamic ring buffer audio system
    let audioContext: AudioContext | null = null;
    
    // Dynamic pool configuration
    const MIN_POOL_SIZE = 2;
    const MAX_POOL_SIZE = 10;
    const INITIAL_POOL_SIZE = 3;
    
    let audioPool: Array<{
        element: HTMLAudioElement;
        gainNode: GainNode | null;
        filterNode: BiquadFilterNode | null;
        source: MediaElementAudioSourceNode | null;
        isActive: boolean;
        trackId: string | null;
        fadeStartTime: number;
        fadeType: 'in' | 'out' | null;
        lastUsedTime: number;
    }> = [];
    let currentAudioIndex = 0;
    let activeTransitions = new Map<number, { startTime: number; duration: number }>();
    
    // Rapid navigation tracking
    let navigationHistory: number[] = [];
    let lastNavigationTime = 0;
    
    // Touch gesture support
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;
    let isTouching = false;

    // Browser detection for SSR compatibility
    const browser = typeof window !== 'undefined';
    
    // Track if audio listeners have been set up
    let audioListenersSetup = false;
    

    function initializeAudioPool() {
        if (!browser || audioPool.length > 0) return;
        
        console.log('Initializing dynamic audio pool with', INITIAL_POOL_SIZE, 'elements');
        
        for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
            addSlotToPool();
        }
    }
    
    function addSlotToPool(): number {
        if (audioPool.length >= MAX_POOL_SIZE) {
            console.log('Pool at maximum size, cannot add more slots');
            return -1;
        }
        
        const slotIndex = audioPool.length;
        const element = new Audio();
        element.preload = 'metadata';
        element.crossOrigin = 'anonymous'; // For Web Audio API
        
        const slot = {
            element,
            gainNode: null,
            filterNode: null,
            source: null,
            isActive: false,
            trackId: null,
            fadeStartTime: 0,
            fadeType: null,
            lastUsedTime: Date.now()
        };
        
        // Add essential event listeners to each slot
        setupSlotEventListeners(slot, slotIndex);
        
        audioPool.push(slot);
        
        return slotIndex;
    }

    function setupSlotEventListeners(slot: typeof audioPool[0], slotIndex: number) {
        const element = slot.element;
        
        element.addEventListener('play', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                isPlaying = true;
                isBuffering = false;
                startPlayTracking();
            }
        });
        
        element.addEventListener('pause', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                isPlaying = false;
                stopPlayTracking();
            }
        });
        
        element.addEventListener('timeupdate', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                const newCurrentTime = element.currentTime;
                const newDuration = element.duration;
                if (currentTime !== newCurrentTime || duration !== newDuration) {
                    currentTime = newCurrentTime;
                    duration = newDuration;
                }
                
                // Check if we should register a play
                if (playStartTime > 0 && !hasRegisteredPlay) {
                    tryRegisterPlay();
                }
            }
        });
        
        element.addEventListener('loadedmetadata', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                duration = element.duration || 0;
                currentTime = 0;
            }
        });
        
        element.addEventListener('waiting', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                isBuffering = true;
            }
        });
        
        element.addEventListener('canplay', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                isBuffering = false;
            }
        });
        
        element.addEventListener('error', (e) => {
            console.error(`❌ Slot ${slotIndex} error:`, e);
            if (slot.isActive && slotIndex === currentAudioIndex) {
                isBuffering = false;
            }
        });
        
        element.addEventListener('ended', () => {
            if (slot.isActive && slotIndex === currentAudioIndex) {
                isPlaying = false;
                stopPlayTracking();
            }
        });
        
    }

    function createAudioNodes(audioSlot: typeof audioPool[0]): boolean {
        if (!audioContext || audioSlot.source) return true; // Already has nodes

        try {
            const source = audioContext.createMediaElementSource(audioSlot.element);
            const gainNode = audioContext.createGain();
            const filterNode = audioContext.createBiquadFilter();

            // Set up filter defaults
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(20000, audioContext.currentTime);
            filterNode.Q.setValueAtTime(1, audioContext.currentTime);

            // Connect the audio graph: source -> filter -> gain -> destination
            source.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Store references
            audioSlot.source = source;
            audioSlot.gainNode = gainNode;
            audioSlot.filterNode = filterNode;

            return true;
        } catch (error) {
            console.error('❌ Failed to create audio nodes:', error);
            return false;
        }
    }

    function cleanupAudioSlot(slot: typeof audioPool[0], slotIndex: number) {
        
        // Stop audio playback
        if (!slot.element.paused) {
            slot.element.pause();
        }
        slot.element.currentTime = 0;
        
        // Reset Web Audio nodes to default state
        if (slot.gainNode && audioContext) {
            slot.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            slot.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        }
        if (slot.filterNode && audioContext) {
            slot.filterNode.frequency.cancelScheduledValues(audioContext.currentTime);
            slot.filterNode.frequency.setValueAtTime(20000, audioContext.currentTime);
            slot.filterNode.type = 'lowpass';
        }
        
        // Reset slot state
        slot.isActive = false;
        slot.trackId = null;
        slot.fadeType = null;
        slot.fadeStartTime = 0;
        
    }
    
    function detectRapidNavigation(): boolean {
        const now = Date.now();
        const timeSinceLastNav = now - lastNavigationTime;
        
        // Add current navigation to history
        navigationHistory.push(now);
        lastNavigationTime = now;
        
        // Keep only recent navigations (last 2 seconds)
        navigationHistory = navigationHistory.filter(time => now - time < 2000);
        
        // Rapid navigation = more than 3 navigations in 1 second
        const recentNavs = navigationHistory.filter(time => now - time < 1000);
        const isRapid = recentNavs.length > 3;
        
        return isRapid;
    }
    
    function expandPoolIfNeeded(): boolean {
        const activeSlots = audioPool.filter(slot => slot.isActive || slot.fadeType !== null).length;
        const availableSlots = audioPool.length - activeSlots;
        
        // Need more slots if we have less than 2 available
        if (availableSlots < 2 && audioPool.length < MAX_POOL_SIZE) {
            const newSlotIndex = addSlotToPool();
            return newSlotIndex !== -1;
        }
        
        return false;
    }
    
    function contractPoolIfNeeded() {
        // Only contract if we have more than minimum and plenty of idle slots
        if (audioPool.length <= MIN_POOL_SIZE) return;
        
        const now = Date.now();
        const activeSlots = audioPool.filter(slot => slot.isActive || slot.fadeType !== null).length;
        const idleTime = 5000; // 5 seconds of inactivity
        
        // Check if we can safely remove unused slots
        for (let i = audioPool.length - 1; i >= MIN_POOL_SIZE; i--) {
            const slot = audioPool[i];
            
            // Can remove if slot is completely idle for a while
            if (!slot.isActive && 
                slot.fadeType === null && 
                (now - slot.lastUsedTime) > idleTime &&
                activeSlots < audioPool.length - 1) {
                
                
                // Clean up the slot completely
                cleanupAudioSlot(slot, i);
                
                // Remove from pool
                audioPool.splice(i, 1);

                
                return; // Only remove one at a time
            }
        }
    }

    function findAvailableAudioSlot(): number {
        // First try to find a completely inactive slot
        for (let i = 0; i < audioPool.length; i++) {
            const slot = audioPool[i];
            if (!slot.isActive && slot.fadeType === null) {
                slot.lastUsedTime = Date.now();
                return i;
            }
        }
        
        // If no clean slots available, try to expand the pool
        const expandedSlot = expandPoolIfNeeded();
        if (expandedSlot) {
            // Return the newly created slot
            const newSlotIndex = audioPool.length - 1;
            audioPool[newSlotIndex].lastUsedTime = Date.now();
            return newSlotIndex;
        }
        
        // If we can't expand, look for slots that are only fading out (safe to reuse)
        let oldestFadeOut = -1;
        let oldestTime = Infinity;
        
        for (let i = 0; i < audioPool.length; i++) {
            const slot = audioPool[i];
            // Only reuse if it's fading out AND not actively playing new content
            if (slot.fadeType === 'out' && !slot.isActive && slot.fadeStartTime < oldestTime) {
                oldestTime = slot.fadeStartTime;
                oldestFadeOut = i;
            }
        }
        
        if (oldestFadeOut !== -1) {
            audioPool[oldestFadeOut].lastUsedTime = Date.now();
            return oldestFadeOut;
        }
        
        // Emergency fallback: find least recently used inactive slot
        let lruSlot = -1;
        let oldestUseTime = Infinity;
        
        for (let i = 0; i < audioPool.length; i++) {
            const slot = audioPool[i];
            if (!slot.isActive && slot.lastUsedTime < oldestUseTime) {
                oldestUseTime = slot.lastUsedTime;
                lruSlot = i;
            }
        }
        
        if (lruSlot !== -1) {
            audioPool[lruSlot].lastUsedTime = Date.now();
            return lruSlot;
        }
        
        // Absolute last resort: use first slot (shouldn't happen with dynamic pool)
        return 0;
    }

    function findAvailableAudioSlotExcluding(excludeIndex: number): number {
        // First try to find an inactive slot (excluding the specified index)
        for (let i = 0; i < audioPool.length; i++) {
            if (i !== excludeIndex && !audioPool[i].isActive) {
                return i;
            }
        }
        
        // If all slots are active, find the oldest one that's fading out (excluding the specified index)
        let oldestFadeOut = -1;
        let oldestTime = Infinity;
        
        for (let i = 0; i < audioPool.length; i++) {
            const slot = audioPool[i];
            if (i !== excludeIndex && slot.fadeType === 'out' && slot.fadeStartTime < oldestTime) {
                oldestTime = slot.fadeStartTime;
                oldestFadeOut = i;
            }
        }
        
        if (oldestFadeOut !== -1) {
            return oldestFadeOut;
        }
        
        // Last resort: use next available slot (avoiding the excluded one)
        let nextIndex = (excludeIndex + 1) % audioPool.length;
        return nextIndex;
    }

    function getCurrentAudioElement(): HTMLAudioElement | null {
        if (audioPool.length === 0) return null;
        
        // Find the active audio that's not fading out
        for (const slot of audioPool) {
            if (slot.isActive && slot.fadeType !== 'out') {
                return slot.element;
            }
        }
        
        // Fallback to the current index
        return audioPool[currentAudioIndex]?.element || null;
    }
    
    function getAudioElement(): HTMLAudioElement {
        // Legacy compatibility - returns current playing audio
        const currentElement = getCurrentAudioElement();
        if (currentElement) return currentElement;
        
        // Fallback: initialize pool and return first element
        if (audioPool.length === 0) {
            initializeAudioPool();
        }
        
        return audioPool[0].element;
    }

    async function ensureAudioContext(): Promise<boolean> {
        if (!browser) return false;
        
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (error) {
                console.error('❌ Failed to create audio context:', error);
                return false;
            }
        }

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (error) {
                return false;
            }
        }

        return audioContext.state === 'running';
    }


    async function ringBufferCrossfade(audioSrc: string, trackId: string, transitionDuration = 600): Promise<boolean> {
        
        try {
            // Step 1: Ensure audio context and pool are ready
            const contextReady = await ensureAudioContext();
            if (!contextReady) {
                return false;
            }
            
            if (audioPool.length === 0) {
                initializeAudioPool();
            }

            // Step 2: Find currently playing audio to fade out (before we allocate new slot)
            const currentSlots = audioPool.filter(slot => slot.isActive && slot.fadeType !== 'out');
            
            // Step 3: Find slot for new audio
            const newSlotIndex = findAvailableAudioSlot();
            const newSlot = audioPool[newSlotIndex];
            
            // Clean up the slot if it was previously used
            if (newSlot.isActive) {
                cleanupAudioSlot(newSlot, newSlotIndex);
            }
            
            // Step 4: Set up Web Audio nodes for the new slot
            const nodesReady = createAudioNodes(newSlot);
            if (!nodesReady || !newSlot.gainNode || !newSlot.filterNode) {
                return false;
            }
            
            // Step 4.5: Validate current slots have Web Audio nodes for crossfading
            let validCurrentSlots = [];
            for (const slot of currentSlots) {
                if (!slot.gainNode || !slot.filterNode) {
                    const currentNodesReady = createAudioNodes(slot);
                    if (currentNodesReady && slot.gainNode && slot.filterNode) {
                        validCurrentSlots.push(slot);
                    } else {
                        console.log('Failed to create Web Audio nodes for current slot, will skip crossfade');
                    }
                } else {
                    validCurrentSlots.push(slot);
                }
            }
            
            
            // If no current slots exist or have valid nodes, this is effectively a "first play"
            if (validCurrentSlots.length === 0) {
                console.log('No current audio to crossfade from - direct play new audio');
            }

            // Step 5: Load new audio
            newSlot.element.src = audioSrc;
            newSlot.trackId = trackId;
            
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Load timeout')), 5000);
                
                const onCanPlay = () => {
                    clearTimeout(timeout);
                    newSlot.element.removeEventListener('canplay', onCanPlay);
                    newSlot.element.removeEventListener('error', onError);
                    resolve();
                };
                
                const onError = () => {
                    clearTimeout(timeout);
                    newSlot.element.removeEventListener('canplay', onCanPlay);
                    newSlot.element.removeEventListener('error', onError);
                    reject(new Error('Load error'));
                };
                
                newSlot.element.addEventListener('canplay', onCanPlay);
                newSlot.element.addEventListener('error', onError);
                newSlot.element.load();
            });

            // Step 6: Start crossfade (new audio loaded successfully)
            const startTime = audioContext.currentTime;
            const endTime = startTime + (transitionDuration / 1000);
            
            // Fade out all currently playing audio (use validated slots only)
            for (const slot of validCurrentSlots) {
                // if (slot === newSlot) continue;
                if (slot.gainNode && slot.filterNode) {
                    
                    slot.fadeType = 'out';
                    slot.fadeStartTime = startTime;
                    
                    // Fade out volume and apply lowpass filter
                    slot.gainNode.gain.cancelScheduledValues(startTime);
                    slot.gainNode.gain.setValueAtTime(1, startTime);
                    slot.gainNode.gain.linearRampToValueAtTime(0, endTime);
                    
                    // IMPORTANT: Set filter type to lowpass for proper fadeout
                    slot.filterNode.type = 'lowpass';
                    slot.filterNode.frequency.cancelScheduledValues(startTime);
                    slot.filterNode.frequency.setValueAtTime(20000, startTime); // Start clear
                    slot.filterNode.frequency.exponentialRampToValueAtTime(300, endTime); // End muffled
                    
                    // Schedule event-based cleanup after fade completes
                    const cleanupFadedSlot = () => {
                        slot.element.pause();
                        slot.element.currentTime = 0;
                        slot.isActive = false;
                        slot.fadeType = null;
                        slot.trackId = null;
                        slot.lastUsedTime = Date.now();
                        
                        // Reset Web Audio nodes to default state for next use
                        if (slot.gainNode && audioContext) {
                            slot.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
                        }
                        if (slot.filterNode && audioContext) {
                            slot.filterNode.type = 'lowpass';
                            slot.filterNode.frequency.setValueAtTime(20000, audioContext.currentTime);
                        }
                    };
                    
                    // Use Web Audio event timing for precise cleanup
                    if (audioContext) {
                        const cleanupTime = audioContext.currentTime + (transitionDuration / 1000) + 0.1;
                        
                        // Create a gain node just for timing
                        const timingGain = audioContext.createGain();
                        timingGain.connect(audioContext.destination);
                        timingGain.gain.setValueAtTime(0, cleanupTime - 0.01);
                        timingGain.gain.setValueAtTime(1, cleanupTime);
                        
                        // Listen for the timing event
                        const checkCleanup = () => {
                            if (audioContext!.currentTime >= cleanupTime) {
                                cleanupFadedSlot();
                                timingGain.disconnect();
                                return;
                            }
                            requestAnimationFrame(checkCleanup);
                        };
                        requestAnimationFrame(checkCleanup);
                    } else {
                        // Fallback to timer if no audioContext
                        setTimeout(cleanupFadedSlot, transitionDuration + 100);
                    }
                }
            }
            
            // Step 6: Fade in new audio
            newSlot.isActive = true;
            newSlot.fadeStartTime = startTime;
            
            if (validCurrentSlots.length > 0) {
                // Crossfade mode: fade in with highpass filter
                newSlot.fadeType = 'in';
                
                // Set up highpass filter for fade in (start heavily filtered, become clear)
                newSlot.filterNode.type = 'highpass';
                newSlot.filterNode.frequency.cancelScheduledValues(startTime);
                newSlot.filterNode.frequency.setValueAtTime(20000, startTime); // Start heavily filtered (thin sound)
                newSlot.filterNode.frequency.exponentialRampToValueAtTime(20, endTime); // End minimally filtered (full sound)
                
                newSlot.gainNode.gain.cancelScheduledValues(startTime);
                newSlot.gainNode.gain.setValueAtTime(0, startTime);
                newSlot.gainNode.gain.linearRampToValueAtTime(1, endTime);
            } else {
                // Direct play mode: no current audio to crossfade from
                newSlot.fadeType = null;
                
                // Set up for direct play (no filter effects)
                newSlot.filterNode.type = 'lowpass';
                newSlot.filterNode.frequency.setValueAtTime(20000, audioContext.currentTime);
                newSlot.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
            }
            
            // Step 7: Start playback
            if (isPlaying) {
                await newSlot.element.play();
            }
            
            // Update current audio index
            currentAudioIndex = newSlotIndex;
            
            return true;
            
        } catch (error) {
            console.error('❌ Ring buffer crossfade failed:', error);
            
            // IMPORTANT: Even if crossfade fails, we must stop the current audio
            // to prevent audio overlap in the fallback loading
            
            const failureCurrentSlots = audioPool.filter(slot => slot.isActive && slot.fadeType !== 'out');
            for (const slot of failureCurrentSlots) {
                const slotIndex = audioPool.indexOf(slot);
                cleanupAudioSlot(slot, slotIndex);
            }
            
            return false;
        }
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

        // Detect rapid navigation and manage pool accordingly
        const isRapid = detectRapidNavigation();
        if (isRapid) {
            expandPoolIfNeeded();
        }
        
        // Reset audio metrics but preserve playback state
        currentTime = 0;
        duration = 0;
        isBuffering = false;
        resetPlayTracking();
        loadAudio(true); // Use crossfade for audio changes
        
        // Schedule pool cleanup for later (when things calm down)
        setTimeout(() => contractPoolIfNeeded(), 3000);
    }

    async function loadAudio(useCrossfade = false) {
        if (!currentAudio || !browser) return;
        
        // Guard against interfering with active crossfades
        if (isTransitioning) {
            console.log('Load audio skipped - transition in progress');
            return;
        }
        


        // Determine the audio source to use
        const audioSrc = currentAudio.transcodedPath ? 
            `/${currentAudio.transcodedPath}` : 
            `/${currentAudio.path}`;

        // Try ring buffer crossfade first
        if (useCrossfade && isPlaying) {
            
            isTransitioning = true;
            const crossfadeSuccess = await ringBufferCrossfade(audioSrc, currentAudio.id, 200);
            isTransitioning = false;
            
            if (crossfadeSuccess) {
                isBuffering = false;
                return; // Crossfade handled everything
            }
        } else if (useCrossfade) {
            console.log('Crossfade skipped - not currently playing');
        }

        // Fallback to normal loading using ring buffer
        console.log('Using fallback loading');
        
        if (audioPool.length === 0) {
            initializeAudioPool();
        }
        
        // Store the currently playing slot to avoid reusing it immediately
        const currentlyPlayingSlot = audioPool.findIndex(slot => 
            slot.isActive && slot.fadeType !== 'out' && !slot.element.paused
        );
        
        
        // Deactivate all other slots (but keep the currently playing one for now)
        audioPool.forEach((slot, index) => {
            if (slot.isActive && index !== currentlyPlayingSlot) {
                cleanupAudioSlot(slot, index);
            }
        });
        
        // Find a different slot for new audio (avoid the currently playing slot)
        const slotIndex = findAvailableAudioSlotExcluding(currentlyPlayingSlot);
        const slot = audioPool[slotIndex];
        
        // If we found a different slot, clean up the currently playing one
        if (currentlyPlayingSlot >= 0 && currentlyPlayingSlot !== slotIndex) {
            const oldSlot = audioPool[currentlyPlayingSlot];
            cleanupAudioSlot(oldSlot, currentlyPlayingSlot);
        }
    
        
        // Prepare the slot (but don't mark as active until loading succeeds)
        slot.trackId = currentAudio.id;
        slot.fadeType = null;
        slot.element.src = audioSrc;
        
        // Set up Web Audio nodes if needed
        if (!slot.source && audioContext) {
            await ensureAudioContext();
            createAudioNodes(slot);
        }
        
        // Set gain to full for immediate playback
        if (slot.gainNode && audioContext) {
            slot.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
            if (slot.filterNode) {
                slot.filterNode.type = 'lowpass';
                slot.filterNode.frequency.setValueAtTime(20000, audioContext.currentTime);
            }
        }
        
        // Don't set currentAudioIndex until audio loads successfully
        isBuffering = true;
        
        
        // Load the audio with fallback, activate slot on success
        tryLoadAudioWithFallbackAndActivate(slot.element, slot, slotIndex);
    }
    
    function tryLoadAudioWithFallback(audio: HTMLAudioElement) {
        // Prioritize transcoded path for bandwidth optimization
        if (currentAudio.transcodedPath) {
            const transcodedSrc = `/${currentAudio.transcodedPath}`;
            
            // Set up one-time error handler for fallback
            const handleTranscodedError = () => {
                console.log('Transcoded audio failed, falling back to original');
                audio.removeEventListener('error', handleTranscodedError);
                
                // Try original audio as fallback
                const originalSrc = `/${currentAudio.path}`;
                console.log('Trying original audio:', originalSrc);
                audio.src = originalSrc;
                audio.load();
            };
            
            audio.addEventListener('error', handleTranscodedError, { once: true });
            audio.src = transcodedSrc;
            audio.load();
        } else {
            // No transcoded version, use original directly
            const originalSrc = `/${currentAudio.path}`;
            console.log('Using original audio (no transcoded):', originalSrc);
            audio.src = originalSrc;
            audio.load();
        }
        
        console.log('Audio load() called, src:', audio.src);
    }

    function tryLoadAudioWithFallbackAndActivate(audio: HTMLAudioElement, slot: typeof audioPool[0], slotIndex: number) {
        let loadAttempted = false;
        
        const activateSlotOnSuccess = async () => {
            slot.isActive = true;
            currentAudioIndex = slotIndex;
            isBuffering = false;
            
            // Ensure Web Audio nodes are created for crossfade capability
            if (!slot.source && audioContext) {
                await ensureAudioContext();
                const nodesCreated = createAudioNodes(slot);
                if (nodesCreated) {
                    console.log(`Web Audio nodes created for slot ${slotIndex}`);
                } else {
                    console.log(`Failed to create Web Audio nodes for slot ${slotIndex}`);
                }
            }
            
            // Remove the success listener since we only want it to fire once
            audio.removeEventListener('canplay', activateSlotOnSuccess);
            audio.removeEventListener('loadedmetadata', activateSlotOnSuccess);
        };
        
        const handleLoadFailure = (errorMsg: string) => {
            console.error(`❌ Failed to load audio in slot ${slotIndex}:`, errorMsg);
            
            // Clean up the failed slot
            cleanupAudioSlot(slot, slotIndex);
            isBuffering = false;
            
            // Remove all listeners
            audio.removeEventListener('canplay', activateSlotOnSuccess);
            audio.removeEventListener('loadedmetadata', activateSlotOnSuccess);
        };
        
        // Listen for successful load
        audio.addEventListener('canplay', activateSlotOnSuccess, { once: true });
        audio.addEventListener('loadedmetadata', activateSlotOnSuccess, { once: true });
        
        // Prioritize transcoded path for bandwidth optimization
        if (currentAudio.transcodedPath) {
            const transcodedSrc = `/${currentAudio.transcodedPath}`;
            
            // Set up one-time error handler for fallback
            const handleTranscodedError = () => {
                console.log('Transcoded audio failed, falling back to original');
                audio.removeEventListener('error', handleTranscodedError);
                
                if (!loadAttempted) {
                    loadAttempted = true;
                    // Try original audio as fallback
                    const originalSrc = `/${currentAudio.path}`;
                    console.log('Trying original audio:', originalSrc);
                    
                    // Set up error handler for original audio failure
                    const handleOriginalError = () => {
                        console.log('Original audio also failed');
                        audio.removeEventListener('error', handleOriginalError);
                        handleLoadFailure('Both transcoded and original audio failed');
                    };
                    
                    audio.addEventListener('error', handleOriginalError, { once: true });
                    audio.src = originalSrc;
                    audio.load();
                } else {
                    handleLoadFailure('Multiple load failures');
                }
            };
            
            audio.addEventListener('error', handleTranscodedError, { once: true });
            audio.src = transcodedSrc;
            audio.load();
        } else {
            // No transcoded version, use original directly
            const originalSrc = `/${currentAudio.path}`;
            console.log('Using original audio (no transcoded):', originalSrc);
            
            const handleOriginalError = () => {
                console.log('Original audio failed to load');
                audio.removeEventListener('error', handleOriginalError);
                handleLoadFailure('Original audio failed to load');
            };
            
            audio.addEventListener('error', handleOriginalError, { once: true });
            audio.src = originalSrc;
            audio.load();
        }
        
        console.log('Audio load() called, src:', audio.src);
    }

    function openCommentsDialog(index: number) {
        // Use scroll-based navigation to avoid double crossfade
        scrollToIndex(index);
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
    }

    function stopPlayTracking() {
        playStartTime = 0;
    }

    function resetPlayTracking() {
        stopPlayTracking();
        hasRegisteredPlay = false;
    }

    async function tryRegisterPlay() {
        if (!currentAudio || hasRegisteredPlay || !browser) return;
        
        const playTime = Date.now() - playStartTime;
        if (playTime >= 10000) { // 10 seconds
            hasRegisteredPlay = true;
            
            try {
                const response = await fetch(`/listen/${currentAudio.id}/try_register_play`, {
                    method: 'POST'
                });
                if (response.ok) {
                } else {
                    console.warn('⚠️ Failed to register play');
                }
            } catch (error) {
                console.error('❌ Error registering play:', error);
            }
        }
    }

    async function togglePlay() {

        if (!browser) {
            console.error('❌ Toggle play blocked - browser:', browser);
            return;
        }
        
        const audio = getAudioElement();

        // Ensure audio pool and Web Audio context are ready
        if (audio.paused && audioPool.length === 0) {
            initializeAudioPool();
            const contextReady = await ensureAudioContext();
            if (!contextReady) {
                console.error('❌ Failed to initialize audio context');
                return;
            }
        }
        
        // Use actual audio state instead of component state for more reliability
        if (!audio.paused) {
            audio.pause();
        } else {
            
            // Check if audio is ready to play
            if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
                audio.play().catch(error => {
                    console.error('❌ Failed to play audio:', error);
                    isBuffering = false;
                });
            } else {
                console.log('Audio not ready, waiting for canplay event');
                isBuffering = true;
                
                // Wait for audio to be ready, then play
                const handleCanPlay = () => {
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
    }

    function goToNext() {
        if (currentIndex < audios.length - 1) {
            // Don't change currentIndex directly - let scroll handle it
            const targetIndex = currentIndex + 1;
            scrollToIndex(targetIndex);
            checkNearEnd(); // Check if we need to load more content
        }
    }

    function goToPrevious() {
        if (currentIndex > 0) {
            // Don't change currentIndex directly - let scroll handle it  
            const targetIndex = currentIndex - 1;
            scrollToIndex(targetIndex);
        }
    }

    function scrollToIndex(targetIndex: number) {
        if (!scrollContainer || !browser) return;
        const itemHeight = window.innerHeight;
        const targetScrollTop = targetIndex * itemHeight;
        
        scrollContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }
    
    function scrollToCurrentItem() {
        scrollToIndex(currentIndex);
    }

    function handleScroll() {
        if (!scrollContainer || !browser) return;
        const scrollTop = scrollContainer.scrollTop;
        const itemHeight = window.innerHeight;
        const newIndex = Math.round(scrollTop / itemHeight);
        
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < audios.length) {
            currentIndex = newIndex;
            checkNearEnd(); // Check if we need to load more content
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        // Check if comments modal is open
        const isModalOpen = commentsDialog?.open || false;
        
        // Check if user is currently typing in an input field
        const isInputFocused = event.target instanceof HTMLInputElement || 
                              event.target instanceof HTMLTextAreaElement ||
                              (event.target as Element)?.tagName === 'INPUT' ||
                              (event.target as Element)?.tagName === 'TEXTAREA';
        
        console.log('⌨️ KEY PRESSED:', event.key, 'Target:', event.target);
        console.log('  - Current index:', currentIndex);
        console.log('  - Audio pool length:', audioPool.length);
        console.log('  - Browser:', browser);
        console.log('  - Modal open:', isModalOpen);
        console.log('  - Input focused:', isInputFocused);
        
        // Handle escape key for modal
        if (event.key === 'Escape' && isModalOpen) {
            console.log('🚪 Escape pressed - closing modal');
            event.preventDefault();
            closeCommentsDialog();
            return;
        }
        
        // Skip main page shortcuts when modal is open or user is typing in input
        if (isModalOpen || isInputFocused) {
            console.log('⏭️ Skipping shortcuts - modal open or input focused');
            return;
        }
        
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                goToPrevious();
                break;
            case 'ArrowDown':
                event.preventDefault();
                goToNext();
                break;
            case ' ':
                event.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                seek(-10);
                break;
            case 'ArrowRight':
                event.preventDefault();
                seek(10);
                break;
            case 'c':
            case 'C':
                event.preventDefault();
                openCommentsDialog(currentIndex);
                break;
            case 'f':
            case 'F':
                const currentAudioElement = getCurrentAudioElement();
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

    async function loadMoreAudios() {
        if (isLoadingMore || !hasMoreContent || !browser) {
            console.log('Cannot load more audios:', { isLoadingMore, hasMoreContent, browser });
            return;
        }

        isLoadingMore = true;
        const nextPage = currentPage + 1;
        console.log('Loading more audios, page:', nextPage);

        try {
            const response = await fetch(`/quickfeed/api?page=${nextPage}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.audios && data.audios.length > 0) {
                // Append new audios to existing array
                audios = [...audios, ...data.audios];
                currentPage = nextPage;
                
                // Use hasMore field from API response for more reliable pagination
                hasMoreContent = data.hasMore || false;
                
                console.log(`Successfully loaded ${data.audios.length} more audios. Total: ${audios.length}. Has more: ${hasMoreContent}`);
            } else {
                hasMoreContent = false;
                console.log('No more audios available');
            }
        } catch (error) {
            console.error('Failed to load more audios:', error);
            // Don't set hasMoreContent to false on error, allow retry
        } finally {
            isLoadingMore = false;
        }
    }

    function checkNearEnd() {
        const nearEndThreshold = 10;
        const isNearEnd = currentIndex >= audios.length - nearEndThreshold;
        
        if (isNearEnd && !isLoadingMore && hasMoreContent) {
            console.log('Near end detected, loading more content');
            loadMoreAudios();
        }
    }

    async function toggleFavorite() {
        if (!currentUser || !currentAudio) return;
        

        const currentAudioElement = getCurrentAudioElement();
        
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
                
                const currentAudioElementAfter = getCurrentAudioElement();
                
                // Announce the change for accessibility
                const message = wasFavorited ? 'Removed from favorites' : 'Added to favorites';
                announceStatus(message);
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

    

    onMount(() => {

        if (browser) {
            document.addEventListener('keydown', handleKeydown);
        } else {
            console.error('❌ Browser detection failed - no keyboard events');
        }
        
        // Initialize audio pool and context
        if (browser) {
            initializeAudioPool();
            
            // Make debug toggle available globally for development
            (window as any).toggleQuickfeedDebug = () => {
                showDebugInfo = !showDebugInfo;
                console.log('Debug panel:', showDebugInfo ? 'enabled' : 'disabled');
            };
            
        }
        
        // Debug check every second for the first 5 seconds
        let debugCount = 0;
        const debugInterval = setInterval(() => {
            debugCount++;
            const currentAudioElement = getCurrentAudioElement();
            console.log(`Debug check ${debugCount}: currentAudioElement =`, currentAudioElement, 'currentAudio =', currentAudio?.title);
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
                                <button on:click={() => {togglePlay();}} aria-label={isPlaying ? "Pause" : "Play"}>
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
                                on:click={() => {scrollToIndex(index); toggleFavorite();}}
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
                                scrollToIndex(index); 
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
        
        <!-- Loading indicator -->
        {#if isLoadingMore}
            <div class="audio-item loading-item">
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p>Loading more audios...</p>
                </div>
            </div>
        {/if}
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
                            use:enhance={browser ? ({ formData, formElement }) => {
                                formData.append('audioId', currentAudio.id);
                                return async ({ result, update }) => {
                                    if (result.type === 'success' && result.data?.comment) {
                                        // Add the new comment to the local state
                                        if (!currentAudio.comments) {
                                            audios[currentIndex].comments = [];
                                        }
                                        audios[currentIndex].comments = [...(audios[currentIndex].comments || []), result.data.comment];
                                        audios = audios; // Trigger reactivity
                                        
                                        // Clear the form
                                        formElement.reset();
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

    <!-- Crossfade transition indicator -->
    {#if isTransitioning}
        <div class="transition-indicator">
            <div class="transition-content">
                <div class="transition-spinner"></div>
                <span>Crossfading...</span>
            </div>
        </div>
    {/if}

    <!-- Debug Info Panel (for development) -->
    {#if showDebugInfo}
        <div class="debug-panel">
            <h4>🐛 Ring Buffer Debug</h4>
            <div class="debug-info">
                <div>Context: {audioContext ? audioContext.state : 'null'}</div>
                <div>Pool Size: {audioPool.length}</div>
                <div>Active Slots: {audioPool.filter(s => s.isActive).length}</div>
                <div>Current Index: {currentAudioIndex}</div>
                <div>Transitioning: {isTransitioning ? '✅' : '❌'}</div>
                <div>Current Audio: {currentAudio?.title?.substring(0, 15)}...</div>
                <div>Is Playing: {isPlaying ? '▶️' : '⏸️'}</div>
                {#each audioPool as slot, i}
                    <div class="slot-info" class:active={i === currentAudioIndex}>
                        Slot {i}: {slot.isActive ? '🔴' : '⚫'} {slot.fadeType || 'none'} {slot.trackId?.substring(0, 8) || 'empty'}
                    </div>
                {/each}
            </div>
        </div>
    {/if}

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

    .loading-item {
        background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
    }

    .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        height: 100%;
        color: white;
    }

    .loading-content p {
        font-size: 1.1rem;
        margin: 0;
        opacity: 0.9;
    }

    .transition-indicator {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        border-radius: 8px;
        padding: 1rem 1.5rem;
        z-index: 2000;
        color: white;
        font-size: 0.9rem;
    }

    .transition-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .transition-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .debug-panel {
        position: fixed;
        top: 1rem;
        left: 1rem;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 1rem;
        border-radius: 8px;
        font-family: monospace;
        font-size: 0.8rem;
        z-index: 1500;
        min-width: 200px;
    }

    .debug-panel h4 {
        margin: 0 0 0.5rem 0;
        color: #ff6b6b;
    }

    .debug-info div {
        margin-bottom: 0.3rem;
        padding: 0.2rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .slot-info {
        font-size: 0.7rem;
        opacity: 0.7;
    }

    .slot-info.active {
        color: #ff6b6b;
        font-weight: bold;
        opacity: 1;
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