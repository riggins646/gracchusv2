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

const BLOB_PATH = "subscribers.json";

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
    const { blobs } = await list({ prefix: BLOB_PATH, token });
    if (blobs.length === 0) return [];
    const url = blobs[0].downloadUrl || blobs[0].url;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    // If token is missing, re-throw so caller gets a clear message
    if (err.message?.includes("BLOB_READ_WRITE_TOKEN")) throw err;
    return [];
  }
}

async function saveSubscribers(subscribers) {
  const token = getToken();
  await put(BLOB_PATH, JSON.stringify(subscribers, null, 2), {
    access: "private",
    addRandomSuffix: false,
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

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Sanitise: only store the email, nothing else from the payload
    const cleanEmail = email.trim().toLowerCase().slice(0, 254);

    const subscribers = await getSubscribers();

    // Check for duplicate
    if (subscribers.some((s) => s.email === cleanEmail)) {
      return NextResponse.json({ ok: true, message: "Already subscribed" });
    }

    // Add new subscriber
    subscribers.push({
      email: cleanEmail,
      subscribedAt: new Date().toISOString(),
    });

    await saveSubscribers(subscribers);

    return NextResponse.json({ ok: true, message: "Subscribed" });
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
