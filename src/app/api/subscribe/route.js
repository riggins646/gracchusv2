import { put, list, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/* ───────────────────────────────────────────────
   POST /api/subscribe
   Stores subscriber emails in Vercel Blob as a
   single JSON file (subscribers.json).
   No external services needed.

   Rate limited: 5 requests per hour per IP.
   ─────────────────────────────────────────────── */

const BLOB_PATH = "subscribers.json";

async function getSubscribers() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    if (blobs.length === 0) return [];
    // Use the download URL with token for private blobs
    const url = blobs[0].downloadUrl || blobs[0].url;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function saveSubscribers(subscribers) {
  await put(BLOB_PATH, JSON.stringify(subscribers, null, 2), {
    access: "private",
    addRandomSuffix: false,
  });
}

export async function POST(req) {
  try {
    // ── Origin check (CSRF protection) ──────────────────────────
    const origin = req.headers.get("origin");
    if (
      origin &&
      !origin.endsWith("gracchus.ai") &&
      !origin.endsWith(".vercel.app") &&
      !origin.startsWith("http://localhost")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    // If Vercel Blob is not configured, give a clear message
    if (err?.message?.includes("BLOB") || err?.message?.includes("token") || err?.message?.includes("unauthorized")) {
      return NextResponse.json(
        { error: "Newsletter storage not configured. Please contact us." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Could not subscribe. Please try again." },
      { status: 500 }
    );
  }
}

// GET endpoint removed — subscriber list should not be publicly accessible.
// To view subscribers, check the subscribers.json blob in the Vercel dashboard.
