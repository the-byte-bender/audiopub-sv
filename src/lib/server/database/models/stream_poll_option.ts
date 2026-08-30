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
    HasMany,
    Index,
    CreatedAt,
    UpdatedAt,
} from "sequelize-typescript";
import StreamPoll from "./stream_poll";
import StreamPollVote from "./stream_poll_vote";

@Table
export default class StreamPollOption extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @ForeignKey(() => StreamPoll)
    @Index
    @Column(DataType.UUID)
    declare pollId: string;

    @BelongsTo(() => StreamPoll, { foreignKey: "pollId", onDelete: "CASCADE" })
    declare poll?: StreamPoll;

    @AllowNull(false)
    @Column(DataType.STRING(200))
    declare text: string;

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number;

    /**
     * Denormalized tally. Votes are also stored individually so a user can
     * change their mind, but the running count is what every listener sees.
     */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare voteCount: number;

    @HasMany(() => StreamPollVote, { onDelete: "CASCADE" })
    declare votes?: StreamPollVote[];

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;
}
