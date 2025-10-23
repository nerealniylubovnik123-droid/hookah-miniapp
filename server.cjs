import express from "express";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DEV_ALLOW_UNSAFE = process.env.DEV_ALLOW_UNSAFE === "true";
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "").split(",").map(x => parseInt(x));
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, "app.sqlite");

const bot = new TelegramBot(process.env.BOT_TOKEN || "", { polling: false });
const db = new sqlite3.Database(SQLITE_PATH);

// === Мидлвары ===
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// === API: сохранение и чтение миксов из локального файла mixes.json ===
const MIXES_PATH = path.join(process.cwd(), "mixes.json");

// --- Получение всех миксов ---
app.get("/api/mixes", (req, res) => {
  try {
    if (!fs.existsSync(MIXES_PATH)) fs.writeFileSync(MIXES_PATH, "[]", "utf-8");
    const data = fs.readFileSync(MIXES_PATH, "utf-8");
    const mixes = JSON.parse(data || "[]");
    res.json(mixes);
  } catch (err) {
    console.error("Ошибка чтения mixes.json:", err);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// --- Добавление нового микса ---
app.post("/api/mixes", (req, res) => {
  try {
    const mix = req.body;
    if (!mix || !mix.name || !Array.isArray(mix.flavors)) {
      return res.status(400).json({ success: false, error: "Некорректный формат данных" });
    }

    const data = fs.existsSync(MIXES_PATH)
      ? JSON.parse(fs.readFileSync(MIXES_PATH, "utf-8") || "[]")
      : [];

    const newMix = {
      ...mix,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };

    data.push(newMix);
    fs.writeFileSync(MIXES_PATH, JSON.stringify(data, null, 2), "utf-8");

    console.log("💾 Новый микс сохранён:", newMix.name);
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка сохранения микса:", err);
    res.status(500).json({ success: false, error: "Ошибка записи в файл" });
  }
});

// === Остальные API (из твоего проекта) ===
// примеры: /api/stop-words, /api/suppliers, /api/orders и др.
// они остаются без изменений — вся логика Telegram и SQLite сохраняется

// === Фронтенд ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Запуск ===
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
