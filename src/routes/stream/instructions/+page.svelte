<!--
  This file is part of the audiopub project.

  Copyright (C) 2026 the-byte-bender

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
    import title from "$lib/title";
    import {
        streamIngestHost,
        streamIngestPort,
    } from "$lib/streaming_config";
    import { onMount } from "svelte";

    export let data;

    onMount(() => title.set("Stream Instructions"));

    let showSensitiveInfo = false;

    const ingestAddress = `${streamIngestHost}:${streamIngestPort}`;

    $: icecastUrl =
        data.user?.streamKey && showSensitiveInfo
            ? `icecast://source:${data.user.streamKey}@${ingestAddress}/${data.user.id}`
            : null;

    const placeholderKey = "<your-stream-key>";
    $: placeholderUserId = data.user?.id ?? "<your-user-id>";
    $: hasUser = data.user !== null;
</script>

<h1>How to Stream to audiopub</h1>

<section>
    <h2>Before You Begin</h2>

    <p>
        In order to stream to audiopub, you must first create a stream on the
        website. Make sure you have gone to the
        <a href="/live/new">go live</a> page and started a stream there.
    </p>

    <p>
        Keep that page open in a tab. You will need to come back to it to see
        your live stream page and chat while you broadcast. Your stream will not
        appear in pages until you connect your broadcasting software and start
        sending audio.
    </p>

    <p>
        Make sure you know your stream key. Do not share this! Your stream key
        is like a password. You can find your stream key on your
        <a href="/profile">Profile page</a>. If you have not set a stream key
        yet, you can generate one there.
    </p>
</section>

<section>
    <h2>Showing Sensitive Information</h2>

    <p>
        Below on this page, you will see your stream key and a direct URL
        containing your stream key. If you check the box below to show sensitive
        information, these values will be revealed. Only do this where nobody
        else can see.
    </p>

    <label class="toggle-label">
        <input
            type="checkbox"
            name="showSensitive"
            bind:checked={showSensitiveInfo}
        />
        <span>Show sensitive information</span>
    </label>
</section>

<section>
    <h2>Your connection Details</h2>

    <p>
        Any broadcasting software that supports streaming to an Icecast server
        should work with audiopub. We have instructions later on this page for
        setting up OBS Studio, but if you use something else, the settings will
        be similar. You just need to find where to enter the appropriate
        information.
    </p>

    <dl>
        <dt>Server address</dt>
        <dd>
            <code>{streamIngestHost}</code>
        </dd>

        <dt>Port</dt>
        <dd>
            <code>{streamIngestPort}</code>
        </dd>

        <dt>Mount point</dt>
        <dd>
            <code>{placeholderUserId}</code>
        </dd>

        <dt>Username</dt>
        <dd>
            <code>source</code>
            <span class="note">
                (The username can be anything. We use "source" as a convention.)
            </span>
        </dd>

        <dt>Password / Stream key</dt>
        <dd>
            {#if hasUser && showSensitiveInfo && data.user?.streamKey}
                <code class="sensitive">{data.user.streamKey}</code>
            {:else if hasUser}
                <code class="sensitive masked">
                    {placeholderKey}
                    (check "show sensitive information" above to reveal)
                </code>
            {:else}
                <code class="sensitive masked">
                    {placeholderKey}
                    (log in to see your stream key)
                </code>
            {/if}
        </dd>
    </dl>

    <p>
        If you have the option, do not enable tls / ssl in your broadcasting
        software.
    </p>

    <p>
        Some broadcasting programs ask for a single URL. If your software
        supports this, you can use the following URL. It contains everything in
        one line. Fill any placeholders with the values from above.
    </p>

    <p class="url-display">
        {#if icecastUrl}
            <code class="sensitive full-url">{icecastUrl}</code>
        {:else}
            <code class="sensitive masked full-url">
                icecast://source:{placeholderKey}@{ingestAddress}/{placeholderUserId}
            </code>
        {/if}
    </p>
</section>

<section>
    <h2>OBS Studio Setup</h2>

    <p>
        This will override your recording settings, so I recommend using the
        profile feature in OBS Studio to create a separate profile just for
        streaming to audiopub.
    </p>

    <p>
        Go to the OBS settings, then to Output. Set the following settings.
        Note. If your screen reader doesn't read a label properly, you can use
        object navigation or your screen reader's equivalent. Move to the
        previous object of a control and that should speak the label
    </p>

    <p>Change the Output Mode in the combo box to "Advanced".</p>

    <p>
        Move forward to reach the tabs control. Change the tab to "recording"
        (not "streaming," even though we are actually streaming)
    </p>

    <p>
        After you've changed to the recording tab, keep tabbing forward. You
        will reach a combo box labeled "Type" or "Recording Type" Set this to
        "Custom Output (FFmpeg)."
    </p>

    <p>
        Keep moving forward. Now is when we'll potentially reach the part where
        your screen reader might not read the labels properly. See above for how
        to read the labels if that happens.
    </p>

    <p>
        The first thing you have is the "FFmpeg Output Type" combo box. Set this
        to "Output to URL"
    </p>

    <p>
        Tab to the text field labeled "File path or URL." This is where you
        paste the full streaming URL for audiopub. In the field, type or paste
        the following URL. If you checked the box at the top of this page to
        show sensitive information, use the full URL with your stream key filled
        in:
    </p>

    <p class="url-display">
        {#if icecastUrl}
            <code class="sensitive full-url">{icecastUrl}</code>
        {:else}
            <code class="sensitive masked full-url">
                icecast://source:{placeholderKey}@{ingestAddress}/{placeholderUserId}
            </code>
        {/if}
    </p>

    <p>
        Note: The URL contains your stream key. Only enter this on a private
        computer.
    </p>

    <p>
        After the URL field, Tab forward to the combo box labeled "Container
        Format."Set this to "adts (Audio)."
    </p>

    <p>
        Now tab to the text field labeled "Muxer Settings." Set this to:
        <code>content_type=audio/aac</code>
    </p>

    <p>
        Keep tabbing forward. You will reach a spin button labeled "Audio
        Bitrate." Set this to 160 Kbps.
    </p>

    <p>
        Continue tabbing forward. You will reach a combo box labeled "Audio
        Encoder." Set it to "AAC - AAC (Advanced Audio Coding)"
    </p>

    <p>That's it. Hit ok to save your settings.</p>

    <p>
        Now, start a new stream on Audiopub, then in the main OBS Studio window,
        click start recording (not start streaming!) to go live. OBS Studio will
        connect to audiopub and start sending your audio. Your Audiopub stream
        will then be shown in the main page and anyone can listen to it.
    </p>

    <p>
        When you are done broadcasting, go back to OBS Studio and click "Stop
        Recording." Then, go to your stream page on audiopub and press the "End
        Stream" button there to fully shut down the stream and archive it if you
        had archiving enabled.
    </p>
</section>

<style>
    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-weight: 500;
    }

    .toggle-label input {
        width: 1.2em;
        height: 1.2em;
    }

    dl {
        margin: 1rem 0;
    }

    dt {
        font-weight: 600;
        margin-top: 1rem;
    }

    dd {
        margin-left: 1.5rem;
        margin-top: 0.25rem;
    }

    .note {
        font-size: 0.875rem;
        color: #666;
        font-style: italic;
    }

    code {
        background: #f3f4f6;
        padding: 0.15em 0.35em;
        border-radius: 3px;
        font-size: 0.9em;
        font-family: monospace;
        word-break: break-all;
    }

    .sensitive {
        background: #fff3cd;
        color: #856404;
    }

    .masked {
        background: #f3f4f6;
        color: #666;
        font-style: italic;
    }

    .full-url {
        display: block;
        padding: 0.75rem 1rem;
        border-radius: 4px;
        margin: 0.5rem 0;
        word-break: break-all;
        white-space: pre-wrap;
    }

    .url-display {
        margin: 1rem 0;
    }
</style>
