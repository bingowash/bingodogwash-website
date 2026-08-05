const api = "/api/admin/marketing";
let token = "";
let state = null;
const pending = new Set();
const qs = (value) => document.querySelector(value);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));
const tokenMessages = {
  empty: "Enter your admin token.",
  unsupported: "The admin token contains an unsupported character. Retype it using standard letters, numbers, and symbols.",
  incorrect: "Incorrect admin token.",
  forbidden: "You do not have permission to access marketing.",
  configuration: "Marketing service is not configured.",
  unavailable: "Marketing service is currently unavailable.",
};
const safePreflightMessages = new Set([
  "Meta access token is not configured.",
  "Meta connection has expired or is invalid. Reconnect Meta in server settings.",
  "Meta account connection is incomplete.",
  "Meta connection does not have permission to publish.",
  "Meta service is temporarily unavailable.",
  "Instagram identity verified, but publishing permission cannot be confirmed without a controlled test post.",
]);
const preflightFallback = "The marketing request could not be completed.";

function safeError(message, status = 0) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateToken(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw safeError(tokenMessages.empty);
  if (!/^[\x21-\x7e]+$/.test(trimmed)) throw safeError(tokenMessages.unsupported);
  return trimmed;
}

function safePreflightResult(data) {
  const platform = (value) => ({
    ok: value?.ok === true,
    error: value?.ok === true ? "Connection verified." : (safePreflightMessages.has(value?.error) ? value.error : preflightFallback),
  });
  return {
    ok: data?.ok === true,
    paused: data?.paused === true,
    publishingAttempted: data?.publishingAttempted === true,
    facebook: platform(data?.facebook),
    instagram: platform(data?.instagram),
  };
}

async function call(path = "", options = {}) {
  let response;
  try {
    response = await fetch(api + path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type":"application/json", ...(options.headers || {}) } });
  } catch {
    throw safeError(tokenMessages.unavailable);
  }
  const data = await response.json().catch(() => ({ ok: false, error: `Marketing API returned HTTP ${response.status}.` }));
  if (response.status === 401) throw safeError(tokenMessages.incorrect, 401);
  if (response.status === 403) throw safeError(tokenMessages.forbidden, 403);
  if (response.status === 503) throw safeError(tokenMessages.configuration, 503);
  if (response.status === 422 && path === "/preflight") return safePreflightResult(data);
  if (!response.ok) throw safeError(response.status >= 500 ? tokenMessages.unavailable : (data.error || "The marketing request could not be completed."), response.status);
  return data;
}

function showResponse(value, isError = false) {
  const panel = qs("[data-marketing-response]"); panel.hidden = false; panel.classList.toggle("is-error", isError); panel.textContent = JSON.stringify(value, null, 2);
}

function showOAuthCallbackStatus() {
  const params = new URLSearchParams(window.location.search);
  const oauth = params.get("oauth");
  if (!oauth) return;
  const messages = {
    success: params.get("discovery") === "success"
      ? `Meta reconnected. Facebook returned ${Number(params.get("pages") || 0)} managed Page(s). Run Safe Preflight.`
      : "Meta credential stored, but managed Page discovery needs attention. Run Safe Preflight for details.",
    error: "Meta reconnect failed. Please try again or inspect the Worker callback logs.",
    invalid_state: "Meta reconnect state was invalid or already used. Start reconnect again from this page.",
    missing_code: "Facebook did not return an authorization code. Start reconnect again.",
    server_error: "Meta reconnect is not fully configured on the server.",
  };
  const message = messages[oauth] || "Meta reconnect did not complete.";
  qs("[data-marketing-message]").textContent = message;
  showResponse({ ok: oauth === "success", oauth, discovery: params.get("discovery") || "", returnedPageCount: Number(params.get("pages") || 0), message }, oauth !== "success");
  history.replaceState({}, "", window.location.pathname);
}

function formatUtcDate(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}

async function runOnce(key, button, task) {
  if (pending.has(key)) return;
  pending.add(key); const original = button?.textContent || "";
  if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Working…"; }
  try { return await task(); }
  catch (error) { const message = error?.message || tokenMessages.unavailable; showResponse({ ok: false, error: message, status: error?.status || 0 }, true); qs("[data-marketing-message]").textContent = message; }
  finally { pending.delete(key); if (button) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = original; } }
}

async function refresh() { state = await call(); render(); return state; }
function render() {
  qs("[data-marketing-dashboard]").hidden = false;
  const a = state.analytics || {}; const settings = state.settings || {};
  qs("[data-marketing-stats]").innerHTML = [["Products promoted",a.products_promoted],["Clicks",a.clicks],["Engagement",a.engagement],["Sales",a.sales]].map(([label,value]) => `<article class="card marketing-stat"><span>${label}</span><strong>${Number(value || 0)}</strong></article>`).join("");
  qs("[data-marketing-status]").textContent = `${settings.enabled ? "Automation active" : "Automation paused"}. Next scheduled post: ${settings.nextRunAt ? formatUtcDate(settings.nextRunAt) : "not scheduled"}. Last product: ${state.lastPost?.product_name || "none yet"}.`;
  qs("[data-marketing-schedule] [name=hourUtc]").value = settings.hourUtc; qs("[data-marketing-schedule] [name=minuteUtc]").value = settings.minuteUtc;
  const platformStatus = state.platformStatus || {};
  const connectedPlatforms = state.connectedPlatforms || {};
  qs("[data-marketing-platforms]").innerHTML = Object.entries(platformStatus).length ? Object.entries(platformStatus).map(([name,status]) => {
    const connected = status?.ok === true;
    const label = connected ? "Connected" : (connectedPlatforms[name] ? "Configured" : "Not configured");
    let detail = "";
    if (connected) {
      detail = status.pageId ? `Page ID: ${escapeHtml(status.pageId)}` : "Connection verified.";
    } else if (status?.error) {
      detail = escapeHtml(status.error);
    } else {
      detail = `Page ID: ${escapeHtml(status?.pageId || "unknown")}`;
    }
    if (name === "instagram" && !status?.ok && status?.publishingPermission === "unconfirmed") {
      detail = "Publishing permission unconfirmed; run a test post.";
    }
    return `<span class="platform-pill ${connected ? "connected" : ""}">${label}: ${escapeHtml(name)} — ${detail}</span>`;
  }).join("") : Object.entries(state.connectedPlatforms || {}).map(([name,connected]) => `<span class="platform-pill ${connected ? "connected" : ""}">${connected ? "Configured" : "Not configured"}: ${escapeHtml(name)}</span>`).join("");
  const best = a.bestProducts || []; const max = Math.max(1,...best.map((item) => Number(item.clicks)+Number(item.engagement)+Number(item.sales)*5));
  qs("[data-marketing-chart]").innerHTML = best.length ? best.map((item) => { const score=Number(item.clicks)+Number(item.engagement)+Number(item.sales)*5; return `<div class="marketing-bar"><strong>${escapeHtml(item.product_name)}</strong><div class="marketing-bar-track"><div class="marketing-bar-fill" style="width:${Math.max(3,score/max*100)}%"></div></div><span>${item.clicks} clicks · ${item.sales} sales</span></div>`; }).join("") : "<p>No campaign activity yet.</p>";
  qs("[data-marketing-history]").innerHTML = `<table class="marketing-table"><thead><tr><th>Date</th><th>Product</th><th>Status</th><th>Platforms</th><th>Caption / error</th></tr></thead><tbody>${(state.history || []).map((post) => `<tr><td>${escapeHtml(new Date(post.created_at).toLocaleString())}</td><td>${escapeHtml(post.product_name)}</td><td class="status-${escapeHtml(post.status)}">${escapeHtml(post.status)}</td><td>${post.facebook_post_id ? "Facebook ✓ " : ""}${post.instagram_post_id ? "Instagram ✓" : ""}</td><td><small>${escapeHtml(post.error_message || post.caption)}</small></td></tr>`).join("") || '<tr><td colspan="5">No posts yet.</td></tr>'}</tbody></table>`;
}

const unlockForm = qs("[data-marketing-unlock]");
const tokenInput = unlockForm.querySelector("[name=token]");
tokenInput.addEventListener("paste", (event) => {
  try {
    validateToken(event.clipboardData?.getData("text") || "");
  } catch (error) {
    event.preventDefault();
    const message = error?.message || tokenMessages.unsupported;
    qs("[data-marketing-message]").textContent = message;
    showResponse({ ok: false, error: message, status: 0 }, true);
  }
});
unlockForm.addEventListener("submit", (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); runOnce("unlock", button, async () => { token = validateToken(new FormData(event.currentTarget).get("token")); const result = await refresh(); qs("[data-marketing-message]").textContent = "Marketing controls unlocked."; showResponse({ ok: result.ok, settings: result.settings, connectedPlatforms: result.connectedPlatforms }); }); });
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  const action = button?.dataset.action;
  if (!action) return;
  if (action === "logs") { qs("#marketing-logs").scrollIntoView({behavior:"smooth"}); return; }
  if (action === "oauth-start") {
    runOnce(`action:${action}`, button, async () => {
      const result = await call("/oauth/start", { method:"POST", body:"{}" });
      if (!result?.url || !result.url.startsWith("https://www.facebook.com/")) throw safeError("Meta reconnect could not be started.");
      qs("[data-marketing-message]").textContent = "Opening Facebook to reconnect Metaâ€¦";
      window.location.assign(result.url);
    });
    return;
  }
  runOnce(`action:${action}`, button, async () => { const result = await call(`/${action}`, {method:"POST",body:"{}"}); showResponse(result); await refresh(); qs("[data-marketing-message]").textContent = `${action} completed.`; });
});
qs("[data-marketing-schedule]").addEventListener("submit", (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); runOnce("schedule", button, async () => { const values=Object.fromEntries(new FormData(event.currentTarget)); const result = await call("/schedule",{method:"POST",body:JSON.stringify({hourUtc:Number(values.hourUtc),minuteUtc:Number(values.minuteUtc)})}); showResponse(result); await refresh(); qs("[data-marketing-message]").textContent="Schedule updated."; }); });
showOAuthCallbackStatus();
