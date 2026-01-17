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
    import { dialog } from "$lib/stores/dialog";
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

    async function handleClick(e: MouseEvent) {
        if (!safeHref) return;
        e.preventDefault();
        
        const confirmed = await dialog.confirm({
            title: "Open external link?",
            message: `You're about to open an external link:\n\n${safeHref}`,
            confirmText: "Open",
            cancelText: "Cancel"
        });

        if (confirmed && safeHref) {
            window.open(safeHref, "_blank", "noopener,noreferrer");
        }
    }
</script>

{#if safeHref}
    <a
        href={safeHref}
        {title}
        target="_blank"
        rel="noopener noreferrer nofollow"
        on:click={handleClick}
    >
        <slot />
    </a>
{/if}

<style>
    a {
        cursor: pointer;
    }
</style>
