const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN || "7250424426:AAFl9ngqfJ8sqtCa7Q3t3_50M0bx7JJ78YI";
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "Guest";

  const text = `Hi ${name}! Click the button below to open Hookah Mixer.`;

  bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open Hookah Mixer",
            web_app: {
              url: "https://hookah-miniapp-production.up.railway.app"
            }
          }
        ]
      ]
    }
  });
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.code, err.message);
});

console.log("✅ Telegram bot started. Type /start in your chat.");
