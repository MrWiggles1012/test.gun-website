// unnamedsoldier-cfg.js
document.addEventListener("DOMContentLoaded", () => {
  // Alleen targets binnen de card/pagina (veilig als je ooit meerdere cards krijgt)
  // Als je geen wrapper gebruikt, kun je gewoon document.querySelectorAll blijven gebruiken.
  const root = document; // of: document.querySelector(".stats-card") || document;

  const langItems = root.querySelectorAll(".lang-item");
  const langBlocks = root.querySelectorAll(".lang-block");

  if (!langItems.length || !langBlocks.length) return;

  const STORAGE_KEY = "unnamedsoldier_cfg_lang";
  const DEFAULT_LANG = "en";

  function setLanguage(lang) {
    // content-blokken show/hide
    langBlocks.forEach((block) => {
      block.classList.toggle("hidden", block.dataset.lang !== lang);
    });

    // active state op de knoppen
    langItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.lang === lang);
    });

    // onthouden
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // ignore
    }
  }

  function getSavedLang() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getInitialLang() {
    const saved = getSavedLang();
    const available = new Set(
      Array.from(langBlocks).map((b) => b.dataset.lang).filter(Boolean)
    );

    // 1) saved als die bestaat op de pagina
    if (saved && available.has(saved)) return saved;

    // 2) default als die bestaat
    if (available.has(DEFAULT_LANG)) return DEFAULT_LANG;

    // 3) anders eerste beschikbare
    return Array.from(available)[0] || DEFAULT_LANG;
  }

  // klik-handler op flags/taal-items
  langItems.forEach((item) => {
    item.addEventListener("click", () => {
      const lang = item.dataset.lang;
      if (!lang) return;
      setLanguage(lang);
    });
  });

  // init
  setLanguage(getInitialLang());
});
