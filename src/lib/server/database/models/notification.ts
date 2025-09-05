/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2025 the-byte-bender
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
import {
    Table,
    Column,
    Model,
    DataType,
    PrimaryKey,
    AllowNull,
    Default,
    Index,
    ForeignKey,
    BelongsTo,
    CreatedAt,
    UpdatedAt,
} from "sequelize-typescript";
import User from "./user";
import Audio from "./audio";
import Comment from "./comment";
import type { ClientsideAudio, ClientsideComment } from "$lib/types";
import {
    NotificationType,
    NotificationTargetType,
    type ClientsideResolvedNotification,
} from "$lib/types";

@Table
export default class Notification extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(true)
    @ForeignKey(() => User)
    @Index
    @Column(DataType.UUID)
    declare userId: string | null;

    @AllowNull(true)
    @ForeignKey(() => User)
    @Index
    @Column(DataType.UUID)
    declare actorId: string | null;

    @BelongsTo(() => User, { foreignKey: "userId", onDelete: "CASCADE" })
    declare user?: User | null;

    @BelongsTo(() => User, { foreignKey: "actorId", onDelete: "SET NULL" })
    declare actor?: User | null;

    @AllowNull(false)
    @Index
    @Column(DataType.STRING)
    declare type: NotificationType;

    @AllowNull(false)
    @Index
    @Column(DataType.STRING)
    declare targetType: NotificationTargetType;

    @AllowNull(true)
    @Index
    @Column(DataType.UUID)
    declare targetId: string | null;

    @AllowNull(true)
    @Column(DataType.JSON)
    declare metadata: any | null;

    @AllowNull(true)
    @Index
    @Column(DataType.DATE)
    declare readAt: Date | null;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    async resolve(): Promise<ClientsideResolvedNotification> {
        const [resolved] = await Notification.resolveMany([this]);
        return resolved;
    }

    static async resolveMany(
        notifications: Notification[]
    ): Promise<ClientsideResolvedNotification[]> {
        if (notifications.length === 0) return [];

        const actorIds = Array.from(
            new Set(
                notifications
                    .map((n) => n.actorId || undefined)
                    .filter((x): x is string => !!x)
            )
        );

        const audioIds = new Set<string>();
        const commentIds = new Set<string>();
        for (const n of notifications) {
            if (n.targetType === NotificationTargetType.audio && n.targetId) {
                audioIds.add(n.targetId);
            } else if (
                n.targetType === NotificationTargetType.comment &&
                n.targetId
            ) {
                commentIds.add(n.targetId);
            }
        }

        const [actors, audios, comments] = await Promise.all([
            actorIds.length
                ? User.findAll({ where: { id: actorIds as any } })
                : Promise.resolve([]),
            audioIds.size
                ? Audio.findAll({ where: { id: Array.from(audioIds) as any } })
                : Promise.resolve([]),
            commentIds.size
                ? Comment.findAll({
                      where: { id: Array.from(commentIds) as any },
                      include: [Audio, User],
                  })
                : Promise.resolve([]),
        ]);

        const actorMap = new Map<string, User>();
        for (const a of actors) actorMap.set(a.id, a);
        const audioMap = new Map<string, Audio>();
        for (const a of audios) audioMap.set(a.id, a);
        const commentMap = new Map<string, Comment>();
        for (const c of comments) commentMap.set(c.id, c);

        const resolved: ClientsideResolvedNotification[] = [];
        const toDelete: Notification[] = [];

        for (const n of notifications) {
            let target: ClientsideAudio | ClientsideComment | undefined =
                undefined;
            if (n.targetType === NotificationTargetType.audio) {
                const a = n.targetId ? audioMap.get(n.targetId) : undefined;
                if (!a && n.targetId) toDelete.push(n);
                if (a) target = a.toClientside();
            } else if (n.targetType === NotificationTargetType.comment) {
                const c = n.targetId ? commentMap.get(n.targetId) : undefined;
                if (!c && n.targetId) toDelete.push(n);
                if (c) target = c.toClientside(true);
            }

            const actor = n.actorId ? actorMap.get(n.actorId) : undefined;

            resolved.push({
                id: n.id,
                userId: n.userId,
                type: n.type,
                targetType: n.targetType,
                target,
                metadata: n.metadata || undefined,
                actor: actor ? actor.toClientside() : undefined,
                readAt: n.readAt ? n.readAt.getTime() : undefined,
                createdAt: n.createdAt.getTime(),
            });
        }

        if (toDelete.length > 0) {
            setTimeout(() => {
                Promise.allSettled(toDelete.map((n) => n.destroy())).catch(
                    () => {}
                );
            }, 0);
        }

        return resolved;
    }

    static async createSystem(message: string, metadata?: any) {
        return Notification.create({
            userId: null,
            actorId: null,
            type: NotificationType.system,
            targetType: NotificationTargetType.audio,
            targetId: null,
            metadata: { message, ...metadata },
        } as any);
    }
}
