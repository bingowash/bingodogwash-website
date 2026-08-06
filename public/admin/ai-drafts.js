const aiDraftApi = location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/ai-drafts"
  : "/api/admin/ai-drafts";

function aiAdminToken() {
  return sessionStorage.getItem("bingoAdminCoreToken") || sessionStorage.getItem("bingoAdminGiftCardToken") || "";
}

function setAiMessage(message) {
  const target = document.querySelector("[data-ai-message]");
  if (target) target.textContent = message;
}

function unlockAiWorkspace() {
  const workspace = document.querySelector("[data-ai-workspace]");
  if (!workspace || !aiAdminToken()) return;
  workspace.hidden = false;
  setAiMessage("Drafting unlocked for this browser session.");
}

document.querySelector("[data-ai-token-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const token = event.currentTarget.elements.token.value.trim();
  if (!token) return;
  sessionStorage.setItem("bingoAdminCoreToken", token);
  event.currentTarget.elements.token.value = "";
  unlockAiWorkspace();
});

document.querySelector("[data-ai-draft-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("[data-ai-result-status]");
  const button = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form));
  if (status) status.textContent = "Generating a draft…";
  if (button) button.disabled = true;
  try {
    const response = await fetch(aiDraftApi, {
      method: "POST",
      headers: { Authorization: `Bearer ${aiAdminToken()}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "AI drafting is unavailable.");
    Object.entries(data.draft || {}).forEach(([name, value]) => {
      const field = document.querySelector(`[data-ai-output="${name}"]`);
      if (field) field.value = String(value || "");
    });
    if (status) status.textContent = "New editable draft generated. Nothing has been saved or published.";
  } catch (error) {
    if (status) status.textContent = error.message || "AI drafting is unavailable.";
  } finally {
    if (button) button.disabled = false;
  }
});

document.querySelectorAll("[data-ai-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const field = document.querySelector(`[data-ai-output="${button.dataset.aiCopy}"]`);
    if (!field?.value) return;
    await navigator.clipboard.writeText(field.value);
    const previous = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = previous; }, 1400);
  });
});

unlockAiWorkspace();
