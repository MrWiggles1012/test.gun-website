// nav.js

const AUTH_USER_KEY = "mohstats_logged_in_user";

/**
 * LET OP: hardcoded accounts in de frontend is alleen oké voor test/local.
 * Voor echte security: backend login + sessions/JWT.
 */
const ACCOUNTS = [
  { username: "admin",  password: "admin123" },
  { username: "leader", password: "rifleonly" },
  { username: "1",      password: "1" },
];

const ADMIN_USERS = new Set(["admin"]);

// Guides dropdown: welke pagina's horen onder Guides
const GUIDES_PAGES = new Set([
  "unnamedsoldier-cfg.html",
  "console.html",
  "binds.html",
  "cvars.html",
]);

function getCurrentFile() {
  return (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
}

// Body class voor per-page styling (home vs other)
function setPageClass() {
  const file = getCurrentFile();
  const style = (file === "index.html") ? "home" : "other";
  document.body.classList.add(`page-${style}`);
}

function getLoggedInUser() {
  return localStorage.getItem(AUTH_USER_KEY) || null;
}
function isLoggedIn() {
  return !!getLoggedInUser();
}
function isAdmin() {
  const u = getLoggedInUser();
  return !!u && ADMIN_USERS.has(u);
}

function refreshAuthUI() {
  const loggedIn = isLoggedIn();
  const admin = isAdmin();
  const currentUser = getLoggedInUser();

  // Admin-only links zichtbaar/verborgen
  document.querySelectorAll(".nav-sessions, .nav-chat")
    .forEach((el) => el.classList.toggle("hidden", !admin));

  // Login knop state
  const btn = document.getElementById("login-toggle");
  if (btn) {
    btn.classList.toggle("logged-in", loggedIn);
    btn.setAttribute("aria-label", loggedIn ? "Logout" : "Login");
    btn.title = loggedIn ? "Logout" : "Login";
    btn.setAttribute("aria-expanded", "false");
  }

  // "Logged in as ..."
  const userLabel = document.getElementById("login-user-label");
  if (userLabel) {
    if (loggedIn && currentUser) {
      userLabel.innerHTML = `Logged in as <span class="login-user-name">${currentUser}</span>`;
      userLabel.classList.remove("hidden");
    } else {
      userLabel.textContent = "";
      userLabel.classList.add("hidden");
    }
  }

  // Restrict admin pages
  const file = getCurrentFile();
  if (!admin && (file === "sessions.html" || file === "chatlogs.html")) {
    window.location.href = "index.html";
  }
}

function setupLoginUI() {
  const btn = document.getElementById("login-toggle");
  const panel = document.getElementById("login-panel");
  const closeBtn = document.getElementById("login-close");
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const userInput = document.getElementById("login-username");
  const passInput = document.getElementById("login-password");
  const togglePw = document.getElementById("toggle-password");

  // Als een pagina geen login overlay heeft: geen errors
  if (!btn || !panel) return;

  const successUser = panel.querySelector("#auth-success-user");
  const modal =
    panel.querySelector(".auth-modal") ||
    panel.querySelector(".login-dialog") ||
    panel; // fallback
  

    const openPanel = () => {
      modal.classList.remove("is-success");
      panel.classList.remove("hidden");
      panel.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      if (errorEl) errorEl.textContent = "";
      setTimeout(() => userInput?.focus(), 0);
    };
    

  const closePanel = () => {
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");
    if (errorEl) errorEl.textContent = "";
  };

  btn.addEventListener("click", () => {
    // Logout via dezelfde knop
    if (isLoggedIn()) {
      localStorage.removeItem(AUTH_USER_KEY);
      closePanel();
      refreshAuthUI();
      setActiveNavFromUrl();
      return;
    }

    // Toggle overlay
    if (panel.classList.contains("hidden")) openPanel();
    else closePanel();
  });

  closeBtn?.addEventListener("click", closePanel);

  // Klik op overlay sluit (alleen als je op de achtergrond klikt)
  panel.addEventListener("click", (e) => {
    if (e.target === panel) closePanel();
  });

  // ESC sluit overlay
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  // Form submit: login check
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = (userInput?.value || "").trim();
    const password = (passInput?.value || "").trim();

    const ok = ACCOUNTS.some((a) => a.username === username && a.password === password);

    if (!ok) {
      if (errorEl) errorEl.textContent = "Invalid username or password.";
      return;
    }

    localStorage.setItem(AUTH_USER_KEY, username);

    // ✅ success animatie tonen
    if (successUser) successUser.textContent = username;
    if (modal) modal.classList.add("is-success");

    // Optioneel: na 0.9 sec sluiten + UI refresh
    setTimeout(() => {
      if (modal) modal.classList.remove("is-success");
      form.reset();
      closePanel();
      refreshAuthUI();
      setActiveNavFromUrl();
    }, 3000);

    return; // voorkom dat er nog oude "form.reset/closePanel" code onder staat

  });

  // Show/hide password
  togglePw?.addEventListener("click", () => {
    if (!passInput) return;
    const isPw = passInput.type === "password";
    passInput.type = isPw ? "text" : "password";
    togglePw.textContent = isPw ? "Hide" : "Show";
    togglePw.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
  });
}

function setupDropdowns() {
  const dropdowns = document.querySelectorAll(".nav-dropdown");
  if (!dropdowns.length) return;

  const closeAll = () => {
    dropdowns.forEach((dd) => {
      dd.classList.remove("open");
      const btn = dd.querySelector(".dropdown-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  dropdowns.forEach((dd) => {
    const btn = dd.querySelector(".dropdown-toggle");
    if (!btn) return;

    btn.setAttribute("aria-expanded", "false");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = dd.classList.contains("open");
      closeAll();
      if (!isOpen) {
        dd.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  // click buiten dropdown -> sluiten
  document.addEventListener("click", () => closeAll());

  // ESC -> sluiten
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}

function clearActiveStates() {
  document.querySelectorAll(".main-nav .nav-link.active").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".main-nav .nav-dropdown.active").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".main-nav .dropdown-menu a.active").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".main-nav [aria-current='page']").forEach((el) => el.removeAttribute("aria-current"));
}

function setActiveNavFromUrl() {
  const currentFile = getCurrentFile();

  clearActiveStates();

  // Gewone nav links (alle anchors in main nav)
  document.querySelectorAll(".main-nav a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href || href.includes("://")) return;

    const hrefFile = href.split("#")[0].split("?")[0].split("/").pop()?.toLowerCase();
    if (hrefFile && hrefFile === currentFile) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  // Guides dropdown: active als huidige pagina in GUIDES_PAGES zit
  const guidesBtn = document.querySelector(".main-nav .nav-dropdown .nav-guides");
  if (guidesBtn) {
    const dd = guidesBtn.closest(".nav-dropdown");
    const menuLinks = dd?.querySelectorAll(".dropdown-menu a[href]") || [];

    let matched = false;

    menuLinks.forEach((link) => {
      const href = link.getAttribute("href") || "";
      const hrefFile = href.split("#")[0].split("?")[0].split("/").pop()?.toLowerCase();
      if (hrefFile && hrefFile === currentFile) {
        matched = true;
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });

    if (!matched && GUIDES_PAGES.has(currentFile)) matched = true;

    if (matched) {
      guidesBtn.classList.add("active");
      dd?.classList.add("active");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setPageClass();
  setupDropdowns();
  setupLoginUI();
  refreshAuthUI();
  setActiveNavFromUrl();
});
