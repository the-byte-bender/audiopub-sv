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

@Table
export default class AudioFollow extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Unique("uniq_audio_follow_user_audio")
    @ForeignKey(() => User)
    @Index
    @Column(DataType.UUID)
    declare userId: string;

    @BelongsTo(() => User, { foreignKey: "userId", onDelete: "CASCADE" })
    declare user?: User;

    @AllowNull(false)
    @Unique("uniq_audio_follow_user_audio")
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
}
