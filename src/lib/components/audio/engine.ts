/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2025 the-byte-bender
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Shared audio engine interface so Listen and Quickfeed can use the same UI.
 */
export interface AudioEngineState {
    isPlaying: boolean;
    isBuffering: boolean;
    currentTime: number;
    duration: number;
    volume: number;
}

export interface AudioEngineEvents {
    play: () => void;
    pause: () => void;
    ended: () => void;
    timeupdate: (currentTime: number, duration: number) => void;
    bufferingchange: (isBuffering: boolean) => void;
}

export interface AudioEngine {
    // State (readonly, get current snapshot)
    getState(): AudioEngineState;

    // Commands
    play(): void;
    pause(): void;
    togglePlay(): void;
    seek(time: number): void;
    setVolume(volume: number): void;

    // Lifecycle
    load(src: string | string[]): void;
    destroy(): void;

    // Event subscription
    on<K extends keyof AudioEngineEvents>(event: K, handler: AudioEngineEvents[K]): void;
    off<K extends keyof AudioEngineEvents>(event: K, handler: AudioEngineEvents[K]): void;
}

/**
 * Simple HTML Audio-based engine for Listen page.
 */
export class HtmlAudioEngine implements AudioEngine {
    private audio: HTMLAudioElement;
    private handlers: { [K in keyof AudioEngineEvents]?: Set<AudioEngineEvents[K]> } = {};
    private _volume = 1;
    private _isBuffering = false;

    constructor() {
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.setupListeners();
    }

    private setupListeners() {
        this.audio.addEventListener('play', () => this.emit('play'));
        this.audio.addEventListener('pause', () => this.emit('pause'));
        this.audio.addEventListener('ended', () => this.emit('ended'));
        this.audio.addEventListener('timeupdate', () => {
            this.emit('timeupdate', this.audio.currentTime, this.audio.duration || 0);
        });
        this.audio.addEventListener('waiting', () => {
            this._isBuffering = true;
            this.emit('bufferingchange', true);
        });
        this.audio.addEventListener('canplay', () => {
            this._isBuffering = false;
            this.emit('bufferingchange', false);
        });
    }

    getState(): AudioEngineState {
        return {
            isPlaying: !this.audio.paused,
            isBuffering: this._isBuffering,
            currentTime: this.audio.currentTime,
            duration: this.audio.duration || 0,
            volume: this._volume,
        };
    }

    play() {
        this.audio.play().catch(() => {});
    }

    pause() {
        this.audio.pause();
    }

    togglePlay() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    seek(time: number) {
        const max = isFinite(this.audio.duration) ? this.audio.duration : Infinity;
        this.audio.currentTime = Math.max(0, Math.min(time, max));
    }

    setVolume(volume: number) {
        this._volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this._volume;
    }

    load(src: string | string[]) {
        const url = Array.isArray(src) ? src[0] : src;
        this.audio.src = url;
        this.audio.load();
    }

    destroy() {
        this.audio.pause();
        this.audio.src = '';
        this.handlers = {};
    }

    on<K extends keyof AudioEngineEvents>(event: K, handler: AudioEngineEvents[K]) {
        if (!this.handlers[event]) {
            (this.handlers as Record<K, Set<AudioEngineEvents[K]>>)[event] = new Set();
        }
        (this.handlers[event] as Set<AudioEngineEvents[K]>).add(handler);
    }

    off<K extends keyof AudioEngineEvents>(event: K, handler: AudioEngineEvents[K]) {
        this.handlers[event]?.delete(handler as any);
    }

    private emit<K extends keyof AudioEngineEvents>(event: K, ...args: Parameters<AudioEngineEvents[K]>) {
        const set = this.handlers[event];
        if (set) {
            for (const h of set) {
                (h as (...a: any[]) => void)(...args);
            }
        }
    }

    /** Expose underlying element for legacy compatibility (sources, autoplay) */
    get element(): HTMLAudioElement {
        return this.audio;
    }
}

/**
 * Volume persistence helper (shared between engines).
 */
const VOLUME_STORAGE_KEY = 'audiopub_volume';

export function loadPersistedVolume(): number {
    if (typeof localStorage === 'undefined') return 1;
    try {
        const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
        if (saved !== null) {
            const parsed = parseFloat(saved);
            if (!isNaN(parsed)) return Math.max(0, Math.min(1, parsed));
        }
    } catch {}
    return 1;
}

export function persistVolume(volume: number) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
    } catch {}
}
