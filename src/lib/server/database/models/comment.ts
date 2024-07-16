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
  Index,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import Audio from "./audio";
import User  from "./user";
import type { ClientsideComment, ClientsideAudio} from "$lib/types";

@Table
export default class Comment extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @ForeignKey(() => Audio)
  @Column(DataType.UUID)
  declare audioId: string;

  @BelongsTo(() => Audio)
  declare audio?: Audio;

  toClientside(includeAudio: boolean = false): ClientsideComment {
    return {
      id: this.id,
      content: this.content,
      createdAt: this.createdAt.getTime(),
      updatedAt: this.updatedAt.getTime(),
      user: this.user!.toClientside(),
      audio: includeAudio ? this.audio?.toClientside() : undefined,
    };
  }
}
