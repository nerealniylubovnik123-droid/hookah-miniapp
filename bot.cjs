const TelegramBot = require("node-telegram-bot-api");
const TOKEN = process.env.BOT_TOKEN || "ТОКЕН_ТВОЕГО_БОТА"; // вставь сюда токен, если не используешь переменные окружения

const bot = new TelegramBot(TOKEN, { polling: true });

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || "";
  bot.sendMessage(chatId, `Привет, ${firstName}! 👋\nВыбери, что хочешь сделать:`, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "🎨 Открыть кальянный миксер",
            web_app: {
              url: "https://hookah-miniapp-production.up.railway.app",
            },
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
});

// Просто для проверки, что бот работает
console.log("✅ Telegram bot started");
