const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_TG_IDS = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(",").map((id) => id.trim())
  : [];

// SQLite подключение
const dbPromise = open({
  filename: process.env.SQLITE_PATH || "./app.sqlite",
  driver: sqlite3.Database,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Раздача статики
app.use(express.static(path.join(__dirname, "public")));

// ✅ Главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === API для миксов через файл ===
import fs from "fs";
const MIXES_FILE = process.env.MIXES_PATH || "/mnt/data/mixes.json";

// Проверяем, есть ли файл, если нет — создаём пустой
if (!fs.existsSync(MIXES_FILE)) {
  fs.writeFileSync(MIXES_FILE, "[]", "utf-8");
}

// Получить все миксы
app.get("/api/mix", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(MIXES_FILE, "utf-8"));
    res.json(data);
  } catch (err) {
    console.error("Ошибка чтения mixes.json:", err);
    res.json([]);
  }
});

// Добавить микс
app.post("/api/mix", (req, res) => {
  const { title, author, content } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: "Отсутствуют данные" });
  }

  try {
    const data = JSON.parse(fs.readFileSync(MIXES_FILE, "utf-8"));
    const newMix = {
      id: Date.now(),
      title,
      author,
      content,
      createdAt: new Date().toISOString(),
    };
    data.unshift(newMix);
    fs.writeFileSync(MIXES_FILE, JSON.stringify(data, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка записи mixes.json:", err);
    res.status(500).json({ error: "Ошибка сохранения" });
  }
});

// 🔹 Создаём таблицы, если их нет
(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS stop_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      author TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
})();

// ✅ API — получить все миксы
app.get("/api/mix", async (req, res) => {
  try {
    const db = await dbPromise;
    const mixes = await db.all("SELECT * FROM mixes ORDER BY id DESC");
    res.json(mixes);
  } catch (err) {
    console.error("Ошибка при получении миксов:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// ✅ API — добавить новый микс
app.post("/api/mix", async (req, res) => {
  try {
    const { title, author, content } = req.body;
    if (!title || !author || !content)
      return res.status(400).json({ error: "Missing data" });
    const db = await dbPromise;
    await db.run(
      "INSERT INTO mixes (title, author, content) VALUES (?, ?, ?)",
      [title, author, content]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка при добавлении микса:", err);
    res.status(500).json({ error: "DB insert error" });
  }
});

// ✅ API — стоп-слова (без изменений)
app.post("/api/stop-words", async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });
  const db = await dbPromise;
  await db.run("INSERT INTO stop_words (word) VALUES (?)", [word]);
  res.json({ success: true });
});

// ✅ Проверка статуса
app.get("/api/status", (req, res) => res.json({ ok: true }));

// --- API для миксов ---
app.get("/api/mix", async (req, res) => {
  const db = await dbPromise;
  const mixes = await db.all("SELECT * FROM mixes ORDER BY id DESC");
  res.json(mixes);
});

app.post("/api/mix", async (req, res) => {
  const { title, author, content } = req.body;
  if (!title || !author) return res.status(400).json({ error: "Missing data" });

  const db = await dbPromise;
  await db.run(
    "CREATE TABLE IF NOT EXISTS mixes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, author TEXT, content TEXT, createdAt INTEGER)"
  );

  await db.run(
    "INSERT INTO mixes (title, author, content, createdAt) VALUES (?, ?, ?, ?)",
    [title, author, content, Date.now()]
  );

  res.json({ success: true });
});

// ✅ Уведомление админам
async function notifyAdmins(message) {
  for (const id of ADMIN_TG_IDS) {
    try {
      await bot.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка Telegram:", err.message);
    }
  }
}

// ✅ Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});
