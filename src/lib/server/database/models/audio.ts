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
  Index,
  ForeignKey,
  BelongsTo,
  HasMany,
  Sequelize,
} from "sequelize-typescript";
import Mime from "mime-types";
import User, { type UserInfo } from "./user";
import Comment from "./comment";
import PlaysTracker from "./plays_tracker";
import type { ClientsideAudio } from "$lib/types";

export interface AudioInfo {
  id: string;
  title: string;
  description: string;
  hasFile: boolean;
  path: string;
  user?: UserInfo;
}

@Table
export default class Audio extends Model {
  static playsTracker: Map<string, Date> = new Map(); // Where the first string is ip+id
  @PrimaryKey
  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Index({ type: "FULLTEXT" })
  @Column(DataType.TEXT)
  declare title: string;

  @AllowNull(false)
  @Default("")
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare hasFile: boolean;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare plays: number;

  @AllowNull(false)
  @Default("aac")
  @Column(DataType.STRING)
  declare extension: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isFromAi: boolean;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @HasMany(() => Comment)
  declare comments?: Comment[];

  get path(): string {
    return `audio/${this.id}`;
  }

  get transcodedPath(): string {
    return `audio/${this.id}.aac`;
  }

  get mimeType(): string {
    return Mime.lookup(this.extension) || "audio/aac";
  }

  toJSON(includeSencitiveInfo: boolean = false): AudioInfo {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      hasFile: this.hasFile,
      path: this.path,
      user: (this.user && this.user.toJSON(includeSencitiveInfo)) || undefined,
    };
  }

  get playsString(): string {
    if (this.plays <= 0) {
      return "No registered plays";
    }
    if (this.plays === 1) {
      return "Played 1 time";
    }
    return `Played ${this.plays} times`;
  }

  async registerPlay(userIp: string): Promise<boolean> {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
    const key = `${userIp}-${this.id}`;
    if (Audio.playsTracker.has(key)) {
      if (Audio.playsTracker.get(key)!.getTime() > twelveHoursAgo.getTime()) {
        return false;
      }
    }
    Audio.playsTracker.set(key, new Date());
    await this.increment("plays");
    return true;
  }

  toClientside(includeUser: boolean = true): ClientsideAudio {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      extension: this.extension,
      path: this.path,
      transcodedPath: this.transcodedPath,
      url: this.path,
      plays: this.plays,
      playsString: this.playsString,
      createdAt: this.createdAt.getTime(),
      user: includeUser ? this.user?.toClientside() : undefined,
    };
  }

  static async search(
    query: string,
    page: number,
    isFromAI: boolean = false
  ): Promise<Audio[]> {
    return Audio.findAll({
      where: Sequelize.literal(
        `MATCH(title, description) AGAINST(:query IN NATURAL LANGUAGE MODE) AND isFromAI = :isFromAI`
      ),
      replacements: { query, isFromAI },
      limit: 30,
      offset: (page - 1) * 30,
      include: User,
      nest: true,
    });
  }
}
