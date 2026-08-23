const api = "/api/admin/marketing";
const tiktokApi = "/api/tiktok";
let token = "";
let state = null;
let oauthCallbackResult = null;
let secondaryOAuthFlow = "";
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
  // Preflight diagnostics are sanitized by the Worker and intentionally include
  // per-Page discovery details. Preserve that structure for troubleshooting.
  if (response.status === 422 && path === "/preflight") return data;
  if (!response.ok) throw safeError(response.status >= 500 ? tokenMessages.unavailable : (data.error || "The marketing request could not be completed."), response.status);
  return data;
}

async function callTikTok(path, options = {}) {
  const response = await fetch(tiktokApi + path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type":"application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({ ok: false, error: `TikTok API returned HTTP ${response.status}.` }));
  if (response.status === 401) throw safeError(tokenMessages.incorrect, 401);
  if (!response.ok) throw safeError(data.error || "The TikTok request could not be completed.", response.status);
  return data;
}

async function refreshTikTokStatus() {
  const result = await callTikTok("/status");
  const accounts = result.tiktok?.accounts || {};
  for (const role of ["creator", "marketing"]) {
    const account = accounts[role] || {};
    const identity = account.username ? `@${account.username}` : account.displayName || "Account name unavailable";
    const scopes = Array.isArray(account.scopesAvailable) && account.scopesAvailable.length ? account.scopesAvailable.join(", ") : "none granted";
    const directPost = role === "marketing" ? ` Direct Post: ${result.tiktok?.directPostEnabled ? account.directPostReady ? "ready" : "enabled but awaiting video.publish" : "disabled"}.` : "";
    qs(`[data-tiktok-${role}-status]`).textContent = `${account.connected ? "Connected" : "Disconnected"} · ${identity}. Token present: ${account.tokenPresent ? "yes" : "no"}. Scopes: ${scopes}.${directPost}`;
  }
  return result;
}

function showResponse(value, isError = false) {
  const panel = qs("[data-marketing-response]"); panel.hidden = false; panel.classList.toggle("is-error", isError); panel.textContent = JSON.stringify(value, null, 2);
}

function showOAuthCallbackStatus() {
  const params = new URLSearchParams(window.location.search);
  const tiktok = params.get("tiktok");
  if (tiktok) {
    const messages = { success: "TikTok connected. Unlock marketing controls to verify the connection.", invalid_state: "TikTok connection state was invalid or already used. Start again.", missing_code: "TikTok did not return an authorization code.", provider_error: "TikTok authorisation was cancelled or rejected.", token_exchange_failed: "TikTok connection failed during token exchange.", server_error: "TikTok OAuth is not fully configured on the server." };
    const message = messages[tiktok] || "TikTok connection did not complete.";
    qs("[data-marketing-message]").textContent = message;
    oauthCallbackResult = { ok: tiktok === "success", provider: "tiktok", result: tiktok, message };
    showResponse(oauthCallbackResult, tiktok !== "success");
    history.replaceState({}, "", window.location.pathname);
    return;
  }
  const oauth = params.get("oauth");
  if (!oauth) return;
  const providerHttpStatus = Number(params.get("httpStatus") || 0) || null;
  const providerErrorCode = Number(params.get("providerCode") || params.get("code") || 0) || null;
  const providerErrorType = params.get("providerType") || null;
  const providerErrorSubcode = Number(params.get("providerSubcode") || 0) || null;
  const safeProviderMessage = params.get("providerMessage") || "";
  const safeFailureSummary = [providerHttpStatus ? `HTTP ${providerHttpStatus}` : "", providerErrorCode ? `Meta code ${providerErrorCode}` : "", providerErrorType, providerErrorSubcode ? `subcode ${providerErrorSubcode}` : "", safeProviderMessage].filter(Boolean).join("; ");
  const messages = {
    success: params.get("discovery") === "success"
      ? `Meta reconnected. Facebook returned ${Number(params.get("pages") || 0)} managed Page(s). Run Safe Preflight.`
      : "Meta credential stored, but managed Page discovery needs attention. Run Safe Preflight for details.",
    error: `Meta reconnect failed during ${params.get("stage") || "an unknown stage"}.${safeFailureSummary ? ` ${safeFailureSummary}` : ""}`,
    invalid_state: "Meta reconnect state was invalid or already used. Start reconnect again from this page.",
    missing_code: "Facebook did not return an authorization code. Start reconnect again.",
    server_error: "Meta reconnect is not fully configured on the server.",
    secondary_select: `Meta returned ${Number(params.get("pages") || 0)} manageable Page(s). Unlock marketing and choose Facebook Secondary.`,
  };
  const message = messages[oauth] || "Meta reconnect did not complete.";
  qs("[data-marketing-message]").textContent = message;
  oauthCallbackResult = {
    ok: oauth === "success" || oauth === "secondary_select",
    oauth,
    stage: params.get("stage") || "",
    providerHttpStatus,
    providerErrorCode,
    providerErrorType,
    providerErrorSubcode,
    safeProviderMessage,
    appIdConfigured: params.get("appIdConfigured") === "true",
    appSecretConfigured: params.get("appSecretConfigured") === "true",
    redirectUriConfigured: params.get("redirectUriConfigured") === "true",
    redirectUriUsed: params.get("redirectUriUsed") || "",
    callbackHost: params.get("callbackHost") || "",
    productionEnvironment: params.get("productionEnvironment") === "true",
    graphHost: params.get("graphHost") || "",
    graphApiVersion: params.get("graphApiVersion") || "",
    requestMethod: params.get("requestMethod") || "",
    discovery: params.get("discovery") || "",
    returnedPageCount: Number(params.get("pages") || 0),
    message,
  };
  if (oauth === "secondary_select") secondaryOAuthFlow = params.get("flow") || "";
  showResponse(oauthCallbackResult, !oauthCallbackResult.ok);
  history.replaceState({}, "", window.location.pathname);
}

function formatUtcDate(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function tiktokAccountLabel(post) {
  try { return JSON.parse(post.tiktok_metadata || "{}").accountRole === "marketing" ? "TikTok Marketing" : "TikTok Creator"; }
  catch { return "TikTok"; }
}

async function runOnce(key, button, task) {
  if (pending.has(key)) return;
  pending.add(key); const original = button?.textContent || "";
  if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Working…"; }
  try { return await task(); }
  catch (error) { const message = error?.message || tokenMessages.unavailable; showResponse({ ok: false, error: message, status: error?.status || 0 }, true); qs("[data-marketing-message]").textContent = message; }
  finally { pending.delete(key); if (button) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = original; } }
}

async function refresh() { state = await call(); render(); await refreshTikTokStatus(); return state; }
async function loadSecondaryCandidates() {
  if (!secondaryOAuthFlow) return;
  const result = await call("/oauth/secondary/candidates", { method: "POST", body: JSON.stringify({ flowId: secondaryOAuthFlow }) });
  const panel = qs("[data-facebook-secondary-selector]");
  panel.hidden = false;
  panel.innerHTML = result.pages?.length
    ? `<label>Managed Page<select data-facebook-secondary-page>${result.pages.map((page) => `<option value="${escapeHtml(page.pageId)}">${escapeHtml(page.pageName)} (${escapeHtml(page.pageId)})</option>`).join("")}</select></label><button class="btn btn-secondary" type="button" data-action="oauth-secondary-select">Use as Facebook Secondary</button>`
    : "<p>Meta returned no manageable Facebook Pages. Profiles and manually entered IDs cannot be connected here.</p>";
}
function render() {
  qs("[data-marketing-dashboard]").hidden = false;
  const a = state.analytics || {}; const settings = state.settings || {};
  qs("[data-marketing-stats]").innerHTML = [["Products promoted",a.products_promoted],["Clicks",a.clicks],["Engagement",a.engagement],["Sales",a.sales]].map(([label,value]) => `<article class="card marketing-stat"><span>${label}</span><strong>${Number(value || 0)}</strong></article>`).join("");
  const nextProduct = state.nextEligibleProduct;
  const rotationText = nextProduct
    ? `Next eligible product: ${nextProduct.name}${nextProduct.cooldownFallback ? " (least recently posted; all other products are within the 7-day cooldown)" : ""}.`
    : "Next eligible product: none currently eligible.";
  qs("[data-marketing-status]").textContent = `${settings.enabled ? "Automation active" : "Automation paused"}. Posting every ${settings.intervalHours || 4} hours. Next scheduled post: ${settings.nextRunAt ? formatUtcDate(settings.nextRunAt) : "not scheduled"}. Last product: ${state.lastPost?.product_name || "none yet"}. ${rotationText}`;
  qs("[data-marketing-schedule] [name=hourUtc]").value = settings.hourUtc; qs("[data-marketing-schedule] [name=minuteUtc]").value = settings.minuteUtc;
  const platformStatus = state.platformStatus || {};
  const connectedPlatforms = state.connectedPlatforms || {};
  const primary = platformStatus.facebookPrimary || {};
  const secondary = platformStatus.facebookSecondary || {};
  qs("[data-facebook-primary-status]").textContent = `${primary.ok ? "Connected" : "Needs attention"} · Page ${primary.id || primary.pageId || "not available"}. ${primary.error || primary.statusMessage || "Primary credential verified."}`;
  qs("[data-facebook-secondary-status]").textContent = `${secondary.connected ? secondary.ok ? "Connected" : "Needs attention" : "Not connected"} · ${secondary.pageName || "No Page selected"}${secondary.pageId ? ` (${secondary.pageId})` : ""}. ${secondary.error || "Independent secondary destination."}`;
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
  qs("[data-marketing-history]").innerHTML = `<table class="marketing-table"><thead><tr><th>Date</th><th>Product</th><th>Status</th><th>Platforms</th><th>Caption / error</th></tr></thead><tbody>${(state.history || []).map((post) => { const facebook = (post.facebook_destinations || []).map((item) => { const primary = item.connectionRole === "facebook_primary"; const followUp = primary ? `<br>Collaborator follow-up: ${escapeHtml(item.collaborationState)}${item.collaborationState === "pending" ? ` <button class="btn btn-light" type="button" data-action="facebook-collaboration" data-platform-result-id="${escapeHtml(item.platformResultId)}" data-collaboration-state="completed">Mark completed</button>` : item.collaborationState === "completed" ? ` <button class="btn btn-light" type="button" data-action="facebook-collaboration" data-platform-result-id="${escapeHtml(item.platformResultId)}" data-collaboration-state="pending">Reset pending</button>` : ""}${item.postUrl ? ` <a class="btn btn-light" href="${escapeHtml(item.postUrl)}" target="_blank" rel="noopener noreferrer">Open Facebook post</a>` : ""}` : ""; return `${item.connectionRole === "facebook_secondary" ? "Facebook Secondary" : "Facebook Primary"}: ${escapeHtml(item.pageName || item.pageId)} (${escapeHtml(item.pageId)}) ${escapeHtml(item.status)}${item.externalPostId ? ` · ID ${escapeHtml(item.externalPostId)}` : ""}${item.error ? ` · ${escapeHtml(item.error)}` : ""}${followUp}`; }).join("<br>"); return `<tr><td>${escapeHtml(new Date(post.created_at).toLocaleString())}</td><td>${escapeHtml(post.product_name)}</td><td class="status-${escapeHtml(post.status)}">${escapeHtml(post.status)}</td><td>${facebook}${facebook && (post.instagram_post_id || post.tiktok_status) ? "<br>" : ""}${post.instagram_post_id ? "Instagram ✓ " : ""}${post.tiktok_status || String(post.trigger_type || "").includes("tiktok") ? `${tiktokAccountLabel(post)} ${post.tiktok_status === "success" || post.status === "success" ? "draft ✓" : "draft failed"}${post.tiktok_publish_id ? ` · ID ${escapeHtml(post.tiktok_publish_id)}` : ""}` : ""}</td><td><small>${escapeHtml(post.error_message || post.caption)}</small></td></tr>`; }).join("") || '<tr><td colspan="5">No posts yet.</td></tr>'}</tbody></table>`;
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
unlockForm.addEventListener("submit", (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); runOnce("unlock", button, async () => { token = validateToken(new FormData(event.currentTarget).get("token")); const result = await refresh(); await loadSecondaryCandidates(); if (oauthCallbackResult) { qs("[data-marketing-message]").textContent = oauthCallbackResult.message; showResponse(oauthCallbackResult, oauthCallbackResult.ok !== true); } else { qs("[data-marketing-message]").textContent = "Marketing controls unlocked."; showResponse({ ok: result.ok, settings: result.settings, connectedPlatforms: result.connectedPlatforms }); } }); });
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  const action = button?.dataset.action;
  if (!action) return;
  if (action === "logs") { qs("#marketing-logs").scrollIntoView({behavior:"smooth"}); return; }
  if (action === "facebook-collaboration") {
    runOnce(`action:${action}:${button.dataset.platformResultId}`, button, async () => {
      const result = await call("/facebook-collaboration", { method:"POST", body:JSON.stringify({ platformResultId: button.dataset.platformResultId, state: button.dataset.collaborationState }) });
      showResponse(result);
      await refresh();
      qs("[data-marketing-message]").textContent = `Facebook collaborator follow-up marked ${result.collaborationState}.`;
    });
    return;
  }
  if (action === "instagram-sharing-test") {
    if (!window.confirm("This creates ONE REAL Instagram post on bingo_dogwash. Continue with the Instagram-only sharing test?")) return;
    runOnce(`action:${action}`, button, async () => {
      const result = await call("/instagram-sharing-test", { method:"POST", body:"{}" });
      showResponse(result);
      await refresh();
      qs("[data-marketing-message]").textContent = result.instagram?.success
        ? "Instagram sharing test published. Manually check Bingodog Wash on Facebook for Accounts Centre sharing."
        : "Instagram sharing test did not publish.";
    });
    return;
  }
  if (action === "oauth-start") {
    runOnce(`action:${action}`, button, async () => {
      const result = await call("/oauth/start", { method:"POST", body:"{}" });
      if (!result?.url || !result.url.startsWith("https://www.facebook.com/")) throw safeError("Meta reconnect could not be started.");
      qs("[data-marketing-message]").textContent = "Opening Facebook to reconnect Metaâ€¦";
      window.location.assign(result.url);
    });
    return;
  }
  if (action === "oauth-secondary-start") {
    runOnce(`action:${action}`, button, async () => {
      const result = await call("/oauth/secondary/start", { method:"POST", body:"{}" });
      if (!result?.url || !result.url.startsWith("https://www.facebook.com/")) throw safeError("Secondary Facebook connection could not be started.");
      window.location.assign(result.url);
    });
    return;
  }
  if (action === "oauth-secondary-select") {
    runOnce(`action:${action}`, button, async () => {
      const pageId = qs("[data-facebook-secondary-page]")?.value || "";
      const result = await call("/oauth/secondary/select", { method:"POST", body:JSON.stringify({ flowId: secondaryOAuthFlow, pageId }) });
      secondaryOAuthFlow = "";
      qs("[data-facebook-secondary-selector]").hidden = true;
      showResponse(result);
      await refresh();
    });
    return;
  }
  if (action === "tiktok-connect") {
    runOnce(`action:${action}`, button, async () => {
      const role = button.dataset.accountRole || "creator";
      const result = await callTikTok(`/connect?accountRole=${encodeURIComponent(role)}`);
      if (!result?.url || !result.url.startsWith("https://www.tiktok.com/")) throw safeError("TikTok connection could not be started.");
      window.location.assign(result.url);
    });
    return;
  }
  if (action === "tiktok-refresh") {
    const role = button.dataset.accountRole || "creator";
    runOnce(`action:${action}:${role}`, button, async () => { const result = await callTikTok(`/refresh?accountRole=${encodeURIComponent(role)}`, { method:"POST", body:"{}" }); showResponse(result); await refreshTikTokStatus(); });
    return;
  }
  runOnce(`action:${action}`, button, async () => { const result = await call(`/${action}`, {method:"POST",body:"{}"}); showResponse(result); await refresh(); qs("[data-marketing-message]").textContent = `${action} completed.`; });
});
qs("[data-marketing-schedule]").addEventListener("submit", (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); runOnce("schedule", button, async () => { const values=Object.fromEntries(new FormData(event.currentTarget)); const result = await call("/schedule",{method:"POST",body:JSON.stringify({hourUtc:Number(values.hourUtc),minuteUtc:Number(values.minuteUtc)})}); showResponse(result); await refresh(); qs("[data-marketing-message]").textContent="Schedule updated."; }); });
qs("[data-tiktok-draft-test]").addEventListener("submit", (event) => { event.preventDefault(); const form=event.currentTarget; const button=form.querySelector("button"); runOnce("tiktok-draft-test", button, async () => { const file=form.elements.video.files?.[0]; if(!file)throw safeError("Select a video before testing TikTok draft upload.",400); const allowed=new Map([["video/mp4",".mp4"],["video/quicktime",".mov"],["video/webm",".webm"]]); const extension=allowed.get(file.type); if(!extension||!file.name.toLowerCase().endsWith(extension))throw safeError("Unsupported video type. Choose an MP4, MOV or WebM file whose extension matches its format.",415); if(file.size>64*1024*1024)throw safeError("Test videos must be 64 MB or smaller.",413); const response=await fetch(`${tiktokApi}/draft?filename=${encodeURIComponent(file.name)}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":file.type},body:file}); const result=await response.json().catch(()=>({ok:false,error:`TikTok API returned HTTP ${response.status}.`})); if(!response.ok||!result.ok){showResponse(result,true);qs("[data-marketing-message]").textContent=result.error||"TikTok draft upload failed.";await refresh();return;} showResponse(result); qs("[data-marketing-message]").textContent=result.message; form.reset(); await refresh(); }); });
showOAuthCallbackStatus();
