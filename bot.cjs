// Minimal, safe Telegram bot to open your WebApp.
// English-only text (ASCII) and plain URL to avoid unescaped chars.
// Requires: npm i node-telegram-bot-api

const TelegramBot = require("node-telegram-bot-api");

// Put your real token here or via BOT_TOKEN env var
const TOKEN = process.env.BOT_TOKEN || "7250424426:AAFl9ngqfJ8sqtCa7Q3t3_50M0bx7JJ78YI";

if (!TOKEN || TOKEN.includes("PASTE_YOUR_BOT_TOKEN_HERE")) {
  console.error("❌ BOT_TOKEN is missing. Set it in env or put it into bot.cjs.");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name || "Guest";

  const text = `Hi ${name}! Click the button below to open Hookah Mixer.`;

  bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "Open Hookah Mixer",
            web_app: {
              // IMPORTANT:
              // 1) Plain URL (no encodeURI, no query params, no spaces)
              // 2) Must open from this button to get initData from Telegram
              url: "https://hookah-miniapp-production.up.railway.app"
            }
          }
        ]
      ],
      resize_keyboard: true
    }
  });
});

// Optional: also provide inline keyboard button (works the same)
bot.onText(/\/open/, (msg) => {
  bot.sendMessage(msg.chat.id, "Open the mini app:", {
    reply_markup: {
      inline_keyboard: [[{
        text: "Open Hookah Mixer",
        web_app: { url: "https://hookah-miniapp-production.up.railway.app" }
      }]]
    }
  });
});

bot.on("polling_error", (err) => {
  // Logs transport-level issues; not fatal for the process
  console.error("Polling error:", err.code || "", err.message || err);
});

console.log("✅ Telegram bot started. Send /start to your bot and press the button.");
