// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

const { parsePlayerFile } = require("./playerParser");

const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Map waar de GAME de spelersbestanden (.txt) schrijft
const PLAYERFILES_DIR = process.env.PLAYERFILES_DIR
  ? path.resolve(process.env.PLAYERFILES_DIR)
  : path.join(__dirname, "data"); // fallback voor testen

// ✅ App data (sessions_log.json + chat_logs.json) bewaren in je projectmap
const APP_DATA_DIR = path.join(__dirname, "data");
const SESSIONS_LOG_PATH = path.join(APP_DATA_DIR, "sessions_log.json");
const CHAT_LOG_PATH = path.join(APP_DATA_DIR, "chat_logs.json");

// ✅ Intervals
const STATS_REFRESH_MS = Number(process.env.STATS_REFRESH_MS || 5 * 60 * 1000);     // 5 min
const SESSIONS_REFRESH_MS = Number(process.env.SESSIONS_REFRESH_MS || 5 * 1000);   // 5 sec

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// Discord screenshot upload
// ---------------------------
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith(".tga")) return cb(new Error("Only .tga files are allowed"));
    cb(null, true);
  },
});

// ---------------------------
// Helpers
// ---------------------------
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeLower(v) {
  return String(v || "").toLowerCase().trim();
}

function isConnectedState(connection_state) {
  return safeLower(connection_state) === "connected";
}

function joinFromFile(session) {
  const a = [];
  if (session.join_date) a.push(session.join_date);
  if (session.join_time) a.push(session.join_time);
  return a.join(" ").trim();
}

function leaveFromFile(session) {
  const a = [];
  if (session.leave_date) a.push(session.leave_date);
  if (session.leave_time) a.push(session.leave_time);
  const leave = a.join(" ").trim();
  if (leave) return leave;

  const b = [];
  if (session.last_seen_date) b.push(session.last_seen_date);
  if (session.last_seen_time) b.push(session.last_seen_time);
  return b.join(" ").trim();
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function writeJsonAtomic(filePath, obj) {
  const tmp = filePath + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), "utf-8");
  await fsp.rename(tmp, filePath);
}

// Medal of Honor "typed wrapper" -> plain JS (werkt ook als het al plain JSON is)
function unwrap(node) {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(unwrap);

  if (typeof node === "object" && "type" in node && "content" in node) {
    const { type, content } = node;

    if (type === "integer" || type === "float") return Number(content);
    if (type === "string") return String(content);
    if (type === "boolean") return Boolean(content);

    if (type === "array_object" || type === "object") {
      const out = {};
      for (const [k, v] of Object.entries(content || {})) out[k] = unwrap(v);
      return out;
    }

    return unwrap(content);
  }

  if (typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = unwrap(v);
    return out;
  }

  return node;
}

// ---------------------------
// Parsed file cache (mtime-based)
// ---------------------------
const fileCache = new Map(); // fileName -> {mtimeMs, parsed}

async function readParsed(fileName) {
  const fullPath = path.join(PLAYERFILES_DIR, fileName);
  const st = await fsp.stat(fullPath);

  const cached = fileCache.get(fileName);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.parsed;

  const raw = await fsp.readFile(fullPath, "utf-8");
  const parsed = parsePlayerFile(raw);

  fileCache.set(fileName, { mtimeMs: st.mtimeMs, parsed });
  return parsed;
}

// ---------------------------
// API caches
// ---------------------------
let cachePlayers = []; // statistics tabel (GET /api/getplayers)

let lastStatsRefreshMs = 0;
let lastSessionsRefreshMs = 0;
let lastChatWriteMs = 0;
let lastError = null;

let statsRefreshing = false;
let sessionsRefreshing = false;

// ---------------------------
// Sessions log (persistent)
// ---------------------------
let sessionsLog = []; // array rows (history)

const activeLogIdByFile = new Map();
const prevConnectedByFile = new Map();
const prevPlayCountByFile = new Map();

async function loadSessionsLog() {
  try {
    if (!fs.existsSync(SESSIONS_LOG_PATH)) return;

    const raw = await fsp.readFile(SESSIONS_LOG_PATH, "utf-8");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;

    sessionsLog = arr;

    activeLogIdByFile.clear();
    prevConnectedByFile.clear();
    prevPlayCountByFile.clear();

    for (const row of sessionsLog) {
      if (!row || !row.filename) continue;

      if (row.connection_state === "connected" && row.leave === "Online") {
        activeLogIdByFile.set(row.filename, row.id);
        prevConnectedByFile.set(row.filename, true);
        prevPlayCountByFile.set(row.filename, Number(row.number_of_times_played || 0));
      }
    }
  } catch (e) {
    console.error("Failed to load sessions_log.json:", e);
  }
}

function startSessionRow(snap) {
  const id = `${snap.filename}:${snap.play_count}:${Date.now()}`;

  sessionsLog.unshift({
    id,
    filename: snap.filename,
    name: snap.name,
    connection_state: "connected",
    ip: snap.ip,
    rate: snap.rate,
    snaps: snap.snaps,
    ping: snap.ping,
    allies_model: snap.allies_model,
    axis_model: snap.axis_model,
    game_version: snap.game_version,
    join: nowStamp(),
    leave: "Online",
    join_from_file: snap.join_from_file,
    number_of_times_played: snap.play_count,
  });

  activeLogIdByFile.set(snap.filename, id);
}

function updateOpenSessionRowWhileConnected(snap) {
  const id = activeLogIdByFile.get(snap.filename);
  if (!id) return;

  const row = sessionsLog.find((x) => x.id === id);
  if (!row) return;

  row.connection_state = "connected";
  row.ip = snap.ip;
  row.rate = snap.rate;
  row.snaps = snap.snaps;
  row.ping = snap.ping;
  row.allies_model = snap.allies_model;
  row.axis_model = snap.axis_model;
  row.game_version = snap.game_version;
  row.leave = "Online";
}

function endSessionRow(filename, leaveVal) {
  const id = activeLogIdByFile.get(filename);
  if (!id) return;

  const row = sessionsLog.find((x) => x.id === id);
  if (row) {
    row.connection_state = "disconnected";
    row.leave = leaveVal || nowStamp();
  }
  activeLogIdByFile.delete(filename);
}

// ---------------------------
// Chat logs (persistent + SSE live stream)
// ---------------------------
let chatLogs = []; // {message,sender,recipient,scope,team,date,time?}
const chatSseClients = new Set();

async function loadChatLogs() {
  try {
    if (!fs.existsSync(CHAT_LOG_PATH)) return;
    const raw = await fsp.readFile(CHAT_LOG_PATH, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) chatLogs = arr;
  } catch (e) {
    console.error("Failed to load chat_logs.json:", e);
  }
}

async function saveChatLogs() {
  ensureDir(APP_DATA_DIR);
  await writeJsonAtomic(CHAT_LOG_PATH, chatLogs);
  lastChatWriteMs = Date.now();
}

function broadcastChat(log) {
  const payload = `event: chat\ndata: ${JSON.stringify(log)}\n\n`;
  for (const res of chatSseClients) {
    try { res.write(payload); } catch (_) {}
  }
}

// keepalive ping (handig voor proxies/idle timeouts)
setInterval(() => {
  for (const res of chatSseClients) {
    try { res.write(`: ping\n\n`); } catch (_) {}
  }
}, 25000);

// ---------------------------
// Refresh loops
// ---------------------------
async function listTxtFiles(dir) {
  const files = await fsp.readdir(dir);
  return files.filter((f) => f.toLowerCase().endsWith(".txt"));
}

async function refreshSessionsFromFiles() {
  if (sessionsRefreshing) return;
  sessionsRefreshing = true;

  try {
    lastError = null;
    ensureDir(PLAYERFILES_DIR);

    const txtFiles = await listTxtFiles(PLAYERFILES_DIR);
    let dirty = false;

    for (const key of fileCache.keys()) {
      if (!txtFiles.includes(key)) fileCache.delete(key);
    }

    for (const file of txtFiles) {
      const filename = path.basename(file, ".txt");

      const data = await readParsed(file);
      const userinfo = data.userinfo || {};
      const session = data.session || {};

      const connected = isConnectedState(userinfo.connection_state);
      const playCount = Number(session.number_of_times_played || 0);

      const snap = {
        filename,
        name: userinfo.name || filename,
        ip: userinfo.ip || "",
        rate: typeof userinfo.rate !== "undefined" ? userinfo.rate : "",
        snaps: typeof userinfo.snaps !== "undefined" ? userinfo.snaps : "",
        ping: typeof userinfo.ping !== "undefined" ? userinfo.ping : "",
        allies_model: userinfo.allies_model || "",
        axis_model: userinfo.axis_model || "",
        game_version: userinfo.game_version || "",
        join_from_file: joinFromFile(session),
        leave_from_file: leaveFromFile(session),
        connected,
        play_count: playCount,
      };

      const prevConnected = prevConnectedByFile.get(filename) ?? false;
      const prevPlayCount = prevPlayCountByFile.get(filename) ?? playCount;

      const shouldStart =
        (connected && !prevConnected) ||
        (connected && playCount > prevPlayCount);

      if (shouldStart) {
        endSessionRow(filename, nowStamp());
        startSessionRow(snap);
        dirty = true;
      }

      if (connected && (prevConnected || activeLogIdByFile.has(filename))) {
        updateOpenSessionRowWhileConnected(snap);
      }

      if (!connected && prevConnected) {
        endSessionRow(filename, snap.leave_from_file || nowStamp());
        dirty = true;
      }

      prevConnectedByFile.set(filename, connected);
      prevPlayCountByFile.set(filename, playCount);
    }

    const MAX_LOG = 5000;
    if (sessionsLog.length > MAX_LOG) {
      sessionsLog = sessionsLog.slice(0, MAX_LOG);
      dirty = true;
    }

    if (dirty) {
      ensureDir(APP_DATA_DIR);
      await writeJsonAtomic(SESSIONS_LOG_PATH, sessionsLog);
    }

    lastSessionsRefreshMs = Date.now();
  } catch (e) {
    lastError = String(e?.message || e);
    console.error("refreshSessionsFromFiles failed:", e);
  } finally {
    sessionsRefreshing = false;
  }
}

async function refreshStatsFromFiles() {
  if (statsRefreshing) return;
  statsRefreshing = true;

  try {
    lastError = null;
    ensureDir(PLAYERFILES_DIR);

    const txtFiles = await listTxtFiles(PLAYERFILES_DIR);
    const players = [];

    for (const file of txtFiles) {
      const filename = path.basename(file, ".txt");

      const data = await readParsed(file);
      const userinfo = data.userinfo || {};
      const session = data.session || {};
      const combat = data.combat || {};
      const bodyLocations = data["body_locations"] || {};
      const freezeTag = data["freeze_tag"] || {};

      players.push({
        filename,
        name: userinfo.name || filename,
        kills: combat.kills ?? 0,
        deaths: combat.deaths ?? 0,
        kdr: combat.kdr ?? 0,
        headshots: bodyLocations.headshots ?? 0,
        damage: combat.damage ?? 0,
        melts: freezeTag.melts ?? 0,
        total_play_time: session.total_play_time || "",
      });
    }

    players.sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0));
    cachePlayers = players;
    lastStatsRefreshMs = Date.now();
  } catch (e) {
    lastError = String(e?.message || e);
    console.error("refreshStatsFromFiles failed:", e);
  } finally {
    statsRefreshing = false;
  }
}

// ---------------------------
// API routes
// ---------------------------
app.get("/api/getplayers", (req, res) => res.json(cachePlayers));
app.get("/api/sessions", (req, res) => res.json(sessionsLog));

// Chat logs history
app.get("/api/chatlogs", (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 500), 5000));
  res.json(chatLogs.slice(0, limit));
});

// Chat logs live stream (SSE)
app.get("/api/chatlogs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: ready\ndata: {}\n\n`);

  chatSseClients.add(res);
  req.on("close", () => chatSseClients.delete(res));
});

// Game -> post chat log here
app.post("/api/chatlog", express.json({ type: "*/*", limit: "2mb" }), async (req, res) => {
  try {
    const data = unwrap(req.body) || {};

    const sender = String(data.sender || "").trim();
    const message = String(data.message || "").trim();
    if (!sender || !message) {
      return res.json({ status: "success", message: "Success" });
    }

    const date = String(data.date || "").trim();
    const time = String(data.time || "").trim();
    const stamp = (date && time) ? `${date} ${time}` : nowStamp();

    const log = {
      message,
      sender,
      recipient: String(data.recipient || "").trim(),
      scope: String(data.scope || "all").trim(),
      team: String(data.team || "").trim(),
      date: stamp,
    };

    chatLogs.unshift(log);

    const MAX_CHAT = 5000;
    if (chatLogs.length > MAX_CHAT) chatLogs = chatLogs.slice(0, MAX_CHAT);

    await saveChatLogs();
    broadcastChat(log);

    return res.json({ status: "success", message: "Success" });
  } catch (e) {
    console.error("Error in /api/chatlog:", e);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// test: reset chat logs
app.post("/api/reset-chatlogs", async (req, res) => {
  chatLogs = [];
  await saveChatLogs();
  res.json({ ok: true });
});

app.get("/api/cache-status", (req, res) => {
  res.json({
    playerfiles_dir: PLAYERFILES_DIR,
    stats_refresh_ms: STATS_REFRESH_MS,
    sessions_refresh_ms: SESSIONS_REFRESH_MS,

    last_stats_refresh_ms: lastStatsRefreshMs,
    last_stats_refresh_iso: lastStatsRefreshMs ? new Date(lastStatsRefreshMs).toISOString() : null,

    last_sessions_refresh_ms: lastSessionsRefreshMs,
    last_sessions_refresh_iso: lastSessionsRefreshMs ? new Date(lastSessionsRefreshMs).toISOString() : null,

    chat_logs_count: chatLogs.length,
    last_chat_write_iso: lastChatWriteMs ? new Date(lastChatWriteMs).toISOString() : null,

    players_count: cachePlayers.length,
    sessions_log_count: sessionsLog.length,
    error: lastError,
  });
});

// test: handmatig refreshen
app.post("/api/refresh-now", async (req, res) => {
  await refreshSessionsFromFiles();
  await refreshStatsFromFiles();
  res.json({ ok: true });
});

// test: sessions log resetten
app.post("/api/reset-sessions-log", async (req, res) => {
  sessionsLog = [];
  activeLogIdByFile.clear();
  prevConnectedByFile.clear();
  prevPlayCountByFile.clear();

  ensureDir(APP_DATA_DIR);
  await writeJsonAtomic(SESSIONS_LOG_PATH, sessionsLog);

  res.json({ ok: true });
});

// --------------------------------------------------
// STUB endpoints (zodat gamescript "Success" krijgt)
// --------------------------------------------------
app.post("/api/player", express.json({ type: "*/*", limit: "2mb" }), (req, res) => {
  return res.json({ status: "success", message: "Success" });
});

app.post("/api/session", express.json({ type: "*/*", limit: "2mb" }), (req, res) => {
  return res.json({ status: "success", message: "Success" });
});

// --------------------------------------------------
// Upload screenshot → Discord
// --------------------------------------------------
app.post("/api/upload-screenshot", upload.single("screenshot"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    if (!DISCORD_WEBHOOK_URL) {
      console.error("No DISCORD_WEBHOOK_URL set in .env");
      return res.status(500).json({ error: "Server misconfigured (no webhook URL)." });
    }

    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content: `📸 New forced screenshot uploaded: **${req.file.originalname}**`,
      })
    );

    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: "image/tga",
    });

    await axios.post(DISCORD_WEBHOOK_URL, form, { headers: form.getHeaders() });
    res.json({ ok: true, message: "Screenshot uploaded successfully." });
  } catch (err) {
    console.error("Error in /api/upload-screenshot:", err);
    if (err.message === "Only .tga files are allowed") return res.status(400).json({ error: err.message });
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File is too large (max 10 MB)." });
    res.status(500).json({ error: "Something went wrong while uploading." });
  }
});

// Main page -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------------
// Boot
// ---------------------------
(async () => {
  ensureDir(APP_DATA_DIR);
  await loadSessionsLog();
  await loadChatLogs();

  await refreshSessionsFromFiles();
  await refreshStatsFromFiles();

  setInterval(() => refreshSessionsFromFiles().catch(console.error), SESSIONS_REFRESH_MS);
  setInterval(() => refreshStatsFromFiles().catch(console.error), STATS_REFRESH_MS);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Reading player files from: ${PLAYERFILES_DIR}`);
    console.log(`Status: http://localhost:${PORT}/api/cache-status`);
    console.log(`Chat stream: http://localhost:${PORT}/api/chatlogs/stream`);
  });
})();
