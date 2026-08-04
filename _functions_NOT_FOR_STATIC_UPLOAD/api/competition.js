const PUBLIC_ROOT = "/api/competitions";
const ADMIN_ROOT = "/api/admin/competitions";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "turnstile-spin-v1";
const SHARE_PLATFORMS = new Set(["facebook", "whatsapp", "x", "instagram", "native"]);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function text(value, max = 200) {
  return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

function email(value) {
  const result = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : "";
}

function slug(value) {
  return text(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function money(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(pence || 0) / 100);
}

export async function verifyCompetitionTurnstile(token, request, env) {
  const secret = typeof env.TURNSTILE_SECRET === "string" ? env.TURNSTILE_SECRET : "";
  const cleanToken = text(token, 2048);
  if (!secret || !cleanToken) return { success: false, error: "turnstile-unavailable" };

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", cleanToken);
  const remoteIp = text(request.headers.get("CF-Connecting-IP"), 64);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
    if (!response.ok) return { success: false, error: "siteverify-error" };
    const result = await response.json();
    const hostname = text(result.hostname, 255).toLowerCase();
    const expectedHost = new URL(request.url).hostname.toLowerCase();
    const hostnameValid = hostname === expectedHost ||
      (expectedHost === "www.bingodogwash.com" && hostname === "bingodogwash.com") ||
      ((expectedHost === "localhost" || expectedHost === "127.0.0.1") &&
        (hostname === "localhost" || hostname === "127.0.0.1"));

    return {
      success: result.success === true && result.action === TURNSTILE_ACTION && hostnameValid,
      error: result.success === true ? "invalid-context" : "challenge-failed"
    };
  } catch {
    return { success: false, error: "siteverify-unavailable" };
  }
}

async function adminAllowed(request, env) {
  const expected = String(env.ADMIN_API_TOKEN || "");
  const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const encoder = new TextEncoder();
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

async function competition(env, requestedSlug = "top-dog-2026") {
  return env.GIFT_CARD_DB.prepare("SELECT * FROM competitions WHERE slug = ? LIMIT 1").bind(requestedSlug).first();
}

function competitionDto(row) {
  const now = Date.now();
  const opens = Date.parse(row.opens_at);
  const closes = Date.parse(row.closes_at);
  const effectiveStatus = row.status === "open" && now >= closes ? "closed" : row.status === "open" && now < opens ? "draft" : row.status;
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    entryFee: row.entry_fee, entryFeeDisplay: money(row.entry_fee),
    prizeAmount: row.prize_amount, prizeDisplay: money(row.prize_amount),
    maxPhotos: row.max_photos, opensAt: row.opens_at, closesAt: row.closes_at,
    status: effectiveStatus, votingEnabled: Boolean(row.voting_enabled),
    rules: row.rules, terms: row.terms, winnerEntryId: row.winner_entry_id || ""
  };
}

function entryDto(row, photos = []) {
  return {
    id: row.id, entryNumber: row.entry_number, slug: row.public_slug,
    dogName: row.dog_name, breed: row.breed, town: row.town, dogAge: row.dog_age || "",
    ownerFirstName: row.owner_first_name, status: row.status, votes: row.vote_count,
    views: row.views, shares: row.shares, featured: Boolean(row.featured),
    photos: photos.map((photo) => `${PUBLIC_ROOT}/photos/${encodeURIComponent(photo.id)}`)
  };
}

async function photosForEntries(env, ids) {
  if (!ids.length) return new Map();
  const marks = ids.map(() => "?").join(",");
  const result = await env.GIFT_CARD_DB.prepare(
    `SELECT id, entry_id, content_type, sort_order FROM competition_photos WHERE entry_id IN (${marks}) ORDER BY sort_order`
  ).bind(...ids).all();
  const map = new Map();
  for (const photo of result.results || []) {
    if (!map.has(photo.entry_id)) map.set(photo.entry_id, []);
    map.get(photo.entry_id).push(photo);
  }
  return map;
}

function adminPhotoDto(comp, photo) {
  return {
    id: photo.id,
    contentType: photo.content_type,
    sortOrder: Number(photo.sort_order),
    url: `${ADMIN_ROOT}/${encodeURIComponent(comp.slug)}/photos/${encodeURIComponent(photo.id)}`
  };
}

async function publicDashboard(env, comp) {
  const stats = await env.GIFT_CARD_DB.prepare(`SELECT
    COUNT(*) AS total_entries,
    COALESCE(SUM(amount), 0) AS revenue
    FROM competition_entries WHERE competition_id = ? AND payment_status = 'paid'`)
    .bind(comp.id).first();
  return json({ ok: true, competition: competitionDto(comp), stats: {
    totalEntries: Number(stats?.total_entries || 0),
    totalMoneyRaised: Number(stats?.revenue || 0),
    totalMoneyRaisedDisplay: money(stats?.revenue || 0)
  } });
}

async function gallery(env, comp, url) {
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit") || 24)));
  const rows = await env.GIFT_CARD_DB.prepare(`SELECT * FROM competition_entries
    WHERE competition_id = ? AND status = 'approved'
    ORDER BY featured DESC, created_at DESC LIMIT ?`).bind(comp.id, limit).all();
  const map = await photosForEntries(env, (rows.results || []).map((row) => row.id));
  return json({ ok: true, entries: (rows.results || []).map((row) => entryDto(row, map.get(row.id) || [])) });
}

async function leaderboard(env, comp) {
  const rows = await env.GIFT_CARD_DB.prepare(`SELECT * FROM competition_entries
    WHERE competition_id = ? AND status = 'approved'
    ORDER BY featured DESC, vote_count DESC, created_at ASC LIMIT 10`).bind(comp.id).all();
  const map = await photosForEntries(env, (rows.results || []).map((row) => row.id));
  return json({ ok: true, votingEnabled: Boolean(comp.voting_enabled), entries:
    (rows.results || []).map((row, index) => ({ ...entryDto(row, map.get(row.id) || []), rank: index + 1 })) });
}

async function dogProfile(request, env, comp, publicSlug) {
  const row = await env.GIFT_CARD_DB.prepare(`SELECT * FROM competition_entries
    WHERE competition_id = ? AND public_slug = ? AND status = 'approved' LIMIT 1`).bind(comp.id, publicSlug).first();
  if (!row) return json({ ok: false, error: "Dog profile not found." }, 404);
  await env.GIFT_CARD_DB.prepare("UPDATE competition_entries SET views = views + 1 WHERE id = ?").bind(row.id).run();
  const map = await photosForEntries(env, [row.id]);
  return json({ ok: true, entry: entryDto({ ...row, views: Number(row.views) + 1 }, map.get(row.id) || []) });
}

async function paidEntryForThankYou(env, comp, publicSlug, sessionId) {
  const cleanSessionId = text(sessionId, 180);
  if (!cleanSessionId || !cleanSessionId.startsWith("cs_")) return null;
  return env.GIFT_CARD_DB.prepare(`SELECT * FROM competition_entries
    WHERE competition_id = ? AND public_slug = ? AND stripe_checkout_session_id = ?
      AND payment_status = 'paid' LIMIT 1`)
    .bind(comp.id, publicSlug, cleanSessionId).first();
}

async function thankYouEntry(env, comp, publicSlug, url) {
  const row = await paidEntryForThankYou(env, comp, publicSlug, url.searchParams.get("session_id"));
  if (!row) return json({ ok: false, error: "Paid entry not found." }, 404);
  const map = await photosForEntries(env, [row.id]);
  const photos = map.get(row.id) || [];
  return json({
    ok: true,
    entry: {
      ...entryDto(row, []),
      profileUrl: `https://bingodogwash.com/top-dog.html?dog=${encodeURIComponent(row.public_slug)}`,
      sharePhotoUrl: photos[0]
        ? `${PUBLIC_ROOT}/${encodeURIComponent(comp.slug)}/entries/${encodeURIComponent(row.public_slug)}/share-photo?session_id=${encodeURIComponent(url.searchParams.get("session_id"))}`
        : ""
    }
  });
}

async function serveEntrantSharePhoto(env, comp, publicSlug, url) {
  const row = await paidEntryForThankYou(env, comp, publicSlug, url.searchParams.get("session_id"));
  if (!row) return new Response("Not found", { status: 404 });
  const photo = await env.GIFT_CARD_DB.prepare(`SELECT object_key, content_type FROM competition_photos
    WHERE entry_id = ? ORDER BY sort_order LIMIT 1`).bind(row.id).first();
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await env.COMPETITION_PHOTOS.get(photo.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": photo.content_type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function trackShareClick(request, env, comp, publicSlug) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid share event." }, 400);
  }
  const platform = text(input.platform, 20).toLowerCase();
  if (!SHARE_PLATFORMS.has(platform)) return json({ ok: false, error: "Invalid share platform." }, 400);
  const entry = await env.GIFT_CARD_DB.prepare(`SELECT id, status, payment_status, stripe_checkout_session_id
    FROM competition_entries WHERE competition_id = ? AND public_slug = ? LIMIT 1`)
    .bind(comp.id, publicSlug).first();
  if (!entry) return json({ ok: false, error: "Dog profile not found." }, 404);
  const entrantSession = text(input.sessionId, 180);
  const canTrack = entry.status === "approved" ||
    (entry.payment_status === "paid" && entrantSession && entrantSession === entry.stripe_checkout_session_id);
  if (!canTrack) return json({ ok: false, error: "Dog profile not found." }, 404);
  const now = new Date().toISOString();
  await env.GIFT_CARD_DB.batch([
    env.GIFT_CARD_DB.prepare(`INSERT INTO competition_share_clicks
      (id, competition_id, entry_id, platform, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), comp.id, entry.id, platform, now),
    env.GIFT_CARD_DB.prepare("UPDATE competition_entries SET shares = shares + 1, updated_at = ? WHERE id = ?")
      .bind(now, entry.id)
  ]);
  return json({ ok: true, tracked: "click" }, 202);
}

async function createEntry(request, env, comp) {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  if (competitionDto(comp).status !== "open") return json({ ok: false, error: "This competition is not open." }, 409);
  if (!env.COMPETITION_PHOTOS) return json({ ok: false, error: "Photo storage is not configured." }, 503);
  const form = await request.formData();
  if (form.get("website")) return json({ ok: true }, 202);
  const turnstile = await verifyCompetitionTurnstile(form.get("cf-turnstile-response"), request, env);
  if (!turnstile.success) {
    return json({ ok: false, error: "Please complete the security check and try again." }, 403);
  }
  const ownerName = text(form.get("ownerName"), 120);
  const ownerEmail = email(form.get("email"));
  const dogName = text(form.get("dogName"), 100);
  const breed = text(form.get("breed"), 100);
  const town = text(form.get("town"), 100);
  if (!ownerName || !ownerEmail || !dogName || !breed || !town || form.get("rulesAccepted") !== "true") {
    return json({ ok: false, error: "Complete all required fields and accept the rules." }, 400);
  }
  const recent = await env.GIFT_CARD_DB.prepare(`SELECT id FROM competition_entries
    WHERE competition_id = ? AND email = ? AND lower(dog_name) = lower(?) AND created_at > datetime('now','-1 day') LIMIT 1`)
    .bind(comp.id, ownerEmail, dogName).first();
  if (recent) return json({ ok: false, error: "A recent entry already exists for this dog and email." }, 409);
  const files = form.getAll("photos").filter((value) => value instanceof File && value.size);
  if (!files.length || files.length > comp.max_photos) return json({ ok: false, error: `Upload between 1 and ${comp.max_photos} photos.` }, 400);
  if (files.some((file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES)) {
    return json({ ok: false, error: "Photos must be JPEG, PNG or WebP and no larger than 8 MB each." }, 400);
  }
  const count = await env.GIFT_CARD_DB.prepare("SELECT COALESCE(MAX(entry_number), 0) AS value FROM competition_entries WHERE competition_id = ?").bind(comp.id).first();
  const id = crypto.randomUUID();
  const entryNumber = Number(count?.value || 0) + 1;
  const publicSlug = `${slug(dogName)}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const now = new Date().toISOString();
  await env.GIFT_CARD_DB.prepare(`INSERT INTO competition_entries
    (id, competition_id, entry_number, public_slug, owner_name, owner_first_name, email, dog_name, breed, town, dog_age, amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      id, comp.id, entryNumber, publicSlug, ownerName, ownerName.split(/\s+/)[0], ownerEmail,
      dogName, breed, town, text(form.get("dogAge"), 30), comp.entry_fee, now, now
    ).run();
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const photoId = crypto.randomUUID();
      const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
      const objectKey = `${comp.slug}/${id}/${photoId}.${extension}`;
      await env.COMPETITION_PHOTOS.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
      await env.GIFT_CARD_DB.prepare(`INSERT INTO competition_photos
        (id, entry_id, object_key, content_type, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(photoId, id, objectKey, file.type, index + 1, now).run();
    }
  } catch (error) {
    await env.GIFT_CARD_DB.prepare("DELETE FROM competition_entries WHERE id = ?").bind(id).run();
    throw error;
  }
  return createCheckout(env, comp, { id, publicSlug, ownerEmail, dogName });
}

async function createCheckout(env, comp, entry) {
  if (!String(env.STRIPE_SECRET_KEY || "").startsWith("sk_")) return json({ ok: false, error: "Payment is temporarily unavailable." }, 503);
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `https://bingodogwash.com/top-dog-thank-you.html?entry=${encodeURIComponent(entry.publicSlug)}&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", "https://bingodogwash.com/top-dog-competition.html?payment=cancelled");
  body.set("customer_email", entry.ownerEmail);
  body.set("client_reference_id", entry.id);
  body.set("line_items[0][price_data][currency]", "gbp");
  body.set("line_items[0][price_data][product_data][name]", `${comp.name} entry`);
  body.set("line_items[0][price_data][unit_amount]", String(comp.entry_fee));
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[type]", "competition_entry");
  body.set("metadata[entry_id]", entry.id);
  body.set("metadata[competition_id]", comp.id);
  body.set("metadata[dog_name]", entry.dogName);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `competition-${entry.id}` },
    body
  });
  const data = await response.json();
  if (!response.ok || !data.url) return json({ ok: false, error: "Stripe Checkout could not be created." }, 502);
  await env.GIFT_CARD_DB.prepare("UPDATE competition_entries SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?")
    .bind(data.id, new Date().toISOString(), entry.id).run();
  return json({ ok: true, paymentUrl: data.url, entrySlug: entry.publicSlug }, 201);
}

async function servePhoto(env, id) {
  const photo = await env.GIFT_CARD_DB.prepare(`SELECT p.object_key, p.content_type FROM competition_photos p
    JOIN competition_entries e ON e.id = p.entry_id WHERE p.id = ? AND e.status = 'approved' LIMIT 1`).bind(id).first();
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await env.COMPETITION_PHOTOS.get(photo.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": photo.content_type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}

async function serveAdminPhoto(env, comp, id) {
  if (!env.COMPETITION_PHOTOS) return json({ ok: false, error: "Photo storage is not configured." }, 503);
  const photo = await env.GIFT_CARD_DB.prepare(`SELECT p.object_key, p.content_type, p.sort_order
    FROM competition_photos p
    JOIN competition_entries e ON e.id = p.entry_id
    WHERE p.id = ? AND e.competition_id = ? LIMIT 1`).bind(id, comp.id).first();
  if (!photo) return json({ ok: false, error: "Competition photo not found." }, 404);
  const object = await env.COMPETITION_PHOTOS.get(photo.object_key);
  if (!object) return json({ ok: false, error: "Competition photo is missing from storage." }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": photo.content_type,
      "Content-Length": String(object.size || ""),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function adminApi(request, env, url, segments) {
  if (!(await adminAllowed(request, env))) return json({ ok: false, error: "Admin authorisation required." }, 401);
  const comp = await competition(env, segments[0] || url.searchParams.get("competition") || "top-dog-2026");
  if (!comp) return json({ ok: false, error: "Competition not found." }, 404);
  const section = segments[1] || "dashboard";
  if (request.method === "POST" && section === "auth" && segments.length === 2) {
    return json({ ok: true, authenticated: true, competition: competitionDto(comp) });
  }
  if (request.method === "GET" && section === "photos" && segments[2] && segments.length === 3) {
    return serveAdminPhoto(env, comp, segments[2]);
  }
  if (request.method === "GET" && section === "dashboard") {
    const stats = await env.GIFT_CARD_DB.prepare(`SELECT COUNT(*) total, SUM(payment_status='paid') paid,
      SUM(status='pending') pending, COALESCE(SUM(CASE WHEN payment_status='paid' THEN amount END),0) revenue
      FROM competition_entries WHERE competition_id = ?`).bind(comp.id).first();
    return json({ ok: true, competition: competitionDto(comp), stats });
  }
  if (request.method === "GET" && (section === "entries" || section === "reports")) {
    const rows = await env.GIFT_CARD_DB.prepare("SELECT * FROM competition_entries WHERE competition_id = ? ORDER BY created_at DESC LIMIT 1000").bind(comp.id).all();
    if (url.searchParams.get("format") === "csv") {
      const csv = [["Entry","Dog","Breed","Owner","Email","Town","Status","Payment","Amount","Created"], ...(rows.results || []).map((r) =>
        [r.entry_number,r.dog_name,r.breed,r.owner_name,r.email,r.town,r.status,r.payment_status,r.amount,r.created_at])]
        .map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\r\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=${comp.slug}-entries.csv` } });
    }
    const map = await photosForEntries(env, (rows.results || []).map((row) => row.id));
    return json({ ok: true, entries: (rows.results || []).map((row) => ({
      ...entryDto(row, []),
      photos: (map.get(row.id) || []).slice(0, 3).map((photo) => adminPhotoDto(comp, photo)),
      ownerName: row.owner_name,
      email: row.email,
      paymentStatus: row.payment_status,
      amount: row.amount,
      createdAt: row.created_at
    })) });
  }
  if (request.method === "PATCH" && section === "entries" && segments[2]) {
    const input = await request.json();
    const status = ["pending","approved","rejected","withdrawn"].includes(input.status) ? input.status : "";
    if (!status) return json({ ok: false, error: "Invalid status." }, 400);
    if (status === "approved") {
      const paidEntry = await env.GIFT_CARD_DB.prepare(`SELECT id FROM competition_entries
        WHERE id = ? AND competition_id = ? AND payment_status = 'paid' LIMIT 1`)
        .bind(segments[2], comp.id).first();
      if (!paidEntry) {
        return json({ ok: false, error: "Approval requires a confirmed paid entry." }, 409);
      }
      if (!env.COMPETITION_PHOTOS) return json({ ok: false, error: "Photo storage is not configured." }, 503);
      const photoRows = await env.GIFT_CARD_DB.prepare(`SELECT p.object_key
        FROM competition_photos p
        JOIN competition_entries e ON e.id = p.entry_id
        WHERE p.entry_id = ? AND e.competition_id = ?
        ORDER BY p.sort_order LIMIT 3`).bind(segments[2], comp.id).all();
      let reviewablePhotoExists = false;
      for (const photo of photoRows.results || []) {
        if (await env.COMPETITION_PHOTOS.head(photo.object_key)) {
          reviewablePhotoExists = true;
          break;
        }
      }
      if (!reviewablePhotoExists) {
        return json({ ok: false, error: "Approval requires at least one reviewable uploaded photo." }, 409);
      }
    }
    const now = new Date().toISOString();
    await env.GIFT_CARD_DB.prepare("UPDATE competition_entries SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END, updated_at = ? WHERE id = ? AND competition_id = ?")
      .bind(status, status, now, now, segments[2], comp.id).run();
    await audit(env, request, comp.id, segments[2], `entry.${status}`, input);
    return json({ ok: true });
  }
  if (request.method === "DELETE" && section === "entries" && segments[2]) {
    const photoRows = await env.GIFT_CARD_DB.prepare("SELECT object_key FROM competition_photos WHERE entry_id = ?").bind(segments[2]).all();
    if (env.COMPETITION_PHOTOS) {
      await Promise.all((photoRows.results || []).map((photo) => env.COMPETITION_PHOTOS.delete(photo.object_key)));
    }
    await audit(env, request, comp.id, segments[2], "entry.delete", {});
    await env.GIFT_CARD_DB.prepare("DELETE FROM competition_entries WHERE id = ? AND competition_id = ?").bind(segments[2], comp.id).run();
    return json({ ok: true });
  }
  if (request.method === "PATCH" && section === "settings") {
    const input = await request.json();
    const status = ["draft","open","closed","archived"].includes(input.status) ? input.status : comp.status;
    await env.GIFT_CARD_DB.prepare(`UPDATE competitions SET entry_fee=?, prize_amount=?, max_photos=?, opens_at=?, closes_at=?,
      status=?, voting_enabled=?, rules=?, terms=?, updated_at=? WHERE id=?`).bind(
      Math.max(100, Number(input.entryFee || comp.entry_fee)), Math.max(0, Number(input.prizeAmount ?? comp.prize_amount)),
      Math.min(3, Math.max(1, Number(input.maxPhotos || comp.max_photos))), text(input.opensAt || comp.opens_at, 40),
      text(input.closesAt || comp.closes_at, 40), status, input.votingEnabled ? 1 : 0,
      text(input.rules || comp.rules, 10000), text(input.terms || comp.terms, 10000), new Date().toISOString(), comp.id
    ).run();
    await audit(env, request, comp.id, null, "competition.settings", input);
    return json({ ok: true });
  }
  return json({ ok: false, error: "Unsupported admin operation." }, 404);
}

async function audit(env, request, competitionId, entryId, action, details) {
  await env.GIFT_CARD_DB.prepare(`INSERT INTO competition_audit_log
    (id, competition_id, entry_id, actor, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
      crypto.randomUUID(), competitionId, entryId, text(request.headers.get("X-Admin-Actor") || "Admin", 120),
      action, JSON.stringify(details || {}).slice(0, 4000), new Date().toISOString()
    ).run();
}

export async function handleCompetition(request, env, url) {
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Competition database is not configured." }, 503);
  if (url.pathname.startsWith(`${ADMIN_ROOT}/`)) {
    return adminApi(request, env, url, url.pathname.slice(ADMIN_ROOT.length + 1).split("/").filter(Boolean));
  }
  if (url.pathname.startsWith(`${PUBLIC_ROOT}/photos/`)) return servePhoto(env, url.pathname.split("/").pop());
  const segments = url.pathname.slice(PUBLIC_ROOT.length).split("/").filter(Boolean);
  const comp = await competition(env, segments[0] || "top-dog-2026");
  if (!comp) return json({ ok: false, error: "Competition not found." }, 404);
  const action = segments[1] || "dashboard";
  if (request.method === "GET" && action === "dashboard") return publicDashboard(env, comp);
  if (request.method === "GET" && action === "gallery") return gallery(env, comp, url);
  if (request.method === "GET" && action === "leaderboard") return leaderboard(env, comp);
  if (request.method === "GET" && action === "dogs" && segments[2]) return dogProfile(request, env, comp, segments[2]);
  if (request.method === "GET" && action === "entries" && segments[2] && segments[3] === "thank-you") {
    return thankYouEntry(env, comp, segments[2], url);
  }
  if (request.method === "GET" && action === "entries" && segments[2] && segments[3] === "share-photo") {
    return serveEntrantSharePhoto(env, comp, segments[2], url);
  }
  if (request.method === "POST" && action === "dogs" && segments[2] && segments[3] === "shares") {
    return trackShareClick(request, env, comp, segments[2]);
  }
  if (action === "entries") return createEntry(request, env, comp);
  return json({ ok: false, error: "Competition endpoint not found." }, 404);
}

export async function processCompetitionStripeEvent(event, env) {
  if (event.type !== "checkout.session.completed" || event.data?.object?.metadata?.type !== "competition_entry") return false;
  const session = event.data.object;
  const entryId = text(session.metadata.entry_id, 80);
  const competitionId = text(session.metadata.competition_id, 80);
  const dogName = text(session.metadata.dog_name, 100);
  const checkoutSessionId = text(session.id, 180);
  const paymentIntentId = text(session.payment_intent, 180);
  const amountTotal = Number(session.amount_total);
  const currency = text(session.currency, 10).toLowerCase();
  if (
    session.payment_status !== "paid" ||
    !entryId ||
    !competitionId ||
    !dogName ||
    !checkoutSessionId ||
    !paymentIntentId ||
    !Number.isSafeInteger(amountTotal) ||
    amountTotal < 0 ||
    currency !== "gbp"
  ) {
    return false;
  }
  const entry = await env.GIFT_CARD_DB.prepare(`SELECT e.id, e.competition_id, e.dog_name, e.amount,
      e.payment_status, e.stripe_checkout_session_id, e.stripe_payment_intent_id, c.entry_fee
    FROM competition_entries e
    JOIN competitions c ON c.id = e.competition_id
    WHERE e.id = ? AND e.competition_id = ? LIMIT 1`)
    .bind(entryId, competitionId).first();
  if (
    !entry ||
    entry.dog_name !== dogName ||
    Number(entry.amount) !== amountTotal ||
    Number(entry.entry_fee) !== amountTotal ||
    entry.stripe_checkout_session_id !== checkoutSessionId
  ) {
    return false;
  }
  if (entry.payment_status === "paid") {
    return entry.stripe_payment_intent_id === paymentIntentId;
  }
  const reusedPayment = await env.GIFT_CARD_DB.prepare(`SELECT id FROM competition_entries
    WHERE id <> ? AND (stripe_checkout_session_id = ? OR stripe_payment_intent_id = ?) LIMIT 1`)
    .bind(entryId, checkoutSessionId, paymentIntentId).first();
  if (reusedPayment) return false;
  const now = new Date().toISOString();
  const result = await env.GIFT_CARD_DB.prepare(`UPDATE competition_entries SET payment_status='paid', status='pending',
    stripe_checkout_session_id=?, stripe_payment_intent_id=?, paid_at=?, updated_at=?
    WHERE id=? AND competition_id=? AND payment_status <> 'paid' AND stripe_checkout_session_id=?`)
    .bind(checkoutSessionId, paymentIntentId, now, now, entryId, competitionId, checkoutSessionId).run();
  if (Number(result.meta?.changes || 0) !== 1) return false;
  if (env.EMAIL && Number(result.meta?.changes || 0) > 0) {
    const entry = await env.GIFT_CARD_DB.prepare("SELECT email, owner_first_name, dog_name, entry_number FROM competition_entries WHERE id=?").bind(entryId).first();
    if (entry) await env.EMAIL.send({
      to: entry.email,
      from: { email: "competition@bingodogwash.com", name: "Bingo Dog Wash" },
      subject: `${entry.dog_name} is entered in Top Dog!`,
      text: `Thanks ${entry.owner_first_name}. Payment is confirmed and entry #${entry.entry_number} is awaiting photo approval.`,
      html: `<h1>You're in!</h1><p>Thanks ${entry.owner_first_name}. Payment is confirmed and <strong>${entry.dog_name}</strong> is entry #${entry.entry_number}. The profile will appear after photo approval.</p>`
    });
  }
  return true;
}
