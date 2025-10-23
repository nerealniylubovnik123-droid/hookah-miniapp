// server.cjs — сохранение общих миксов в mixes.json (Express, CJS)
const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// ===== Настройки путей =====
const ROOT_DIR = __dirname;                               // корень проекта (где лежит server.cjs и index.html)
const STATIC_DIR = process.env.STATIC_DIR || ROOT_DIR;    // откуда отдаём статику
const MIXES_PATH = process.env.MIXES_PATH || path.join(ROOT_DIR, "mixes.json");

// ===== Создаём mixes.json, если его нет =====
function ensureFile(filePath, initial = "[]") {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, initial, "utf8");
      console.log(`🆕 Создал файл: ${filePath}`);
    }
  } catch (e) {
    console.error("Не удалось создать файл", filePath, e);
  }
}
ensureFile(MIXES_PATH, "[]");

// ===== Миддлвары =====
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(STATIC_DIR)); // отдаём index.html, css, js, картинки из корня

// ===== Утилиты для работы с файлами =====
function readJSON(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", (err, data) => {
      if (err) return reject(err);
      try {
        const parsed = data ? JSON.parse(data) : [];
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function writeJSON(file, obj) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, JSON.stringify(obj, null, 2), "utf8", (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// =====================
// API: общие миксы
// =====================

// Получить все миксы
app.get("/api/mixes", async (req, res) => {
  try {
    const mixes = await readJSON(MIXES_PATH);
    res.json(mixes);
  } catch (e) {
    console.error("Ошибка чтения миксов:", e);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// Добавить новый микс
app.post("/api/mixes", async (req, res) => {
  try {
    const newMix = req.body || {};
    if (!newMix.name || typeof newMix.name !== "string") {
      return res.status(400).json({ error: "Поле 'name' обязательно (string)" });
    }

    // генерируем id и время создания
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const withMeta = { id, createdAt: new Date().toISOString(), ...newMix };

    const mixes = await readJSON(MIXES_PATH);
    mixes.push(withMeta);
    await writeJSON(MIXES_PATH, mixes);
    res.json({ success: true, id });
  } catch (e) {
    console.error("Ошибка записи микса:", e);
    res.status(500).json({ error: "Ошибка записи файла миксов" });
  }
});

// =====================
// (Необязательно) Пример эндпоинта для стоп-слов, чтобы ничего не сломалось на фронте
// Оставь, если фронт его вызывает. Иначе можно удалить.
// =====================
app.post("/api/stop-words", async (req, res) => {
  res.json({ success: true });
});

// =====================
// Отдача index.html по прямому заходу
// =====================
app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

// =====================
// Старт сервера
// =====================
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}/`);
  console.log(`📂 STATIC_DIR = ${STATIC_DIR}`);
  console.log(`📂 MIXES_PATH = ${MIXES_PATH}`);
});
