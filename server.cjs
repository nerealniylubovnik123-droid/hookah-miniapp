const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");           // оставляю, если используется
const TelegramBot = require("node-telegram-bot-api"); // оставляю, если используется
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== Персистентный путь для Railway и fallback в корень проекта ======
const DATA_DIR = process.env.DATA_DIR || "/mnt/data";
const ROOT_MIXES = path.join(process.cwd(), "mixes.json");
const DATA_MIXES = path.join(DATA_DIR, "mixes.json");

// Убедимся, что /mnt/data создан (на Railway)
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

// Выбираем путь чтения: prefer /mnt/data, если нет — корень проекта
function resolveReadPath() {
  if (fs.existsSync(DATA_MIXES)) return DATA_MIXES;
  if (fs.existsSync(ROOT_MIXES)) return ROOT_MIXES;
  // по умолчанию читаем из /mnt/data
  return DATA_MIXES;
}

// Выбираем путь записи: сначала /mnt/data, если не удалось — корень проекта
function resolveWritePath() {
  try {
    // тестовая запись в /mnt/data
    fs.writeFileSync(path.join(DATA_DIR, ".write-test"), "ok");
    try { fs.unlinkSync(path.join(DATA_DIR, ".write-test")); } catch {}
    return DATA_MIXES;
  } catch {
    return ROOT_MIXES;
  }
}

const MIXES_PATH_READ = resolveReadPath();
const MIXES_PATH_WRITE = resolveWritePath();

console.log("📄 MIXES read from:", MIXES_PATH_READ);
console.log("✍️  MIXES write to :", MIXES_PATH_WRITE);

// ====== Остальной твой стек (оставляю, если задействован) ======
const DEV_ALLOW_UNSAFE = process.env.DEV_ALLOW_UNSAFE === "true";
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",").map(x => parseInt(x)).filter(Boolean);
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "app.sqlite");
const bot = new TelegramBot(process.env.BOT_TOKEN || "", { polling: false });
const db = new sqlite3.Database(SQLITE_PATH);

// ====== Мидлвары и статика ======
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ====== Утилиты ======
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
function safeWriteJson(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

// Нормализация для UI (единый формат)
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
    avgStrength: Number.isFinite(avg) ? avg : 0,
    likes: m.likes || 0,
  };
}

// ====== API: МИКСЫ ======

// GET: все миксы (сразу при старте клиента)
app.get("/api/mixes", (req, res) => {
  try {
    const raw = readJsonArray(MIXES_PATH_READ);
    const list = raw.map(normalizeMix);
    res.json(list);
  } catch (err) {
    console.error("Ошибка чтения mixes.json:", err);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// POST: добавить микс
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

    const data = readJsonArray(MIXES_PATH_WRITE);
    const norm = normalizeMix({ ...mix, title: mix.name, parts });

    // не сохраняем createdAt, только поля, нужные UI
    const newMix = {
      id: Date.now(),
      title: norm.title.trim(),
      author: norm.author,
      parts: norm.parts,
      avgStrength: norm.avgStrength,
      likes: 0,
    };

    data.push(newMix);
    safeWriteJson(MIXES_PATH_WRITE, data);

    console.log("💾 Микс сохранён:", newMix.title);
    res.json({ success: true, mix: newMix });
  } catch (err) {
    console.error("Ошибка сохранения микса:", err);
    res.status(500).json({ success: false, error: "Ошибка записи в файл mixes.json" });
  }
});

// POST: лайк/анлайк (лайки общие для всех)
app.post("/api/mixes/:id/like", (req, res) => {
  try {
    const id = String(req.params.id);
    const delta = Number(req.body?.delta || 0); // +1 или -1
    if (![1, -1].includes(delta)) {
      return res.status(400).json({ success: false, error: "delta должен быть +1 или -1" });
    }

    const data = readJsonArray(MIXES_PATH_WRITE).map(normalizeMix);
    const idx = data.findIndex(m => String(m.id) === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: "Микс не найден" });
    }

    const nextLikes = Math.max(0, (data[idx].likes || 0) + delta);
    data[idx].likes = nextLikes;

    safeWriteJson(MIXES_PATH_WRITE, data);
    res.json({ success: true, mix: data[idx] });
  } catch (err) {
    console.error("Ошибка лайка:", err);
    res.status(500).json({ success: false, error: "Ошибка записи лайка" });
  }
});

// ====== Фронтенд ======
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
