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
    import type {
        ClientsideResolvedNotification,
        ClientsideComment,
    } from "$lib/types";
    import { NotificationTargetType, NotificationType } from "$lib/types";
    import { formatRelative } from "date-fns";
    import SafeMarkdown from "./safe_markdown.svelte";

    export let notification: ClientsideResolvedNotification;

    const isUnread = !notification.readAt;

    $: relativeTime = formatRelative(
        new Date(notification.createdAt),
        new Date()
    );

    function linkFor(n: ClientsideResolvedNotification): string | undefined {
        if (
            n.targetType === NotificationTargetType.audio &&
            n.target &&
            "id" in n.target
        ) {
            return `/listen/${(n.target as any).id}`;
        }
        if (
            n.targetType === NotificationTargetType.comment &&
            n.target &&
            "audio" in n.target &&
            (n.target as any).audio
        ) {
            return `/listen/${(n.target as any).audio.id}`;
        }
        return undefined;
    }

    $: href = linkFor(notification);
</script>

<article class:unread={isUnread}>
    {#if notification.type === NotificationType.comment && notification.target}
        {@const comment = notification.target as ClientsideComment}
        <h3>
            <a href={`/@${notification.actor?.name}`}>
                {notification.actor?.displayName}
            </a>
            Commented on <a {href}>{comment.audio?.title}</a>
            <span class="comment-date"> - {relativeTime}</span>
        </h3>
        <SafeMarkdown source={comment.content} />
    {:else if notification.type === NotificationType.favorite && notification.target}
        {@const audio = notification.target}
        <h3>
            <a href={`/@${notification.actor?.name}`}>
                {notification.actor?.displayName}
            </a>
            favorited <a {href}>{(audio as any).title}</a>
            <span class="comment-date"> - {relativeTime}</span>
        </h3>
    {:else if notification.type === NotificationType.mention && notification.target}
        <h3>
            <a href={`/@${notification.actor?.name}`}>
                {notification.actor?.displayName}
            </a>
            mentioned you in 
            {#if notification.targetType === "audio"}
                an <a {href}>audio description</a>
            {:else}
                a <a {href}>comment</a>
            {/if}
            <span class="comment-date"> - {relativeTime}</span>
        </h3>
        {#if notification.targetType === "comment"}
            <SafeMarkdown source={(notification.target as any).content} />
        {:else}
            <SafeMarkdown source={(notification.target as any).description} />
        {/if}
    {:else if notification.type === NotificationType.system}
        <h3>
            {notification.metadata?.title || "System"}
            <span class="comment-date"> - {relativeTime}</span>
        </h3>
        {#if notification.metadata?.content}
            <SafeMarkdown source={notification.metadata.content} />
        {/if}
    {/if}
</article>

<style>
    article {
        border: 1px solid #ddd;
        padding: 0.75rem;
        border-radius: 0.5rem;
        background: #fff;
    }
    article.unread {
        border-color: #007bff;
        background: #f6fbff;
    }
    .comment-date {
        color: #6c757d; /* A muted color for the date */
        font-size: 0.9em;
        margin-left: 0.5em;
    }
    h3 a {
        color: #007bff;
        text-decoration: none;
    }
</style>
