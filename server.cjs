// ===== Hookah MiniApp Local Server =====
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 8080;

// ===== Папки и пути =====
const DATA_MIXES = path.join(__dirname, "mixes.json");
const DATA_LIBRARY = path.join(__dirname, "library.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// ===== Утилиты =====
function ensureFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), "utf-8");
    console.log("🆕 Создан файл:", file);
  }
}

function readJson(file) {
  try {
    const txt = fs.readFileSync(file, "utf-8");
    return JSON.parse(txt || "[]");
  } catch (e) {
    console.error("Ошибка чтения:", file, e);
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ===== Инициализация файлов =====
ensureFile(DATA_MIXES, []);
ensureFile(DATA_LIBRARY, [
  {
    id: "musthave",
    name: "Must Have",
    hidden: false,
    flavors: [
      { id: "raspberry", name: "Raspberry", strength: 3, taste: "ягодный, кисловатый", hidden: false },
      { id: "cheesecake", name: "Cheesecake", strength: 4, taste: "десертный, сливочный", hidden: false }
    ]
  },
  {
    id: "alfakher",
    name: "Al Fakher",
    hidden: false,
    flavors: [
      { id: "mint", name: "Mint", strength: 2, taste: "свежий, мятный", hidden: false },
      { id: "grape", name: "Grape", strength: 2, taste: "фруктовый, виноградный", hidden: false }
    ]
  }
]);

// ===== Middleware =====
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

// ===== API: миксы =====

// Получить все миксы
app.get("/api/mixes", (req, res) => {
  try {
    const data = readJson(DATA_MIXES);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Ошибка чтения миксов" });
  }
});

// Добавить микс
app.post("/api/mixes", (req, res) => {
  try {
    const body = req.body || {};
    const name = (body.name || "").trim();
    const author = (body.author || "Гость").trim();
    const parts = body.flavors || body.parts || [];
    if (!name || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ success: false, error: "Некорректные данные микса" });
    }

    const mixes = readJson(DATA_MIXES);
    const total = parts.reduce((a, b) => a + (b.percent || 0), 0) || 1;
    const avg = Math.round(
      parts.reduce((a, b) => a + (b.percent || 0) * (b.strength || 0), 0) / total
    );

    const mix = {
      id: String(Date.now()),
      title: name,
      author,
      parts,
      avgStrength: avg,
      likes: 0
    };

    mixes.push(mix);
    writeJson(DATA_MIXES, mixes);
    console.log("💾 Микс сохранён:", mix.title);
    res.json({ success: true, mix });
  } catch (err) {
    console.error("Ошибка POST /api/mixes", err);
    res.status(500).json({ success: false, error: "Ошибка записи микса" });
  }
});

// Лайк / анлайк
app.post("/api/mixes/:id/like", (req, res) => {
  try {
    const id = String(req.params.id);
    const delta = Number(req.body?.delta || 0);
    if (![1, -1].includes(delta)) return res.status(400).json({ success: false });

    const mixes = readJson(DATA_MIXES);
    const idx = mixes.findIndex(m => String(m.id) === id);
    if (idx === -1) return res.status(404).json({ success: false });

    mixes[idx].likes = Math.max(0, (mixes[idx].likes || 0) + delta);
    writeJson(DATA_MIXES, mixes);
    res.json({ success: true, mix: mixes[idx] });
  } catch (err) {
    console.error("Ошибка лайка:", err);
    res.status(500).json({ success: false });
  }
});

// ===== API: библиотека =====

// Получить библиотеку (бренды и вкусы)
app.get("/api/library", (req, res) => {
  try {
    const data = readJson(DATA_LIBRARY);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Ошибка чтения библиотеки" });
  }
});

// Сохранить библиотеку
app.post("/api/library", (req, res) => {
  try {
    const lib = req.body;
    if (!Array.isArray(lib)) return res.status(400).json({ success: false });
    writeJson(DATA_LIBRARY, lib);
    console.log("📚 Библиотека сохранена:", lib.length, "брендов");
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка записи библиотеки:", err);
    res.status(500).json({ success: false });
  }
});

// ===== Фронтенд =====
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ===== Запуск =====
app.listen(PORT, () => {
  console.log(`🚀 Hookah MiniApp Server running on port ${PORT}`);
});
