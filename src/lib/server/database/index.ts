import { Sequelize } from "sequelize-typescript";
import * as dotenv from "dotenv";
import User from "./models/user";
import Audio from "./models/audio";
import Comment from "./models/comment";
import PlaysTracker from "./models/plays_tracker";
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
  models: [User, Audio, Comment, PlaysTracker],
  logging: false,
  host: "127.0.0.1",
  port: 3306,
});

export default database;

export { User, Audio, Comment, PlaysTracker };
