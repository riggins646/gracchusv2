/**
 * Shared constants and helpers for the data-refresh metadata system.
 *
 * Vercel Blob stores a single JSON file at BLOB_PATH containing:
 *   { lastUpdatedDate: "YYYY-MM-DD", lastVerifiedMonth: "Month YYYY", refreshedAt: ISO }
 *
 * Both the cron writer (/api/refresh-data) and the reader (/api/metadata)
 * import from here so the path and shape stay in sync.
 */

/** The key (pathname) used inside the Vercel Blob store. */
export const BLOB_PATH = "gracchus/refresh-metadata.json";

/**
 * Build a metadata object from a UTC Date.
 * Pure function — no side effects, easy to test.
 */
export function buildMetadata(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");

  const lastUpdatedDate = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
  ].join("-");

  const lastVerifiedMonth =
    now.toLocaleString("en-GB", { month: "long", timeZone: "UTC" }) +
    " " +
    now.getUTCFullYear();

  return {
    lastUpdatedDate,
    lastVerifiedMonth,
    refreshedAt: now.toISOString(),
  };
}

/**
 * Fallback metadata shown when no blob exists yet
 * (first deploy, or blob store not configured).
 */
export const FALLBACK_METADATA = {
  lastUpdatedDate: new Date().toISOString().slice(0, 10),
  lastVerifiedMonth: (() => {
    const d = new Date();
    return (
      d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" }) +
      " " +
      d.getUTCFullYear()
    );
  })(),
  refreshedAt: null,
};
