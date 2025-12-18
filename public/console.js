// console.js
document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".stats-card");
  if (!card) return;

  const langItems = card.querySelectorAll(".lang-item");
  const langBlocks = card.querySelectorAll(".lang-block");

  if (!langItems.length || !langBlocks.length) return;

  function setLanguage(lang) {
    langBlocks.forEach((block) => {
      if (block.dataset.lang === lang) {
        block.classList.remove("hidden");
      } else {
        block.classList.add("hidden");
      }
    });

    langItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.lang === lang);
    });
  }

  langItems.forEach((item) => {
    item.addEventListener("click", () => {
      const lang = item.dataset.lang;
      setLanguage(lang);
    });
  });

  // standaard Engels (exact zoals howto.js)
  setLanguage("en");
});
