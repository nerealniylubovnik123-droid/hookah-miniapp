const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

// ====== Настройки путей хранения ======
const app = express();
const PORT = process.env.PORT || 3000;

// 1) Основной persist путь для Railway
const DATA_DIR = process.env.DATA_DIR || "/mnt/data";
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const PATH_DATA = path.join(DATA_DIR, "mixes.json");
// 2) Зеркальный файл в корне проекта (чтобы ты видел файл в репозитории/UI)
const PATH_ROOT = path.join(process.cwd(), "mixes.json");

// ЕДИНЫЙ путь, с которым работает приложение
// Если в корне уже есть файл — берём его как единственный источник,
// иначе — используем /mnt/data.
const SINGLE_PATH = fs.existsSync(PATH_ROOT) ? PATH_ROOT : PATH_DATA;

console.log("📄 MIXES single path:", SINGLE_PATH);
console.log("🪞 Mirror to root:", PATH_ROOT !== SINGLE_PATH ? "enabled" : "same file");

// ====== Middleware / Static ======
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
function mirrorToRootIfNeeded() {
  // После КАЖДОЙ записи зеркалим содержимое в другой файл
  try {
    if (SINGLE_PATH !== PATH_ROOT) {
      const data = fs.readFileSync(SINGLE_PATH, "utf-8");
      fs.writeFileSync(PATH_ROOT, data, "utf-8");
    }
  } catch (e) {
    console.warn("Mirror failed:", e.message);
  }
}
function normalizeMix(m) {
  const parts = m.parts || m.flavors || [];
  const total = parts.reduce((a, p) => a + (p.percent || 0), 0) || 1;
  const avg = Math.round(
    parts.reduce((a, p) => a + (p.percent || 0) * (p.strength || 0), 0) / total
  );
  return {
    id: String(m.id || Date.now()),          // СТРОКА, чтобы не было рассинхрона при сравнениях
    title: m.title || m.name || "Без названия",
    author: m.author || "Гость",
    parts,
    avgStrength: Number.isFinite(avg) ? avg : 0,
    likes: Number.isFinite(m.likes) ? m.likes : 0,
  };
}

// ====== API ======

// GET — отдать миксы (показываются при старте)
app.get("/api/mixes", (req, res) => {
  try {
    const list = readJsonArray(SINGLE_PATH).map(normalizeMix);
    res.json(list);
  } catch (err) {
    console.error("GET /api/mixes error:", err);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// POST — сохранить микс
app.post("/api/mixes", (req, res) => {
  try {
    const mix = req.body || {};
    const parts = Array.isArray(mix.parts)
      ? mix.parts
      : Array.isArray(mix.flavors)
      ? mix.flavors
      : [];

    if (!mix.name || parts.length === 0) {
      return res.status(400).json({ success: false, error: "Некорректный формат данных" });
    }

    const data = readJsonArray(SINGLE_PATH);

    // Нормализуем формат под UI
    const total = parts.reduce((a, p) => a + (p.percent || 0), 0) || 1;
    const avg = Math.round(
      parts.reduce((a, p) => a + (p.percent || 0) * (p.strength || 0), 0) / total
    );

    const newMix = {
      id: String(Date.now()),           // строковый id
      title: mix.name.trim(),
      author: mix.author || "Гость",
      parts,
      avgStrength: avg,
      likes: 0,
    };

    data.push(newMix);
    safeWriteJson(SINGLE_PATH, data);
    mirrorToRootIfNeeded();

    console.log("💾 Микс сохранён:", newMix.title, "→", SINGLE_PATH);
    res.json({ success: true, mix: newMix });
  } catch (err) {
    console.error("POST /api/mixes error:", err);
    res.status(500).json({ success: false, error: "Ошибка записи в файл миксов" });
  }
});

// POST — лайк/анлайк (лайки общие)
app.post("/api/mixes/:id/like", (req, res) => {
  try {
    const id = String(req.params.id);
    const delta = Number(req.body?.delta || 0); // +1 / -1
    if (![1, -1].includes(delta)) {
      return res.status(400).json({ success: false, error: "delta должен быть +1 или -1" });
    }

    const data = readJsonArray(SINGLE_PATH).map(normalizeMix);
    const idx = data.findIndex(m => String(m.id) === id);
    if (idx === -1) return res.status(404).json({ success: false, error: "Микс не найден" });

    data[idx].likes = Math.max(0, (data[idx].likes || 0) + delta);
    safeWriteJson(SINGLE_PATH, data);
    mirrorToRootIfNeeded();

    res.json({ success: true, mix: data[idx] });
  } catch (err) {
    console.error("POST /api/mixes/:id/like error:", err);
    res.status(500).json({ success: false, error: "Ошибка записи лайка" });
  }
});

// Фронтенд
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server on ${PORT}`);
});
