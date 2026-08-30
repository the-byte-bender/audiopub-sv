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
import User from "./user";
import Stream from "./stream";
import StreamPollOption from "./stream_poll_option";
import { PollState, type ClientsidePoll } from "$lib/types";

/**
 * A poll attached to a stream. Polls outlive the broadcast: once the stream is
 * archived, the closed poll and its final tally stay visible on the archived
 * audio page.
 */
@Table
export default class StreamPoll extends Model {
    @PrimaryKey
    @AllowNull(false)
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @ForeignKey(() => Stream)
    @Index
    @Column(DataType.UUID)
    declare streamId: string;

    @BelongsTo(() => Stream, { foreignKey: "streamId", onDelete: "CASCADE" })
    declare stream?: Stream;

    @ForeignKey(() => User)
    @Column(DataType.UUID)
    declare createdById: string | null;

    @BelongsTo(() => User, { foreignKey: "createdById", as: "createdBy" })
    declare createdBy?: User | null;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare question: string;

    @AllowNull(false)
    @Default(PollState.open)
    @Column(DataType.STRING(16))
    declare state: PollState;

    /** Multiple choice: voters toggle any number of options. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare allowMultiple: boolean;

    /** Keeps the tally secret until a viewer has voted, to curb bandwagoning. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare hideResultsUntilVote: boolean;

    @Column(DataType.DATE)
    declare closedAt: Date | null;

    @HasMany(() => StreamPollOption, { onDelete: "CASCADE" })
    declare options?: StreamPollOption[];

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    /**
     * `votedOptionIds` is the viewer's own vote and must never be broadcast:
     * each client merges its own selection into the shared tally.
     *
     * When `canSeeResults` is false the counts are zeroed rather than merely
     * hidden by the UI, so a hidden tally cannot be read off the response.
     * Callers should use the helpers in `$lib/server/polls` instead of calling
     * this directly, since `totalVotes` counts distinct voters and has to be
     * queried separately.
     */
    toClientside(
        votedOptionIds: string[] = [],
        voterCount: number = 0,
        canSeeResults: boolean = true,
    ): ClientsidePoll {
        const options = [...(this.options ?? [])].sort(
            (a, b) => a.position - b.position,
        );
        return {
            id: this.id,
            streamId: this.streamId,
            question: this.question,
            state: this.state,
            createdAt: this.createdAt.getTime(),
            closedAt: this.closedAt ? this.closedAt.getTime() : null,
            allowMultiple: this.allowMultiple,
            hideResultsUntilVote: this.hideResultsUntilVote,
            resultsHidden: !canSeeResults,
            totalVotes: canSeeResults ? voterCount : 0,
            votedOptionIds,
            options: options.map((o) => ({
                id: o.id,
                text: o.text,
                votes: canSeeResults ? (o.voteCount ?? 0) : 0,
            })),
        };
    }
}
