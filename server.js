// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { parsePlayerFile } = require("./playerParser");

const multer = require("multer");        
const axios = require("axios");          
const FormData = require("form-data");   


const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");

// Multer-configuratie voor uploaden van screenshots (.tga) in geheugen
const upload = multer({
  storage: multer.memoryStorage(),             // sla bestand in RAM op, niet op schijf
  limits: { fileSize: 10 * 1024 * 1024 },      // max 10 MB
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith(".tga")) {
      // alleen .tga toestaan
      return cb(new Error("Only .tga files are allowed"));
    }
    cb(null, true);
  },
});

// Lees de Discord webhook-URL uit .env
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;


// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, "public")));



// API: list all players (based on .txt files in /data)
app.get("/api/players", async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const players = files
      .filter((file) => file.toLowerCase().endsWith(".txt"))
      .map((file) => path.basename(file, ".txt"));
    res.json(players);
  } catch (err) {
    console.error("Error in /api/players:", err);
    res.status(500).json({ error: "Could not load player list" });
  }
});

// API: single player stats
app.get("/api/player/:name", async (req, res) => {
  const playerName = req.params.name;
  const filePath = path.join(DATA_DIR, `${playerName}.txt`);

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = parsePlayerFile(raw);
    res.json(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "Player not found" });
    }
    console.error("Error in /api/player:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ API: sessions overview per player
app.get("/api/sessions", async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const txtFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".txt")
    );

    const sessions = [];

    for (const file of txtFiles) {
      try {
        const fullPath = path.join(DATA_DIR, file);
        const raw = await fs.readFile(fullPath, "utf-8");
        const data = parsePlayerFile(raw);

        const userinfo = data.userinfo || {};
        const session = data.session || {};

        const joinParts = [];
        if (session.join_date) joinParts.push(session.join_date);
        if (session.join_time) joinParts.push(session.join_time);
        const join = joinParts.join(" ").trim();

        const leaveParts = [];
        if (session.leave_date) leaveParts.push(session.leave_date);
        if (session.leave_time) leaveParts.push(session.leave_time);
        const leave = leaveParts.join(" ").trim();

        sessions.push({
          filename: path.basename(file, ".txt"),
          name: userinfo.name || path.basename(file, ".txt"),
          connection_state: userinfo.connection_state || "",
          ip: userinfo.ip || "",
          rate:
            typeof userinfo.rate !== "undefined" ? userinfo.rate : "",
          snaps:
            typeof userinfo.snaps !== "undefined" ? userinfo.snaps : "",
          ping:
            typeof userinfo.ping !== "undefined" ? userinfo.ping : "",
          allies_model: userinfo.allies_model || "",
          axis_model: userinfo.axis_model || "",
          game_version: userinfo.game_version || "",
          join,
          leave,
        });
      } catch (innerErr) {
        console.error(
          "Error parsing file for /api/sessions:",
          file,
          innerErr
        );
        // we slaan deze speler over, maar crashen niet
      }
    }

    res.json(sessions);
  } catch (err) {
    console.error("Error in /api/sessions:", err);
    res.status(500).json({ error: "Could not load sessions overview" });
  }
});

// API: overzicht met stats per speler voor de Statistics-tabel
app.get("/api/player-overview", async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const txtFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".txt")
    );

    const players = [];

    for (const file of txtFiles) {
      try {
        const fullPath = path.join(DATA_DIR, file);
        const raw = await fs.readFile(fullPath, "utf-8");
        const data = parsePlayerFile(raw);

        const userinfo = data.userinfo || {};
        const session = data.session || {};
        const combat = data.combat || {};
        const bodyLocations = data["body_locations"] || {};
        const freezeTag = data["freeze_tag"] || {};

        players.push({
          filename: path.basename(file, ".txt"),
          name: userinfo.name || path.basename(file, ".txt"),
          kills: combat.kills ?? 0,
          deaths: combat.deaths ?? 0,
          kdr: combat.kdr ?? 0,
          headshots: bodyLocations.headshots ?? 0,
          damage: combat.damage ?? 0,
          melts: freezeTag.melts ?? 0,
          total_play_time: session.total_play_time || "",
        });
      } catch (innerErr) {
        console.error("Error parsing file for /api/player-overview:", file, innerErr);
        // fout in 1 speler -> sla die over maar ga door
      }
    }

    res.json(players);
  } catch (err) {
    console.error("Error in /api/player-overview:", err);
    res.status(500).json({ error: "Could not load player overview" });
  }
});

// ✅ API: upload screenshot en stuur naar Discord via webhook
app.post(
  "/api/upload-screenshot",
  upload.single("screenshot"), // "screenshot" = naam van je <input name="screenshot">
  async (req, res) => {
    try {
      // 1. Bestaat er een bestand?
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      // 2. Hebben we een webhook?
      if (!DISCORD_WEBHOOK_URL) {
        console.error("No DISCORD_WEBHOOK_URL set in .env");
        return res
          .status(500)
          .json({ error: "Server misconfigured (no webhook URL)." });
      }

      // 3. Form-data voor Discord opbouwen
      const form = new FormData();

      // Berichtje dat bij de upload in Discord komt
      form.append(
        "payload_json",
        JSON.stringify({
          content: `📸 New forced screenshot uploaded: **${req.file.originalname}**`,
        })
      );

      // Het daadwerkelijke bestand (buffer uit Multer)
      form.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: "image/tga",
      });

      // 4. Naar Discord sturen
      await axios.post(DISCORD_WEBHOOK_URL, form, {
        headers: form.getHeaders(),
      });

      // 5. Klaar → frontend krijgt een JSON-antwoord
      res.json({ ok: true, message: "Screenshot uploaded successfully." });
    } catch (err) {
      console.error("Error in /api/upload-screenshot:", err);

      // Specifieke foutjes die we herkennen
      if (err.message === "Only .tga files are allowed") {
        return res.status(400).json({ error: err.message });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "File is too large (max 10 MB)." });
      }

      // Algemene fallback
      res.status(500).json({ error: "Something went wrong while uploading." });
    }
  }
);


// Main page -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
