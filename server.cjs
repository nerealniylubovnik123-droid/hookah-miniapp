// server.cjs — версия с рабочим сохранением миксов
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
require("dotenv").config();


const app = express();
const PORT = process.env.PORT || 8080;



// Telegram bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_TG_IDS = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(",").map((id) => id.trim())
  : [];

// SQLite (для других функций)
const dbPromise = open({
  filename: process.env.SQLITE_PATH || "./app.sqlite",
  driver: sqlite3.Database,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// =====================
// ✅ API: сохранение и загрузка миксов
// =====================
const MIXES_PATH = "/mnt/data/mixes.json";

// =====================
// ✅ API: сохранение и загрузка миксов (через SQLite)
// =====================

// Создаём таблицу, если её нет
(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      author TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
})();

// Получение всех миксов
app.get("/api/mix", async (req, res) => {
  try {
    const db = await dbPromise;
    const mixes = await db.all("SELECT * FROM mixes ORDER BY id DESC");
    res.json(mixes);
  } catch (err) {
    console.error("Ошибка чтения миксов:", err);
    res.status(500).json({ error: "Ошибка чтения миксов" });
  }
});

// Сохранение нового микса
app.post("/api/mix", async (req, res) => {
  try {
    const { title, content, author } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Название и состав обязательны" });
    }

    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO mixes (title, content, author) VALUES (?, ?, ?)",
      [title, content, author || "Гость"]
    );

    const savedMix = await db.get("SELECT * FROM mixes WHERE id = ?", [result.lastID]);

    console.log("💾 Новый микс сохранён:", savedMix.title);
    res.json({ success: true, mix: savedMix });
  } catch (err) {
    console.error("Ошибка при сохранении микса:", err);
    res.status(500).json({ error: "Ошибка сохранения микса" });
  }
});

// =====================
// Пример API для стоп-слов (осталось как у тебя)
// =====================
app.post("/api/stop-words", async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });
  const db = await dbPromise;
  await db.run("INSERT INTO stop_words (word) VALUES (?)", [word]);
  res.json({ success: true });
});

// =====================
// Telegram уведомления
// =====================
async function notifyAdmins(message) {
  for (const id of ADMIN_TG_IDS) {
    try {
      await bot.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка Telegram:", err.message);
    }
  }
}

// =====================
// Статические страницы
// =====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// Старт сервера
// =====================
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}/`);
  console.log(`📂 MIXES_PATH = ${MIXES_PATH}`);
});
