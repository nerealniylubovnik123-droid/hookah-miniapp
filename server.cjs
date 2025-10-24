// ===== Hookah MiniApp Server v2 (with banned.json) =====
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 8080;

const DATA_MIXES = path.join(__dirname, "mixes.json");
const DATA_LIBRARY = path.join(__dirname, "library.json");
const DATA_BANNED = path.join(__dirname, "banned.json");
const PUBLIC_DIR = path.join(__dirname, "public");

function ensureFile(file, defaultData) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), "utf-8");
      console.log("🆕 Created file:", file);
    }
  } catch (err) {
    console.error("❌ ensureFile error:", err.message);
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
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    console.log("✅ Saved:", file);
  } catch (err) {
    console.error("❌ Write error:", file, err.message);
  }
}

ensureFile(DATA_MIXES, []);
ensureFile(DATA_LIBRARY, []);
ensureFile(DATA_BANNED, []);

app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

// MIXES
app.get("/api/mixes", (req, res) => res.json(readJson(DATA_MIXES)));
app.post("/api/mixes", (req, res) => {
  const body = req.body || {};
  const name = (body.name || "").trim();
  const author = (body.author || "Гость").trim();
  const parts = body.flavors || body.parts || [];
  if (!name || !Array.isArray(parts) || !parts.length)
    return res.status(400).json({ success: false, error: "bad data" });
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
    likes: 0,
  };
  mixes.push(mix);
  writeJson(DATA_MIXES, mixes);
  res.json({ success: true, mix });
});
app.post("/api/mixes/:id/like", (req, res) => {
  const id = String(req.params.id);
  const delta = Number(req.body?.delta || 0);
  if (![1, -1].includes(delta))
    return res.status(400).json({ success: false, error: "bad delta" });
  const mixes = readJson(DATA_MIXES);
  const idx = mixes.findIndex((m) => String(m.id) === id);
  if (idx === -1) return res.status(404).json({ success: false });
  mixes[idx].likes = Math.max(0, (mixes[idx].likes || 0) + delta);
  writeJson(DATA_MIXES, mixes);
  res.json({ success: true, mix: mixes[idx] });
});

// LIBRARY
app.get("/api/library", (req, res) => res.json(readJson(DATA_LIBRARY)));
app.post("/api/library", (req, res) => {
  const lib = req.body;
  if (!Array.isArray(lib))
    return res.status(400).json({ success: false, error: "bad data" });
  writeJson(DATA_LIBRARY, lib);
  res.json({ success: true });
});

// BANNED
app.get("/api/banned", (req, res) => res.json(readJson(DATA_BANNED)));
app.post("/api/banned", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list))
    return res.status(400).json({ success: false, error: "bad data" });
  writeJson(DATA_BANNED, list);
  res.json({ success: true });
});

// FRONT
app.get("*", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
