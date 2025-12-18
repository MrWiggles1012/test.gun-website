// public/chatlogs.js

let chatLogs = [];
let currentSortKey = "date";
let currentSortDir = "desc";

const INITIAL_LIMIT = 500;

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

  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0).getTime();
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

function renderChatlogsTable() {
  const tbody = document.getElementById("chatlogs-body");
  if (!tbody) return;

  if (!chatLogs.length) {
    tbody.innerHTML = "";
    setError("Nog geen chat logs beschikbaar.");
    return;
  }

  setError("");

  let html = "";
  for (const log of chatLogs) {
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

  updateHeaderSortIndicators();
  renderChatlogsTable();
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

async function loadChatlogs() {
  try {
    setError("Chat logs laden…");
    const r = await fetch(`/api/chatlogs?limit=${INITIAL_LIMIT}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    chatLogs = await r.json();
    sortChatlogs("date", "desc");
  } catch (e) {
    console.error(e);
    setError("Kon chat logs niet laden.");
    chatLogs = [];
    renderChatlogsTable();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupHeaderSorting();
  await loadChatlogs();
});
