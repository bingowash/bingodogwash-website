const API = "/api/competitions/top-dog-2026";
const HASHTAGS = "#TopDogCompetition #BingoDogWash #TopDog2026";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export function shareCaption(entry) {
  return `Meet ${entry.dogName}, a ${entry.breed} from ${entry.town}, in the Bingo Dog Wash Top Dog Competition! ${entry.profileUrl} ${HASHTAGS}`;
}

export function shareTargets(entry) {
  const caption = shareCaption(entry);
  const shortText = `Meet ${entry.dogName} in the Top Dog Competition! #TopDog2026 #BingoDogWash`;
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(entry.profileUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(caption)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(`${shortText} ${entry.profileUrl}`)}`,
    instagram: "https://www.instagram.com/"
  };
}

export function nativeShareMode(navigatorObject, file) {
  if (typeof navigatorObject?.share !== "function") return "unavailable";
  if (file && typeof navigatorObject.canShare === "function" && navigatorObject.canShare({ files: [file] })) return "file";
  return "link";
}

function track(entry, platform) {
  fetch(`${API}/dogs/${encodeURIComponent(entry.slug)}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, sessionId: entry.sessionId || "" }),
    keepalive: true
  }).catch(() => {});
}

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error("Copy is unavailable."));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The primary photo could not be loaded."));
    image.src = url;
  });
}

export async function createBrandedShareFile(entry) {
  if (!entry.primaryPhoto) throw new Error("No primary photo is available yet.");
  const image = await loadImage(entry.primaryPhoto);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  context.fillStyle = "#052e52";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const photoHeight = 940;
  const scale = Math.max(canvas.width / image.naturalWidth, photoHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (photoHeight - height) / 2, width, height);
  context.fillStyle = "#087c67";
  context.fillRect(0, photoHeight, canvas.width, canvas.height - photoHeight);
  context.fillStyle = "#fff";
  context.font = "800 42px Arial, sans-serif";
  context.fillText("BINGO DOG WASH · TOP DOG COMPETITION", 54, 1015);
  context.font = "900 86px Arial, sans-serif";
  context.fillText(String(entry.dogName).slice(0, 20), 54, 1120);
  context.font = "600 33px Arial, sans-serif";
  context.fillText(`${entry.breed} · ${entry.town}`.slice(0, 55), 54, 1180);
  context.font = "500 27px Arial, sans-serif";
  context.fillText(entry.profileUrl.replace(/^https?:\/\//, "").slice(0, 65), 54, 1265);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The share image could not be generated.");
  return new File([blob], `${entry.slug}-top-dog.png`, { type: "image/png" });
}

function downloadFile(file) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function button(label, platform, extra = "") {
  return `<button type="button" class="competition-share-button" data-share="${platform}" aria-label="${label}" ${extra}>${label}</button>`;
}

export function renderShareControls(target, rawEntry) {
  if (!target) return;
  const entry = {
    ...rawEntry,
    profileUrl: rawEntry.profileUrl || `${location.origin}/top-dog.html?dog=${encodeURIComponent(rawEntry.slug)}`,
    primaryPhoto: rawEntry.primaryPhoto || rawEntry.photos?.[0] || ""
  };
  const targets = shareTargets(entry);
  target.innerHTML = `<section class="competition-sharing" aria-labelledby="share-heading">
    <h2 id="share-heading">Share ${escapeHtml(entry.dogName)}</h2>
    <p>Invite friends to view this Top Dog profile. Sharing always stays under your control.</p>
    <div class="competition-share" role="group" aria-label="Share this Top Dog entry">
      ${button("Facebook", "facebook")}
      ${button("WhatsApp", "whatsapp")}
      ${button("X", "x")}
      ${button("Instagram", "instagram", 'aria-expanded="false"')}
      ${button("Share…", "native")}
    </div>
    <div class="competition-instagram-tools" data-instagram-tools hidden>
      <p><strong>Share to Instagram</strong></p>
      ${button("Download branded image", "instagram-download")}
      ${button("Copy caption", "instagram-caption")}
      ${button("Copy profile link", "instagram-link")}
      ${button("Open Instagram", "instagram-open")}
    </div>
    <p class="competition-share-status" data-share-status role="status" aria-live="polite"></p>
  </section>`;
  const status = target.querySelector("[data-share-status]");
  let brandedFile;
  const getFile = async () => {
    if (!brandedFile) brandedFile = await createBrandedShareFile(entry);
    return brandedFile;
  };
  target.addEventListener("click", async (event) => {
    const control = event.target.closest("[data-share]");
    if (!control) return;
    const action = control.dataset.share;
    status.textContent = "";
    try {
      if (["facebook", "whatsapp", "x"].includes(action)) {
        track(entry, action);
        window.open(targets[action], "_blank", "noopener,noreferrer");
      } else if (action === "instagram") {
        track(entry, "instagram");
        const tools = target.querySelector("[data-instagram-tools]");
        tools.hidden = !tools.hidden;
        control.setAttribute("aria-expanded", String(!tools.hidden));
        if (!tools.hidden && /Android|iPhone|iPad/i.test(navigator.userAgent) && nativeShareMode(navigator, await getFile()) === "file") {
          status.textContent = "Use Share… to send the branded image through a supported mobile share sheet.";
        }
      } else if (action === "instagram-download") {
        downloadFile(await getFile());
        status.textContent = "Branded image downloaded.";
      } else if (action === "instagram-caption") {
        await copyText(shareCaption(entry));
        status.textContent = "Caption copied.";
      } else if (action === "instagram-link") {
        await copyText(entry.profileUrl);
        status.textContent = "Profile link copied.";
      } else if (action === "instagram-open") {
        window.open(targets.instagram, "_blank", "noopener,noreferrer");
      } else if (action === "native") {
        track(entry, "native");
        let file = null;
        try { file = await getFile(); } catch {}
        const mode = nativeShareMode(navigator, file);
        if (mode === "unavailable") {
          await copyText(shareCaption(entry));
          status.textContent = "Native sharing is unavailable, so the caption and link were copied.";
        } else {
          const payload = { title: `${entry.dogName} · Top Dog Competition`, text: shareCaption(entry), url: entry.profileUrl };
          if (mode === "file") payload.files = [file];
          await navigator.share(payload);
          status.textContent = "Share sheet opened.";
        }
      }
    } catch (error) {
      if (error?.name !== "AbortError") status.textContent = error.message || "This sharing option is unavailable.";
    }
  });
  getFile().catch(() => {});
}

async function loadThankYouSharing() {
  const target = document.querySelector("[data-top-dog-thank-you-share]");
  if (!target) return;
  const query = new URLSearchParams(location.search);
  const entrySlug = query.get("entry");
  const sessionId = query.get("session_id");
  if (!entrySlug || !sessionId) {
    target.innerHTML = "<p>Sharing controls will be available from the public profile after approval.</p>";
    return;
  }
  try {
    const response = await fetch(`${API}/entries/${encodeURIComponent(entrySlug)}/thank-you?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Entry details are not available yet.");
    renderShareControls(target, { ...data.entry, sessionId, primaryPhoto: data.entry.sharePhotoUrl });
  } catch (error) {
    target.innerHTML = `<p>${escapeHtml(error.message || "Sharing controls are not available yet.")}</p>`;
  }
}

if (typeof document !== "undefined") loadThankYouSharing();
