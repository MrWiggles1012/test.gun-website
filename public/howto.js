// howto.js
document.addEventListener("DOMContentLoaded", () => {
  const langItems = document.querySelectorAll(".lang-item");
  const langBlocks = document.querySelectorAll(".lang-block");

  if (!langItems.length || !langBlocks.length) return;

  function setLanguage(lang) {
    // content-blokken show/hide
    langBlocks.forEach((block) => {
      if (block.dataset.lang === lang) {
        block.classList.remove("hidden");
      } else {
        block.classList.add("hidden");
      }
    });

    // active state op de knoppen
    langItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.lang === lang);
    });
  }

  // klik-handler op English / Arabic
  langItems.forEach((item) => {
    item.addEventListener("click", () => {
      const lang = item.dataset.lang;
      setLanguage(lang);
    });
  });

  // standaard Engels
  setLanguage("en");
});
