// upload.js
// Zorgt ervoor dat het formulier via fetch wordt verstuurd
// en toont een mooi bericht in plaats van een kale JSON-pagina.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("screenshot");
  const messageEl = document.getElementById("upload-message");

  if (!form || !fileInput || !messageEl) return;

  form.addEventListener("submit", async (event) => {
    // 1) Normale form-submit (page reload) tegenhouden
    event.preventDefault();

    // 2) Bericht resetten
    messageEl.textContent = "";
    messageEl.classList.remove("success", "error");

    // 3) Check: is er een bestand gekozen?
    if (!fileInput.files || fileInput.files.length === 0) {
      messageEl.textContent = "Please select a .tga file first.";
      messageEl.classList.add("error");
      return;
    }

    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith(".tga")) {
      messageEl.textContent = "Only .tga files are allowed.";
      messageEl.classList.add("error");
      return;
    }

    // 4) FormData maken op basis van het formulier
    const formData = new FormData(form);

    // 5) “Bezig” bericht tonen
    messageEl.textContent = "Uploading screenshot…";
    // (optioneel: andere kleur, maar we laten hem even default)

    try {
      // 6) Upload naar je Node/Express API
      const res = await fetch("/api/upload-screenshot", {
        method: "POST",
        body: formData,
      });

      // Proberen JSON te lezen; lukt het niet, dan een lege {} terug
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const msg = data.error || "Upload failed. Please try again.";
        messageEl.textContent = msg;
        messageEl.classList.add("error");
        return;
      }

      // 7) Success!
      messageEl.textContent =
        data.message || "Screenshot uploaded successfully.";
      messageEl.classList.add("success");

      // Input weer leeg maken
      form.reset();
    } catch (err) {
      console.error("Upload error:", err);
      messageEl.textContent =
        "Unexpected error while uploading. Please try again later.";
      messageEl.classList.add("error");
    }
  });
});
