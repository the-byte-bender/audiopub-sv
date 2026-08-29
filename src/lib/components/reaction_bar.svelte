<!--
  This file is part of the audiopub project.

  Copyright (C) 2024 the-byte-bender

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
    import { REACTION_KINDS, reactionLabel } from "$lib/reactions";
    import type { ClientsideReaction } from "$lib/types";

    /** Current tally for this target. Emojis with no reactions are omitted. */
    export let reactions: ClientsideReaction[] = [];
    /** Identifies the comment or chat message being reacted to. */
    export let targetId: string;
    /**
     * When set, the bar posts to this form action (works without JavaScript).
     * Otherwise `onReact` is called and the caller handles the request.
     */
    export let formAction: string | null = null;
    export let onReact: ((emoji: string) => void | Promise<void>) | null = null;
    /** Logged out or unverified viewers still see the tally, read only. */
    export let canReact: boolean = false;
    export let label: string = "Reactions";

    // Only emojis somebody actually used get a chip. The rest live behind the
    // picker, so a comment with no reactions costs one button instead of six.
    $: used = reactions.filter((r) => r.count > 0);
    $: unused = REACTION_KINDS.filter(
        (kind) => !used.some((r) => r.emoji === kind.emoji),
    );

    /**
     * The chip's accessible name. Count and state are passed in as arguments
     * on purpose: Svelte derives an expression's dependencies from the
     * expression itself, so a value read only inside the function body would
     * leave the label stale after the tally changes.
     */
    function chipLabel(
        emoji: string,
        count: number,
        reacted: boolean,
        interactive: boolean = true,
    ): string {
        const name = reactionLabel(emoji);
        const tally = count === 1 ? "1 reaction" : `${count} reactions`;
        // A read only viewer has nothing to activate, so the label stops at
        // the tally instead of offering an action they cannot take.
        if (!interactive) {
            return `${name}, ${tally}`;
        }
        return reacted
            ? `${name}, ${tally}, including yours. Activate to remove your reaction`
            : `${name}, ${tally}. Activate to react`;
    }
</script>

{#if canReact}
    {#if formAction}
        <form
            class="reaction-bar"
            method="POST"
            action={formAction}
            aria-label={label}
            use:enhance={() => {
                return async ({ update }) => {
                    await update({ reset: false });
                };
            }}
        >
            <input type="hidden" name="targetId" value={targetId} />
            {#each used as reaction (reaction.emoji)}
                <button
                    type="submit"
                    name="emoji"
                    value={reaction.emoji}
                    class="reaction"
                    class:active={reaction.reacted}
                    aria-pressed={reaction.reacted}
                    aria-label={chipLabel(
                        reaction.emoji,
                        reaction.count,
                        reaction.reacted,
                    )}
                >
                    <span aria-hidden="true">{reaction.emoji}</span>
                    <span aria-hidden="true" class="count">{reaction.count}</span
                    >
                </button>
            {/each}
            {#if unused.length > 0}
                <details class="picker">
                    <summary>Add reaction</summary>
                    <div class="picker-options">
                        {#each unused as kind (kind.emoji)}
                            <button
                                type="submit"
                                name="emoji"
                                value={kind.emoji}
                                class="reaction"
                                aria-label="React with {kind.label}"
                            >
                                <span aria-hidden="true">{kind.emoji}</span>
                            </button>
                        {/each}
                    </div>
                </details>
            {/if}
        </form>
    {:else}
        <div class="reaction-bar" role="group" aria-label={label}>
            {#each used as reaction (reaction.emoji)}
                <button
                    type="button"
                    class="reaction"
                    class:active={reaction.reacted}
                    aria-pressed={reaction.reacted}
                    aria-label={chipLabel(
                        reaction.emoji,
                        reaction.count,
                        reaction.reacted,
                    )}
                    on:click={() => onReact && onReact(reaction.emoji)}
                >
                    <span aria-hidden="true">{reaction.emoji}</span>
                    <span aria-hidden="true" class="count">{reaction.count}</span
                    >
                </button>
            {/each}
            {#if unused.length > 0}
                <details class="picker">
                    <summary>Add reaction</summary>
                    <div class="picker-options">
                        {#each unused as kind (kind.emoji)}
                            <button
                                type="button"
                                class="reaction"
                                aria-label="React with {kind.label}"
                                on:click={() => onReact && onReact(kind.emoji)}
                            >
                                <span aria-hidden="true">{kind.emoji}</span>
                            </button>
                        {/each}
                    </div>
                </details>
            {/if}
        </div>
    {/if}
{:else if used.length > 0}
    <p class="reaction-bar" role="group" aria-label={label}>
        {#each used as reaction (reaction.emoji)}
            <span
                class="reaction static"
                aria-label={chipLabel(
                    reaction.emoji,
                    reaction.count,
                    reaction.reacted,
                    false,
                )}
                ><span aria-hidden="true">{reaction.emoji}</span>
                <span aria-hidden="true" class="count">{reaction.count}</span
                ></span
            >
        {/each}
    </p>
{/if}

<style>
    .reaction-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
        margin: 0.35rem 0 0;
    }

    .reaction {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        padding: 0.1rem 0.4rem;
        border: 1px solid #ccc;
        border-radius: 999px;
        background: #fff;
        font-size: 0.9rem;
        line-height: 1.4;
        cursor: pointer;
    }

    .reaction:hover {
        border-color: #007bff;
    }

    .reaction.active {
        border-color: #007bff;
        background: #e7f1ff;
        font-weight: 600;
    }

    .reaction.static {
        cursor: default;
    }

    .count {
        font-size: 0.8em;
        color: #555;
    }

    .picker > summary {
        display: inline-block;
        padding: 0.1rem 0.4rem;
        border: 1px solid #ccc;
        border-radius: 999px;
        background: #fff;
        font-size: 0.8rem;
        color: #555;
        cursor: pointer;
        list-style: none;
    }

    .picker > summary::-webkit-details-marker {
        display: none;
    }

    .picker > summary:hover {
        border-color: #007bff;
    }

    .picker-options {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.25rem;
    }
</style>
