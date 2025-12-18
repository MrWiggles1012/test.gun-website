// upload.js
// Zorgt ervoor dat het formulier via fetch wordt verstuurd
// en toont een mooi bericht in plaats van een kale JSON-pagina.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("screenshot");
  const messageEl = document.getElementById("upload-message");
  const toastEl = document.getElementById("upload-toast");
  const submitBtn = form?.querySelector("button[type='submit']");

  if (!form || !fileInput || !messageEl || !toastEl || !submitBtn) return;

  let toastTimer = null;

  function showToast(type, title, sub) {
    clearTimeout(toastTimer);

    toastEl.classList.remove("hidden", "success", "error");
    toastEl.classList.add(type);

    toastEl.innerHTML = `
      <div class="toast-row">
        <div class="toast-icon" aria-hidden="true"></div>
        <div class="toast-text">
          <div class="toast-title">${title}</div>
          <div class="toast-sub">${sub}</div>
        </div>
      </div>
    `;

    toastTimer = setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 4500);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // reset inline message
    messageEl.textContent = "";
    messageEl.classList.remove("success", "error");

    // validation
    if (!fileInput.files || fileInput.files.length === 0) {
      messageEl.textContent = "Please select a .tga file first.";
      messageEl.classList.add("error");
      showToast("error", "No file selected", "Select a .tga screenshot before uploading.");
      return;
    }

    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith(".tga")) {
      messageEl.textContent = "Only .tga files are allowed.";
      messageEl.classList.add("error");
      showToast("error", "Invalid file type", "Only .tga screenshots are accepted.");
      return;
    }

    const formData = new FormData(form);

    // busy state
    submitBtn.disabled = true;
    submitBtn.classList.add("is-busy");
    submitBtn.setAttribute("aria-busy", "true");

    messageEl.textContent = "Uploading screenshot…";

    try {
      const res = await fetch("/api/upload-screenshot", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const msg = data.error || "Upload failed. Please try again.";
        messageEl.textContent = msg;
        messageEl.classList.add("error");
        showToast("error", "Upload failed", msg);
        return;
      }

      // success
      const okMsg = data.message || "Screenshot uploaded successfully.";
      messageEl.textContent = okMsg;
      messageEl.classList.add("success");

      showToast("success", "Upload successful", "Your screenshot has been submitted for review.");
      form.reset();
    } catch (err) {
      console.error("Upload error:", err);
      messageEl.textContent = "Unexpected error while uploading. Please try again later.";
      messageEl.classList.add("error");
      showToast("error", "Unexpected error", "Please try again later.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-busy");
      submitBtn.removeAttribute("aria-busy");
    }
  });
});

