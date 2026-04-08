/**
 * CHANGE DETECTION MODULE
 *
 * Prevents blind re-ingestion. Before downloading a full dataset,
 * checks whether the source has actually changed since the last
 * successful fetch.
 *
 * Strategies (per source type):
 *   etag_modified   — HTTP ETag + Last-Modified headers
 *   content_hash    — SHA-256 of downloaded content vs stored hash
 *   page_date       — Parse publication date from an HTML release page
 *   row_tail        — Compare latest date/row in current data
 *   always          — Always re-fetch (for cheap/fast API calls)
 *
 * The change-state file lives at:
 *   data/snapshots/{datasetKey}.change-state.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = path.resolve(__dirname, "..", "..", "..", "data", "snapshots");

if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

function stateFilePath(datasetKey) {
  return path.join(SNAPSHOTS_DIR, `${datasetKey}.change-state.json`);
}

function readState(datasetKey) {
  const p = stateFilePath(datasetKey);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return {}; }
}

function writeState(datasetKey, state) {
  fs.writeFileSync(stateFilePath(datasetKey), JSON.stringify(state, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY: etag_modified
// ═══════════════════════════════════════════════════════════════════════

/**
 * HEAD request to check ETag / Last-Modified without downloading.
 * Returns { changed: bool, reason: string, headers: {} }
 */
export async function checkEtagModified(url, datasetKey) {
  const prev = readState(datasetKey);

  const headers = {};
  if (prev.etag) headers["If-None-Match"] = prev.etag;
  if (prev.lastModified) headers["If-Modified-Since"] = prev.lastModified;

  const resp = await fetch(url, { method: "HEAD", headers });

  if (resp.status === 304) {
    return { changed: false, reason: "304 Not Modified", headers: {} };
  }

  const newEtag = resp.headers.get("etag");
  const newLastModified = resp.headers.get("last-modified");
  const newContentLength = resp.headers.get("content-length");

  // Detect change
  let changed = false;
  let reason = "no change signals";

  if (newEtag && newEtag !== prev.etag) {
    changed = true;
    reason = `ETag changed: ${prev.etag || "(none)"} → ${newEtag}`;
  } else if (newLastModified && newLastModified !== prev.lastModified) {
    changed = true;
    reason = `Last-Modified changed: ${prev.lastModified || "(none)"} → ${newLastModified}`;
  } else if (newContentLength && prev.contentLength && newContentLength !== prev.contentLength) {
    changed = true;
    reason = `Content-Length changed: ${prev.contentLength} → ${newContentLength}`;
  } else if (!newEtag && !newLastModified) {
    // Server provides no change signals — must re-download to check
    changed = true;
    reason = "no ETag or Last-Modified header — must re-download";
  }

  return {
    changed,
    reason,
    headers: { etag: newEtag, lastModified: newLastModified, contentLength: newContentLength },
  };
}

/**
 * Save the ETag/Last-Modified state after a successful ingest.
 */
export function saveEtagState(datasetKey, headers) {
  const state = readState(datasetKey);
  writeState(datasetKey, {
    ...state,
    etag: headers.etag || state.etag,
    lastModified: headers.lastModified || state.lastModified,
    contentLength: headers.contentLength || state.contentLength,
    checkedAt: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY: content_hash
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute SHA-256 of content and compare to stored hash.
 * Call AFTER downloading the content but BEFORE parsing.
 */
export function checkContentHash(content, datasetKey) {
  const prev = readState(datasetKey);
  const buf = typeof content === "string" ? Buffer.from(content) : content;
  const hash = crypto.createHash("sha256").update(buf).digest("hex");

  if (prev.contentHash === hash) {
    return { changed: false, reason: "SHA-256 unchanged", hash };
  }

  return {
    changed: true,
    reason: prev.contentHash
      ? `SHA-256 changed: ${prev.contentHash.slice(0, 12)}… → ${hash.slice(0, 12)}…`
      : "first ingest (no prior hash)",
    hash,
  };
}

export function saveContentHash(datasetKey, hash) {
  const state = readState(datasetKey);
  writeState(datasetKey, { ...state, contentHash: hash, checkedAt: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY: page_date
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch an HTML release page, extract the latest publication date,
 * compare it to the stored date.
 *
 * @param {string} url - URL of the gov.uk statistics page
 * @param {string} datasetKey
 * @param {RegExp|Function} dateExtractor - regex or fn(html) → dateString
 */
export async function checkPageDate(url, datasetKey, dateExtractor) {
  const resp = await fetch(url, { headers: { Accept: "text/html" } });
  if (!resp.ok) return { changed: true, reason: `HTTP ${resp.status} — cannot verify, assume changed` };

  const html = await resp.text();
  let dateStr;

  if (typeof dateExtractor === "function") {
    dateStr = dateExtractor(html);
  } else {
    // Default: look for "Published <date>" pattern on gov.uk
    const match = html.match(
      /(?:published|updated|released)\s*(?:on\s*)?(\d{1,2}\s+\w+\s+\d{4})/i
    );
    dateStr = match ? match[1] : null;
  }

  if (!dateStr) {
    return { changed: true, reason: "could not extract date from page — assume changed" };
  }

  const prev = readState(datasetKey);
  if (prev.pageDate === dateStr) {
    return { changed: false, reason: `publication date unchanged: ${dateStr}` };
  }

  return { changed: true, reason: `new publication date: ${prev.pageDate || "(none)"} → ${dateStr}`, pageDate: dateStr };
}

export function savePageDate(datasetKey, pageDate) {
  const state = readState(datasetKey);
  writeState(datasetKey, { ...state, pageDate, checkedAt: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY: row_tail
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compare the latest date/row value in the live data to what was
 * stored after the last ingest. Useful for time-series datasets
 * where you can check if a new data point exists without downloading.
 */
export function checkRowTail(liveData, datasetKey, tailField) {
  const prev = readState(datasetKey);

  let latestValue;
  const data = typeof tailField === "function"
    ? tailField(liveData)
    : getNestedValue(liveData, tailField);

  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1];
    latestValue = last?.date || last?.year || last?.period || last?.month || JSON.stringify(last).slice(0, 80);
  }

  if (!latestValue) return { changed: true, reason: "could not extract tail — assume changed" };

  if (prev.tailValue === latestValue) {
    return { changed: false, reason: `latest data point unchanged: ${latestValue}` };
  }

  return { changed: true, reason: `new tail: ${prev.tailValue || "(none)"} → ${latestValue}`, tailValue: latestValue };
}

export function saveTailValue(datasetKey, tailValue) {
  const state = readState(datasetKey);
  writeState(datasetKey, { ...state, tailValue, checkedAt: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY: gov_uk_release_page
// ═══════════════════════════════════════════════════════════════════════

/**
 * Specifically for gov.uk /government/statistics/* pages.
 * Looks for the latest document download link and checks if the
 * URL or date has changed.
 */
export async function checkGovUKReleasePage(url, datasetKey, opts = {}) {
  const resp = await fetch(url, { headers: { Accept: "text/html" } });
  if (!resp.ok) return { changed: true, reason: `HTTP ${resp.status} on release page` };

  const html = await resp.text();

  // Extract first .xlsx or .csv or .ods download link
  const ext = opts.ext || "xlsx|csv|ods";
  const linkRegex = new RegExp(`href="([^"]*\\.(?:${ext}))"`, "i");
  const linkMatch = html.match(linkRegex);
  const downloadUrl = linkMatch ? linkMatch[1] : null;

  // Extract date
  const dateMatch = html.match(
    /(?:Published|Updated)\s*(?:<[^>]+>)?\s*(\d{1,2}\s+\w+\s+\d{4})/i
  );
  const pubDate = dateMatch ? dateMatch[1] : null;

  const prev = readState(datasetKey);

  if (downloadUrl && prev.downloadUrl === downloadUrl && prev.pageDate === pubDate) {
    return { changed: false, reason: "download URL and publication date unchanged" };
  }

  const reasons = [];
  if (downloadUrl && downloadUrl !== prev.downloadUrl) reasons.push(`new file URL`);
  if (pubDate && pubDate !== prev.pageDate) reasons.push(`new pub date: ${pubDate}`);
  if (!reasons.length) reasons.push("first check or no prior state");

  return {
    changed: true,
    reason: reasons.join("; "),
    downloadUrl: downloadUrl ? new URL(downloadUrl, url).href : null,
    pageDate: pubDate,
  };
}

export function saveGovUKReleaseState(datasetKey, downloadUrl, pageDate) {
  const state = readState(datasetKey);
  writeState(datasetKey, { ...state, downloadUrl, pageDate, checkedAt: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Master change-check function. Dispatches to the right strategy
 * based on the config.
 *
 * @param {string} datasetKey
 * @param {Object} config - from DATASET_REGISTRY (needs changeDetection field)
 * @returns {{ changed: bool, reason: string, meta: Object }}
 */
export async function detectChange(datasetKey, config) {
  const cd = config.changeDetection;
  if (!cd) return { changed: true, reason: "no changeDetection config — always fetch", meta: {} };

  const strategy = cd.strategy;

  try {
    switch (strategy) {
      case "etag_modified":
        return checkEtagModified(cd.checkUrl || config.sources?.[0]?.url, datasetKey);

      case "content_hash":
        // Content hash is checked after download, not before.
        // Return changed=true so the caller downloads, then checks hash.
        return { changed: true, reason: "content_hash checked post-download", meta: { postDownloadCheck: true } };

      case "page_date":
        return checkPageDate(cd.checkUrl || config.sources?.[0]?.url, datasetKey, cd.dateExtractor);

      case "gov_uk_release_page":
        return checkGovUKReleasePage(cd.checkUrl || config.sources?.[0]?.url, datasetKey, cd);

      case "row_tail":
        // Needs live data — caller must pass it
        return { changed: true, reason: "row_tail checked by caller with live data", meta: {} };

      case "always":
        return { changed: true, reason: "strategy=always", meta: {} };

      default:
        return { changed: true, reason: `unknown strategy: ${strategy}`, meta: {} };
    }
  } catch (err) {
    return { changed: true, reason: `change detection error: ${err.message} — assume changed`, meta: {} };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getNestedValue(obj, pathStr) {
  const parts = pathStr.replace(/\[\]/g, "").split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export default {
  detectChange,
  checkEtagModified, saveEtagState,
  checkContentHash, saveContentHash,
  checkPageDate, savePageDate,
  checkRowTail, saveTailValue,
  checkGovUKReleasePage, saveGovUKReleaseState,
};
