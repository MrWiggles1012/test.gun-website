// public/sessions.js
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Globale data + huidige sorteerinstelling
let sessionsData = [];
let currentSort = {
  key: "join",      // standaard sorteren op Join
  direction: "desc" // meest recente bovenaan
};

// dd.mm.yyyy HH:MM:SS -> timestamp voor sorteren
function parseDateTime(value) {
  if (!value) return 0;
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return 0;

  const [day, month, year] = datePart.split(/[.\-]/).map(Number);
  if (!day || !month || !year) return 0;

  let h = 0, m = 0, s = 0;
  if (timePart) {
    const parts = timePart.split(":").map(Number);
    h = parts[0] || 0;
    m = parts[1] || 0;
    s = parts[2] || 0;
  }

  return new Date(year, month - 1, day, h, m, s).getTime();
}

function getSortedSessions() {
  const { key, direction } = currentSort;
  const dir = direction === "desc" ? -1 : 1;
  const data = [...sessionsData];

  data.sort((a, b) => {
    let av;
    let bv;

    switch (key) {
      case "join":
        av = parseDateTime(a.join);
        bv = parseDateTime(b.join);
        break;
      case "leave":
        av = parseDateTime(a.leave);
        bv = parseDateTime(b.leave);
        break;
      case "rate":
      case "snaps":
      case "ping":
        av = Number(a[key]) || 0;
        bv = Number(b[key]) || 0;
        break;
      default:
        av = (a[key] ?? "").toString().toLowerCase();
        bv = (b[key] ?? "").toString().toLowerCase();
        break;
    }

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  return data;
}

function updateSortIndicators() {
  const headers = document.querySelectorAll(".sessions-table th.sortable");
  headers.forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    const key = th.dataset.sortKey;
    if (key === currentSort.key) {
      th.classList.add(
        currentSort.direction === "desc" ? "sort-desc" : "sort-asc"
      );
    }
  });
}

function renderSessionsTable() {
  const tbody = document.getElementById("sessions-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  const sorted = getSortedSessions();

  sorted.forEach((s) => {
    const tr = document.createElement("tr");

    const nameCell = `
      <a href="stats.html?player=${encodeURIComponent(s.filename)}">
        ${escapeHtml(s.name || s.filename)}
      </a>
    `;

    const isConnected =
      s.connection_state &&
      String(s.connection_state).toLowerCase() === "connected";

    // Connection-kolom: groen als connected
    const connectionCell = isConnected
      ? '<span class="connection-connected">connected</span>'
      : escapeHtml(s.connection_state || "");

    // Leave-kolom: "Online" en groen als connected, anders normale leave
    const leaveCell = isConnected
      ? '<span class="connection-online">Online</span>'
      : escapeHtml(s.leave || "");

    tr.innerHTML = `
      <td>${nameCell}</td>
      <td>${connectionCell}</td>
      <td>${escapeHtml(s.ip)}</td>
      <td>${escapeHtml(s.rate)}</td>
      <td>${escapeHtml(s.snaps)}</td>
      <td>${escapeHtml(s.ping)}</td>
      <td>${escapeHtml(s.allies_model)}</td>
      <td>${escapeHtml(s.axis_model)}</td>
      <td>${escapeHtml(s.game_version)}</td>
      <td>${escapeHtml(s.join)}</td>
      <td>${leaveCell}</td>
    `;

    tbody.appendChild(tr);
  });

  updateSortIndicators();
}

async function loadSessions() {
  const errorEl = document.getElementById("sessions-error");
  const tbody = document.getElementById("sessions-body");

  if (!tbody) return;

  tbody.innerHTML = "";
  errorEl.textContent = "";

  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) {
      throw new Error("Kon sessions-overzicht niet ophalen.");
    }

    const sessions = await res.json();

    if (!sessions.length) {
      errorEl.textContent = "Geen spelers gevonden in de data map.";
      return;
    }

    sessionsData = sessions;
    renderSessionsTable();
  } catch (err) {
    console.error(err);
    errorEl.textContent =
      err.message || "Onbekende fout bij laden van sessions.";
  }
}

function setupSortHeaders() {
  const headers = document.querySelectorAll(".sessions-table th.sortable");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) return;

      if (currentSort.key === key) {
        // zelfde kolom → richting omdraaien
        currentSort.direction =
          currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        // nieuwe kolom → standaard asc, behalve join = desc
        currentSort.key = key;
        currentSort.direction = key === "join" ? "desc" : "asc";
      }

      renderSessionsTable();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSortHeaders();
  loadSessions();
});
