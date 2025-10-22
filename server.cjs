// server.cjs — стабильная версия с сохранением миксов в локальный файл
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// Telegram bot (без polling)
const bot = new TelegramBot(process.env.BOT_TOKEN || "", { polling: false });
const ADMIN_TG_IDS = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(",").map((id) => id.trim())
  : [];

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Статика
app.use(express.static(path.join(__dirname, "public")));

// ⚡ Корень — приветственная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

// Основное приложение
app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Статус API
app.get("/api/status", (req, res) => {
  res.json({ ok: true });
});

// === API для миксов через локальный файл ===

// Путь к файлу миксов
const MIXES_FILE = path.join(__dirname, "mixes.json");

// Проверка: если нет файла — создать пустой
if (!fs.existsSync(MIXES_FILE)) {
  fs.writeFileSync(MIXES_FILE, "[]", "utf-8");
  console.log("✅ Создан новый файл миксов:", MIXES_FILE);
} else {
  console.log("📂 Используется существующий файл миксов:", MIXES_FILE);
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

// Добавить новый микс
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
    console.log("💾 Сохранён новый микс:", newMix.title);
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка записи mixes.json:", err);
    res.status(500).json({ error: "Ошибка сохранения" });
  }
});

// === Уведомления админам (опционально) ===
async function notifyAdmins(message) {
  for (const id of ADMIN_TG_IDS) {
    try {
      await bot.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка Telegram:", err.message);
    }
  }
}

// === Запуск сервера ===
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}/`);
});
