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
import StreamPoll from "./stream_poll";
import StreamPollOption from "./stream_poll_option";

/**
 * One row per selected option. Single choice polls keep at most one row per
 * user; multiple choice polls keep one per option the user picked.
 */
@Table
export default class StreamPollVote extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Unique("uniq_poll_vote_user_option")
    @ForeignKey(() => StreamPoll)
    @Index
    @Column(DataType.UUID)
    declare pollId: string;

    @BelongsTo(() => StreamPoll, { foreignKey: "pollId", onDelete: "CASCADE" })
    declare poll?: StreamPoll;

    @AllowNull(false)
    @Unique("uniq_poll_vote_user_option")
    @ForeignKey(() => StreamPollOption)
    @Index
    @Column(DataType.UUID)
    declare optionId: string;

    @BelongsTo(() => StreamPollOption, {
        foreignKey: "optionId",
        onDelete: "CASCADE",
    })
    declare option?: StreamPollOption;

    @AllowNull(false)
    @Unique("uniq_poll_vote_user_option")
    @ForeignKey(() => User)
    @Index
    @Column(DataType.UUID)
    declare userId: string;

    @BelongsTo(() => User, { foreignKey: "userId", onDelete: "CASCADE" })
    declare user?: User;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;
}
