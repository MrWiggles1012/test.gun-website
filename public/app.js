// public/app.js
async function fetchPlayer(name) {
  const res = await fetch(`/api/player/${encodeURIComponent(name)}`);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Speler niet gevonden.");
    }
    throw new Error("Kon de spelerstats niet ophalen.");
  }

  return res.json();
}

function setText(id, value, fallback = "-") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value != null && value !== "" ? value : fallback;
}

function renderKeyValueGrid(containerId, dataObj) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  if (!dataObj || typeof dataObj !== "object") return;

  Object.entries(dataObj).forEach(([key, value]) => {
    const statDiv = document.createElement("div");
    statDiv.className = "stat";

    const labelText = key.replace(/_/g, " ");

    statDiv.innerHTML = `
      <span class="label">${labelText}</span>
      <span class="value">${value}</span>
    `;

    container.appendChild(statDiv);
  });
}

function renderStats(data) {
  const statsCard = document.getElementById("stats");
  const errorBox = document.getElementById("error");
  errorBox.textContent = "";

  const userinfo = data.userinfo || {};
  const session = data.session || {};
  const combat = data.combat || {};

  const bodyLocations = data["body_locations"] || {};
  const weaponModels = data["weapon_models"] || {};
  const meansOfDeath = data["means_of_death"] || {};
  const freezeTag = data["freeze_tag"] || {};

  const melts = freezeTag.melts;
  const freezeTagRest = { ...freezeTag };
  delete freezeTagRest.melts;

  // titel
  setText("stats-name", userinfo.name || "Onbekende speler");

  // GENERAL
  setText("stat-ip", userinfo.ip);
  setText("stat-connection", userinfo.connection_state);
  setText("stat-version", userinfo.game_version);
  setText("stat-rate", userinfo.rate);
  setText("stat-snaps", userinfo.snaps);
  setText("stat-ping", userinfo.ping);
  setText("stat-allies-model", userinfo.allies_model);
  setText("stat-axis-model", userinfo.axis_model);


  // COMBAT
  setText("stat-kills", combat.kills);
  setText("stat-deaths", combat.deaths);
  setText("stat-damage", combat.damage);
  setText("stat-suicide", combat.suicide);
  setText("stat-teamkill", combat.teamkill);
  setText("stat-kdr", combat.kdr);
  setText("stat-headshots", bodyLocations.headshots);



  // SESSION
  const firstSeen = `${session.first_seen_date || ""} ${session.first_seen_time || ""}`.trim();
  const lastSeen = `${session.last_seen_date || ""} ${session.last_seen_time || ""}`.trim();

  setText("stat-first-seen", firstSeen);
  setText("stat-last-seen", lastSeen);
  setText("stat-times-played", session.number_of_times_played);
  setText("stat-total-play-time", session.total_play_time);


  // MELTS
  setText("stat-melts", melts);

  // overige secties
  renderKeyValueGrid("body-locations-grid", bodyLocations);
  renderKeyValueGrid("weapon-models-grid", weaponModels);
  renderKeyValueGrid("means-of-death-grid", meansOfDeath);
  renderKeyValueGrid("freeze-tag-grid", freezeTagRest);

  statsCard.classList.remove("hidden");
}

function showError(message) {
  const errorBox = document.getElementById("error");
  const statsCard = document.getElementById("stats");

  errorBox.textContent = message;
  statsCard.classList.add("hidden");
}

async function loadPlayer(name) {
  const input = document.getElementById("player-name");
  if (input) input.value = name;

  showError("");

  try {
    const data = await fetchPlayer(name);
    renderStats(data);
  } catch (err) {
    showError(err.message || "Onbekende fout");
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const playerFromUrl = params.get("player");

  if (playerFromUrl) {
    loadPlayer(playerFromUrl);
  } else {
    showError(
      "Geen speler geselecteerd. Ga terug naar Statistics en klik op een speler."
    );
  }
});

