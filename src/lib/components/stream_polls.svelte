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
    import Modal from "./modal.svelte";
    import { PollState, type ClientsidePoll } from "$lib/types";

    export let streamId: string;
    export let polls: ClientsidePoll[] = [];
    /** Stream owner or admin: can create, close and delete polls. */
    export let canManage: boolean = false;
    export let canVote: boolean = false;
    /** Archived streams show final results only. */
    export let readOnly: boolean = false;
    export let heading: string = "Polls";
    export let onLocalUpdate: ((poll: ClientsidePoll) => void) | null = null;
    export let onLocalDelete: ((pollId: string) => void) | null = null;

    const MAX_OPTIONS = 6;

    let showCreate = false;
    let question = "";
    let optionTexts: string[] = ["", ""];
    let allowMultiple = false;
    let hideResultsUntilVote = false;
    let creating = false;
    let notice = "";
    /** Announced to screen readers when a tally or poll state changes. */
    let liveMessage = "";
    let busyPollId: string | null = null;

    function resetForm() {
        question = "";
        optionTexts = ["", ""];
        allowMultiple = false;
        hideResultsUntilVote = false;
        notice = "";
    }

    function addOption() {
        if (optionTexts.length < MAX_OPTIONS) {
            optionTexts = [...optionTexts, ""];
        }
    }

    function removeOption(index: number) {
        if (optionTexts.length > 2) {
            optionTexts = optionTexts.filter((_, i) => i !== index);
        }
    }

    async function readError(res: Response, fallback: string): Promise<string> {
        try {
            const body = await res.json();
            if (typeof body?.message === "string") return body.message;
        } catch {}
        return fallback;
    }

    async function createPoll() {
        creating = true;
        notice = "";
        try {
            const res = await fetch(`/live/${streamId}/polls`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question,
                    options: optionTexts,
                    allowMultiple,
                    hideResultsUntilVote,
                }),
            });
            if (!res.ok) {
                notice = await readError(res, "Could not create the poll.");
                return;
            }
            const body = await res.json();
            onLocalUpdate?.(body.poll);
            liveMessage = `Poll created: ${body.poll.question}`;
            showCreate = false;
            resetForm();
        } catch {
            notice = "Could not create the poll.";
        } finally {
            creating = false;
        }
    }

    async function vote(poll: ClientsidePoll, optionId: string) {
        busyPollId = poll.id;
        try {
            const res = await fetch(`/live/${streamId}/polls/${poll.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ optionId }),
            });
            if (!res.ok) {
                liveMessage = await readError(
                    res,
                    "Could not register your vote.",
                );
                return;
            }
            const body = await res.json();
            const updated = body.poll as ClientsidePoll;
            onLocalUpdate?.(updated);
            const chosen = updated.options.find((o) => o.id === optionId);
            const name = chosen?.text ?? "your option";
            liveMessage = updated.votedOptionIds.includes(optionId)
                ? `Selected ${name}.`
                : `Removed your vote for ${name}.`;
        } catch {
            liveMessage = "Could not register your vote.";
        } finally {
            busyPollId = null;
        }
    }

    async function closePoll(poll: ClientsidePoll) {
        busyPollId = poll.id;
        try {
            const res = await fetch(`/live/${streamId}/polls/${poll.id}`, {
                method: "PUT",
            });
            if (!res.ok) {
                liveMessage = await readError(res, "Could not close the poll.");
                return;
            }
            const body = await res.json();
            onLocalUpdate?.(body.poll);
            liveMessage = `Poll closed: ${poll.question}`;
        } catch {
            liveMessage = "Could not close the poll.";
        } finally {
            busyPollId = null;
        }
    }

    async function deletePoll(poll: ClientsidePoll) {
        busyPollId = poll.id;
        try {
            const res = await fetch(`/live/${streamId}/polls/${poll.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                liveMessage = await readError(res, "Could not delete the poll.");
                return;
            }
            onLocalDelete?.(poll.id);
            liveMessage = "Poll deleted.";
        } catch {
            liveMessage = "Could not delete the poll.";
        } finally {
            busyPollId = null;
        }
    }

    function percentage(votes: number, total: number): number {
        if (total <= 0) return 0;
        return Math.round((votes / total) * 100);
    }

    function votesLabel(count: number): string {
        return count === 1 ? "1 vote" : `${count} votes`;
    }

    function votersLabel(count: number): string {
        return count === 1 ? "1 person voted" : `${count} people voted`;
    }

    /**
     * The option's accessible name. Every reactive value it depends on is
     * passed in as an argument: Svelte derives an expression's dependencies
     * from the expression itself, so a value merely read inside the function
     * body would not re-render the label when it changes.
     */
    function optionLabel(
        text: string,
        votes: number,
        total: number,
        selected: boolean,
        hidden: boolean,
        multiple: boolean,
    ): string {
        const parts = [text];
        if (hidden) {
            parts.push("results hidden");
        } else {
            parts.push(`${votesLabel(votes)}, ${percentage(votes, total)}%`);
        }
        if (selected) {
            parts.push(multiple ? "selected" : "your vote");
        }
        return parts.join(", ");
    }

    function pollModeLabel(poll: ClientsidePoll): string {
        const parts: string[] = [];
        parts.push(
            poll.allowMultiple
                ? "Pick as many options as you like"
                : "Pick one option",
        );
        if (poll.hideResultsUntilVote) {
            parts.push("results hidden until you vote");
        }
        return parts.join(" — ");
    }
</script>

{#if polls.length > 0 || (canManage && !readOnly)}
    <section class="polls" aria-label={heading}>
        <h2>{heading}</h2>

        <p class="sr-only" aria-live="polite">{liveMessage}</p>

        {#if canManage && !readOnly}
            <button type="button" on:click={() => (showCreate = true)}>
                Create poll
            </button>

            <Modal bind:visible={showCreate}>
                <h2>Create a poll</h2>
                {#if notice}
                    <p class="poll-notice" role="alert">{notice}</p>
                {/if}
                <form on:submit|preventDefault={createPoll}>
                    <label for="poll-question">Question:</label>
                    <input
                        id="poll-question"
                        type="text"
                        bind:value={question}
                        required
                        minlength="3"
                        maxlength="300"
                    />

                    <fieldset>
                        <legend>Options</legend>
                        {#each optionTexts as _, index}
                            <div class="poll-option-row">
                                <label for="poll-option-{index}">
                                    Option {index + 1}:
                                </label>
                                <input
                                    id="poll-option-{index}"
                                    type="text"
                                    bind:value={optionTexts[index]}
                                    maxlength="200"
                                    required={index < 2}
                                />
                                {#if optionTexts.length > 2}
                                    <button
                                        type="button"
                                        on:click={() => removeOption(index)}
                                    >
                                        Remove option {index + 1}
                                    </button>
                                {/if}
                            </div>
                        {/each}
                        {#if optionTexts.length < MAX_OPTIONS}
                            <button type="button" on:click={addOption}>
                                Add option
                            </button>
                        {/if}
                    </fieldset>

                    <fieldset>
                        <legend>Settings</legend>
                        <label class="poll-setting" for="poll-allow-multiple">
                            <input
                                id="poll-allow-multiple"
                                type="checkbox"
                                role="switch"
                                bind:checked={allowMultiple}
                            />
                            Allow more than one option per person
                        </label>
                        <label class="poll-setting" for="poll-hide-results">
                            <input
                                id="poll-hide-results"
                                type="checkbox"
                                role="switch"
                                bind:checked={hideResultsUntilVote}
                            />
                            Hide results until the person votes
                        </label>
                        <p class="poll-setting-hint">
                            Hidden results become visible to everyone once you
                            close the poll.
                        </p>
                    </fieldset>

                    <button type="submit" disabled={creating}>
                        {#if creating}Creating...{:else}Create poll{/if}
                    </button>
                    <button
                        type="button"
                        on:click={() => {
                            showCreate = false;
                            resetForm();
                        }}
                    >
                        Cancel
                    </button>
                </form>
            </Modal>
        {/if}

        {#each polls as poll (poll.id)}
            <article class="poll">
                <h3>
                    {poll.question}
                    {#if poll.state === PollState.closed}
                        <span class="poll-state">(closed)</span>
                    {/if}
                </h3>

                {#if poll.state === PollState.open && !readOnly}
                    <p class="poll-mode">{pollModeLabel(poll)}</p>
                {/if}

                <ul class="poll-options">
                    {#each poll.options as option (option.id)}
                        <li>
                            {#if canVote && !readOnly && poll.state === PollState.open}
                                <button
                                    type="button"
                                    class="poll-vote"
                                    class:voted={poll.votedOptionIds.includes(
                                        option.id,
                                    )}
                                    aria-pressed={poll.votedOptionIds.includes(
                                        option.id,
                                    )}
                                    aria-label={optionLabel(
                                        option.text,
                                        option.votes,
                                        poll.totalVotes,
                                        poll.votedOptionIds.includes(option.id),
                                        poll.resultsHidden,
                                        poll.allowMultiple,
                                    )}
                                    disabled={busyPollId === poll.id}
                                    on:click={() => vote(poll, option.id)}
                                >
                                    <span aria-hidden="true">
                                        {option.text}
                                        {#if !poll.resultsHidden}
                                            — {votesLabel(option.votes)}
                                            ({percentage(
                                                option.votes,
                                                poll.totalVotes,
                                            )}%)
                                        {/if}
                                    </span>
                                </button>
                            {:else}
                                <span
                                    class="poll-result"
                                    class:voted={poll.votedOptionIds.includes(
                                        option.id,
                                    )}
                                >
                                    {option.text}
                                    {#if !poll.resultsHidden}
                                        — {votesLabel(option.votes)}
                                        ({percentage(
                                            option.votes,
                                            poll.totalVotes,
                                        )}%)
                                    {/if}
                                    {#if poll.votedOptionIds.includes(option.id)}
                                        <span class="your-vote">your vote</span>
                                    {/if}
                                </span>
                            {/if}
                        </li>
                    {/each}
                </ul>

                {#if poll.resultsHidden}
                    <p class="poll-total">
                        Results are hidden until you vote.
                    </p>
                {:else}
                    <p class="poll-total">{votersLabel(poll.totalVotes)}</p>
                {/if}

                {#if !canVote && !readOnly && poll.state === PollState.open}
                    <p class="poll-hint">
                        <a href="/login">Log in</a> to vote.
                    </p>
                {/if}

                {#if canManage && !readOnly}
                    <div class="poll-admin">
                        {#if poll.state === PollState.open}
                            <button
                                type="button"
                                disabled={busyPollId === poll.id}
                                on:click={() => closePoll(poll)}
                            >
                                Close poll
                            </button>
                        {/if}
                        <button
                            type="button"
                            disabled={busyPollId === poll.id}
                            on:click={() => deletePoll(poll)}
                        >
                            Delete poll
                        </button>
                    </div>
                {/if}
            </article>
        {:else}
            <p class="no-polls">No polls yet.</p>
        {/each}
    </section>
{/if}

<style>
    .polls {
        margin-top: 1.5rem;
        padding: 1rem;
        background: #f9f9f9;
        border-radius: 8px;
    }

    .polls h2 {
        margin-top: 0;
        font-size: 1.2rem;
    }

    .poll {
        margin-top: 1rem;
        padding: 0.75rem;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 6px;
    }

    .poll h3 {
        margin: 0 0 0.5rem;
        font-size: 1.05rem;
    }

    .poll-state {
        font-weight: normal;
        color: #6c757d;
        font-size: 0.9em;
    }

    .poll-mode {
        margin: 0 0 0.5rem;
        font-size: 0.85rem;
        color: #6c757d;
    }

    .poll-options {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .poll-vote {
        width: 100%;
        text-align: left;
        padding: 0.4rem 0.6rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
    }

    .poll-vote:hover {
        border-color: #007bff;
    }

    .poll-vote.voted,
    .poll-result.voted {
        border-color: #007bff;
        background: #e7f1ff;
        font-weight: 600;
    }

    .poll-result {
        display: block;
        padding: 0.4rem 0.6rem;
        border: 1px solid #eee;
        border-radius: 4px;
    }

    .your-vote {
        font-size: 0.85em;
        color: #0056b3;
    }

    .poll-total,
    .poll-hint {
        margin: 0.5rem 0 0;
        font-size: 0.9rem;
        color: #555;
    }

    .poll-notice {
        padding: 0.5rem;
        background: #fff3cd;
        border: 1px solid #ffeeba;
        border-radius: 4px;
        color: #856404;
    }

    .poll-admin {
        margin-top: 0.5rem;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .poll-option-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.35rem;
        flex-wrap: wrap;
    }

    .poll-setting {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 0.35rem;
    }

    .poll-setting-hint {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: #666;
    }

    .no-polls {
        color: #666;
        font-style: italic;
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
</style>
