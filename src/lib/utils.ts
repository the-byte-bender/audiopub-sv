/*
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
*/

/**
 * Format seconds into a human-readable time string (M:SS or H:MM:SS).
 */
export function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
        return '0:00';
    }
    
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Announce a status message to screen readers using a live region.
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    // Find or create the announcer element
    let announcer = document.getElementById('sr-announcer');
    
    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'sr-announcer';
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
        document.body.appendChild(announcer);
    }
    
    // Clear and set the message (triggers announcement)
    announcer.textContent = '';
    setTimeout(() => {
        if (announcer) {
            announcer.textContent = message;
        }
    }, 100);
}

/**
 * Clamp a value between a minimum and maximum.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Try to register a play for an audio if it has been played for a sufficient duration.
 */
export async function registerPlay(audioId: string, currentTime: number, duration: number): Promise<boolean> {
    // Only register if we've played at least 5 seconds or 50% of the audio
    const minimumPlayTime = Math.min(5, duration * 0.5);
    if (currentTime >= minimumPlayTime) {
        try {
            const response = await fetch(`/listen/${audioId}/try_register_play`, {
                method: "POST"
            });
            return response.ok;
        } catch (error) {
            console.error('Play registration error:', error);
            return false;
        }
    }
    return false;
}
