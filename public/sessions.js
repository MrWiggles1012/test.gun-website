function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCountryCell(s) {
  const iso = String(s?.isocode || "").trim().toLowerCase();
  const country = String(s?.country || "").trim();

  if (!iso && !country) return "";

  const label = escapeHtml(country || iso.toUpperCase());
  const flag = iso
    ? `<img class="flag-icon" src="/${escapeHtml(iso)}.png" alt="${escapeHtml(
        iso.toUpperCase()
      )}" onerror="this.style.display='none'" />`
    : "";

  return `${flag}${label}`;
}

// Globale data + huidige sorteerinstelling
let sessionsData = [];
let currentSort = {
  key: "join", // standaard sorteren op Join
  direction: "desc", // meest recente bovenaan
};

// Paging state
const paging = {
  page: 1,
  limit: 50, // standaard 50
};

// dd.mm.yyyy HH:MM:SS -> timestamp voor sorteren
function parseDateTime(value) {
  if (!value) return 0;
  const [datePart, timePart] = String(value).split(" ");
  if (!datePart) return 0;

  const [day, month, year] = datePart.split(/[.\-]/).map(Number);
  if (!day || !month || !year) return 0;

  let h = 0,
    m = 0,
    s = 0;
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
        av = (a?.[key] ?? "").toString().toLowerCase();
        bv = (b?.[key] ?? "").toString().toLowerCase();
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
      th.classList.add(currentSort.direction === "desc" ? "sort-desc" : "sort-asc");
    }
  });
}

// -------- Pagination UI helpers --------
function makeBtn(label, targetPage, disabled = false, active = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pager-btn" + (active ? " is-active" : "");
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", () => {
    paging.page = targetPage;
    renderSessionsTable();
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
  const p = paging.page;

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

function renderSummary(total, startIdx, endIdx) {
  const summaryEl = document.getElementById("table-summary");
  if (!summaryEl) return;

  if (total === 0) {
    summaryEl.textContent = "No results";
    return;
  }
  summaryEl.textContent = `${startIdx}–${endIdx} of ${total}`;
}

function clampPage(totalPages) {
  if (paging.page < 1) paging.page = 1;
  if (paging.page > totalPages) paging.page = totalPages;
}

function renderSessionsTable() {
  const tbody = document.getElementById("sessions-body");
  if (!tbody) return;

  const sorted = getSortedSessions();
  const total = sorted.length;

  const totalPages = Math.max(1, Math.ceil(total / paging.limit));
  clampPage(totalPages);

  const start = (paging.page - 1) * paging.limit;
  const end = Math.min(start + paging.limit, total);

  renderSummary(total, total === 0 ? 0 : start + 1, end);
  renderPager(totalPages);

  tbody.innerHTML = "";

  // alleen rijen voor deze pagina
  sorted.slice(start, end).forEach((s) => {
    const tr = document.createElement("tr");

    const nameCell = `
      <a href="stats.html?player=${encodeURIComponent(s.filename)}">
        ${escapeHtml(s.name || s.filename)}
      </a>
    `;

    const isConnected =
      s.connection_state && String(s.connection_state).toLowerCase() === "connected";

    const connectionCell = isConnected
      ? '<span class="connection-connected">connected</span>'
      : escapeHtml(s.connection_state || "");

    const leaveCell = isConnected
      ? '<span class="connection-online">Online</span>'
      : escapeHtml(s.leave || "");

    tr.innerHTML = `
      <td>${nameCell}</td>
      <td>${connectionCell}</td>
      <td>${escapeHtml(s.ip)}</td>
      <td>${renderCountryCell(s)}</td>
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

  if (errorEl) errorEl.textContent = "";

  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) throw new Error("Kon sessions-overzicht niet ophalen.");

    const sessions = await res.json();

    if (!Array.isArray(sessions) || sessions.length === 0) {
      sessionsData = [];
      paging.page = 1;
      renderSessionsTable();
      if (errorEl) errorEl.textContent = "Geen spelers gevonden in de data map.";
      return;
    }

    sessionsData = sessions;

    // als je op een page zat die nu niet meer bestaat, netjes clampen via render
    renderSessionsTable();
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = err.message || "Onbekende fout bij laden van sessions.";
    }
  }
}

function setupSortHeaders() {
  const headers = document.querySelectorAll(".sessions-table th.sortable");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) return;

      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentSort.key = key;
        currentSort.direction = key === "join" ? "desc" : "asc";
      }

      // bij sorteren terug naar pagina 1 (logischer UX)
      paging.page = 1;
      renderSessionsTable();
    });
  });
}

function setupRowsPerPage() {
  const rowsSelect = document.getElementById("rows-per-page");
  if (!rowsSelect) return;

  rowsSelect.value = String(paging.limit);

  rowsSelect.addEventListener("change", () => {
    paging.limit = parseInt(rowsSelect.value, 10) || 50;
    paging.page = 1;
    renderSessionsTable();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSortHeaders();
  setupRowsPerPage();
  loadSessions();

  // optioneel: auto refresh
  // setInterval(loadSessions, 5000);
});
