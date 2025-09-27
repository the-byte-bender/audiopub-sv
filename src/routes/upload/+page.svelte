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
    import title from "$lib/title";
    import { onMount } from "svelte";

    let uploading = false;
    let progress = 0;
    let error: string | null = null;

    onMount(() => title.set("Upload Audio"));

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (uploading) return;
        const form = e.currentTarget as HTMLFormElement;
        const formData = new FormData(form);
        uploading = true;
        progress = 0;
        error = null;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", window.location.pathname);
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                progress = Math.round((evt.loaded / evt.total) * 100);
            }
        };

        xhr.onload = () => {
            const status = xhr.status;
            let body: any = null;
            const ct = xhr.getResponseHeader("Content-Type") || "";
            if (ct.includes("application/json")) {
                try {
                    body = JSON.parse(xhr.responseText || "null");
                } catch {
                }
            }
            if (status >= 200 && status < 300) {
                progress = 100;
                const redirectUrl = body?.redirect;
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                    return;
                }
                if (
                    xhr.responseURL &&
                    xhr.responseURL !== window.location.href
                ) {
                    window.location.href = xhr.responseURL;
                    return;
                }
                form.reset();
                uploading = false;
            } else if (status >= 400 && status < 500) {
                uploading = false;
                error =
                    body?.message ||
                    body?.error ||
                    `Upload failed (status ${status})`;
            } else {
                uploading = false;
                error = `Server error (status ${status})`;
            }
        };

        xhr.onerror = () => {
            uploading = false;
            error = "Network error during upload.";
        };

        xhr.send(formData);
    }
</script>

<h1>Upload Audio</h1>

<form
    method="POST"
    enctype="multipart/form-data"
    on:submit|preventDefault={handleSubmit}
    aria-describedby="upload-help"
    novalidate
>
    <div class="form-group">
        <label for="title">Title:</label>
        <input
            type="text"
            id="title"
            name="title"
            required
            minlength="3"
            maxlength="120"
            class="form-control"
        />
    </div>
    <div class="form-group">
        <label for="description">Description:</label>
        <textarea
            id="description"
            name="description"
            maxlength="5000"
            class="form-control"
        ></textarea>
    </div>
    <div class="form-group">
        <label for="audio">Audio File:</label>
        <input
            type="file"
            id="audio"
            name="file"
            required
            class="form-control"
        />
    </div>
    <p class="info">
        Most known audio formats should be supported. Your audio may be
        transcoded for browsers that do not support the original format. For
        when you hit the size limit, you can use opus at a decent bitrate as it
        is the most efficient codec for streaming.
    </p>
    <p class="info">
        Please follow common decency and the law. Moderators and admins reserve
        the right to remove any content that is deemed inappropriate or illegal.
    </p>

    {#if uploading}
        <div
            class="progress-wrapper"
            role="progressbar"
            aria-label="Upload progress"
            aria-live="polite"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
        >
            <div class="progress-bar" style={`width: ${progress}%;`}>
                <span class="sr-only">{progress}%</span>
            </div>
        </div>
    {/if}

    {#if error}
        <div class="error" role="alert" aria-live="assertive">{error}</div>
    {/if}

    <button
        type="submit"
        class="btn"
        disabled={uploading}
        aria-disabled={uploading}
    >
        {#if uploading}
            Uploading...
        {:else}
            Upload
        {/if}
    </button>
</form>

<style>
    h1 {
        text-align: center;
        margin-bottom: 1rem;
        color: #333;
    }

    form {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem;
        border: 1px solid #ccc;
        border-radius: 8px;
        background-color: #f9f9f9;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .form-group {
        width: 100%;
        display: flex;
        flex-direction: column;
    }

    label {
        margin-bottom: 0.5rem;
        font-weight: bold;
        color: #555;
    }

    .form-control {
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 1rem;
        transition: border-color 0.3s ease-in-out;
        width: 100%;
    }

    .form-control:focus {
        border-color: #007bff;
        outline: none;
        box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
    }

    .info {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 1rem;
        text-align: center;
    }

    .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        background-color: #007bff;
        color: white;
        font-size: 1rem;
        cursor: pointer;
        transition: background-color 0.3s ease-in-out;
    }

    .btn:hover {
        background-color: #0056b3;
    }

    .progress-wrapper {
        width: 100%;
        background: #e0e0e0;
        border-radius: 4px;
        height: 1rem;
        overflow: hidden;
        position: relative;
        margin-bottom: 0.75rem;
    }

    .progress-bar {
        height: 100%;
        background: #007bff;
        transition: width 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
    }

    .error {
        width: 100%;
        margin-top: 0.5rem;
        background: #ffe5e9;
        color: #b00020;
        padding: 0.75rem 1rem;
        border-left: 4px solid #b00020;
        border-radius: 4px;
        font-size: 0.9rem;
    }
</style>
