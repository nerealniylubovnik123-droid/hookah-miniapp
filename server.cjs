/* server.cjs — Hookah MiniApp (Express, Railway friendly)
 * - Serves SPA from /public
 * - Provides file-based mixes API at /api/mixes
 * - Uses /mnt/data/mixes.json by default (persists on Railway volume)
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

// --- Core middlewares
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Static: ALWAYS serve from /public (Railway-safe)
const STATIC_DIR = path.join(process.cwd(), "public");
app.use(express.static(STATIC_DIR));
console.log("📂 STATIC_DIR =", STATIC_DIR);

// --- Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// --- Mixes file path (persisted on Railway)
const MIXES_PATH = process.env.MIXES_PATH || path.join("/mnt/data", "mixes.json");
console.log("📂 MIXES_PATH =", MIXES_PATH);

// Ensure mixes file exists
try {
  const dir = path.dirname(MIXES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(MIXES_PATH)) fs.writeFileSync(MIXES_PATH, "[]", "utf8");
} catch (e) {
  console.error("Failed to ensure mixes file:", e);
}

// --- API: get all mixes
app.get("/api/mixes", (_req, res) => {
  try {
    const raw = fs.readFileSync(MIXES_PATH, "utf8");
    const mixes = raw ? JSON.parse(raw) : [];
    res.json(mixes);
  } catch (e) {
    console.error("GET /api/mixes error:", e);
    res.status(500).json({ error: "Ошибка чтения файла миксов" });
  }
});

// --- API: add mix
app.post("/api/mixes", (req, res) => {
  const newMix = req.body || {};
  if (!newMix || !newMix.name) {
    return res.status(400).json({ error: "Некорректные данные микса: требуется поле name" });
  }
  try {
    const raw = fs.readFileSync(MIXES_PATH, "utf8");
    const mixes = raw ? JSON.parse(raw) : [];
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    mixes.push({ id, createdAt, ...newMix });
    fs.writeFileSync(MIXES_PATH, JSON.stringify(mixes, null, 2), "utf8");
    res.json({ success: true, id, createdAt });
  } catch (e) {
    console.error("POST /api/mixes error:", e);
    res.status(500).json({ error: "Ошибка записи файла миксов" });
  }
});

// --- Root route (serve SPA)
app.get("/", (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

// --- Fallback for non-API routes (SPA router support)
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    return res.sendFile(path.join(STATIC_DIR, "index.html"));
  }
  next();
});

// --- Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}/`);
});
