/**
 * INGESTION ENGINE — Reusable fetch → validate → store pipeline
 *
 * 3-Layer Architecture:
 *  1. INGESTION:  fetch from source, retry on failure
 *  2. VALIDATION: schema checks, range checks, freshness checks
 *  3. STORAGE:    snapshot (current), history (append), raw (debug)
 *
 * Every ingest produces an IngestResult with full metadata.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const DATA_DIR = path.join(PROJECT_ROOT, "src", "data");
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, "data", "snapshots");
const HISTORY_DIR = path.join(PROJECT_ROOT, "data", "history");
const RAW_DIR = path.join(PROJECT_ROOT, "data", "raw");

// Ensure directories exist
[SNAPSHOTS_DIR, HISTORY_DIR, RAW_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

/**
 * @typedef {Object} IngestResult
 * @property {string}  datasetKey       - Registry key
 * @property {boolean} success          - Did the ingest succeed?
 * @property {string}  fetchedAt        - ISO timestamp of fetch
 * @property {string}  sourceTimestamp   - Source-provided timestamp if available
 * @property {string}  sourceName       - Human-readable source name
 * @property {number}  recordCount      - Number of records/observations
 * @property {string}  validationResult - "pass" | "warn" | "fail"
 * @property {string[]} validationNotes - Any validation warnings/errors
 * @property {string}  snapshotPath     - Path to stored snapshot
 * @property {string}  rawPath          - Path to raw response
 * @property {string}  error            - Error message if failed
 */

/**
 * Core ingestion function. Orchestrates fetch → validate → store.
 *
 * @param {string} datasetKey - Key from DATASET_REGISTRY
 * @param {Object} config - Dataset config from registry
 * @param {Function} fetchFn - async () => { data, rawPayload, sourceTimestamp, recordCount }
 * @param {Function} [normalizeFn] - (rawData) => normalizedData
 * @param {Function} [validateFn] - Custom validator (data) => { pass, notes }
 * @returns {IngestResult}
 */
export async function runIngest(datasetKey, config, fetchFn, normalizeFn, validateFn) {
  const fetchedAt = new Date().toISOString();
  const result = {
    datasetKey,
    success: false,
    fetchedAt,
    sourceTimestamp: null,
    sourceName: config.sources?.[0]?.name || "unknown",
    recordCount: 0,
    validationResult: "pending",
    validationNotes: [],
    snapshotPath: null,
    rawPath: null,
    error: null,
  };

  // ── LAYER 1: FETCH with retries ──────────────────────────────────
  let fetchResult = null;
  const maxRetries = config.refresh?.retryAttempts || 3;
  const retryDelay = config.refresh?.retryDelayMs || 60000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${datasetKey}] Fetch attempt ${attempt}/${maxRetries}...`);
      fetchResult = await fetchFn();
      break;
    } catch (err) {
      console.error(`[${datasetKey}] Fetch attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`[${datasetKey}] Retrying in ${retryDelay / 1000}s...`);
        await sleep(retryDelay);
      } else {
        result.error = `All ${maxRetries} fetch attempts failed. Last error: ${err.message}`;
        return finalize(result, config);
      }
    }
  }

  if (!fetchResult || !fetchResult.data) {
    result.error = "Fetch returned no data";
    return finalize(result, config);
  }

  result.sourceTimestamp = fetchResult.sourceTimestamp || null;
  result.recordCount = fetchResult.recordCount || 0;

  // ── Save raw payload ─────────────────────────────────────────────
  if (fetchResult.rawPayload) {
    const rawFileName = `${datasetKey}_${fetchedAt.replace(/[:.]/g, "-")}.raw.json`;
    result.rawPath = path.join(RAW_DIR, rawFileName);
    try {
      fs.writeFileSync(result.rawPath, JSON.stringify(fetchResult.rawPayload, null, 2));
    } catch (e) {
      result.validationNotes.push(`Warning: Could not save raw payload: ${e.message}`);
    }
  }

  // ── LAYER 1b: NORMALIZE ──────────────────────────────────────────
  let normalizedData = fetchResult.data;
  if (normalizeFn) {
    try {
      normalizedData = normalizeFn(fetchResult.data);
    } catch (err) {
      result.error = `Normalization failed: ${err.message}`;
      return finalize(result, config);
    }
  }

  // ── LAYER 2: VALIDATE ────────────────────────────────────────────
  const validationResult = runValidation(datasetKey, normalizedData, config, validateFn);
  result.validationResult = validationResult.pass ? "pass" : validationResult.critical ? "fail" : "warn";
  result.validationNotes = validationResult.notes;

  if (validationResult.critical) {
    result.error = `Validation failed critically: ${validationResult.notes.join("; ")}`;
    console.error(`[${datasetKey}] VALIDATION FAILED — not writing to data store`);
    return finalize(result, config);
  }

  // ── LAYER 3: STORE ───────────────────────────────────────────────

  // 3a. Inject ingest metadata into the data
  const dataWithMeta = injectMetadata(normalizedData, {
    _ingest: {
      fetchedAt,
      sourceTimestamp: result.sourceTimestamp,
      sourceName: result.sourceName,
      recordCount: result.recordCount,
      validationResult: result.validationResult,
      validationNotes: result.validationNotes,
    },
  });

  // 3b. Write to snapshot (current version)
  const snapshotFile = `${datasetKey}_latest.json`;
  result.snapshotPath = path.join(SNAPSHOTS_DIR, snapshotFile);
  fs.writeFileSync(result.snapshotPath, JSON.stringify(dataWithMeta, null, 2));

  // 3c. Write to live data directory (frontend reads from here)
  const liveFile = config.file;
  if (liveFile) {
    const livePath = path.join(DATA_DIR, liveFile);
    fs.writeFileSync(livePath, JSON.stringify(dataWithMeta, null, 2));
    console.log(`[${datasetKey}] Updated live data: ${livePath}`);
  }

  // 3d. Append to history if configured
  if (config.history?.retention?.startsWith("append")) {
    const historyFile = `${datasetKey}_history.jsonl`;
    const historyPath = path.join(HISTORY_DIR, historyFile);
    const historyEntry = {
      fetchedAt,
      sourceTimestamp: result.sourceTimestamp,
      recordCount: result.recordCount,
      checksum: simpleChecksum(JSON.stringify(normalizedData)),
    };
    fs.appendFileSync(historyPath, JSON.stringify(historyEntry) + "\n");
  }

  // 3e. Manage raw snapshot retention
  pruneOldSnapshots(datasetKey, config.history?.keepRawSnapshots || 12);

  result.success = true;
  return finalize(result, config);
}

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════

function runValidation(datasetKey, data, config, customValidateFn) {
  const notes = [];
  let critical = false;

  // Custom validator
  if (customValidateFn) {
    const customResult = customValidateFn(data);
    if (!customResult.pass) {
      notes.push(...(customResult.notes || ["Custom validation failed"]));
      if (customResult.critical) critical = true;
    }
  }

  const rules = config.validation;
  if (!rules) return { pass: true, critical: false, notes };

  // Required fields check
  if (rules.requiredFields) {
    for (const field of rules.requiredFields) {
      const val = getNestedValue(data, field);
      if (val === undefined || val === null) {
        notes.push(`Missing required field: ${field}`);
        critical = true;
      }
    }
  }

  // Null check fields
  if (rules.nullCheckFields) {
    for (const field of rules.nullCheckFields) {
      const val = getNestedValue(data, field);
      if (val === null || val === undefined) {
        notes.push(`Null value in field: ${field}`);
      }
    }
  }

  // Numeric range checks
  if (rules.numericRanges) {
    for (const [field, range] of Object.entries(rules.numericRanges)) {
      const val = getNestedValue(data, field);
      if (typeof val === "number") {
        if (val < range.min || val > range.max) {
          notes.push(`Out of range: ${field} = ${val} (expected ${range.min}–${range.max})`);
        }
      }
    }
  }

  return { pass: notes.length === 0, critical, notes };
}

// ═══════════════════════════════════════════════════════════════════════
// FALLBACK — Retrieve last known good data
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get the last successful snapshot for a dataset.
 * Used when a fresh ingest fails — frontend shows this with a stale warning.
 */
export function getLastGoodSnapshot(datasetKey) {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${datasetKey}_latest.json`);
  if (fs.existsSync(snapshotPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      return { found: true, data, path: snapshotPath };
    } catch {
      return { found: false };
    }
  }
  return { found: false };
}

/**
 * Get staleness info for a dataset's live data file.
 */
export function checkFreshness(datasetKey, config) {
  const livePath = path.join(DATA_DIR, config.file);
  if (!fs.existsSync(livePath)) return { status: "missing", daysSince: null };

  try {
    const data = JSON.parse(fs.readFileSync(livePath, "utf-8"));
    const fetchedAt = data._ingest?.fetchedAt || data.metadata?.lastUpdated;
    if (!fetchedAt) return { status: "unknown", daysSince: null };

    const daysSince = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 86400000);
    const { warningAfterDays = 90, criticalAfterDays = 180 } = config.staleness || {};

    if (daysSince > criticalAfterDays) return { status: "critical", daysSince };
    if (daysSince > warningAfterDays) return { status: "warning", daysSince };
    return { status: "fresh", daysSince };
  } catch {
    return { status: "error", daysSince: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function simpleChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(16);
}

function getNestedValue(obj, path) {
  // Handle array notation like "series[].incomeTax"
  const parts = path.replace(/\[\]/g, ".0").split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function injectMetadata(data, meta) {
  if (typeof data === "object" && !Array.isArray(data)) {
    return { ...data, ...meta };
  }
  // For array data, wrap in object
  return { data, ...meta };
}

function pruneOldSnapshots(datasetKey, keepCount) {
  try {
    const prefix = `${datasetKey}_`;
    const files = fs
      .readdirSync(RAW_DIR)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".raw.json"))
      .sort()
      .reverse();

    if (files.length > keepCount) {
      for (const f of files.slice(keepCount)) {
        fs.unlinkSync(path.join(RAW_DIR, f));
      }
    }
  } catch {
    // Non-critical — ignore cleanup errors
  }
}

function finalize(result, config) {
  // Log result summary
  const icon = result.success ? "✓" : "✗";
  console.log(
    `[${result.datasetKey}] ${icon} Ingest ${result.success ? "SUCCESS" : "FAILED"}` +
      ` | ${result.recordCount} records` +
      ` | validation: ${result.validationResult}` +
      (result.error ? ` | error: ${result.error}` : "")
  );

  // Save ingest log
  const logPath = path.join(SNAPSHOTS_DIR, "ingest-log.jsonl");
  const logEntry = {
    ...result,
    snapshotPath: result.snapshotPath ? path.basename(result.snapshotPath) : null,
    rawPath: result.rawPath ? path.basename(result.rawPath) : null,
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n");
  } catch {
    // Non-critical
  }

  return result;
}

export default { runIngest, getLastGoodSnapshot, checkFreshness };
