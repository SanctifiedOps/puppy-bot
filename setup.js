/**
 * Setup helper — discovers your channel's chat ID.
 *
 * How to use:
 *   1. Make sure BarkingPupBot is added as an admin to your channel.
 *   2. Send ANY message in the channel.
 *   3. Run: node setup.js
 *   4. Copy the chat ID it prints and paste it into your .env file.
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("ERROR: BOT_TOKEN not set in .env");
  process.exit(1);
}

console.log("Fetching recent updates to find your channel ID...\n");

const bot = new TelegramBot(token);

bot.getUpdates(0, 100, 0).then((updates) => {
  if (!updates.length) {
    console.log("No updates found. Make sure you:");
    console.log("  1. Added the bot as an admin to your channel");
    console.log("  2. Sent at least one message in the channel AFTER adding the bot");
    console.log("\nThen run this script again.");
    process.exit(0);
  }

  const channels = new Map();

  for (const update of updates) {
    const msg =
      update.message ||
      update.channel_post ||
      update.my_chat_member?.chat;

    if (!msg) continue;

    const chat = msg.chat || msg;
    if (chat && chat.id) {
      channels.set(chat.id, {
        id: chat.id,
        title: chat.title || chat.first_name || "Unknown",
        type: chat.type,
      });
    }
  }

  if (!channels.size) {
    console.log("No channel/group chats found in updates.");
    console.log("Send a message in your channel and run this again.");
    process.exit(0);
  }

  console.log("Found the following chats:\n");
  for (const [id, info] of channels) {
    console.log(`  Title: ${info.title}`);
    console.log(`  Type:  ${info.type}`);
    console.log(`  ID:    ${id}`);
    console.log();
  }

  console.log("Copy the correct CHANNEL_ID into your .env file.");
  process.exit(0);
});
