import { createRequire } from "module";
const require = createRequire(import.meta.url);
const messages = require("../../messages.js");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

export default async () => {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.error("Missing BOT_TOKEN or CHANNEL_ID environment variables");
    return new Response("Missing env vars", { status: 500 });
  }

  const msg = messages[Math.floor(Math.random() * messages.length)];

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: msg.text,
        disable_web_page_preview: false,
      }),
    }
  );

  const data = await res.json();

  if (!data.ok) {
    console.error("Telegram API error:", data);
    return new Response("Failed to post", { status: 500 });
  }

  console.log(`Posted [${msg.category}]: ${msg.text.slice(0, 60)}...`);
  return new Response("OK");
};

export const config = {
  schedule: "*/5 * * * *",
};
