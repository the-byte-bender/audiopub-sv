/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2024 the-byte-bender
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
export interface ClientsideUser {
    id: string;
    name: string;
    displayName: string;
    bio: string;
    isBanned: boolean;
    isVerified: boolean;
    isTrusted: boolean;
}

export interface ClientsideStream {
    id: string;
    title: string;
    description: string;
    state: StreamState;
    peekListeners: number;
    activeListeners: number;
    createdAt: number;
    user?: ClientsideUser;
    chats?: ClientsideStreamChat[];
    isStream: true;
}

export interface ClientsideStreamChat {
    id: string;
    content: string;
    createdAt: number;
    user: ClientsideUser;
    stream?: ClientsideStream;
}

export interface ClientsideStreamMute {
    id: string;
    userId: string;
    userName: string;
    displayName: string;
    expiresAt: number | null;
    reason: string | null;
    createdAt: number;
}

export interface ClientsideAudio {
    id: string;
    title: string;
    description: string;
    extension: string;
    path: string;
    transcodedPath: string;
    url: string;
    plays: number;
    playsString: string;
    favoriteCount: number;
    isFavorited?: boolean;
    createdAt: number;
    /** Admin-authored notice pinned to the top of the upload page. */
    isAnnouncement: boolean;
    user?: ClientsideUser;
    comments?: ClientsideComment[];
}

export interface ClientsideComment {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    user: ClientsideUser;
    audio?: ClientsideAudio;
    replies?: ClientsideComment[];
}

export enum NotificationType {
    comment = "comment",
    upload = "upload",
    system = "system",
    favorite = "favorite",
}

export enum NotificationTargetType {
    audio = "audio",
    stream = "stream",
    comment = "comment",
}

export enum StreamState {
    pending = "pending",
    active = "active",
    disconnected = "disconnected",
    finished = "finished",
}

export enum StreamFormat {
    aac = "aac",
    mp3 = "mp3",
}

export interface ClientsideResolvedNotification {
    id: string;
    userId: string | null;
    type: NotificationType;
    targetType: NotificationTargetType;
    target?: ClientsideAudio | ClientsideStream | ClientsideComment | null;
    metadata?: any;
    actor?: ClientsideUser;
    readAt?: number;
    createdAt: number;
}
