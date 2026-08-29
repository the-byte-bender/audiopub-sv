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
import {
    Table,
    Column,
    Model,
    DataType,
    PrimaryKey,
    AllowNull,
    Default,
    ForeignKey,
    BelongsTo,
    Index,
    Unique,
    CreatedAt,
    UpdatedAt,
} from "sequelize-typescript";
import User from "./user";
import { ReactionTargetType } from "$lib/types";

/**
 * A single reaction left by a user. Reactions are polymorphic: the same table
 * backs comment reactions and stream chat reactions, discriminated by
 * `targetType`. A user may only hold one reaction per target at a time;
 * picking a different emoji replaces the previous one.
 */
@Table
export default class Reaction extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Unique("uniq_reaction_user_target")
    @ForeignKey(() => User)
    @Index
    @Column(DataType.UUID)
    declare userId: string;

    @BelongsTo(() => User, { foreignKey: "userId", onDelete: "CASCADE" })
    declare user?: User;

    @AllowNull(false)
    @Unique("uniq_reaction_user_target")
    @Column(DataType.STRING(32))
    declare targetType: ReactionTargetType;

    @AllowNull(false)
    @Unique("uniq_reaction_user_target")
    @Column(DataType.UUID)
    declare targetId: string;

    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare emoji: string;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;
}
