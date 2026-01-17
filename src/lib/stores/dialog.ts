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
import { writable } from 'svelte/store';

export interface DialogOptions {
  title: string;
  message: string;
  type: 'confirm' | 'alert' | 'prompt';
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  danger?: boolean;
}

export interface DialogState extends DialogOptions {
  id: string;
  resolve?: (value: boolean | string | null) => void;
}

function createDialogStore() {
  const { subscribe, set, update } = writable<DialogState | null>(null);
  let idCounter = 0;

  return {
    subscribe,
    
    confirm: (options: Omit<DialogOptions, 'type'>) => {
      return new Promise<boolean>((resolve) => {
        const id = `dialog-${++idCounter}`;
        update(() => ({
          id,
          type: 'confirm',
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          ...options,
          resolve: (value: boolean | string | null) => {
            set(null);
            resolve(value as boolean);
          }
        }));
      });
    },

    alert: (options: Omit<DialogOptions, 'type' | 'confirmText' | 'cancelText'>) => {
      return new Promise<void>((resolve) => {
        const id = `dialog-${++idCounter}`;
        update(() => ({
          id,
          type: 'alert',
          confirmText: 'OK',
          ...options,
          resolve: () => {
            set(null);
            resolve();
          }
        }));
      });
    },

    prompt: (options: Omit<DialogOptions, 'type'>) => {
      return new Promise<string | null>((resolve) => {
        const id = `dialog-${++idCounter}`;
        update(() => ({
          id,
          type: 'prompt',
          confirmText: 'OK',
          cancelText: 'Cancel',
          ...options,
          resolve: (value: boolean | string | null) => {
            set(null);
            resolve(value as string | null);
          }
        }));
      });
    },

    close: () => set(null)
  };
}

export const dialog = createDialogStore();
