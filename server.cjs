// ========================
// Hookah MiniApp Server
// ========================

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// Telegram Bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_TG_IDS = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(",").map((id) => id.trim())
  : [];

// SQLite (если используется)
const dbPromise = open({
  filename: process.env.SQLITE_PATH || "./app.sqlite",
  driver: sqlite3.Database,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// ===================================================
// 📦 МИКСЫ — хранение в JSON файле (постоянно в /mnt/data)
// ===================================================
const MIXES_FILE = process.env.MIXES_PATH || path.join("/mnt/data", "mixes.json");

// Проверяем наличие файла при запуске
if (!fs.existsSync(MIXES_FILE)) {
  try {
    fs.writeFileSync(MIXES_FILE, "[]", "utf8");
    console.log("✅ Создан новый файл миксов:", MIXES_FILE);
  } catch (err) {
    console.error("❌ Не удалось создать файл миксов:", err);
  }
}

// Получение всех миксов
app.get("/api/mix", (req, res) => {
  try {
    const data = fs.readFileSync(MIXES_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("Ошибка чтения миксов:", err);
    res.status(500).json({ error: "Не удалось загрузить миксы" });
  }
});

// Добавление нового микса
app.post("/api/mix", (req, res) => {
  try {
    const data = fs.readFileSync(MIXES_FILE, "utf8");
    const mixes = JSON.parse(data);

    const newMix = {
      id: Date.now(),
      title: req.body.title || "Без названия",
      author: req.body.author || "Гость",
      content: req.body.content || "",
      date: new Date().toISOString(),
    };

    mixes.push(newMix);
    fs.writeFileSync(MIXES_FILE, JSON.stringify(mixes, null, 2), "utf8");

    console.log("💾 Новый микс сохранён:", newMix.title);
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка сохранения микса:", err);
    res.status(500).json({ error: "Не удалось сохранить микс" });
  }
});

// ===================================================
// 🛠️ Другие API (пример — стоп-слова, статус, админ)
// ===================================================

// Пример: статус API
app.get("/api/status", (req, res) => {
  res.json({ ok: true });
});

// Пример: добавление стоп-слова
app.post("/api/stop-words", async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });
  const db = await dbPromise;
  await db.run("INSERT INTO stop_words (word) VALUES (?)", [word]);
  res.json({ success: true });
});

// Уведомление админам
async function notifyAdmins(message) {
  for (const id of ADMIN_TG_IDS) {
    try {
      await bot.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка Telegram:", err.message);
    }
  }
}

// ===================================================
// Запуск сервера
// ===================================================
app.listen(PORT, () => {
  console.log("✅ Server started on port", PORT);
  console.log("🌐 Open: http://localhost:" + PORT);
  console.log("📂 Файл миксов:", MIXES_FILE);
});
