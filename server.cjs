// ====== Hookah MiniApp Server ======
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== Пути хранения ======
const DATA_DIR = process.env.DATA_DIR || "/mnt/data";
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn("⚠️ Не удалось создать DATA_DIR:", e.message);
}

const PATH_MIXES = path.join(DATA_DIR, "mixes.json");
const PATH_LIBRARY = path.join(DATA_DIR, "library.json");

// зеркальные файлы в корне для видимости
const PATH_MIXES_ROOT = path.join(process.cwd(), "mixes.json");
const PATH_LIBRARY_ROOT = path.join(process.cwd(), "library.json");

// ====== Утилиты ======
function ensureFile(file, defaultData) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), "utf-8");
      console.log("🆕 Создан файл:", file);
    }
  } catch (e) {
    console.error("Ошибка создания файла:", file, e);
  }
}
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
function mirror(fileSrc, fileDst) {
  try {
    const data = fs.readFileSync(fileSrc, "utf-8");
    fs.writeFileSync(fileDst, data, "utf-8");
  } catch (e) {
    console.warn("Mirror failed:", e.message);
  }
}

// ====== Инициализация файлов ======
ensureFile(PATH_MIXES, []);
ensureFile(PATH_LIBRARY, [
  {
    id: "alfakher",
    name: "Al Fakher",
    hidden: false,
    flavors: [
      { id: "mint", name: "Mint", strength: 2, taste: "свежий, мятный", hidden: false },
      { id: "grape", name: "Grape", strength: 2, taste: "фруктовый, виноградный", hidden: false },
      { id: "double-apple", name: "Double Apple", strength: 3, taste: "анисовый, яблочный", hidden: false },
    ],
  },
  {
    id: "musthave",
    name: "Must Have",
    hidden: false,
    flavors: [
      { id: "raspberry", name: "Raspberry", strength: 3, taste: "ягодный, кисловатый", hidden: false },
      { id: "cheesecake", name: "Cheesecake", strength: 4, taste: "десертный, сливочный", hidden: false },
      { id: "whiskey-cola", name: "Whiskey Cola", strength: 5, taste: "алкогольный, кола", hidden: false },
    ],
  },
]);

console.log("📄 MIXES path:", PATH_MIXES);
console.log("📚 LIBRARY path:", PATH_LIBRARY);

// ====== Middleware ======
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ====== API ======

// === Получить все миксы ===
app.get("/api/mixes", (req, res) => {
  try {
    const list = readJsonArray(PATH_MIXES);
    res.json(list);
  } catch (err) {
    console.error("GET /api/mixes error:", err);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// === Сохранить новый микс ===
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

    const data = readJsonArray(PATH_MIXES);

    const total = parts.reduce((a, p) => a + (p.percent || 0), 0) || 1;
    const avg = Math.round(
      parts.reduce((a, p) => a + (p.percent || 0) * (p.strength || 0), 0) / total
    );

    const newMix = {
      id: String(Date.now()),
      title: mix.name.trim(),
      author: mix.author || "Гость",
      parts,
      avgStrength: avg,
      likes: 0,
    };

    data.push(newMix);
    safeWriteJson(PATH_MIXES, data);
    mirror(PATH_MIXES, PATH_MIXES_ROOT);

    console.log("💾 Микс сохранён:", newMix.title);
    res.json({ success: true, mix: newMix });
  } catch (err) {
    console.error("POST /api/mixes error:", err);
    res.status(500).json({ success: false, error: "Ошибка записи микса" });
  }
});

// === Лайк / анлайк ===
app.post("/api/mixes/:id/like", (req, res) => {
  try {
    const id = String(req.params.id);
    const delta = Number(req.body?.delta || 0);
    if (![1, -1].includes(delta)) {
      return res.status(400).json({ success: false, error: "delta должен быть +1 или -1" });
    }

    const data = readJsonArray(PATH_MIXES);
    const idx = data.findIndex(m => String(m.id) === id);
    if (idx === -1) return res.status(404).json({ success: false, error: "Микс не найден" });

    data[idx].likes = Math.max(0, (data[idx].likes || 0) + delta);
    safeWriteJson(PATH_MIXES, data);
    mirror(PATH_MIXES, PATH_MIXES_ROOT);

    res.json({ success: true, mix: data[idx] });
  } catch (err) {
    console.error("POST /api/mixes/:id/like error:", err);
    res.status(500).json({ success: false, error: "Ошибка записи лайка" });
  }
});

// === Получить библиотеку (бренды и вкусы) ===
app.get("/api/library", (req, res) => {
  try {
    const lib = readJsonArray(PATH_LIBRARY);
    res.json(lib);
  } catch (err) {
    console.error("GET /api/library error:", err);
    res.status(500).json({ error: "Ошибка чтения библиотеки" });
  }
});

// === Сохранить библиотеку (только для админа) ===
app.post("/api/library", (req, res) => {
  try {
    const lib = req.body;
    if (!Array.isArray(lib)) {
      return res.status(400).json({ success: false, error: "Неверный формат данных" });
    }
    safeWriteJson(PATH_LIBRARY, lib);
    mirror(PATH_LIBRARY, PATH_LIBRARY_ROOT);
    console.log("📚 Библиотека обновлена. Элементов:", lib.length);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/library error:", err);
    res.status(500).json({ success: false, error: "Ошибка записи библиотеки" });
  }
});

// ====== Фронтенд ======
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== Запуск ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
