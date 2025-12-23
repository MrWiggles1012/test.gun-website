// stats.js — Player stats page (Option 23)
// Adds:
// - Time-range buttons (1D / 7D / 1M / 1Y / All)
// - Delta / trend lines (vs previous period) + per-day normalization
//
// Backend expectation (recommended):
// GET /api/playerstats?player=NAME&range=1d|7d|1m|1y|all
// returns at least:
// {
//   player, name,
//   rangeKey, rangeDays, rangeLabel,
//   parsed: { combat, session, bodyLocations, weaponModels, meansOfDeath, freezeTag },
//   sessions: { firstSeen, lastSeen, timesPlayed, totalPlayTime },
//   derived: { kdr, hsRate, dmgPerKill },
//   previous: { parsed, sessions, derived }  // optional, for deltas
// }

(function () {
  const RANGE_META = {
    "1d": { label: "1D", days: 1 },
    "7d": { label: "7D", days: 7 },
    "1m": { label: "1M", days: 30 },
    "1y": { label: "1Y", days: 365 },
    "all": { label: "All", days: null },
  };

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val == null || val === "" ? "—" : String(val);
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
  }

  function fmtInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return Math.round(x).toLocaleString("nl-NL");
  }

  function fmtFloat(n, d = 2) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toFixed(d);
  }

  function fmtPercent(n, d = 1) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toFixed(d) + "%";
  }

  function getQS() {
    return new URLSearchParams(location.search);
  }

  function getPlayerFromQS() {
    return getQS().get("player");
  }

  function getRangeFromQS() {
    const raw = (getQS().get("range") || "7D").toLowerCase();
    return RANGE_META[raw] ? raw : "7D";
  }

  function setRangeInURL(rangeKey) {
    const qs = getQS();
    if (rangeKey === "all") qs.delete("range");
    else qs.set("range", rangeKey);
    const newUrl = location.pathname + "?" + qs.toString();
    history.replaceState({}, "", newUrl);
  }

  function setActiveRangeButton(rangeKey) {
    document.querySelectorAll("#ps-range-nav .ps-range-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.range === rangeKey);
    });
  }

  function initRangeNav(onChange) {
    const nav = document.getElementById("ps-range-nav");
    if (!nav) return;
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".ps-range-btn");
      if (!btn) return;
      const rk = (btn.dataset.range || "all").toLowerCase();
      if (!RANGE_META[rk]) return;
      setRangeInURL(rk);
      setActiveRangeButton(rk);
      onChange(rk);
    });
  }

  function toNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function calcKdr(kills, deaths) {
    if (deaths <= 0) return kills;
    return kills / deaths;
  }

  function calcHsRate(headshots, kills) {
    if (kills <= 0) return 0;
    return (headshots / kills) * 100;
  }

  function calcDmgPerKill(damage, kills) {
    if (kills <= 0) return NaN;
    return damage / kills;
  }

  function clearDelta(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = "";
    el.classList.remove("is-up", "is-down", "is-flat", "is-good", "is-bad");
    el.removeAttribute("title");
  }

  // goodWhen: "up" (higher better), "down" (lower better), "either" (neutral)
  function setDelta(id, curr, prev, days, goodWhen = "either") {
    const el = document.getElementById(id);
    if (!el) return;

    const c = Number(curr);
    const p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p)) {
      clearDelta(id);
      return;
    }

    const diff = c - p;
    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "•";
    const absDiff = Math.abs(diff);
    const pct = p !== 0 ? (diff / p) * 100 : (c === 0 ? 0 : 100);

    // per-day for count-like stats
    const perDay = (typeof days === "number" && days > 0) ? (c / days) : null;
    const perDayText = (perDay != null) ? ` • ${fmtFloat(perDay, 1)}/d` : "";

    const diffText = (absDiff < 0.0000001)
      ? "0"
      : (Number.isInteger(c) && Number.isInteger(p))
        ? fmtInt(diff)
        : fmtFloat(diff, 2);

    const pctText = Number.isFinite(pct) ? `${pct >= 0 ? "+" : ""}${fmtFloat(pct, 0)}%` : "";

    el.textContent = `${arrow} ${diff >= 0 ? "+" : ""}${diffText} (${pctText})${perDayText}`;
    el.title = `Previous: ${p}`;

    el.classList.remove("is-up", "is-down", "is-flat", "is-good", "is-bad");
    el.classList.add(diff > 0 ? "is-up" : diff < 0 ? "is-down" : "is-flat");

    // Add good/bad semantics (subtle)
    if (goodWhen === "up") {
      el.classList.add(diff >= 0 ? "is-good" : "is-bad");
    } else if (goodWhen === "down") {
      el.classList.add(diff <= 0 ? "is-good" : "is-bad");
    }
  }

  function renderAllList(containerId, obj) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const entries = Object.entries(obj || {}).map(([k, v]) => [k, toNum(v)]);
    if (!entries.length) {
      el.innerHTML = '<div class="ps-list-item"><span class="label">No data</span><span class="value">—</span></div>';
      return;
    }

    // sort: highest first, 0s naturally end up at bottom
    entries.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

    const frag = document.createDocumentFragment();
    el.innerHTML = "";

    for (const [k, v] of entries) {
      const label = String(k).replace(/_/g, " ");
      const div = document.createElement("div");
      div.className = "ps-list-item" + (v === 0 ? " is-zero" : "");
      div.innerHTML =
        `<span class="label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>` +
        `<span class="value">${fmtInt(v)}</span>`;
      frag.appendChild(div);
    }

    el.appendChild(frag);
  }

  async function loadPlayerStats(rangeKey) {
    const errorEl = document.getElementById("error");
    const wrapEl = document.getElementById("stats");
    const titleEl = document.getElementById("ps-range-title");

    const player = getPlayerFromQS();
    if (!player) {
      if (errorEl) errorEl.textContent = "Geen speler opgegeven (missing ?player=...)";
      return;
    }

    const rk = rangeKey || getRangeFromQS();
    const meta = RANGE_META[rk] || RANGE_META.all;
    setActiveRangeButton(rk);

    try {
      if (errorEl) errorEl.textContent = "";

      const url = `/api/playerstats?player=${encodeURIComponent(player)}&range=${encodeURIComponent(rk)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`Player stats not found (HTTP ${r.status})`);
      const data = await r.json();

      if (wrapEl) wrapEl.classList.remove("hidden");

      // Title
      const rangeLabel = data.rangeLabel || meta.label;
      if (titleEl) titleEl.textContent = `Player detail · ${rangeLabel}`;

      const parsed = data.parsed || {};
      const combat = parsed.combat || {};
      const sessionParsed = parsed.session || {};
      const bodyLoc = parsed.bodyLocations || {};
      const freeze = parsed.freezeTag || {};

      // Derived (fallback if backend doesn't compute it)
      const kills = toNum(combat.kills);
      const deaths = toNum(combat.deaths);
      const damage = toNum(combat.damage);
      const headshots = toNum(bodyLoc.headshots);

      const derived = data.derived || {};
      const kdr = (derived.kdr != null) ? Number(derived.kdr) : calcKdr(kills, deaths);
      const hsRate = (derived.hsRate != null) ? Number(derived.hsRate) : calcHsRate(headshots, kills);
      const dmgPerKill = (derived.dmgPerKill != null) ? Number(derived.dmgPerKill) : calcDmgPerKill(damage, kills);

      // Left: player + sessions summary
      setText("ps-player-name", data.name || data.player || player);
      const ses = data.sessions || {};
      setText("ps-total-play-time", ses.totalPlayTime || sessionParsed.total_play_time || "—");
      setText("ps-times-played", fmtInt(ses.timesPlayed ?? sessionParsed.number_of_times_played));
      setText("ps-first-seen", ses.firstSeen || data.sessions?.firstSeen || "—");
      setText("ps-last-seen", ses.lastSeen || data.sessions?.lastSeen || "—");

      // Left: efficiency
      setText("ps-eff-kdr", fmtFloat(kdr, 2));
      setText("ps-eff-dpk", Number.isFinite(dmgPerKill) ? fmtFloat(dmgPerKill, 1) : "—");
      setText("ps-eff-hs", fmtPercent(hsRate, 1));

      // Right: combat overview
      setText("ps-kills", fmtInt(combat.kills));
      setText("ps-deaths", fmtInt(combat.deaths));
      setText("ps-melts", fmtInt(freeze.melts));
      setText("ps-headshots", fmtInt(bodyLoc.headshots));
      setText("ps-suicide", fmtInt(combat.suicide));
      setText("ps-teamkills", fmtInt(combat.teamkill));
      setText("ps-damage", fmtInt(combat.damage));

      // Lists: render ALL keys
      renderAllList("body-locations-grid", parsed.bodyLocations);
      renderAllList("weapon-models-grid", parsed.weaponModels);
      renderAllList("means-of-death-grid", parsed.meansOfDeath);

      // Deltas / trend (vs previous period)
      const prev = data.previous || null;
      const days = (typeof data.rangeDays === "number") ? data.rangeDays : meta.days;
      if (!prev || rk === "all") {
        [
          "ps-kills-delta","ps-deaths-delta","ps-melts-delta","ps-headshots-delta",
          "ps-suicide-delta","ps-teamkills-delta","ps-damage-delta",
          "ps-eff-kdr-delta","ps-eff-dpk-delta","ps-eff-hs-delta",
        ].forEach(clearDelta);
        return;
      }

      const pParsed = prev.parsed || {};
      const pCombat = pParsed.combat || {};
      const pBody = pParsed.bodyLocations || {};
      const pFreeze = pParsed.freezeTag || {};

      const pKills = toNum(pCombat.kills);
      const pDeaths = toNum(pCombat.deaths);
      const pDamage = toNum(pCombat.damage);
      const pHeadshots = toNum(pBody.headshots);

      const pDerived = prev.derived || {};
      const pKdr = (pDerived.kdr != null) ? Number(pDerived.kdr) : calcKdr(pKills, pDeaths);
      const pHsRate = (pDerived.hsRate != null) ? Number(pDerived.hsRate) : calcHsRate(pHeadshots, pKills);
      const pDpk = (pDerived.dmgPerKill != null) ? Number(pDerived.dmgPerKill) : calcDmgPerKill(pDamage, pKills);

      // Combat (counts) — set good/bad semantics subtly
      setDelta("ps-kills-delta", kills, pKills, days, "up");
      setDelta("ps-deaths-delta", deaths, pDeaths, days, "down");
      setDelta("ps-melts-delta", toNum(freeze.melts), toNum(pFreeze.melts), days, "up");
      setDelta("ps-headshots-delta", headshots, pHeadshots, days, "up");
      setDelta("ps-suicide-delta", toNum(combat.suicide), toNum(pCombat.suicide), days, "down");
      setDelta("ps-teamkills-delta", toNum(combat.teamkill), toNum(pCombat.teamkill), days, "down");
      setDelta("ps-damage-delta", damage, pDamage, days, "either");

      // Efficiency
      setDelta("ps-eff-kdr-delta", kdr, pKdr, null, "up");
      setDelta("ps-eff-dpk-delta", dmgPerKill, pDpk, null, "down");
      setDelta("ps-eff-hs-delta", hsRate, pHsRate, null, "up");
    } catch (e) {
      console.error(e);
      if (errorEl) errorEl.textContent = e.message || "Kon stats niet laden.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const rk = getRangeFromQS();
    setActiveRangeButton(rk);
    initRangeNav((newRange) => loadPlayerStats(newRange));
    loadPlayerStats(rk);
  });
})();
