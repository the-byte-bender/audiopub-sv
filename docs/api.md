# AudioPub API

AudioPub has a JSON API for native clients, such as Android, iOS and desktop apps. It covers what a listener does on the site: browsing and searching audios, listening, commenting, favorites, subscriptions, mutes, notifications, uploading, and following live streams and their chat. Administration and broadcasting are left to the website.

Every endpoint lives under `/api/v1`, so on the official instance the base URL is `https://audiopub.site/api/v1`. Breaking changes will only ever go into a new version.

## Conventions

### Authentication

Log in or register to get a token, then send it with every request in an `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens do not expire on their own. They stop working when the account's email or password changes, which signs out every session. The endpoints that make such a change answer with a fresh token for the client that made it, which should replace the stored one. To sign out, discard the token.

Endpoints that act on an account answer `401` without a valid token. Requests from a banned account are answered with `403`.

### Requests

Request bodies are JSON, sent with `Content-Type: application/json`, except for uploads, which are `multipart/form-data`. Flags in query strings are on when set to `true`.

### Responses

Successful responses are JSON. Actions with nothing in particular to return answer `{ "success": true }`.

Errors carry a status code and a message meant to be shown to the user:

```json
{ "error": "Title must be between 3 and 120 characters" }
```

| Status | Meaning |
| --- | --- |
| `400` | The request is invalid. The message says why. |
| `401` | A token is required, or the one sent is no longer valid. |
| `403` | The account may not do this. The message says why. |
| `404` | The thing asked for does not exist, or is not visible to this account. |
| `409` | The request conflicts with the current state, such as an email already in use. |
| `413` | The upload is too large. |
| `429` | Slow mode is on in a stream's chat. The message says how long to wait. |
| `500` | Something went wrong on the server. |

### Pagination

Lists are paged 30 items at a time. Pass `page`, starting from 1, and read the paging fields next to the items:

```json
{ "audios": [], "count": 132, "page": 1, "limit": 30, "totalPages": 5 }
```

### Data

Ids are UUIDs, and timestamps are milliseconds since the Unix epoch. The objects returned are the ones the website itself uses, defined in [`src/lib/types.ts`](../src/lib/types.ts): users are `ClientsideUser`, audios `ClientsideAudio`, comments `ClientsideComment`, streams `ClientsideStream`, stream chat messages `ClientsideStreamChat` and notifications `ClientsideResolvedNotification`.

Wherever a user is looked up by `{user}`, either their id or their name prefixed with `@`, such as `@alice`, works.

### Playing audio

An audio's `path` and `transcodedPath` are relative to the instance, not to the API. For example, an audio with the path `audio/<id>` plays from `https://audiopub.site/audio/<id>`. `transcodedPath` is an AAC version every player can handle, and `path` is the original upload, with the MIME type given by the audio endpoint. A fresh upload is only playable from `path` until it has been transcoded.

## Accounts

### `POST /auth/register`

```json
{ "email": "alice@example.com", "username": "alice", "password": "correct horse" }
```

Usernames are 3 to 24 characters and passwords 8 to 64. Answers `201` with a token and the account, and emails a verification token to the address. New accounts are reviewed by admins before they can upload more than once, favorite, or go live.

```json
{ "token": "<token>", "user": { "id": "…", "name": "alice", "displayName": "alice", "email": "alice@example.com", "isVerified": false, "isAdmin": false, … } }
```

### `POST /auth/login`

```json
{ "email": "alice@example.com", "password": "correct horse" }
```

Answers with a token and the account, like registering. If the email is not verified yet, the verification token is emailed again.

### `POST /auth/verify`

Requires a token. Verifies the email address with the token that was emailed. Commenting, following audios, chatting and uploading need a verified email.

```json
{ "verificationToken": "…" }
```

Answers with the account.

### `POST /auth/forgot_password`

```json
{ "email": "alice@example.com" }
```

Emails a link to reset the password on the website. Always answers with success, so it cannot be used to find out whether an address has an account.

### `GET /me`

Requires a token. Answers with the account: a `ClientsideUser` with `email` and `isAdmin` added.

```json
{ "user": { … } }
```

### `PATCH /me`

Requires a token. Changes any of `email`, `displayName` (3 to 30 characters), `bio` (up to 1000 characters) and `password`. Nothing is changed unless every field given is valid. A new email has to be verified again.

```json
{ "displayName": "Alice", "bio": "I record birdsong." }
```

Answers with a fresh token and the account.

### `GET /me/notification_key`

Requires a token. Answers with the key push notifications are sent to through OneSignal, which the client registers the device under as its external id.

```json
{ "notificationKey": "…" }
```

## Audios

### `GET /audios`

The home feed. Muted users' audios are left out.

| Parameter | Values |
| --- | --- |
| `sort` | `createdAt` (default), `plays`, `title`, `favoriteCount` or `random` |
| `order` | `desc` (default) or `asc` |
| `excludeArchives` | `true` to leave out archived live streams |
| `page` | The page number |

Answers with a page of `audios`.

### `POST /audios`

Requires a token and a verified email. Uploads an audio, as `multipart/form-data`:

| Field | |
| --- | --- |
| `file` | The audio file, up to 500 MB |
| `title` | 3 to 120 characters |
| `description` | Optional, up to 5000 characters, in Markdown |
| `isAnnouncement` | Admins only: `true` to pin it on the upload page |

Answers `201` with the new `audio`. Subscribers of the uploader are notified.

### `GET /search`

Searches audio titles and descriptions.

| Parameter | Values |
| --- | --- |
| `q` | At least 3 characters |
| `includeMuted` | `true` to include muted users' audios |
| `page` | The page number |

Answers with a page of `audios`, and `hiddenByMutes`, the number of matches left out because their uploaders are muted.

### `GET /audios/{id}`

```json
{
    "audio": { … },
    "mimeType": "audio/mpeg",
    "archivedStreamId": null,
    "isFollowing": false,
    "canEdit": true,
    "remainingEdits": 3
}
```

`archivedStreamId` is set when the audio is the recording of a live stream. `remainingEdits` is the number of times the uploader may still change the title and description, and `null` when there is no limit or no permission to edit at all. How the viewer relates to the uploader is part of `GET /users/{user}`.

### `PATCH /audios/{id}`

Requires a token, from the uploader or an admin. Changes `title`, `description` or both. Answers with the updated `audio`.

### `DELETE /audios/{id}`

Requires a token, from the uploader or an admin.

### `POST /audios/{id}/play`

Counts a play. Each network address counts once per audio every twelve hours, so it is safe to call whenever playback starts. Answers with whether this call was counted:

```json
{ "registered": true }
```

### `PUT /audios/{id}/favorite` and `DELETE /audios/{id}/favorite`

Requires a token from a reviewed account. Adds the audio to the favorites, or removes it.

### `PUT /audios/{id}/follow` and `DELETE /audios/{id}/follow`

Requires a token and a verified email. Following an audio sends notifications about new comments on it. Uploaders are always notified about comments on their own audios.

## Comments

### `GET /audios/{id}/comments`

Answers with every comment on the audio, as `comments` threaded through their `replies`, oldest first.

### `POST /audios/{id}/comments`

Requires a token and a verified email.

```json
{ "content": "Lovely recording!", "parentId": null }
```

`content` is 3 to 4000 characters of Markdown, and `parentId` is the comment being replied to, if any. Answers `201` with the new `comment`. The uploader and the audio's followers are notified.

### `DELETE /comments/{id}`

Requires a token, from the commenter or an admin. A comment that has replies is replaced with `[deleted]` instead, to keep the thread readable.

## Users

### `GET /users/{user}`

```json
{
    "user": { … },
    "subscribers": 12,
    "isSubscribed": false,
    "isMuted": false,
    "canBeMuted": true,
    "stream": null
}
```

`stream` is the stream the user is broadcasting, if any. `canBeMuted` says whether the viewer can mute this user: admins can neither mute nor be muted.

### `GET /users/{user}/audios`

Answers with a page of the user's `audios`, newest first.

### `PUT /users/{user}/subscription` and `DELETE /users/{user}/subscription`

Requires a token. Subscribes to the user, which sends notifications when they upload or go live, or unsubscribes. Muted users cannot be subscribed to.

### `PUT /users/{user}/mute` and `DELETE /users/{user}/mute`

Requires a token. Muting a user hides their audios and streams from feeds and search, and their actions from notifications. It also ends any subscription to them.

### `GET /favorites`

Requires a token. Answers with a page of the favorite `audios`, most recently favorited first.

### `GET /subscriptions`

Requires a token. Answers with a page of `audios` from everyone subscribed to, newest first. On the first page, `streams` holds the ones who are live right now.

### `GET /mutes`

Requires a token. Answers with a page of `mutes`, each with its `id`, `createdAt` and muted `user`. `canMute` is false for admins, who may still remove mutes made before they became one.

## Notifications

### `GET /notifications`

Requires a token. Answers with a page of `notifications`, newest first. Reading them does not mark them as read.

### `GET /notifications/unread`

Requires a token. Answers with the number of unread notifications, and is cheap enough to poll.

```json
{ "unread": 3 }
```

### `POST /notifications/read`

Requires a token. Marks every notification as read.

### `DELETE /notifications/{id}`

Requires a token. Deletes a notification.

### `DELETE /notifications`

Requires a token. Deletes every notification.

## Live streams

### `GET /streams`

Answers with every stream that is live right now, as `streams`, newest first.

### `GET /streams/{stream}`

`{stream}` is a stream id, or `@` and a username for whatever that user is broadcasting right now.

```json
{
    "stream": { … },
    "chats": [ … ],
    "format": "aac",
    "slowModeSeconds": 0,
    "listenUrl": "https://live.audiopub.site/<user id>"
}
```

The audio plays from `listenUrl`, which is `null` once the stream has finished. A finished stream that was archived is then an audio with the same id.

### `GET /streams/{stream}/events`

A stream of [server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) that keeps a client up to date while it is open. Each event's data is JSON:

| Event | Data |
| --- | --- |
| `state` | `{ "state": "active" }`, on connecting and whenever the state changes |
| `listeners` | `{ "activeListeners": 4, "peekListeners": 9 }` |
| `chat` | A new `ClientsideStreamChat` |
| `chat_delete` | `{ "chatId": "…" }` |
| `moderation` | `{ "kind": "mute", "userId": "…", "slowModeSeconds": null, "mute": { … } }`, where `kind` is `mute`, `unmute` or `slowmode` |
| `archived` | `{}`, once the recording has been saved as an audio |
| `finish` | `{}`, when the stream ends. The connection closes after it. |

A finished stream answers `204`, which tells clients to stop reconnecting.

### `POST /streams/{stream}/chats`

Requires a token and a verified email.

```json
{ "content": "Hello from my phone!" }
```

Messages are up to 2000 characters. Answers `201` with the new `chat`. Fails with `403` while muted in the stream, and `429` while slow mode is on.

### `DELETE /streams/{stream}/chats/{id}`

Requires a token, from the message's author, the broadcaster or an admin.
