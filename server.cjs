// ===== Hookah MiniApp Local Server =====
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 8080;

// ===== Paths =====
const DATA_MIXES = path.join(__dirname, "mixes.json");
const DATA_LIBRARY = path.join(__dirname, "library.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// ===== Utils =====
function ensureFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), "utf-8");
    console.log("🆕 Created file:", file);
  }
}
function readJson(file) {
  try {
    const txt = fs.readFileSync(file, "utf-8");
    return JSON.parse(txt || "[]");
  } catch (e) {
    console.error("Read error:", file, e.message);
    return [];
  }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ===== Init files =====
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

// ===== API: mixes =====
app.get("/api/mixes", (req, res) => {
  try { res.json(readJson(DATA_MIXES)); }
  catch { res.status(500).json({ error: "Ошибка чтения миксов" }); }
});

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
    const avg = Math.round(parts.reduce((a, b) => a + (b.percent || 0) * (b.strength || 0), 0) / total);
    const mix = { id: String(Date.now()), title: name, author, parts, avgStrength: avg, likes: 0 };
    mixes.push(mix);
    writeJson(DATA_MIXES, mixes);
    console.log("💾 Mix saved:", mix.title);
    res.json({ success: true, mix });
  } catch (err) {
    console.error("POST /api/mixes error", err.message);
    res.status(500).json({ success: false, error: "Ошибка записи микса" });
  }
});

app.post("/api/mixes/:id/like", (req, res) => {
  try {
    const id = String(req.params.id);
    const delta = Number(req.body?.delta || 0);
    if (![1, -1].includes(delta)) return res.status(400).json({ success: false, error: "delta must be +1 or -1" });
    const mixes = readJson(DATA_MIXES);
    const idx = mixes.findIndex(m => String(m.id) === id);
    if (idx === -1) return res.status(404).json({ success: false, error: "mix not found" });
    mixes[idx].likes = Math.max(0, (mixes[idx].likes || 0) + delta);
    writeJson(DATA_MIXES, mixes);
    res.json({ success: true, mix: mixes[idx] });
  } catch (err) {
    console.error("like error", err.message);
    res.status(500).json({ success: false });
  }
});

// ===== API: library (brands & flavors) =====
app.get("/api/library", (req, res) => {
  try { res.json(readJson(DATA_LIBRARY)); }
  catch { res.status(500).json({ error: "Ошибка чтения библиотеки" }); }
});
app.post("/api/library", (req, res) => {
  try {
    const lib = req.body;
    if (!Array.isArray(lib)) return res.status(400).json({ success: false, error: "bad format" });
    writeJson(DATA_LIBRARY, lib);
    console.log("📚 Library saved:", lib.length, "brands");
    res.json({ success: true });
  } catch (err) {
    console.error("library save error", err.message);
    res.status(500).json({ success: false });
  }
});

// ===== Frontend =====
app.get("*", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

// ===== Start =====
app.listen(PORT, () => console.log(`🚀 Hookah MiniApp Server running on port ${PORT}`));
