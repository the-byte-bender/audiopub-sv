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
import { Sequelize } from "sequelize-typescript";
import * as dotenv from "dotenv";
import User from "./models/user";
import Audio from "./models/audio";
import Comment from "./models/comment";
import PlaysTracker from "./models/plays_tracker";
import Notification from "./models/notification";
import AudioFollow from "./models/audio_follow";
import AudioFavorite from "./models/audio_favorite";
import AudioEditHistory from "./models/audio_edit_history";
dotenv.config();

if (
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_PASSWORD
) {
    throw new Error(
        "Please set DATABASE_NAME, DATABASE_USER, and DATABASE_PASSWORD in .env file"
    );
}

const database = new Sequelize({
    database: process.env.DATABASE_NAME,
    dialect: "mariadb",
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    models: [User, Audio, Comment, PlaysTracker, Notification, AudioFollow, AudioFavorite, AudioEditHistory],
    logging: false,
    host: "127.0.0.1",
    port: 3306,
});

export default database;

export { User, Audio, Comment, PlaysTracker, Notification, AudioFollow, AudioFavorite, AudioEditHistory };
