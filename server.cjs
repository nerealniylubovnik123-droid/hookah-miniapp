const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const ADMIN_TG_IDS = process.env.ADMIN_TG_IDS
  ? process.env.ADMIN_TG_IDS.split(",").map(id => id.trim())
  : [];

const dbPromise = open({
  filename: process.env.SQLITE_PATH || "./app.sqlite",
  driver: sqlite3.Database,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/stop-words", async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });
  const db = await dbPromise;
  await db.run("INSERT INTO stop_words (word) VALUES (?)", [word]);
  res.json({ success: true });
});

app.get("/api/status", (req, res) => {
  res.json({ ok: true });
});

async function notifyAdmins(message) {
  for (const id of ADMIN_TG_IDS) {
    try {
      await bot.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Ошибка Telegram:", err.message);
    }
  }
}

app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});
