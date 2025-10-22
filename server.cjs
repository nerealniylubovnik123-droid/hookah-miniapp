import express from "express";
import path from "path";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

// Настройка Telegram
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_TG_IDS = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(",").map(id => id.trim())
  : [];

// Настройка базы данных SQLite
const dbPromise = open({
  filename: process.env.SQLITE_PATH || "./app.sqlite",
  driver: sqlite3.Database,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Раздача статических файлов из папки public
app.use(express.static(path.join(__dirname, "public")));

// ⚡ Приоритетная загрузка welcome.html при открытии корня
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

// API пример (оставь свои эндпоинты)
app.get("/api/status", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

// Пример API для стоп-слов (если используется)
app.post("/api/stop-words", async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });

  const db = await dbPromise;
  await db.run("INSERT INTO stop_words (word) VALUES (?)", [word]);

  res.json({ success: true });
});

// Telegram уведомления (пример)
async function notifyAdmins(text) {
  for (const id of ADMIN_TG_IDS) {
    try {
      await bot.sendMessage(id, text, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка Telegram:", err.message);
    }
  }
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}/`);
});
