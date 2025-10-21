// === Telegram bot for Hookah MiniApp ===
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("❌ BOT_TOKEN is missing in environment variables.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// === Express server to serve WebApp ===
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Hookah MiniApp running on port ${PORT}`);
});

// === Telegram WebApp button setup ===
const WEBAPP_URL = "https://hookah-miniapp-production.up.railway.app";

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, "Добро пожаловать в кальянный миксер 👇", {
    reply_markup: {
      keyboard: [
        [
          {
            text: "Открыть миксер",
            web_app: { url: WEBAPP_URL },
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
});

// === Optional: handle WebApp data (if needed) ===
bot.on("web_app_data", (msg) => {
  console.log("📩 WebApp data received:", msg.web_app_data?.data);
});

// === Error handling ===
bot.on("polling_error", (err) => {
  console.error("Polling error:", err);
});
