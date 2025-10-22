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

// Чтение миксов
app.get("/api/mix", (req, res) => {
  try {
    if (fs.existsSync(MIXES_PATH)) {
      const data = fs.readFileSync(MIXES_PATH, "utf8");
      const mixes = JSON.parse(data || "[]");
      res.json(mixes);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Ошибка чтения миксов:", err);
    res.status(500).json({ error: "Ошибка чтения миксов" });
  }
});

// Сохранение нового микса
app.post("/api/mix", (req, res) => {
  const { title, content, author } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Название и состав обязательны" });
  }

  try {
    let mixes = [];
    if (fs.existsSync(MIXES_PATH)) {
      const data = fs.readFileSync(MIXES_PATH, "utf8");
      mixes = JSON.parse(data || "[]");
    }

    const newMix = {
      id: Date.now(),
      title,
      content,
      author: author || "Гость",
      createdAt: new Date().toISOString(),
    };

    mixes.push(newMix);
    fs.writeFileSync(MIXES_PATH, JSON.stringify(mixes, null, 2));

    console.log("💾 Новый микс сохранён:", newMix.title);
    res.json({ success: true, mix: newMix });
  } catch (err) {
    console.error("Ошибка при сохранении микса:", err);
    res.status(500).json({ error: "Ошибка при сохранении микса" });
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
