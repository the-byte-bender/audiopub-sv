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
    import Modal from "./modal.svelte";
    export let href: string;
    export let title: string;

    const trustedSchemas = ["http:", "https:", "mailto:", "tel:", "ftp:"];

    function sanitizeUrl(url: string): string | null {
        try {
            let cleanUrl = url.trim();
            const lowerUrl = cleanUrl.toLowerCase();

            if (!trustedSchemas.some((schema) => lowerUrl.startsWith(schema))) {
                if (cleanUrl.includes(".") && !cleanUrl.startsWith("/")) {
                    cleanUrl = `https://${cleanUrl}`;
                } else {
                    return null;
                }
            }

            const finalLowerUrl = cleanUrl.toLowerCase();
            const hasTrustedSchema = trustedSchemas.some((schema) =>
                finalLowerUrl.startsWith(schema)
            );

            if (!hasTrustedSchema) {
                return null;
            }

            new URL(cleanUrl);
            return cleanUrl;
        } catch {
            return null;
        }
    }

    $: safeHref = sanitizeUrl(href);
    let confirmVisible = false;

    function confirmOpen(e: MouseEvent) {
        if (!safeHref) return;
        e.preventDefault();
        confirmVisible = true;
    }

    function openLink() {
        if (!safeHref) return;
        window.open(safeHref, "_blank", "noopener,noreferrer");
        confirmVisible = false;
    }
</script>

{#if safeHref}
    <a
        href={safeHref}
        {title}
        target="_blank"
        rel="noopener noreferrer nofollow"
        on:click|preventDefault={confirmOpen}
    >
        <slot />
    </a>
    <Modal bind:visible={confirmVisible}>
        <h2>Open link?</h2>
        <p>You're about to open an external link:</p>
        <p style="word-break: break-all"><strong>{safeHref}</strong></p>
        <div
            style="display: flex; gap: .5rem; margin-top: .75rem; flex-wrap: wrap;"
        >
            <button on:click={() => (confirmVisible = false)}>Cancel</button>
            <button on:click={openLink}>Open</button>
        </div>
    </Modal>
{/if}

<style>
    a {
        cursor: pointer;
    }
    button {
        cursor: pointer;
    }
</style>
