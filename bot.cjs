// bot.cjs
import { Telegraf } from "telegraf";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("❌ Missing BOT_TOKEN env variable!");

const bot = new Telegraf(BOT_TOKEN);

// --- Persistent storage (list of users who already started) ---
const FILE_PATH = "/mnt/data/started.json";
let startedUsers = new Set();

// Load existing users
try {
  if (fs.existsSync(FILE_PATH)) {
    const data = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    if (Array.isArray(data)) startedUsers = new Set(data);
  }
} catch (e) {
  console.error("Failed to read started.json:", e);
}

// Save helper
function saveStarted() {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify([...startedUsers], null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save started.json:", e);
  }
}

// --- Commands ---
bot.start(async (ctx) => {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || "Guest";

  if (!userId) return ctx.reply("Sorry, I can't detect your Telegram ID.");

  // If user is new — send WebApp button
  if (!startedUsers.has(userId)) {
    startedUsers.add(userId);
    saveStarted();

    const webAppUrl = "https://hookah-miniapp-production.up.railway.app/";

    await ctx.reply(`Welcome, ${firstName}! 👋\nOpen the Hookah Mixer below:`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Hookah Mixer",
              web_app: { url: webAppUrl },
            },
          ],
        ],
      },
    });
  } else {
    await ctx.reply("You already have access to the Hookah Mixer 😉");
  }
});

// --- Simple health check ---
bot.command("ping", (ctx) => ctx.reply("pong 🪩"));

// --- Error handling ---
bot.catch((err) => {
  console.error("Bot error:", err);
});

// --- Launch ---
bot.launch();
console.log("✅ Telegram bot started. Type /start in your chat.");

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
