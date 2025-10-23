import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// === Мидлвары ===
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === API: управление миксами через файл mixes.json ===
const MIXES_PATH = path.join(process.cwd(), "mixes.json");

// --- Получение всех миксов ---
app.get("/api/mixes", (req, res) => {
  try {
    if (!fs.existsSync(MIXES_PATH)) {
      fs.writeFileSync(MIXES_PATH, "[]", "utf-8");
    }
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
      return res
        .status(400)
        .json({ success: false, error: "Некорректный формат данных" });
    }

    // Загружаем текущие миксы
    const data = fs.existsSync(MIXES_PATH)
      ? JSON.parse(fs.readFileSync(MIXES_PATH, "utf-8") || "[]")
      : [];

    // Добавляем ID и дату
    const newMix = {
      ...mix,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };

    // Сохраняем
    data.push(newMix);
    fs.writeFileSync(MIXES_PATH, JSON.stringify(data, null, 2), "utf-8");

    console.log("💾 Новый микс сохранён:", newMix.name);
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка сохранения микса:", err);
    res.status(500).json({ success: false, error: "Ошибка записи в файл" });
  }
});

// === Отдача фронтенда ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Запуск сервера ===
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
