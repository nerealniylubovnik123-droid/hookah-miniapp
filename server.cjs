const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

const DEV_ALLOW_UNSAFE = process.env.DEV_ALLOW_UNSAFE === "true";
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((x) => parseInt(x))
  .filter(Boolean);

// 🔸 Пишем данные на persistent volume (Railway): /mnt/data
const DATA_DIR = process.env.DATA_DIR || "/mnt/data";
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {
    console.error("Не удалось создать DATA_DIR:", DATA_DIR, e);
  }
}
const MIXES_PATH = path.join(DATA_DIR, "mixes.json");

// Если у тебя реально используется SQLite и бот — оставляю без изменений
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "app.sqlite");
const bot = new TelegramBot(process.env.BOT_TOKEN || "", { polling: false });
const db = new sqlite3.Database(SQLITE_PATH);

// === Мидлвары ===
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Утилита: безопасно читать JSON
function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf-8");
    const txt = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(txt || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("readJsonArray error:", e);
    return [];
  }
}

// Нормализация: чтобы и старый, и новый фронт были довольны
function withBothFields(mix) {
  const parts = Array.isArray(mix.parts) ? mix.parts
               : Array.isArray(mix.flavors) ? mix.flavors
               : [];
  const flavors = Array.isArray(mix.flavors) ? mix.flavors : parts;
  return { ...mix, parts, flavors };
}

// --- Получение всех миксов ---
app.get("/api/mixes", (req, res) => {
  try {
    const list = readJsonArray(MIXES_PATH).map(withBothFields);
    res.json(list);
  } catch (err) {
    console.error("Ошибка чтения mixes.json:", err);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// --- Добавление нового микса ---
app.post("/api/mixes", (req, res) => {
  try {
    const mix = req.body || {};
    const candidateParts = Array.isArray(mix.parts) ? mix.parts
                        : Array.isArray(mix.flavors) ? mix.flavors
                        : [];

    if (!mix || !mix.name || candidateParts.length === 0) {
      return res.status(400).json({ success: false, error: "Некорректный формат данных (name, parts/flavors обязательны)" });
    }

    const data = readJsonArray(MIXES_PATH);

    const newMix = withBothFields({
      ...mix,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    });

    data.push(newMix);

    // 🔒 Простая «атомарность»: сначала пишем во временный файл, потом переименовываем
    const tmp = MIXES_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, MIXES_PATH);

    console.log("💾 Новый микс сохранён:", newMix.name, "в", MIXES_PATH);
    res.json({ success: true, mix: newMix });
  } catch (err) {
    console.error("Ошибка сохранения микса:", err);
    res.status(500).json({ success: false, error: "Ошибка записи в файл mixes.json" });
  }
});

// === Остальные твои API/роуты (бот, заявки, поставщики и т.п.) оставляю как есть ===

// === Фронтенд ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Запуск ===
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📄 Путь хранения миксов: ${MIXES_PATH}`);
});
