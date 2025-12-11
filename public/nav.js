// public/nav.js

// hier sla je de ingelogde user in op (in localStorage)
const AUTH_USER_KEY = "mohstats_logged_in_user";

// 🔐 lijst met accounts (voeg hier nieuwe bij)
const ACCOUNTS = [
  { username: "admin",  password: "admin123" },
  { username: "leader", password: "rifleonly" },
  { username: "1", password: "1" },
  // { username: "moderator", password: "mod123" },
];

// helpers rond login status
function getLoggedInUser() {
  return localStorage.getItem(AUTH_USER_KEY) || null;
}

function isLoggedIn() {
  return !!getLoggedInUser();
}

function setLoggedInUser(username) {
  if (username) {
    localStorage.setItem(AUTH_USER_KEY, username);
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

// UI updaten op basis van loginstatus
function refreshAuthUI() {
  const loggedIn = isLoggedIn();
  const currentUser = getLoggedInUser();

  // navigatie: sessions + chat alleen tonen als ingelogd
  const protectedLinks = document.querySelectorAll(
    ".nav-sessions, .nav-chat"
  );
  protectedLinks.forEach((el) => {
    if (loggedIn) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });

  // login knop label + stijl
  const loginBtn = document.getElementById("login-toggle");
  if (loginBtn) {
    loginBtn.textContent = loggedIn ? "Logout" : "Login";
    loginBtn.classList.toggle("logged-in", loggedIn);
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

  // paneel dicht als niet ingelogd
  const panel = document.getElementById("login-panel");
  if (!loggedIn && panel) {
    panel.classList.add("hidden");
  }

  // restrict: sessions.html + chatlogs.html niet bereikbaar zonder login
  const path = window.location.pathname;
  const isSessionsPage = path.endsWith("sessions.html");
  const isChatPage = path.endsWith("chatlogs.html");

  if (!loggedIn && (isSessionsPage || isChatPage)) {
    window.location.href = "index.html";
  }
}

function setupLoginUI() {
  const loginBtn  = document.getElementById("login-toggle");
  const panel     = document.getElementById("login-panel");
  const form      = document.getElementById("login-form");
  const errorEl   = document.getElementById("login-error");
  const closeBtn  = document.getElementById("login-close");

  if (!loginBtn || !panel || !form) return;

  // Login/Logout knop rechtsboven
  loginBtn.addEventListener("click", () => {
    if (isLoggedIn()) {
      // Logout
      setLoggedInUser(null);
      refreshAuthUI();
      return;
    }

    // Login: overlay tonen/verbergen
    panel.classList.toggle("hidden");
    if (errorEl) errorEl.textContent = "";
  });

  // X-knop sluit overlay
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      panel.classList.add("hidden");
      if (errorEl) errorEl.textContent = "";
    });
  }

  // Klik op donkere achtergrond sluit ook overlay
  panel.addEventListener("click", (e) => {
    if (e.target === panel) {
      panel.classList.add("hidden");
      if (errorEl) errorEl.textContent = "";
    }
  });

  // Form submit (checkt nu tegen ACCOUNTS)
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const userInput = document
      .getElementById("login-username")
      .value.trim();
    const passInput = document
      .getElementById("login-password")
      .value.trim();

    // zoek een match in de ACCOUNTS lijst
    const account = ACCOUNTS.find(
      (acc) =>
        acc.username === userInput &&
        acc.password === passInput
    );

    if (account) {
      // success: user opslaan en UI updaten
      setLoggedInUser(account.username);
      panel.classList.add("hidden");
      if (errorEl) errorEl.textContent = "";
      form.reset();
      refreshAuthUI();
    } else {
      if (errorEl) {
        errorEl.textContent = "Invalid username or password.";
      }
    }
  });
}

// init
document.addEventListener("DOMContentLoaded", () => {
  setupLoginUI();
  refreshAuthUI();
});
