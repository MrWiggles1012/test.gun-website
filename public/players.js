// public/players.js
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadPlayersOverview() {
  const tbody = document.getElementById("players-body");
  const errorEl = document.getElementById("players-error");

  if (!tbody) return;

  tbody.innerHTML = "";
  errorEl.textContent = "";

  try {
    const res = await fetch("/api/player-overview");
    if (!res.ok) {
      throw new Error("Kon spelers-statistics niet ophalen.");
    }

    const players = await res.json();

    if (!players.length) {
      errorEl.textContent = "Geen spelers gevonden in de data map.";
      return;
    }

    players.forEach((p) => {
      const tr = document.createElement("tr");

      const nameCell = `
        <a href="stats.html?player=${encodeURIComponent(p.filename)}">
          ${escapeHtml(p.name || p.filename)}
        </a>
      `;

      tr.innerHTML = `
        <td>${nameCell}</td>
        <td>${escapeHtml(p.kills)}</td>
        <td>${escapeHtml(p.deaths)}</td>
        <td>${escapeHtml(p.kdr)}</td>
        <td>${escapeHtml(p.headshots)}</td>
        <td>${escapeHtml(p.damage)}</td>
        <td>${escapeHtml(p.melts)}</td>
        <td>${escapeHtml(p.total_play_time)}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    errorEl.textContent =
      err.message || "Onbekende fout bij laden van speler-statistics.";
  }
}

document.addEventListener("DOMContentLoaded", loadPlayersOverview);
