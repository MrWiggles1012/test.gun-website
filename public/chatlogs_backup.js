// public/chatlogs.js

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Datum string "11.12.2025 00:00:25" omzetten naar timestamp (ms)
function dateToValue(dateStr) {
  if (!dateStr) return 0;
  const [dPart, tPart] = dateStr.split(" ");
  if (!dPart || !tPart) return 0;

  const [day, month, year] = dPart.split(".").map(Number);
  const [hour, minute, second] = tPart.split(":").map(Number);

  const d = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
  return d.getTime();
}

// Globale data + sorteerstatus
let chatLogs = [];
let currentSortKey = "date";
let currentSortDir = "desc"; // 'asc' of 'desc'

// Tabel opnieuw tekenen
function renderChatlogsTable() {
  const tbody = document.getElementById("chatlogs-body");
  const errorEl = document.getElementById("chatlogs-error");
  if (!tbody || !errorEl) return;

  tbody.innerHTML = "";
  errorEl.textContent = "";

  if (!chatLogs.length) {
    errorEl.textContent = "Nog geen chat logs beschikbaar.";
    return;
  }

  chatLogs.forEach((log) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(log.message)}</td>
      <td>${escapeHtml(log.sender)}</td>
      <td>${escapeHtml(log.recipient || "")}</td>
      <td>${escapeHtml(log.scope)}</td>
      <td>${escapeHtml(log.date)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Sorteren op key + richting
function sortChatlogs(key, dir) {
  currentSortKey = key;
  currentSortDir = dir;

  chatLogs.sort((a, b) => {
    let va = a[key];
    let vb = b[key];

    // speciaal geval: datum
    if (key === "date") {
      va = dateToValue(a.date);
      vb = dateToValue(b.date);
    } else {
      // strings case-insensitive vergelijken
      va = (va ?? "").toString().toLowerCase();
      vb = (vb ?? "").toString().toLowerCase();
    }

    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });

  updateHeaderSortIndicators();
  renderChatlogsTable();
}

// Pijltjes / highlight in de kopregel zetten
function updateHeaderSortIndicators() {
  const ths = document.querySelectorAll(".chatlogs-table thead th");

  ths.forEach((th) => {
    const baseLabel = th.dataset.label || th.textContent.trim();
    th.dataset.label = baseLabel;

    const key = th.dataset.sortKey;
    if (key === currentSortKey) {
      const arrow = currentSortDir === "asc" ? " ▲" : " ▼";
      th.textContent = baseLabel + arrow;
    } else {
      th.textContent = baseLabel;
    }
  });
}

// Klikbare koppen instellen
function setupHeaderSorting() {
  const ths = document.querySelectorAll(".chatlogs-table thead th");

  ths.forEach((th) => {
    const key = th.dataset.sortKey;
    if (!key) return;

    th.style.cursor = "pointer";

    th.addEventListener("click", () => {
      let dir = "asc";

      if (currentSortKey === key) {
        // zelfde kolom -> toggle asc/desc
        dir = currentSortDir === "asc" ? "desc" : "asc";
      } else {
        // nieuwe kolom -> standaard asc
        dir = "asc";
      }

      sortChatlogs(key, dir);
    });
  });
}

// Demo-data op basis van jouw voorbeeld
function loadDemoChatlogs() {
  // TODO: later kun je dit vervangen door fetch('/api/chatlogs')
  chatLogs = [
    {
      date: "11.12.2025 00:00:25",
      sender: "G|u|N-|EFF|ƒ*{ Skaemmanova }*",
      recipient: "",
      scope: "team",
      message: "ksom pingy",
    },
    {
      date: "11.12.2025 00:00:48",
      sender: "G|u|N-abo ali",
      recipient: "",
      scope: "team",
      message: "w kosom alhakat",
    },
    {
      date: "11.12.2025 00:01:00",
      sender: "G|u|N-|EFF|ƒ*{ Skaemmanova }*",
      recipient: "",
      scope: "team",
      message: "ah wallahy",
    },
    {
      date: "11.12.2025 00:01:51",
      sender: "G|u|N-{£ÐR}-|ƒ!A|FLAMEWAR|god|",
      recipient: "",
      scope: "team",
      message: "cp",
    },
    {
      date: "11.12.2025 00:02:05",
      sender: "Borsti",
      recipient: "",
      scope: "team",
      message: "sry",
    },
    {
      date: "11.12.2025 00:02:12",
      sender: "G|u|N-{£ÐR}-|ƒ!A|FLAMEWAR|god|",
      recipient: "",
      scope: "team",
      message: "cp camped all",
    },
    {
      date: "11.12.2025 00:02:38",
      sender: "AHMED_IRAQ_PRO",
      recipient: "",
      scope: "all",
      message: "hi all",
    },
    {
      date: "11.12.2025 00:02:48",
      sender: "Borsti",
      recipient: "",
      scope: "all",
      message: "hi",
    },
    {
      date: "11.12.2025 00:02:48",
      sender: "G|u|N-{£ÐR}-|ƒ!A|FLAMEWAR|god|",
      recipient: "",
      scope: "all",
      message: "hi ahmed",
    },
    {
      date: "11.12.2025 00:03:12",
      sender: "G|u|N-FELIX",
      recipient: "",
      scope: "all",
      message: "hi",
    },
    {
      date: "11.12.2025 00:04:35",
      sender: "G|u|N-FELIX",
      recipient: "",
      scope: "all",
      message: "ty",
    },
    {
      date: "11.12.2025 00:04:55",
      sender: "G|u|N-GeneralXXL",
      recipient: "",
      scope: "all",
      message: "bb all",
    },
    {
      date: "11.12.2025 00:07:27",
      sender: "=|'KnighT-'=N1ght-GhOsT",
      recipient: "",
      scope: "all",
      message: "Brosti please stop hack",
    },
    {
      date: "11.12.2025 00:07:37",
      sender: "=|'KnighT-'=N1ght-GhOsT",
      recipient: "",
      scope: "all",
      message: "stop aim please",
    },
    {
      date: "11.12.2025 00:07:50",
      sender: "|clean.pk3| Godspeed",
      recipient: "",
      scope: "all",
      message: "take it borsti :D",
    },
    {
      date: "11.12.2025 00:08:11",
      sender: "Borsti",
      recipient: "",
      scope: "all",
      message: "you take it ;P",
    },
    {
      date: "11.12.2025 00:08:22",
      sender: "Havaiz",
      recipient: "",
      scope: "all",
      message: "hi all",
    },
    {
      date: "11.12.2025 00:08:33",
      sender: "AHMED_IRAQ_PRO",
      recipient: "",
      scope: "team",
      message: "hi",
    },
  ];
}

document.addEventListener("DOMContentLoaded", () => {
  const errorEl = document.getElementById("chatlogs-error");
  if (!errorEl) return;

  setupHeaderSorting();
  loadDemoChatlogs();

  // 🔥 Standaard: sorteer op Date DESC (nieuwste bovenaan)
  sortChatlogs("date", "desc");
});
