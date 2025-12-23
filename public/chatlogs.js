let chatLogs = [];
let currentSortKey = "date";
let currentSortDir = "desc";

const FETCH_LIMIT = 500; // we halen max 500 op, daarna pagineren we client-side

const chatPaging = {
  page: 1,
  limit: 50, // standaard 50
};

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dateToValue(dateStr) {
  if (!dateStr) return 0;
  const [dPart, tPart] = String(dateStr).split(" ");
  if (!dPart || !tPart) return 0;

  const [day, month, year] = dPart.split(".").map(Number);
  const [hour, minute, second] = tPart.split(":").map(Number);

  return new Date(
    year || 0,
    (month || 1) - 1,
    day || 1,
    hour || 0,
    minute || 0,
    second || 0
  ).getTime();
}

function setError(msg) {
  const errorEl = document.getElementById("chatlogs-error");
  if (errorEl) errorEl.textContent = msg || "";
}

function cleanRecipient(recipient) {
  const r = String(recipient || "").trim();
  if (!r) return "";
  if (r.toLowerCase() === "<unknown>") return "";
  return r;
}

function clampPage(totalPages) {
  if (chatPaging.page < 1) chatPaging.page = 1;
  if (chatPaging.page > totalPages) chatPaging.page = totalPages;
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
    chatPaging.page = targetPage;
    renderChatlogsTable();
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
  const p = chatPaging.page;

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

function updateHeaderSortIndicators() {
  const ths = document.querySelectorAll(".chatlogs-table thead th");
  ths.forEach((th) => {
    const baseLabel = th.dataset.label || th.textContent.trim();
    th.dataset.label = baseLabel;

    const key = th.dataset.sortKey;
    if (key === currentSortKey) {
      th.textContent = baseLabel + (currentSortDir === "asc" ? " ▲" : " ▼");
    } else {
      th.textContent = baseLabel;
    }
  });
}

function sortChatlogs(key, dir) {
  currentSortKey = key;
  currentSortDir = dir;

  chatLogs.sort((a, b) => {
    let va, vb;

    if (key === "date") {
      va = dateToValue(a.date);
      vb = dateToValue(b.date);
    } else {
      va = String(a?.[key] ?? "").toLowerCase();
      vb = String(b?.[key] ?? "").toLowerCase();
    }

    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });

  // bij sorteren logisch terug naar pagina 1
  chatPaging.page = 1;
  updateHeaderSortIndicators();
  renderChatlogsTable();
}

function renderChatlogsTable() {
  const tbody = document.getElementById("chatlogs-body");
  if (!tbody) return;

  if (!chatLogs.length) {
    tbody.innerHTML = "";
    setError("Nog geen chat logs beschikbaar.");
    renderSummary(0, 0, 0);
    renderPager(1);
    return;
  }

  setError("");

  const total = chatLogs.length;
  const totalPages = Math.max(1, Math.ceil(total / chatPaging.limit));
  clampPage(totalPages);

  const start = (chatPaging.page - 1) * chatPaging.limit;
  const end = Math.min(start + chatPaging.limit, total);

  renderSummary(total, start + 1, end);
  renderPager(totalPages);

  let html = "";
  for (const log of chatLogs.slice(start, end)) {
    const isPrivate = String(log.scope || "").toLowerCase() === "private";
    const recipient = cleanRecipient(log.recipient);

    html += `
      <tr class="${isPrivate ? "is-private" : ""}">
        <td>${escapeHtml(log.message)}</td>
        <td>${escapeHtml(log.sender)}</td>
        <td>${escapeHtml(recipient)}</td>
        <td>${escapeHtml(log.scope || "")}</td>
        <td>${escapeHtml(log.date || "")}</td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
}

function setupHeaderSorting() {
  const ths = document.querySelectorAll(".chatlogs-table thead th");
  ths.forEach((th) => {
    const key = th.dataset.sortKey;
    if (!key) return;

    if (!th.dataset.label) th.dataset.label = th.textContent.trim();
    th.style.cursor = "pointer";

    th.addEventListener("click", () => {
      let dir = "asc";
      if (currentSortKey === key) dir = currentSortDir === "asc" ? "desc" : "asc";
      sortChatlogs(key, dir);
    });
  });
}

function setupRowsPerPage() {
  const rowsSelect = document.getElementById("rows-per-page");
  if (!rowsSelect) return;

  rowsSelect.value = String(chatPaging.limit);

  rowsSelect.addEventListener("change", () => {
    chatPaging.limit = parseInt(rowsSelect.value, 10) || 50;
    chatPaging.page = 1;
    renderChatlogsTable();
  });
}

async function loadChatlogs() {
  try {
    setError("Chat logs laden…");
    const r = await fetch(`/api/chatlogs?limit=${FETCH_LIMIT}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    chatLogs = await r.json();
    if (!Array.isArray(chatLogs)) chatLogs = [];

    // default sort: date desc
    currentSortKey = "date";
    currentSortDir = "desc";
    chatLogs.sort((a, b) => dateToValue(b.date) - dateToValue(a.date));

    updateHeaderSortIndicators();
    renderChatlogsTable();
    setError("");
  } catch (e) {
    console.error(e);
    setError("Kon chat logs niet laden.");
    chatLogs = [];
    renderChatlogsTable();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupRowsPerPage();
  setupHeaderSorting();
  await loadChatlogs();
});
