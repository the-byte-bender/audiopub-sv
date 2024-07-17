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
import Mailgun from "mailgun-js";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
  throw new Error("Please provide a mailgun API key and domain");
}

const mailgun = new Mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});

export default function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<Mailgun.messages.SendResponse> {
  const data = {
    from: `Audiopub <noreply@${process.env.MAILGUN_DOMAIN}>`,
    to: to,
    subject,
    html: htmlContent,
  };
  return mailgun.messages().send(data);
}
