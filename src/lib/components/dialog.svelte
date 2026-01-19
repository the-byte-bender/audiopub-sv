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
  import { dialog as dialogStore } from '$lib/stores/dialog';
  import type { DialogState } from '$lib/stores/dialog';

  let dialogElement: HTMLDialogElement;
  let inputValue: string = '';

  $: if (dialogElement && $dialogStore) {
    dialogElement.showModal();
  } else if (dialogElement) {
    dialogElement.close();
  }

  function handleConfirm() {
    if ($dialogStore?.type === 'prompt') {
      $dialogStore.resolve?.(inputValue);
    } else {
      $dialogStore?.resolve?.(true);
    }
    inputValue = '';
  }

  function handleCancel() {
    if ($dialogStore?.type === 'alert') {
      $dialogStore.resolve?.();
    } else {
      $dialogStore?.resolve?.(null);
    }
    inputValue = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }

  $: if ($dialogStore?.type === 'prompt' && dialogElement?.open) {
    const input = dialogElement?.querySelector('input');
    setTimeout(() => input?.focus(), 0);
  }
</script>

<dialog
  bind:this={dialogElement}
  on:close={handleCancel}
  on:click|self={handleCancel}
  aria-labelledby="dialog-title"
  aria-describedby="dialog-message"
>
  <div on:click|stopPropagation on:keydown={handleKeydown} role="presentation">
    {#if $dialogStore}
      <h2 id="dialog-title">{$dialogStore.title}</h2>
      
      <p id="dialog-message">{$dialogStore.message}</p>

      {#if $dialogStore.type === 'prompt'}
        <input
          type="text"
          placeholder={$dialogStore.placeholder || ''}
          bind:value={inputValue}
          on:keydown={handleKeydown}
        />
      {/if}

      <div class="button-group">
        {#if $dialogStore.type !== 'alert'}
          <button 
            type="button" 
            class="cancel-button"
            on:click={handleCancel}
          >
            {$dialogStore.cancelText || 'Cancel'}
          </button>
        {/if}
        <button
          type="button"
          class="confirm-button"
          class:danger={$dialogStore.danger}
          on:click={handleConfirm}
        >
          {$dialogStore.confirmText || 'OK'}
        </button>
      </div>
    {/if}
  </div>
</dialog>

<style>
  dialog {
    max-width: 28rem;
    border-radius: 0.5rem;
    border: none;
    padding: 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
  }

  dialog > div {
    padding: 1.5rem;
  }

  h2 {
    margin: 0 0 0.75rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text, #000);
  }

  p {
    margin: 0 0 1rem 0;
    color: var(--color-text-secondary, #666);
    line-height: 1.5;
  }

  input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid var(--color-border, #ccc);
    border-radius: 0.25rem;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary, #007bff);
    box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(0, 123, 255, 0.1));
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background-color: var(--color-background-secondary, #f3f4f6);
    color: var(--color-text, #000);
    border-color: var(--color-border, #d1d5db);
  }

  .cancel-button:hover {
    background-color: var(--color-background-secondary-hover, #e5e7eb);
    border-color: var(--color-border-hover, #9ca3af);
  }

  .cancel-button:active {
    background-color: var(--color-background-secondary-active, #d1d5db);
  }

  .confirm-button {
    background-color: var(--color-primary, #007bff);
    color: #fff;
    border-color: var(--color-primary-dark, #0056b3);
  }

  .confirm-button:hover {
    background-color: var(--color-primary-hover, #0056b3);
    border-color: var(--color-primary-dark, #003d82);
  }

  .confirm-button:active {
    background-color: var(--color-primary-active, #003d82);
  }

  .confirm-button.danger {
    background-color: var(--color-danger, #dc2626);
    border-color: var(--color-danger-dark, #991b1b);
  }

  .confirm-button.danger:hover {
    background-color: var(--color-danger-hover, #991b1b);
    border-color: var(--color-danger-dark, #7f1d1d);
  }

  .confirm-button.danger:active {
    background-color: var(--color-danger-active, #7f1d1d);
  }

  dialog[open] {
    animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes slideIn {
    from {
      transform: scale(0.9) translateY(-10px);
      opacity: 0;
    }
    to {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }

  dialog[open]::backdrop {
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
