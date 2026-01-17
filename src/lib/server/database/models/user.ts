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
import jwt from "jsonwebtoken";
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
} from "sequelize-typescript";
import sendEmail from "$lib/server/email";
import { v4 as uuidv4, v4 } from "uuid";
import * as dotenv from "dotenv";
import Audio from "./audio";
import Comment from "./comment";
import type { ClientsideUser } from "$lib/types";
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export interface UserInfo {
  id: string;
  name: string;
  email?: string;
  displayName: string;
  isBanned: boolean;
  isVerified: boolean;
  bio: string;
}

@Table
export default class User extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare password: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare displayName: string;

  @AllowNull(true)
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare verificationToken: string | null;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare verificationAttempts: number;

  @AllowNull(true)
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare resetPasswordToken: string | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isBanned: boolean;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isTrusted: boolean;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isAdmin: boolean;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare version: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare bio: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasMany(() => Audio)
  declare audios?: Audio[];

  @HasMany(() => Comment)
  declare comments?: Comment[];

  get isVerified() {
    return !this.verificationToken;
  }

  async trySendVerificationEmail() {
    if (!this.verificationToken) {
      return;
    }
    if (this.verificationAttempts >= 5) {
      throw new Error("Too many verification attempts");
    }
    await sendEmail(
      this.email,
      "Verify your email",
      `
      <p>Hello ${this.displayName},</p>
      <p> Your verification token is: ${this.verificationToken}</p>
      <p> If you didn't request this, please ignore this email.</p>
      <p> Thanks, Audiopub</p>
      `
    );
    await this.increment("verificationAttempts");
  }

  async ban(shortReason: string, body: string) {
    this.isBanned = true;
    await this.save();
    await sendEmail(
      this.email,
      `Your account has been banned from Audiopub for ${shortReason}`,
      `
      <p>Hello ${this.displayName},</p>
      <p>Your account has been banned. from accessing Audiopub.</p>
      <p>Message from the admin:</p>
      <blockquote>${body}</blockquote>
      <p>Thanks, Audiopub</p>
      `
    );
  }

  async warn(shortReason: string, body: string) {
    await sendEmail(
      this.email,
      `You have been warned on Audiopub for ${shortReason}`,
      `
      <p>Hello ${this.displayName},</p>
      <p>You have received a warning on Audiopub.</p>
      <blockquote>${body}</blockquote>
      <p>Thanks, Audiopub</p>
      `
    );
  }

  async resetEmail(email: string) {
    if (this.email === email) {
      return;
    }
    this.email = email;
    await this.regenerateVerificationToken();
    this.version++;
    await this.save();
  }

  async regenerateVerificationToken() {
    this.verificationToken = v4();
    this.verificationAttempts = 0;
    await this.save();
  }

  async verify(verificationToken: string) {
    if (this.verificationToken !== verificationToken) {
      throw new Error("Invalid verification token");
    }
    this.verificationToken = null;
    this.verificationAttempts = 0;
    await this.save();
  }

  generateToken(): string {
    return jwt.sign(
      {
        id: this.id,
        version: this.version,
      },
      process.env.JWT_SECRET!
    );
  }

  async generateResetPasswordToken() {
    this.resetPasswordToken = v4();
    await this.save();
    const resetUrl = `https://audiopub.site/reset_password/${this.resetPasswordToken}`;
    // Send email.
    await sendEmail(
      this.email,
      "Reset your password",
      `
      <p>Hello ${this.displayName},</p>
      <p>You are receiving this email because you requested to reset your password.</p>
      <p> if you didn't request this, please ignore this email.</p>
      <p> Please click the following link to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If your email client does not support clicking the link, please copy and paste the following into your browser.</p>
      <p>${resetUrl}</p>
      <p>Thanks, Audiopub</p>
      `
    );
  }

  toJSON(includeSencitiveInfo: boolean = false): UserInfo {
    return {
      id: this.id,
      name: this.name,
      email: (includeSencitiveInfo && this.email) || undefined,
      displayName: this.displayName,
      isBanned: this.isBanned,
      isVerified: this.isVerified,
      bio: this.bio || "",
    };
  }

  toClientside(): ClientsideUser {
    return {
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      isBanned: this.isBanned,
      isVerified: this.isVerified,
      isTrusted: this.isTrusted,
      bio: this.bio || "",
    };
  }

  @BeforeCreate
  static async normalizeData(user: User) {
    user.email = user.email.toLowerCase();
    user.displayName = user.name;
    user.name = user.name.toLowerCase();
    user.isTrusted = false;
  }

  @BeforeUpdate
  static async normalizeDataForUpdate(user: User) {
    user.email = user.email.toLowerCase();
    user.name = user.name.toLowerCase();
  }
}
