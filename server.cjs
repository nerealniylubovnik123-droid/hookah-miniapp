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

const DATA_DIR = process.env.DATA_DIR || "/mnt/data";
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("Не удалось создать DATA_DIR:", DATA_DIR, e);
  }
}
const MIXES_PATH = path.join(DATA_DIR, "mixes.json");

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "app.sqlite");
const bot = new TelegramBot(process.env.BOT_TOKEN || "", { polling: false });
const db = new sqlite3.Database(SQLITE_PATH);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// === МИКСЫ ===

// безопасное чтение JSON
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

// нормализация старых записей
function normalizeMix(m) {
  const parts = m.parts || m.flavors || [];
  const total = parts.reduce((a, p) => a + (p.percent || 0), 0) || 1;
  const avg = Math.round(
    parts.reduce((a, p) => a + (p.percent || 0) * (p.strength || 0), 0) / total
  );

  return {
    id: m.id || Date.now(),
    title: m.title || m.name || "Без названия",
    author: m.author || "Гость",
    parts,
    avgStrength: avg || 0,
    likes: m.likes || 0,
  };
}

// === Получение миксов ===
app.get("/api/mixes", (req, res) => {
  try {
    const list = readJsonArray(MIXES_PATH).map(normalizeMix);
    res.json(list);
  } catch (err) {
    console.error("Ошибка чтения mixes.json:", err);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// === Добавление микса ===
app.post("/api/mixes", (req, res) => {
  try {
    const mix = req.body || {};
    const parts = Array.isArray(mix.parts)
      ? mix.parts
      : Array.isArray(mix.flavors)
      ? mix.flavors
      : [];

    if (!mix.name || parts.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Некорректный формат данных" });
    }

    const data = readJsonArray(MIXES_PATH);
    const total = parts.reduce((a, p) => a + (p.percent || 0), 0) || 1;
    const avg = Math.round(
      parts.reduce((a, p) => a + (p.percent || 0) * (p.strength || 0), 0) /
        total
    );

    const newMix = {
      id: Date.now(),
      title: mix.name.trim(),
      author: mix.author || "Гость",
      parts,
      avgStrength: avg,
      likes: 0,
    };

    data.push(newMix);
    fs.writeFileSync(MIXES_PATH, JSON.stringify(data, null, 2), "utf-8");

    console.log("💾 Микс сохранён:", newMix.title);
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка сохранения микса:", err);
    res.status(500).json({ success: false, error: "Ошибка записи в файл mixes.json" });
  }
});

// === Остальные роуты ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📄 Путь хранения миксов: ${MIXES_PATH}`);
});
