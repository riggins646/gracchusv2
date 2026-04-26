import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";

/* ───────────────────────────────────────────────
   POST /api/subscribe
   Stores subscriber emails in Vercel Blob as a
   single JSON file (subscribers.json).

   Rate limited: 5 requests per hour per IP.

   Requires BLOB_READ_WRITE_TOKEN env var
   (set automatically when a Blob store is
   connected to the Vercel project).
   ─────────────────────────────────────────────── */

// SECURITY (audit fix B3, 2026-04-26): blob path is the PREFIX, not the
// canonical filename. addRandomSuffix is true now, so each save writes
// to subscribers-<hash>.json. URL is no longer guessable — even if the
// access mode is ever flipped to "public", an attacker can't enumerate
// the subscriber list from a deterministic URL. Reads sort by uploadedAt
// descending and take the most recent.
const BLOB_PREFIX = "subscribers";

// SECURITY (audit fix C3, 2026-04-26): hard cap on the subscriber list
// to prevent DoS via the in-memory rate-limiter being per-isolate. With
// many concurrent isolates an attacker can far exceed the documented
// 5-per-hour-per-IP limit. The cap means once the list reaches this
// size the endpoint returns 503 instead of growing the blob unbounded
// to the point that the function OOMs trying to JSON.parse it.
// 50,000 covers any plausible real-world subscriber count for an
// independent journalism site for a long time before this triggers.
const MAX_SUBSCRIBERS = 50_000;

function getToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Connect a Blob store to this project in the Vercel dashboard."
    );
  }
  return token;
}

async function getSubscribers() {
  try {
    const token = getToken();
    const { blobs } = await list({ prefix: BLOB_PREFIX, token });
    if (blobs.length === 0) return [];
    // SECURITY (audit fix B3): with addRandomSuffix: true each save creates
    // a new blob (subscribers-<hash>.json). Sort by uploadedAt desc and
    // take the most recent — that's the canonical current state. Older
    // blobs remain as natural append-only history, harmless under the
    // access:"private" mode.
    const sorted = [...blobs].sort((a, b) => {
      const at = new Date(a.uploadedAt || 0).getTime();
      const bt = new Date(b.uploadedAt || 0).getTime();
      return bt - at;
    });
    const url = sorted[0].downloadUrl || sorted[0].url;
    const res = await fetch(url);
    if (!res.ok) return [];
    const parsed = await res.json();
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // If token is missing, re-throw so caller gets a clear message
    if (err.message?.includes("BLOB_READ_WRITE_TOKEN")) throw err;
    return [];
  }
}

async function saveSubscribers(subscribers) {
  const token = getToken();
  // Pathname is just the prefix; addRandomSuffix appends the random hash.
  await put(BLOB_PREFIX + ".json", JSON.stringify(subscribers, null, 2), {
    access: "private",
    addRandomSuffix: true,
    token,
  });
}

export async function POST(req) {
  try {
    // ── Check Blob token is available ───────────────────────────
    getToken();

    // ── Origin check (CSRF protection) ──────────────────────────
    const blocked = checkOrigin(req);
    if (blocked) return blocked;

    // ── Rate limiting: 5 per hour per IP ────────────────────────
    const ip = getClientIp(req);
    const rl = rateLimit(`subscribe:${ip}`, 5, 3_600_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    // SECURITY (audit fix C4 applied to subscribe, 2026-04-26): cap
    // body size BEFORE req.json() parses everything into memory. A 50MB
    // POST is fully parsed before the email regex below ever runs.
    // Email + a few wrapping bytes; 1KB is generous.
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 1024) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Sanitise: only store the email, nothing else from the payload
    const cleanEmail = email.trim().toLowerCase().slice(0, 254);

    const subscribers = await getSubscribers();

    // Check for duplicate
    if (subscribers.some((s) => s.email === cleanEmail)) {
      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
        message: "You're already subscribed — thanks.",
      });
    }

    // SECURITY (audit fix C3, 2026-04-26): hard cap on the subscriber
    // list. With 50,000 subscribers any further sign-up is refused with
    // 503 — the in-memory rate limiter is per-isolate and can't reliably
    // throttle a botnet across many concurrent isolates, so this cap is
    // the structural floor that prevents the JSON.parse OOM scenario.
    // When this triggers in legitimate use, swap in a proper KV-backed
    // store; treat it as a "we're successful" milestone, not an outage.
    if (subscribers.length >= MAX_SUBSCRIBERS) {
      console.warn(
        `[subscribe] Subscriber list reached cap of ${MAX_SUBSCRIBERS}; refusing new sign-ups until storage is upgraded.`
      );
      return NextResponse.json(
        {
          error: "Newsletter signup temporarily paused — please email us instead.",
        },
        { status: 503 }
      );
    }

    // Add new subscriber
    subscribers.push({
      email: cleanEmail,
      subscribedAt: new Date().toISOString(),
    });

    await saveSubscribers(subscribers);

    return NextResponse.json({
      ok: true,
      alreadySubscribed: false,
      message: "Thanks — you're subscribed. Look out for the next briefing.",
    });
  } catch (err) {
    console.error("Subscribe error:", err?.message || err);

    // Missing Blob token — clear message for admin
    if (err?.message?.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json(
        { error: "Newsletter storage not configured. Please contact us." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Newsletter signup failed. Please try again later." },
      { status: 500 }
    );
  }
}

// GET endpoint removed — subscriber list should not be publicly accessible.
// To view subscribers, check the subscribers.json blob in the Vercel dashboard.
