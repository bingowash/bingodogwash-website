const stripeAdminApi = location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/stripe"
  : "/api/admin/stripe";

const stripeMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function stripeAdminToken() {
  return sessionStorage.getItem("bingoAdminCoreToken") || sessionStorage.getItem("bingoAdminGiftCardToken") || "";
}

function stripeEscape(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function stripeDate(value) {
  if (!value) return "No event recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB");
}

async function loadStripeAdmin() {
  const panel = document.querySelector("[data-stripe-admin-panel]");
  const message = document.querySelector("[data-stripe-admin-message]");
  if (!panel || !stripeAdminToken()) return;
  panel.hidden = false;
  if (message) message.textContent = "Loading payment reporting…";

  try {
    const response = await fetch(stripeAdminApi, {
      headers: { Authorization: `Bearer ${stripeAdminToken()}`, Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Payment reporting is unavailable.");
    renderStripeSummary(data.totals || {});
    renderStripeHealth(data.connection || {});
    renderStripeRecent(data.recent || []);
    if (message) message.textContent = "Payment reporting unlocked for this browser session.";
  } catch (error) {
    if (message) message.textContent = error.message || "Payment reporting is unavailable.";
  }
}

function renderStripeSummary(totals) {
  const target = document.querySelector("[data-stripe-summary]");
  if (!target) return;
  const cards = [
    ["All recorded payments", totals.count, totals.amount],
    ["Dog wash", totals.wash?.count, totals.wash?.amount],
    ["Gift cards", totals.giftCards?.count, totals.giftCards?.amount],
    ["Giveaway + competition", Number(totals.giveaway?.count || 0) + Number(totals.competition?.count || 0), Number(totals.giveaway?.amount || 0) + Number(totals.competition?.amount || 0)]
  ];
  target.innerHTML = cards.map(([label, count, amount]) => `<article class="card admin-source-card"><p class="tag">Payments</p><h3>${stripeEscape(label)}</h3><strong>${stripeEscape(count || 0)}</strong><p>${stripeEscape(stripeMoney.format(Number(amount || 0) / 100))}</p></article>`).join("");
}

function renderStripeHealth(connection) {
  const target = document.querySelector("[data-stripe-health]");
  if (!target) return;
  const status = (ready) => ready ? "Configured" : "Needs attention";
  target.innerHTML = `
    <div class="mini-row"><strong>Stripe server key</strong><span class="tag">${status(connection.secretKeyConfigured)}</span></div>
    <div class="mini-row"><strong>Webhook signing secret</strong><span class="tag">${status(connection.webhookSecretConfigured)}</span></div>
    <div class="mini-row"><strong>Verified webhook route</strong><span>${stripeEscape(connection.webhookPath || "/api/stripe-webhook")}</span></div>
    <div class="mini-row"><strong>Last recorded webhook</strong><span>${stripeEscape(stripeDate(connection.lastWebhookAt))}</span></div>`;
}

function renderStripeRecent(rows) {
  const target = document.querySelector("[data-stripe-recent]");
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = '<div class="mini-row"><strong>No payments recorded</strong><span>Successful Stripe-backed activity will appear here.</span></div>';
    return;
  }
  target.innerHTML = `<table class="admin-giveaway-table"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${stripeEscape(stripeDate(row.createdAt))}</td><td>${stripeEscape(row.source)}</td><td>${stripeEscape(row.reference)}</td><td>${stripeEscape(row.customer)}</td><td>${stripeEscape(stripeMoney.format(Number(row.amount || 0) / 100))}</td><td><span class="tag">${stripeEscape(row.status)}</span></td></tr>`).join("")}</tbody></table>`;
}

document.querySelector("[data-stripe-admin-token-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  sessionStorage.setItem("bingoAdminCoreToken", event.currentTarget.elements.token.value.trim());
  loadStripeAdmin();
});
document.querySelector("[data-stripe-refresh]")?.addEventListener("click", loadStripeAdmin);

const savedStripeAdminToken = stripeAdminToken();
if (savedStripeAdminToken) {
  const input = document.querySelector("[data-stripe-admin-token-form] input[name='token']");
  if (input) input.value = savedStripeAdminToken;
  loadStripeAdmin();
}
