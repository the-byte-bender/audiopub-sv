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
  CreatedAt,
  UpdatedAt,
  HasMany,
} from "sequelize-typescript";
import Audio from "./audio";
import User from "./user";
import type { ClientsideComment, ClientsideAudio } from "$lib/types";

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

  @ForeignKey(() => Comment)
  @Column(DataType.UUID)
  declare parentId?: string;

  @BelongsTo(() => Comment, { foreignKey: "parentId", as: "parent" })
  declare parent?: Comment;

  @HasMany(() => Comment, { foreignKey: "parentId", as: "replies" })
  declare replies?: Comment[];

  public countReplies!: () => Promise<number>;
  toClientside(
    includeAudio: boolean = false,
    includeReplies: boolean = false
  ): ClientsideComment {
    return {
      id: this.id,
      content: this.content,
      createdAt: this.createdAt.getTime(),
      updatedAt: this.updatedAt.getTime(),
      user: this.user!.toClientside(),
      audio: includeAudio ? this.audio?.toClientside() : undefined,
      replies: includeReplies
        ? this.replies?.map((r) => r.toClientside(includeAudio, includeReplies))
        : undefined,
    };
  }

  static constructThreads(flatList: Comment[]): Comment[] {
    // Create an index for fast lookups of comments by ID
    let index = new Map<string, Comment>();
    // Populate the index
    for (const comment of flatList) {
      index.set(comment.id, comment);
    }

    // Now, build the tree structure
    let roots: Comment[] = [];
    for (const comment of flatList) {
      if (!comment.parentId) {
        // This is a root comment
        roots.push(comment);
        continue;
      }

      const parent = index.get(comment.parentId);
      if (parent) {
        if (!parent.replies) {
          // Create a new replies array for this parent
          parent.replies = [comment];
        } else {
          parent.replies.push(comment);
        }
      } else {
        // Orphaned comment, no parent found
        roots.push(comment);
      }
    }

    // Recursively sort all comments by creation date
    const recursiveSort = (comments: Comment[]) => {
      comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (const comment of comments) {
        if (comment.replies) {
          recursiveSort(comment.replies);
        }
      }
    };
    recursiveSort(roots);

    return roots;
  }
}
