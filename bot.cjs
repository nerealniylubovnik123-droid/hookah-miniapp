const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN || "7250424426:AAFl9ngqfJ8sqtCa7Q3t3_50M0bx7JJ78YI";
const bot = new TelegramBot(TOKEN, { polling: true });

// When user sends /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "Guest";

  const text = `Hi ${name}! 👋\nClick the button below to open Hookah Mixer.`;

  bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "Open Hookah Mixer",
            web_app: {
              // ✅ Fully encoded and safe URL
              url: encodeURI("https://hookah-miniapp-production.up.railway.app"),
            },
          },
        ],
      ],
      resize_keyboard: true,
    },
  });
});

// Log polling errors clearly
bot.on("polling_error", (err) => {
  console.error("Polling error:", err.code, err.message);
});

console.log("✅ Telegram bot started successfully. Type /start in your chat!");
