console.log("✅ players.js loaded");

async function loadPlayersOverview() {
  const tbody = document.getElementById("players-body");
  const errorEl = document.getElementById("players-error");

  // Alleen uitvoeren op de pagina waar de tabel bestaat
  if (!tbody) return;

  try {
    const resp = await fetch("/api/getplayers", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const players = await resp.json();

    tbody.innerHTML = "";
    if (errorEl) errorEl.textContent = "";

    if (!Array.isArray(players) || players.length === 0) {
      if (errorEl) errorEl.textContent = "Geen spelers gevonden.";
      return;
    }

    for (const p of players) {
      const tr = document.createElement("tr");

      // kolommen: Name, Kills, Deaths, KDR, Headshots, Damage, Melts, Total time played
      tr.innerHTML = `
        <td>${p.name ?? ""}</td>
        <td>${p.kills ?? 0}</td>
        <td>${p.deaths ?? 0}</td>
        <td>${p.kdr ?? 0}</td>
        <td>${p.headshots ?? 0}</td>
        <td>${p.damage ?? 0}</td>
        <td>${p.melts ?? 0}</td>
        <td>${p.total_play_time ?? ""}</td>
      `;

      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("loadPlayersOverview error:", err);
    if (errorEl) errorEl.textContent = err.message || "Onbekende fout...";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadPlayersOverview);
} else {
  loadPlayersOverview();
}

// live refresh (optioneel)
setInterval(loadPlayersOverview, 2000);
