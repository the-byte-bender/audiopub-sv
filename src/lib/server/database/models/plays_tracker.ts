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
  Unique,
  Default,
  BeforeCreate,
  BeforeUpdate,
  CreatedAt,
  UpdatedAt,
  HasMany,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import User from "./user";
import Audio from "./audio";

@Table
export default class PlaysTracker extends Model {
  @PrimaryKey
  @AllowNull(false)
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => User)
  declare userId: string;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  declare user: User;

  @ForeignKey(() => Audio)
  declare audioId: string;

  @BelongsTo(() => Audio, { onDelete: "CASCADE" })
  declare audio: Audio;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare lastPlayedAt: Date;
}
