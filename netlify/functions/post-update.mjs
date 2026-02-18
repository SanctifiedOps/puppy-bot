import { getStore } from "@netlify/blobs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const messages = require("../../messages.js");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// ---------------------------------------------------------------------------
// Build a shuffled queue where no two adjacent messages share a category
// ---------------------------------------------------------------------------
function buildQueue(msgs) {
  // Group message indices by category
  const groups = {};
  msgs.forEach((msg, i) => {
    if (!groups[msg.category]) groups[msg.category] = [];
    groups[msg.category].push(i);
  });

  // Shuffle within each category
  Object.values(groups).forEach((arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  });

  // Build queue: pick from a random category that isn't the same as the last
  const queue = [];
  const categoryKeys = Object.keys(groups);
  let lastCategory = null;

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

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async () => {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.error("Missing BOT_TOKEN or CHANNEL_ID environment variables");
    return new Response("Missing env vars", { status: 500 });
  }

  // Load state from Netlify Blobs
  const store = getStore("bot-state");
  let state;

  try {
    const raw = await store.get("queue-state");
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.log("No existing state found, creating new queue.");
  }

  // If no state or queue exhausted, build a fresh queue
  if (!state || state.index >= state.queue.length) {
    const lastCategory = state?.lastCategory || null;
    const queue = buildQueue(messages);

    // If possible, ensure the first message of the new queue isn't the same
    // category as the last message of the previous queue
    if (lastCategory && messages[queue[0]]?.category === lastCategory) {
      for (let i = 1; i < queue.length; i++) {
        if (messages[queue[i]].category !== lastCategory) {
          [queue[0], queue[i]] = [queue[i], queue[0]];
          break;
        }
      }
    }

    state = { queue, index: 0, lastCategory };
    console.log("[cycle] New queue built — all messages will play before repeating.");
  }

  // Get the next message
  const msgIndex = state.queue[state.index];
  const msg = messages[msgIndex];
  state.lastCategory = msg.category;
  state.index++;

  // Save state back to blob store
  await store.set("queue-state", JSON.stringify(state));

  // Post to Telegram
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

  console.log(
    `[${state.index}/${state.queue.length}] Posted [${msg.category}]: ${msg.text.slice(0, 60)}...`
  );
  return new Response("OK");
};

export const config = {
  schedule: "*/5 * * * *",
};
