/*
 * This file is part of the audiopub project.
 *
 * Copyright (C) 2025 the-byte-bender
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
    Unique,
} from "sequelize-typescript";
import User from "./user";
import Audio from "./audio";
import Notification from "./notification";
import { NotificationType, NotificationTargetType } from "$lib/types";
import { Op } from "sequelize";

@Table
export default class AudioFavorite extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Unique("uniq_audio_favorite_user_audio")
    @ForeignKey(() => User)
    @Index
    @Column(DataType.UUID)
    declare userId: string;

    @BelongsTo(() => User, { foreignKey: "userId", onDelete: "CASCADE" })
    declare user?: User;

    @AllowNull(false)
    @Unique("uniq_audio_favorite_user_audio")
    @ForeignKey(() => Audio)
    @Index
    @Column(DataType.UUID)
    declare audioId: string;

    @BelongsTo(() => Audio, { foreignKey: "audioId", onDelete: "CASCADE" })
    declare audio?: Audio;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    static async createFavorite(userId: string, audioId: string): Promise<AudioFavorite | null> {
        try {
            const favorite = await AudioFavorite.create({
                userId,
                audioId,
            } as any);

            // Create notification for the audio owner
            const audio = await Audio.findByPk(audioId, { include: [User] });
            if (audio && audio.user && audio.user.id !== userId) {
                // Check for recent favorite notifications to prevent spam
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const recentNotification = await Notification.findOne({
                    where: {
                        userId: audio.user.id,
                        actorId: userId,
                        type: NotificationType.favorite,
                        targetType: NotificationTargetType.audio,
                        targetId: audioId,
                        createdAt: {
                            [Op.gte]: fiveMinutesAgo,
                        },
                    },
                });

                // Only create notification if no recent one exists
                if (!recentNotification) {
                    await Notification.create({
                        userId: audio.user.id,
                        actorId: userId,
                        type: NotificationType.favorite,
                        targetType: NotificationTargetType.audio,
                        targetId: audioId,
                    } as any);
                }
            }

            return favorite;
        } catch (error) {
            // Handle unique constraint violation (user already favorited this audio)
            if ((error as any).name === 'SequelizeUniqueConstraintError') {
                return null;
            }
            throw error;
        }
    }

    static async removeFavorite(userId: string, audioId: string): Promise<boolean> {
        const result = await AudioFavorite.destroy({
            where: {
                userId,
                audioId,
            },
        });

        if (result > 0) {
            // Clean up the favorite notification
            const audio = await Audio.findByPk(audioId, { include: [User] });
            if (audio && audio.user && audio.user.id !== userId) {
                await Notification.destroy({
                    where: {
                        userId: audio.user.id,
                        actorId: userId,
                        type: NotificationType.favorite,
                        targetType: NotificationTargetType.audio,
                        targetId: audioId,
                    },
                });
            }
        }

        return result > 0;
    }

    static async getFavoriteCount(audioId: string): Promise<number> {
        return AudioFavorite.count({
            where: {
                audioId,
            },
        });
    }

    static async isUserFavorite(userId: string, audioId: string): Promise<boolean> {
        const favorite = await AudioFavorite.findOne({
            where: {
                userId,
                audioId,
            },
        });
        return !!favorite;
    }

    static async getUserFavorites(userId: string, page: number = 1, limit: number = 30, isAdmin: boolean = false) {
        const offset = (page - 1) * limit;
        
        return AudioFavorite.findAndCountAll({
            where: {
                userId,
            },
            include: [
                {
                    model: Audio,
                    include: [
                        {
                            model: User,
                            where: isAdmin ? {} : {
                                [Op.or]: [
                                    { isTrusted: true },
                                    { id: userId } // Always show own audios even if not trusted
                                ]
                            }
                        }
                    ],
                    required: true,
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });
    }
}