(() => {
  const API = "/api/competitions/top-dog-2026";
  const ADMIN = "/api/admin/competitions/top-dog-2026";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatMoney = (pence) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, { cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  };
  const dogCard = (dog) => `<article class="competition-dog-card">
    <a href="/top-dog.html?dog=${encodeURIComponent(dog.slug)}">
      <div class="competition-dog-photo">${dog.photos[0] ? `<img src="${dog.photos[0]}" alt="${escapeHtml(dog.dogName)}" loading="lazy" decoding="async">` : "<span>🐕</span>"}</div>
      <div><span>#${dog.entryNumber} · ${escapeHtml(dog.town)}</span><h3>${escapeHtml(dog.dogName)}</h3><p>${escapeHtml(dog.breed)}</p></div>
    </a></article>`;

  async function loadPublic() {
    const [dashboard, gallery, leaderboard] = await Promise.all([
      requestJson(`${API}/dashboard`), requestJson(`${API}/gallery`), requestJson(`${API}/leaderboard`)
    ]);
    document.querySelector("[data-comp-total]").textContent = dashboard.stats.totalEntries.toLocaleString("en-GB");
    document.querySelector("[data-comp-raised]").textContent = dashboard.stats.totalMoneyRaisedDisplay;
    document.querySelector("[data-comp-prize]").textContent = dashboard.competition.prizeDisplay;
    document.querySelector("[data-comp-status]").textContent = dashboard.competition.status === "open" ? "Open" : "Closed";
    document.querySelector("[data-comp-status]").classList.toggle("is-open", dashboard.competition.status === "open");
    document.querySelector("[data-competition-rules]").innerHTML = dashboard.competition.rules.split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    const galleryTarget = document.querySelector("[data-competition-gallery]");
    galleryTarget.innerHTML = gallery.entries.length ? gallery.entries.map(dogCard).join("") : `<div class="competition-empty"><span>🐾</span><h3>Be first into the gallery</h3><p>Approved dogs will appear here.</p></div>`;
    const board = document.querySelector("[data-competition-leaderboard]");
    board.innerHTML = leaderboard.entries.length ? leaderboard.entries.map((dog) => `<a href="/top-dog.html?dog=${encodeURIComponent(dog.slug)}"><b>${dog.rank}</b>${dog.photos[0] ? `<img src="${dog.photos[0]}" alt="" loading="lazy" decoding="async">` : "<span>🐕</span>"}<strong>${escapeHtml(dog.dogName)}</strong><small>${escapeHtml(dog.breed)}</small>${leaderboard.votingEnabled ? `<em>${dog.votes} votes</em>` : `<em>${dog.featured ? "Featured" : "Contender"}</em>`}</a>`).join("") : "<p>Rankings will appear after the first dogs are approved.</p>";
    const close = new Date(dashboard.competition.closesAt).getTime();
    const tick = () => {
      const distance = Math.max(0, close - Date.now());
      const days = Math.floor(distance / 86400000);
      const hours = Math.floor((distance % 86400000) / 3600000);
      const minutes = Math.floor((distance % 3600000) / 60000);
      document.querySelector("[data-comp-countdown]").textContent = distance ? `${days}d ${hours}h ${minutes}m` : "Closed";
    };
    tick(); window.setInterval(tick, 60000);
  }

  function setupEntry() {
    const form = document.querySelector("[data-competition-entry]");
    if (!form) return;
    const fileInput = form.elements.photos;
    fileInput.addEventListener("change", () => {
      const files = [...fileInput.files].slice(0, 3);
      if (fileInput.files.length > 3) fileInput.setCustomValidity("Choose no more than three photos."); else fileInput.setCustomValidity("");
      const target = form.querySelector("[data-photo-preview]");
      target.innerHTML = "";
      files.forEach((file) => {
        const image = document.createElement("img"); image.alt = file.name; image.src = URL.createObjectURL(file); target.append(image);
      });
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector("button[type=submit]");
      const message = form.querySelector("[data-entry-message]");
      button.disabled = true; button.textContent = "Preparing secure checkout…"; message.textContent = "Uploading your photos securely.";
      try {
        const data = await requestJson(`${API}/entries`, { method: "POST", body: new FormData(form) });
        window.location.assign(data.paymentUrl);
      } catch (error) {
        message.textContent = error.message; button.disabled = false; button.textContent = "Continue to secure payment — £5";
        if (window.turnstile) window.turnstile.reset();
      }
    });
  }

  async function loadDog() {
    const target = document.querySelector("[data-dog-profile-content]");
    const dogSlug = new URLSearchParams(location.search).get("dog");
    if (!target || !dogSlug) return;
    try {
      const { entry } = await requestJson(`${API}/dogs/${encodeURIComponent(dogSlug)}`);
      document.title = `${entry.dogName} | Top Dog Competition`;
      target.innerHTML = `<div class="dog-profile-gallery">${entry.photos.map((photo, index) => `<img src="${photo}" alt="${escapeHtml(entry.dogName)} photo ${index + 1}" decoding="async"${index ? ' loading="lazy"' : ""}>`).join("")}</div>
        <div class="dog-profile-copy"><span class="eyebrow">Entry #${entry.entryNumber}</span><h1>${escapeHtml(entry.dogName)}</h1><p class="dog-profile-breed">${escapeHtml(entry.breed)}</p>
        <dl><div><dt>Human</dt><dd>${escapeHtml(entry.ownerFirstName)}</dd></div><div><dt>Home town</dt><dd>${escapeHtml(entry.town)}</dd></div>${entry.dogAge ? `<div><dt>Age</dt><dd>${escapeHtml(entry.dogAge)}</dd></div>` : ""}</dl>
        <div data-dog-share></div></div>`;
      const { renderShareControls } = await import("/competition-sharing.js");
      renderShareControls(target.querySelector("[data-dog-share]"), entry);
    } catch (error) { target.innerHTML = `<div class="competition-empty"><h1>Profile unavailable</h1><p>${escapeHtml(error.message)}</p></div>`; }
  }

  const adminHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem("bingoAdminCoreToken") || ""}`, "Content-Type": "application/json", "X-Admin-Actor": "Bingo Dog Wash admin" });
  const adminPhotoGalleries = new Map();
  let activeAdminPhoto = { entryId: "", index: 0 };
  let adminPhotoObjectUrls = [];

  const imageLoads = (url) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });

  async function loadAdminEntryPhotos(entries) {
    adminPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    adminPhotoObjectUrls = [];
    adminPhotoGalleries.clear();
    await Promise.all(entries.map(async (entry) => {
      const target = document.querySelector(`[data-admin-entry-photos="${CSS.escape(entry.id)}"]`);
      const approve = document.querySelector(`[data-entry-status="approved"][data-entry-id="${CSS.escape(entry.id)}"]`);
      if (!target) return;
      const metadata = Array.isArray(entry.photos) ? entry.photos.slice(0, 3) : [];
      if (!metadata.length) {
        target.innerHTML = '<span class="admin-photo-missing">No uploaded photos found</span>';
        if (approve) approve.disabled = true;
        return;
      }
      const loaded = [];
      const missing = [];
      for (const photo of metadata) {
        try {
          const response = await fetch(photo.url, { headers: adminHeaders(), cache: "no-store" });
          if (!response.ok) throw new Error("Missing photo");
          const objectUrl = URL.createObjectURL(await response.blob());
          if (!(await imageLoads(objectUrl))) {
            URL.revokeObjectURL(objectUrl);
            throw new Error("Unreadable photo");
          }
          adminPhotoObjectUrls.push(objectUrl);
          loaded.push({ ...photo, objectUrl });
        } catch {
          missing.push(photo);
        }
      }
      adminPhotoGalleries.set(entry.id, loaded);
      target.innerHTML = loaded.map((photo, index) => `<button type="button" class="admin-photo-thumb" data-admin-photo-open="${escapeHtml(entry.id)}" data-admin-photo-index="${index}" aria-label="Open photo ${index + 1} of ${escapeHtml(entry.dogName)}"><img src="${photo.objectUrl}" alt="${escapeHtml(entry.dogName)} photo ${photo.sortOrder}" loading="lazy" decoding="async"></button>`).join("") +
        missing.map((photo) => `<span class="admin-photo-missing">Photo ${photo.sortOrder} unavailable</span>`).join("");
      if (!loaded.length) target.innerHTML = '<span class="admin-photo-missing">No reviewable image is available</span>';
      if (approve) {
        approve.disabled = loaded.length === 0;
        approve.title = loaded.length ? "Approve this reviewed entry" : "Load at least one photo before approval";
      }
    }));
  }

  function showAdminPhoto(entryId, index) {
    const gallery = adminPhotoGalleries.get(entryId) || [];
    if (!gallery.length) return;
    const safeIndex = (index + gallery.length) % gallery.length;
    activeAdminPhoto = { entryId, index: safeIndex };
    const dialog = document.querySelector("[data-admin-photo-dialog]");
    const image = dialog.querySelector("[data-admin-photo-large]");
    image.src = gallery[safeIndex].objectUrl;
    image.alt = `Entry photo ${safeIndex + 1}`;
    dialog.querySelector("[data-admin-photo-position]").textContent = `Photo ${safeIndex + 1} of ${gallery.length}`;
    dialog.querySelector("[data-admin-photo-prev]").hidden = gallery.length < 2;
    dialog.querySelector("[data-admin-photo-next]").hidden = gallery.length < 2;
    if (!dialog.open) dialog.showModal();
  }

  async function loadAdmin() {
    const [dashboard, entries, leaderboard] = await Promise.all([
      requestJson(`${ADMIN}/dashboard`, { headers: adminHeaders() }),
      requestJson(`${ADMIN}/entries`, { headers: adminHeaders() }),
      requestJson(`${API}/leaderboard`)
    ]);
    document.querySelector("[data-admin-competition]").hidden = false;
    const stats = dashboard.stats;
    document.querySelector("[data-admin-comp-stats]").innerHTML = [
      ["Total entries", stats.total], ["Revenue", formatMoney(stats.revenue)], ["Pending approvals", stats.pending],
      ["Prize", dashboard.competition.prizeDisplay], ["Status", dashboard.competition.status]
    ].map(([label, value]) => `<article class="card"><span>${label}</span><strong>${value ?? 0}</strong></article>`).join("");
    const rows = entries.entries;
    document.querySelector("[data-admin-comp-entries]").innerHTML = rows.length ? `<table class="admin-giveaway-table"><thead><tr><th>Entry</th><th>Dog</th><th>Photos</th><th>Owner</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map((entry) => `<tr><td>#${entry.entryNumber}</td><td><strong>${escapeHtml(entry.dogName)}</strong><br>${escapeHtml(entry.breed)}, ${escapeHtml(entry.town)}</td><td><div class="admin-entry-photos" data-admin-entry-photos="${escapeHtml(entry.id)}"><span>Loading photos…</span></div></td><td>${escapeHtml(entry.ownerName)}<br><small>${escapeHtml(entry.email)}</small></td><td>${escapeHtml(entry.paymentStatus)}<br>${formatMoney(entry.amount)}</td><td><span class="tag">${escapeHtml(entry.status)}</span></td><td><div class="button-row"><button data-entry-status="approved" data-entry-id="${entry.id}" disabled title="Load at least one photo before approval">Approve</button><button data-entry-status="rejected" data-entry-id="${entry.id}">Reject</button><button data-entry-delete="${entry.id}">Delete</button></div></td></tr>`).join("")}</tbody></table>` : "<p>No entries yet.</p>";
    await loadAdminEntryPhotos(rows);
    document.querySelector("[data-admin-comp-leaderboard]").innerHTML = leaderboard.entries.map((dog) => `<div class="mini-row"><strong>#${dog.rank} ${escapeHtml(dog.dogName)}</strong><span>${dog.votes} votes ${dog.featured ? "· Featured" : ""}</span></div>`).join("") || "<p>No approved dogs yet.</p>";
    document.querySelector("[data-admin-comp-payments]").innerHTML = rows.filter((entry) => entry.paymentStatus === "paid").map((entry) => `<div class="mini-row"><strong>#${entry.entryNumber} ${escapeHtml(entry.dogName)}</strong><span>${formatMoney(entry.amount)} · Paid</span></div>`).join("") || "<p>No paid entries yet.</p>";
    const form = document.querySelector("[data-admin-comp-settings]");
    const comp = dashboard.competition;
    for (const [name, value] of Object.entries({ entryFee: comp.entryFee, prizeAmount: comp.prizeAmount, maxPhotos: comp.maxPhotos, status: comp.status, rules: comp.rules, terms: comp.terms })) if (form.elements[name]) form.elements[name].value = value;
    form.elements.opensAt.value = comp.opensAt.slice(0, 16); form.elements.closesAt.value = comp.closesAt.slice(0, 16); form.elements.votingEnabled.checked = comp.votingEnabled;
    document.querySelector("[data-admin-comp-export]").href = `${ADMIN}/reports?format=csv`;
  }

  function setupAdmin() {
    const auth = document.querySelector("[data-competition-admin-auth]");
    if (!auth) return;
    auth.elements.token.value = sessionStorage.getItem("bingoAdminCoreToken") || "";
    auth.addEventListener("submit", async (event) => {
      event.preventDefault(); sessionStorage.setItem("bingoAdminCoreToken", auth.elements.token.value.trim());
      try {
        await requestJson(`${ADMIN}/auth`, { method: "POST", headers: adminHeaders(), body: "{}" });
        await loadAdmin();
        auth.querySelector("[data-admin-comp-message]").textContent = "Competition controls unlocked.";
      } catch (error) {
        auth.querySelector("[data-admin-comp-message]").textContent = error.message;
      }
    });
    document.addEventListener("click", async (event) => {
      const tab = event.target.closest("[data-comp-tab]");
      if (tab) {
        document.querySelectorAll("[data-comp-tab]").forEach((item) => item.classList.toggle("active", item === tab));
        document.querySelectorAll("[data-comp-panel]").forEach((panel) => { panel.hidden = panel.dataset.compPanel !== tab.dataset.compTab; });
      }
      const status = event.target.closest("[data-entry-status]");
      if (status) { await requestJson(`${ADMIN}/entries/${status.dataset.entryId}`, { method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ status: status.dataset.entryStatus }) }); await loadAdmin(); }
      const remove = event.target.closest("[data-entry-delete]");
      if (remove && window.confirm("Permanently delete this entry and its records?")) { await requestJson(`${ADMIN}/entries/${remove.dataset.entryDelete}`, { method: "DELETE", headers: adminHeaders() }); await loadAdmin(); }
      const photo = event.target.closest("[data-admin-photo-open]");
      if (photo) showAdminPhoto(photo.dataset.adminPhotoOpen, Number(photo.dataset.adminPhotoIndex || 0));
      if (event.target.closest("[data-admin-photo-prev]")) showAdminPhoto(activeAdminPhoto.entryId, activeAdminPhoto.index - 1);
      if (event.target.closest("[data-admin-photo-next]")) showAdminPhoto(activeAdminPhoto.entryId, activeAdminPhoto.index + 1);
      if (event.target.closest("[data-admin-photo-close]")) document.querySelector("[data-admin-photo-dialog]").close();
      const exportLink = event.target.closest("[data-admin-comp-export]");
      if (exportLink) {
        event.preventDefault();
        const response = await fetch(exportLink.href, { headers: adminHeaders() });
        if (!response.ok) throw new Error("Could not export the report.");
        const download = document.createElement("a");
        download.href = URL.createObjectURL(await response.blob());
        download.download = "top-dog-2026-report.csv";
        download.click();
        URL.revokeObjectURL(download.href);
      }
    });
    document.querySelector("[data-admin-comp-settings]").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
      data.votingEnabled = form.elements.votingEnabled.checked; data.opensAt = new Date(data.opensAt).toISOString(); data.closesAt = new Date(data.closesAt).toISOString();
      await requestJson(`${ADMIN}/settings`, { method: "PATCH", headers: adminHeaders(), body: JSON.stringify(data) }); await loadAdmin();
    });
    if (auth.elements.token.value) loadAdmin().catch(() => {});
  }

  if (document.querySelector("[data-competition-page]")) { loadPublic().catch((error) => console.error(error)); setupEntry(); window.setInterval(() => loadPublic().catch(() => {}), 30000); }
  if (document.querySelector("[data-dog-profile]")) loadDog();
  if (document.querySelector("[data-competition-admin]")) setupAdmin();
})();
