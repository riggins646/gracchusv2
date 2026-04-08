/**
 * POST /api/refresh-data
 *
 * Vercel Cron handler — runs daily at 04:00 UTC (configured in vercel.json).
 * Can also be triggered manually via:
 *   curl -X GET http://localhost:3000/api/refresh-data
 *
 * What it does:
 *   1. Validates the CRON_SECRET (in production) to block unauthorised calls.
 *   2. Builds a timestamped metadata object.
 *   3. Writes it to Vercel Blob at a well-known path.
 *   4. Calls res.revalidate("/") so the ISR page picks up the new values
 *      without waiting for the next visitor or a redeploy.
 *
 * Idempotent: running it twice in a row simply overwrites the blob with
 * an identical (or near-identical) timestamp. No duplication, no side-effects.
 */

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { BLOB_PATH, buildMetadata } from "@/lib/refresh-metadata";

// ── Auth helper ──────────────────────────────────────────────────────
function isAuthorised(request) {
  // In development / local testing, skip auth
  if (process.env.NODE_ENV !== "production") return true;

  // Vercel Cron sends this header automatically when CRON_SECRET is set
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  return false;
}

// ── Main handler (supports both GET and POST for flexibility) ────────
async function handler(request) {
  const start = Date.now();
  console.log("[refresh-data] Starting data refresh …");

  // 1. Auth
  if (!isAuthorised(request)) {
    console.warn("[refresh-data] Unauthorised request blocked");
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    // 2. Build metadata from current UTC time
    const now = new Date();
    const metadata = buildMetadata(now);
    console.log("[refresh-data] Metadata:", JSON.stringify(metadata));

    // 3. Write to Vercel Blob (overwrite if exists)
    const blob = await put(BLOB_PATH, JSON.stringify(metadata), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,           // deterministic path — idempotent
    });

    console.log("[refresh-data] Blob written:", blob.url);

    // 4. Revalidate the homepage so ISR serves fresh content
    //    Next.js 14 App Router: we call the revalidatePath import
    //    from next/cache. This is safe to call from a Route Handler.
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/");
      console.log("[refresh-data] Revalidated /");
    } catch (revalErr) {
      // revalidatePath may not work in all runtimes (e.g. edge)
      console.warn("[refresh-data] revalidatePath skipped:", revalErr.message);
    }

    const elapsed = Date.now() - start;
    console.log(`[refresh-data] Done in ${elapsed}ms`);

    return NextResponse.json({
      ok: true,
      metadata,
      blobUrl: blob.url,
      elapsed: `${elapsed}ms`,
    });
  } catch (err) {
    console.error("[refresh-data] FAILED:", err);
    return NextResponse.json(
      { error: "Refresh failed", message: err.message },
      { status: 500 }
    );
  }
}

// Vercel Cron invokes GET by default
export const GET = handler;
// Allow POST for manual triggers too
export const POST = handler;

// Run for up to 60 seconds (Vercel Pro/Enterprise cron can go longer)
export const maxDuration = 60;
