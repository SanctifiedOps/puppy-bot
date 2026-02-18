/**
 * BarkingPupBot — Telegram community update bot for Barking Puppy ($BP)
 *
 * Posts rotating community updates from the message library every N minutes.
 *
 * Usage:
 *   1. Run `node setup.js` first to get your CHANNEL_ID
 *   2. Set CHANNEL_ID in .env
 *   3. Run `node bot.js`
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const messages = require("./messages");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const POST_INTERVAL = (parseInt(process.env.POST_INTERVAL_MINUTES, 10) || 5) * 60 * 1000;

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN not set in .env");
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error("ERROR: CHANNEL_ID not set in .env");
  console.error("Run `node setup.js` first to discover your channel ID.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bot setup
// ---------------------------------------------------------------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Build a shuffled queue where no two adjacent messages share a category
let queue = buildCategoryQueue(messages);
let index = 0;

// ---------------------------------------------------------------------------
// Posting logic
// ---------------------------------------------------------------------------
function getNextMessage() {
  if (index >= queue.length) {
    const lastCategory = queue[queue.length - 1].category;
    queue = buildCategoryQueue(messages, lastCategory);
    index = 0;
    console.log("[cycle] New queue built — all messages will play before repeating.");
  }
  return queue[index++];
}

async function postUpdate() {
  const msg = getNextMessage();
  try {
    await bot.sendMessage(CHANNEL_ID, msg.text, {
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] Posted [${msg.category}]: ${msg.text.slice(0, 60)}...`);
  } catch (err) {
    console.error(`[error] Failed to post message:`, err.message);

    // If parse_mode HTML fails, retry without it
    try {
      await bot.sendMessage(CHANNEL_ID, msg.text);
      console.log(`[retry] Posted without HTML parse mode.`);
    } catch (retryErr) {
      console.error(`[error] Retry also failed:`, retryErr.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Admin commands (in private chat or group where bot is present)
// ---------------------------------------------------------------------------

// /start — greeting
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🐶 BarkingPupBot is alive!\n\nI post community updates to the Barking Puppy channel every " +
      (POST_INTERVAL / 60000) +
      " minutes.\n\nCommands:\n/status — check bot status\n/next — post the next update now\n/skip — skip current message and move to next"
  );
});

// /status — show current state
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📊 BarkingPupBot Status:\n\n` +
      `Messages in library: ${messages.length}\n` +
      `Current position: ${index} / ${queue.length}\n` +
      `Post interval: ${POST_INTERVAL / 60000} minutes\n` +
      `Channel: ${CHANNEL_ID}`
  );
});

// /next — manually trigger the next post
bot.onText(/\/next/, async (msg) => {
  await postUpdate();
  bot.sendMessage(msg.chat.id, "✅ Next update posted to channel.");
});

// /skip — skip current message
bot.onText(/\/skip/, (msg) => {
  const skipped = getNextMessage();
  bot.sendMessage(
    msg.chat.id,
    `⏭️ Skipped: [${skipped.category}] ${skipped.text.slice(0, 50)}...`
  );
});

// /preview — show next message without posting
bot.onText(/\/preview/, (msg) => {
  const peek = queue[index] || queue[0];
  bot.sendMessage(
    msg.chat.id,
    `👀 Next up [${peek.category}]:\n\n${peek.text}`
  );
});

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------
console.log("=".repeat(50));
console.log("  BarkingPupBot started!");
console.log(`  Messages: ${messages.length}`);
console.log(`  Interval: every ${POST_INTERVAL / 60000} minutes`);
console.log(`  Channel:  ${CHANNEL_ID}`);
console.log("=".repeat(50));

// Post immediately on startup
postUpdate();

// Then repeat on interval
setInterval(postUpdate, POST_INTERVAL);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildCategoryQueue(msgs, avoidCategory) {
  // Group messages by category
  const groups = {};
  msgs.forEach((msg) => {
    if (!groups[msg.category]) groups[msg.category] = [];
    groups[msg.category].push(msg);
  });

  // Shuffle within each category
  Object.values(groups).forEach((arr) => shuffleArray(arr));

  // Build queue: pick from a random category that isn't the same as the last
  const queue = [];
  const categoryKeys = Object.keys(groups);
  let lastCategory = avoidCategory || null;

  while (categoryKeys.some((k) => groups[k].length > 0)) {
    let available = categoryKeys.filter(
      (k) => groups[k].length > 0 && k !== lastCategory
    );

    // Fallback if only one category remains
    if (available.length === 0) {
      available = categoryKeys.filter((k) => groups[k].length > 0);
    }

    const cat = available[Math.floor(Math.random() * available.length)];
    queue.push(groups[cat].shift());
    lastCategory = cat;
  }

  return queue;
}
