const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Раздаём статику
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

app.listen(PORT, () => console.log(`✅ Hookah MiniApp running on port ${PORT}`));
