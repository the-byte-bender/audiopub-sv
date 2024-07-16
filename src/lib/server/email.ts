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
