// login.js
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("login-toggle");
    const panel = document.getElementById("login-panel");
    const closeBtn = document.getElementById("login-close");
    const userLabel = document.getElementById("login-user-label");
  
    if (!btn) return;
  
    function isLoggedIn() {
      return btn.classList.contains("logged-in");
    }
  
    function setAriaLabel() {
      btn.setAttribute("aria-label", isLoggedIn() ? "Logout" : "Login");
    }
  
    function openPanel() {
      if (!panel) return;
      panel.classList.remove("hidden");
    }
  
    function closePanel() {
      if (!panel) return;
      panel.classList.add("hidden");
    }
  
    // Init
    setAriaLabel();
  
    // Klik op de login-knop
    btn.addEventListener("click", () => {
      // Als je al ingelogd bent: dan is dit "Logout"
      if (isLoggedIn()) {
        btn.classList.remove("logged-in");
        setAriaLabel();
  
        if (userLabel) {
          userLabel.classList.add("hidden");
          userLabel.textContent = "";
        }
  
        // Optioneel: panel ook dicht
        closePanel();
        return;
      }
  
      // Niet ingelogd -> open login overlay
      openPanel();
    });
  
    // Close button in overlay
    if (closeBtn) {
      closeBtn.addEventListener("click", closePanel);
    }
  
    // Klik buiten dialog = sluiten
    if (panel) {
      panel.addEventListener("click", (e) => {
        if (e.target === panel) closePanel();
      });
    }
  
    // Escape = sluiten
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
  
    /**
     * 👇 OPTIONAL helper:
     * Als je login-form ergens anders succesvol is, roep dit aan:
     * window.setLoggedIn("Username");
     */
    window.setLoggedIn = (username) => {
      btn.classList.add("logged-in");
      setAriaLabel();
      closePanel();
  
      if (userLabel) {
        userLabel.classList.remove("hidden");
        userLabel.innerHTML = `Logged in as <span class="login-user-name">${username}</span>`;
      }
    };
  });
  