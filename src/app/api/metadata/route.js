/**
 * GET /api/metadata
 *
 * Returns the latest refresh timestamps from Vercel Blob.
 * The Dashboard fetches this on mount to display:
 *   - "Last updated: YYYY-MM-DD"       (top right)
 *   - "Data verified Month YYYY"        (bottom right)
 *
 * Response is cached for 60 seconds (stale-while-revalidate 300s)
 * so it doesn't hit the blob store on every page view, but still
 * picks up new values within a minute of the cron running.
 *
 * If the blob doesn't exist yet (first deploy, or blob store not
 * configured), falls back to build-time defaults.
 */

import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { BLOB_PATH, FALLBACK_METADATA } from "@/lib/refresh-metadata";

export async function GET() {
  try {
    // List blobs with the exact prefix to find our metadata file
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });

    if (blobs.length === 0) {
      console.log("[metadata] No blob found, returning fallback");
      return NextResponse.json(FALLBACK_METADATA, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    // Fetch the blob contents
    const res = await fetch(blobs[0].url);
    if (!res.ok) {
      throw new Error(`Blob fetch failed: ${res.status}`);
    }

    const metadata = await res.json();

    return NextResponse.json(metadata, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[metadata] Error reading blob:", err.message);

    // Graceful degradation — never let the UI break
    return NextResponse.json(FALLBACK_METADATA, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  }
}
