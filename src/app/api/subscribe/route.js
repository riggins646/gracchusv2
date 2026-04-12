import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

/* ───────────────────────────────────────────────
   POST /api/subscribe
   Stores subscriber emails in Vercel Blob as a
   single JSON file (subscribers.json).
   No external services needed.

   GET /api/subscribe
   Returns current subscriber list (for you to
   export / review). Protected by session token.
   ─────────────────────────────────────────────── */

const BLOB_PATH = "subscribers.json";

async function getSubscribers() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return [];
  }
}

async function saveSubscribers(subscribers) {
  await put(BLOB_PATH, JSON.stringify(subscribers, null, 2), {
    access: "public",
    addRandomSuffix: false,
  });
}

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const subscribers = await getSubscribers();

    // Check for duplicate
    if (subscribers.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ ok: true, message: "Already subscribed" });
    }

    // Add new subscriber
    subscribers.push({
      email,
      subscribedAt: new Date().toISOString(),
    });

    await saveSubscribers(subscribers);

    return NextResponse.json({ ok: true, message: "Subscribed" });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Could not subscribe. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const subscribers = await getSubscribers();
    return NextResponse.json({
      count: subscribers.length,
      subscribers,
    });
  } catch (err) {
    console.error("List subscribers error:", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
