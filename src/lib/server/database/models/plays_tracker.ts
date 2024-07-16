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
