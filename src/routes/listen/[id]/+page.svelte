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
  export let data;

  import { enhance } from "$app/forms";
  import {onMount} from "svelte";
  import CommentList from "$lib/components/comment_list.svelte";
  import title from "$lib/title";
  onMount(() => title.set(data.audio.title));
  const handlePlay = () => {
    fetch(`/listen/${data.audio.id}/try_register_play`, { method: "POST" });
  };
</script>

<h1>{data.audio.title}</h1>

<div class="audio-player">
  <audio controls id="player" on:play={handlePlay}>
    <source src="/{data.audio.path}" type={data.mimeType} />
    <source src="/{data.audio.transcodedPath}" type="audio/aac" />
    <p>Your browser doesn't support the audio element.</p>
  </audio>
  <a
    href="/{data.audio.path}"
    download={data.audio.title +
      (data.audio.extension.startsWith(".")
        ? data.audio.extension
        : "." + data.audio.extension)}
  >
    Download
  </a>
</div>

<div class="audio-details">
  <p>{data.audio.playsString}</p>
  {#if data.audio.user}
    <p>
      Uploaded by: <a href="/user/{data.audio.user.id}"
        >{data.audio.user.name}</a
      >
    </p>
  {/if}
  <p>Upload date: {new Date(data.audio.createdAt).toLocaleDateString()}</p>
  {#if data.audio.description}
    <h2>Description:</h2>
    <pre>{data.audio.description}</pre>
  {/if}

  {#if data.user && (data.isAdmin || data.user.id === data.audio.user?.id)}
    <form
      use:enhance={({ formElement, formData, action, cancel, submitter }) => {
        if (!confirm("Are you sure you want to delete this audio?")) {
          cancel();
        }
      }}
      action="?/delete"
      method="POST"
    >
      <button type="submit"> Permanently delete</button>
    </form>

    {#if !data.isFromAi}
      <form
        use:enhance={({ formElement, formData, action, cancel, submitter }) => {
          if (
            !confirm(
              "Are you sure you want to move this audio to AI trash? Only admins can move it back!"
            )
          ) {
            cancel();
          }
        }}
        action="?/move_to_ai"
        method="POST"
      >
        <button type="submit"> Move to the AI trash mirror </button>
      </form>
    {:else if data.isAdmin}
      <form use:enhance action="?/move_to_main" method="POST">
        <button type="submit"> Move back from the AI trash mirror </button>
      </form>
    {/if}
  {/if}

  <CommentList
    comments={data.comments}
    isAdmin={data.isAdmin}
    user={data.user}
  />

  {#if data.user && !data.user.isBanned}
    <form use:enhance action="?/add_comment" method="POST">
      <label for="comment">Add a comment:</label>
      <textarea name="comment" id="comment" required maxlength="4000"
      ></textarea>
      <button type="submit">Submit</button>
    </form>
  {/if}
</div>

<style>
  /* Styling for the main title */
  h1 {
    text-align: center;
    margin-bottom: 1rem;
    color: #333;
  }

  /* Styling for the audio player section */
  .audio-player {
    margin-bottom: 1rem;
  }

  /* Styling for the audio controls */
  audio {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  /* Styling for the download link */
  .audio-player a {
    display: block;
    text-align: center;
    margin-top: 0.5rem;
    color: #007bff;
    text-decoration: none;
    font-weight: bold;
  }

  /* Styling for the audio details section */
  .audio-details {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 1rem;
    background-color: #f9f9f9;
  }

  /* Styling for the uploaded by link */
  .audio-details a {
    color: #007bff;
    text-decoration: none;
  }

  /* Styling for the description section */
  .audio-details h2 {
    margin-top: 1rem;
    color: #333;
  }

  .audio-details pre {
    white-space: pre-wrap;
    background-color: #fff;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  /* Styling for the delete and move buttons */
  .audio-details form {
    margin-top: 1rem;
  }

  .audio-details button {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background-color: #007bff;
    color: white;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .audio-details button:hover {
    background-color: #0056b3;
  }

  /* Styling for the comment section */
  .audio-details form textarea {
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
  }

  .audio-details form button[type="submit"] {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background-color: #007bff;
    color: white;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .audio-details form button[type="submit"]:hover {
    background-color: #0056b3;
  }
</style>
