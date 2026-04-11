/**
 * POST /api/ingest-spending
 *
 * Server-side departmental spending data refresh.
 * Checks GOV.UK for newer PESA editions and updates the metadata blob.
 *
 * This is NOT a daily cron — it should be triggered:
 *   1. Manually after a new PESA edition is published (usually July)
 *   2. Monthly via a secondary cron schedule (1st of each month)
 *   3. Via the admin UI (future)
 *
 * In production, the actual data update flow is:
 *   1. This endpoint checks GOV.UK for a newer PESA edition
 *   2. If found, it flags the metadata blob with { pesaUpdateAvailable: true }
 *   3. A human runs `node scripts/ingest-dept-spending.mjs` locally
 *      to review and apply the update (sub-department breakdowns need curation)
 *   4. The updated JSON is committed and deployed
 *
 * Why not fully automated? Sub-department breakdowns come from multiple
 * departmental reports, not a single machine-readable table. They need
 * human review to ensure accuracy. The script handles the top-line totals
 * automatically, but the curated mapping file needs manual updates.
 */

import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

const PESA_CONTENT_API =
  "https://www.gov.uk/api/content/government/statistics/public-expenditure-statistical-analyses-pesa";

const BLOB_PATH = "gracchus/pesa-check.json";

// ── Auth ──────────────────────────────────────────────────────────────
function isAuthorised(request) {
  if (process.env.NODE_ENV !== "production") return true;
  if (!process.env.CRON_SECRET) {
    console.error("[ingest-spending] CRON_SECRET not set — blocking request");
    return false;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

// ── Check GOV.UK for latest PESA ─────────────────────────────────────
async function checkPesa() {
  const res = await fetch(PESA_CONTENT_API, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const titleMatch = (data.title || "").match(/(\d{4})/);

  return {
    title: data.title,
    editionYear: titleMatch ? titleMatch[1] : null,
    published: data.public_updated_at || data.first_published_at,
    url: `https://www.gov.uk${data.base_path}`,
  };
}

// ── Handler ──────────────────────────────────────────────────────────
async function handler(request) {
  console.log("[ingest-spending] Starting PESA check...");

  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const pesa = await checkPesa();

    if (!pesa) {
      return NextResponse.json({
        ok: true,
        message: "Could not reach GOV.UK — skipping",
        checked: new Date().toISOString(),
      });
    }

    // Read our current known edition from blob
    let knownEdition = null;
    try {
      const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
      if (blobs.length > 0) {
        const blobRes = await fetch(blobs[0].url);
        if (blobRes.ok) knownEdition = await blobRes.json();
      }
    } catch {
      // First run, no blob yet
    }

    const isNew =
      !knownEdition ||
      knownEdition.editionYear !== pesa.editionYear ||
      knownEdition.published !== pesa.published;

    // Write the check result to blob
    const checkResult = {
      ...pesa,
      checked: new Date().toISOString(),
      isNewEdition: isNew,
      previousEdition: knownEdition?.editionYear || null,
    };

    await put(BLOB_PATH, JSON.stringify(checkResult), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    if (isNew) {
      console.log(
        `[ingest-spending] ⚠ New PESA edition detected: ${pesa.editionYear}`
      );
      console.log(
        `[ingest-spending] Run: node scripts/ingest-dept-spending.mjs`
      );
    } else {
      console.log(
        `[ingest-spending] ✓ PESA ${pesa.editionYear} — already current`
      );
    }

    return NextResponse.json({
      ok: true,
      ...checkResult,
    });
  } catch (err) {
    console.error("[ingest-spending] Error:", err.message);
    return NextResponse.json(
      { error: "Check failed", message: err.message },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const maxDuration = 30;
