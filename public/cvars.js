// cvars.js
document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".stats-card");
  if (!card) return;

  const langItems = card.querySelectorAll(".lang-item");
  const langBlocks = card.querySelectorAll(".lang-block");

  if (!langItems.length || !langBlocks.length) return;

  function setLanguage(lang) {
    langBlocks.forEach((block) => {
      block.classList.toggle("hidden", block.dataset.lang !== lang);
    });

    langItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.lang === lang);
    });
  }

  langItems.forEach((item) => {
    item.addEventListener("click", () => {
      setLanguage(item.dataset.lang);
    });
  });

  setLanguage("en");
});
