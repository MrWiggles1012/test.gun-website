/* public/players.js */
console.log("✅ players.js loaded");

const playersState = {
  rows: [],
  page: 1,
  limit: 50, // default
  sortKey: null,
  sortDir: "asc",
};

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampPage(totalPages) {
  if (playersState.page < 1) playersState.page = 1;
  if (playersState.page > totalPages) playersState.page = totalPages;
}

function renderSummary(total, startIdx, endIdx) {
  const summaryEl = document.getElementById("table-summary");
  if (!summaryEl) return;
  summaryEl.textContent = total === 0 ? "No results" : `${startIdx}–${endIdx} of ${total}`;
}

function makeBtn(label, targetPage, disabled = false, active = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pager-btn" + (active ? " is-active" : "");
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", () => {
    playersState.page = targetPage;
    renderPlayersTable();
  });
  return b;
}

function makeEllipsis() {
  const s = document.createElement("span");
  s.className = "pager-ellipsis";
  s.textContent = "…";
  return s;
}

function renderPager(totalPages) {
  const pagerEl = document.getElementById("table-pager");
  if (!pagerEl) return;

  pagerEl.innerHTML = "";
  const p = playersState.page;

  pagerEl.appendChild(makeBtn("«", 1, p === 1));
  pagerEl.appendChild(makeBtn("‹", p - 1, p === 1));

  const windowSize = 2;
  const addPage = (n) => pagerEl.appendChild(makeBtn(String(n), n, false, n === p));

  if (totalPages <= 9) {
    for (let i = 1; i <= totalPages; i++) addPage(i);
  } else {
    addPage(1);

    let start = Math.max(2, p - windowSize);
    let end = Math.min(totalPages - 1, p + windowSize);

    if (start > 2) pagerEl.appendChild(makeEllipsis());
    for (let i = start; i <= end; i++) addPage(i);
    if (end < totalPages - 1) pagerEl.appendChild(makeEllipsis());

    addPage(totalPages);
  }

  pagerEl.appendChild(makeBtn("›", p + 1, p === totalPages));
  pagerEl.appendChild(makeBtn("»", totalPages, p === totalPages));
}

function getSortedPlayers(rows) {
  const key = playersState.sortKey;
  if (!key) return rows;

  const dir = playersState.sortDir === "desc" ? -1 : 1;
  const numericKeys = new Set(["kills","deaths","kdr","headshots","damage","melts"]);

  return [...rows].sort((a, b) => {
    let av = a?.[key];
    let bv = b?.[key];

    if (numericKeys.has(key)) {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    } else {
      av = String(av ?? "").toLowerCase();
      bv = String(bv ?? "").toLowerCase();
    }

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function updateSortIndicators() {
  const headers = document.querySelectorAll(".players-table th.sortable");
  headers.forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    const key = th.dataset.sortKey;
    if (key && key === playersState.sortKey) {
      th.classList.add(playersState.sortDir === "desc" ? "sort-desc" : "sort-asc");
    }
  });
}

function renderPlayersTable() {
  const tbody = document.getElementById("players-body");
  const errorEl = document.getElementById("players-error");
  if (!tbody) return;

  const total = playersState.rows.length;

  if (!total) {
    tbody.innerHTML = "";
    if (errorEl) errorEl.textContent = "Geen spelers gevonden.";
    renderSummary(0, 0, 0);
    renderPager(1);
    return;
  }
  if (errorEl) errorEl.textContent = "";

  const sorted = getSortedPlayers(playersState.rows);

  const totalPages = Math.max(1, Math.ceil(total / playersState.limit));
  clampPage(totalPages);

  const start = (playersState.page - 1) * playersState.limit;
  const end = Math.min(start + playersState.limit, total);

  renderSummary(total, start + 1, end);
  renderPager(totalPages);

  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const p of sorted.slice(start, end)) {
    const tr = document.createElement("tr");
    const filename = p.filename || "";
    const nameHtml = filename
      ? `<a href="stats.html?player=${encodeURIComponent(filename)}">${escapeHtml(p.name ?? filename)}</a>`
      : escapeHtml(p.name ?? "");

    tr.innerHTML = `
      <td>${nameHtml}</td>
      <td>${escapeHtml(p.kills ?? 0)}</td>
      <td>${escapeHtml(p.deaths ?? 0)}</td>
      <td>${escapeHtml(p.kdr ?? 0)}</td>
      <td>${escapeHtml(p.headshots ?? 0)}</td>
      <td>${escapeHtml(p.damage ?? 0)}</td>
      <td>${escapeHtml(p.melts ?? 0)}</td>
      <td>${escapeHtml(p.total_play_time ?? "")}</td>
    `;
    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
  updateSortIndicators();
}

async function loadPlayersOverview() {
  const tbody = document.getElementById("players-body");
  const errorEl = document.getElementById("players-error");
  if (!tbody) return;

  try {
    const resp = await fetch("/api/getplayers", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const players = await resp.json();
    playersState.rows = Array.isArray(players) ? players : [];

    renderPlayersTable();
  } catch (err) {
    console.error("loadPlayersOverview error:", err);
    playersState.rows = [];
    renderPlayersTable();
    if (errorEl) errorEl.textContent = err.message || "Onbekende fout...";
  }
}

function setupRowsPerPage() {
  const rowsSelect = document.getElementById("rows-per-page");
  if (!rowsSelect) return;

  rowsSelect.value = String(playersState.limit);

  rowsSelect.addEventListener("change", () => {
    playersState.limit = parseInt(rowsSelect.value, 10) || 50;
    playersState.page = 1;
    renderPlayersTable();
  });
}

function setupSortHeaders() {
  // only activates if your <th> have data-sort-key
  const headers = document.querySelectorAll(".players-table th[data-sort-key]");
  headers.forEach((th) => {
    th.classList.add("sortable");
    th.style.cursor = "pointer";

    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) return;

      if (playersState.sortKey === key) {
        playersState.sortDir = playersState.sortDir === "asc" ? "desc" : "asc";
      } else {
        playersState.sortKey = key;
        playersState.sortDir = "asc";
      }

      playersState.page = 1;
      renderPlayersTable();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupRowsPerPage();
  setupSortHeaders();
  loadPlayersOverview();

  // live refresh (optional)
  setInterval(loadPlayersOverview, 2000);
});
