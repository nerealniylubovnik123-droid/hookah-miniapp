const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN || "ВСТАВЬ_СЮДА_СВОЙ_ТОКЕН";
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "";

  // Используем только ASCII в тексте запроса
  const messageText = `Hi ${name}! Click the button below to open Hookah Mixer.`;

  bot.sendMessage(chatId, messageText, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "Open Hookah Mixer",
            web_app: {
              url: "https://hookah-miniapp-production.up.railway.app",
            },
          },
        ],
      ],
      resize_keyboard: true,
    },
  });
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

console.log("✅ Telegram bot started. Type /start in chat.");
