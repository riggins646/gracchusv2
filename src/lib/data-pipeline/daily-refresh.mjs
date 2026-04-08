#!/usr/bin/env node
/**
 * DAILY REFRESH ORCHESTRATOR
 *
 * The production entry point. Runs every day at 4am via GitHub Actions
 * (or cron). For each dataset that has an adapter:
 *
 *   1. CADENCE GATE  — Is this dataset due for a check today?
 *   2. CHANGE DETECT — Has the source actually changed?
 *   3. FETCH         — Download new data
 *   4. HASH CHECK    — Post-download content hash comparison
 *   5. NORMALIZE     — Transform to frontend schema
 *   6. VALIDATE      — Schema, range, row-count checks
 *   7. STORE         — Snapshot + live data + history + raw archive
 *   8. CHANGE STATE  — Record new ETag/hash/date for next run
 *   9. MONITOR       — Build pipeline status, fire alerts if red
 *
 * Usage:
 *   node daily-refresh.mjs                       # Normal daily run
 *   node daily-refresh.mjs --force               # Ignore cadence + change detection
 *   node daily-refresh.mjs --dataset=cost-of-living  # Single dataset
 *   node daily-refresh.mjs --check-only          # Change detection only, no ingest
 *   node daily-refresh.mjs --alert               # Fire Slack/webhook alerts after run
 *   node daily-refresh.mjs --status              # Just print health report
 */

import { DATASET_REGISTRY, getByPriority } from "./dataset-registry.mjs";
import { runIngest, checkFreshness, getLastGoodSnapshot } from "./ingest-engine.mjs";
import { detectChange, saveEtagState, saveContentHash, savePageDate, saveTailValue, saveGovUKReleaseState, checkContentHash } from "./change-detector.mjs";
import { buildPipelineStatus, printStatusReport, savePipelineStatus, fireAlerts } from "./monitor.mjs";

// Source adapters
import * as onsApi from "./adapters/ons-api.mjs";
import * as electoralCommission from "./adapters/electoral-commission.mjs";
import * as contractsFinder from "./adapters/contracts-finder.mjs";
import * as parliamentApi from "./adapters/parliament-api.mjs";
import * as oecdApi from "./adapters/oecd-api.mjs";
import * as hmrcCsv from "./adapters/hmrc-csv.mjs";
import * as iatiDatastore from "./adapters/iati-datastore.mjs";
import * as companiesHouse from "./adapters/companies-house.mjs";
import * as govukSpend from "./adapters/govuk-spend.mjs";
import * as publicFinancesAdapter from "./adapters/public-finances.mjs";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const RUN_LOG = path.join(PROJECT_ROOT, "data", "snapshots", "daily-run-log.jsonl");

// ═══════════════════════════════════════════════════════════════════════
// ADAPTER MAP — dataset key → { fetchFn, normalizeFn, validateFn }
// ═══════════════════════════════════════════════════════════════════════

const ADAPTER_MAP = {
  "cost-of-living": {
    fetchFn: () =>
      onsApi.fetchONSMultipleSeries({
        cpiRate: "L55O",
        foodInflation: "L55P",
        housingCosts: "L55Q",
        wages: "KAC3",
      }),
    normalizeFn: onsApi.normalizeCostOfLiving,
  },
  "economic-output": {
    fetchFn: () =>
      onsApi.fetchONSMultipleSeries({
        gdpGrowth: "IHYQ",
        unemployment: "MGSX",
        employmentRate: "LF24",
      }),
    normalizeFn: onsApi.normalizeEconomicOutput,
  },
  "political-donations": {
    fetchFn: () => electoralCommission.fetchAndNormalizeDonations(),
    normalizeFn: electoralCommission.normalizeDonations,
  },
  "suppliers-summary": {
    fetchFn: () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return contractsFinder.fetchAllNotices({ publishedFrom: d.toISOString(), stage: "award" });
    },
    normalizeFn: contractsFinder.normalizeSuppliersSummary,
  },
  "consultancy-contracts": {
    fetchFn: () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return contractsFinder.fetchAllNotices({
        keyword: "consultancy OR consulting OR advisory",
        publishedFrom: d.toISOString(),
        stage: "award",
      });
    },
    normalizeFn: contractsFinder.normalizeConsultancyContracts,
  },
  "contracts-raw": {
    fetchFn: () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return contractsFinder.fetchAllNotices({ publishedFrom: d.toISOString() });
    },
    normalizeFn: contractsFinder.normalizeSuppliersSummary,
  },
  "mp-interests": {
    fetchFn: async () => {
      const members = await parliamentApi.fetchAllCurrentMPs();
      return parliamentApi.fetchAllInterests(members.data);
    },
    normalizeFn: parliamentApi.normalizeMPInterests,
  },
  "structural-performance": {
    fetchFn: async () => {
      const [gdp, gov, tax] = await Promise.all([
        oecdApi.fetchGDPComparison(),
        oecdApi.fetchGovSpendingComparison(),
        oecdApi.fetchTaxRevenueComparison(),
      ]);
      return {
        data: { gdp: gdp.data, govSpending: gov.data, taxRevenue: tax.data },
        rawPayload: { gdp: gdp.rawPayload, govSpending: gov.rawPayload, taxRevenue: tax.rawPayload },
        sourceTimestamp: new Date().toISOString(),
        recordCount: gdp.recordCount + gov.recordCount + tax.recordCount,
      };
    },
    normalizeFn: oecdApi.normalizeStructuralPerformance,
  },
  "fcdo-programmes": {
    fetchFn: () =>
      iatiDatastore.fetchAllActivities({ reportingOrg: "GB-GOV-1", hierarchy: 1, status: "2" }),
    normalizeFn: iatiDatastore.normalizeFCDOProgrammes,
  },
  "tax-receipts": {
    fetchFn: () =>
      hmrcCsv.fetchSpreadsheet(
        "https://assets.publishing.service.gov.uk/media/hmrc-receipts.csv"
      ),
    normalizeFn: (raw) => {
      if (typeof raw === "string") return hmrcCsv.normalizeTaxReceipts(hmrcCsv.parseCSV(raw));
      return raw;
    },
  },
  "company-profiles": {
    fetchFn: async () => {
      // Batch-lookup key companies from existing supplier/donor data.
      // In practice, the company numbers come from cross-referencing
      // suppliers-summary and political-donations datasets.
      // For now, provide a placeholder that the pipeline can extend.
      const companyNumbers = await loadCompanyNumbersFromCrossRef();
      return companiesHouse.fetchCompanyBatch(companyNumbers, {
        includeOfficers: true,
        includePSC: true,
      });
    },
    normalizeFn: companiesHouse.normalizeCompanyProfiles,
    validateFn: companiesHouse.validateCompanyProfiles,
  },
  "departmental-spend": {
    fetchFn: () =>
      govukSpend.fetchAllDepartmentSpend({ monthsBack: 3 }),
    normalizeFn: govukSpend.normalizeDepartmentalSpend,
    validateFn: govukSpend.validateDepartmentalSpend,
  },
  "public-finances-flow": {
    fetchFn: () => publicFinancesAdapter.fetchPublicFinances(),
    normalizeFn: publicFinancesAdapter.normalizePublicFinancesFlow,
    validateFn: publicFinancesAdapter.validatePublicFinancesFlow,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// COMPANY NUMBER CROSS-REFERENCE LOADER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Load company numbers from existing datasets (suppliers, donors) for
 * Companies House enrichment. Reads the current suppliers-summary and
 * political-donations JSON files, extracts any company registration
 * numbers, and returns a deduplicated list.
 *
 * Falls back to a curated seed list of major government suppliers.
 */
async function loadCompanyNumbersFromCrossRef() {
  const dataDir = path.join(PROJECT_ROOT, "src", "data");
  const numbers = new Set();

  // Try to extract from existing supplier data
  try {
    const suppliersPath = path.join(dataDir, "suppliers-summary.json");
    if (fs.existsSync(suppliersPath)) {
      const data = JSON.parse(fs.readFileSync(suppliersPath, "utf-8"));
      for (const s of data.topSuppliers || []) {
        if (s.companyNumber) numbers.add(s.companyNumber);
      }
    }
  } catch { /* non-critical */ }

  // Try to extract from donation data
  try {
    const donationsPath = path.join(dataDir, "political-donations.json");
    if (fs.existsSync(donationsPath)) {
      const data = JSON.parse(fs.readFileSync(donationsPath, "utf-8"));
      for (const d of data.donors || data.topDonors || []) {
        if (d.companyNumber) numbers.add(d.companyNumber);
      }
    }
  } catch { /* non-critical */ }

  // Seed list of major government suppliers if no cross-refs found
  if (numbers.size === 0) {
    const SEED_COMPANIES = [
      "02711625", // Serco Group plc
      "03099799", // Capita plc
      "01550462", // G4S plc
      "01753700", // Atos IT Services UK Ltd
      "01397068", // BAE Systems plc
      "02418033", // Fujitsu Services Ltd
      "00102498", // Deloitte LLP
      "OC303480", // PricewaterhouseCoopers LLP
      "OC328366", // KPMG LLP
      "SC084268", // Ernst & Young LLP
      "02627460", // Accenture (UK) Ltd
      "00198491", // McKinsey & Company Inc UK
    ];
    for (const n of SEED_COMPANIES) numbers.add(n);
  }

  return [...numbers];
}

// ═══════════════════════════════════════════════════════════════════════
// CADENCE GATING — Should this dataset be checked today?
// ═══════════════════════════════════════════════════════════════════════

const CADENCE_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 28,
  quarterly: 84,
  annual: 350,
  manual: Infinity,
};

function isDueForCheck(datasetKey, config) {
  const cadence = config.refresh?.cadence || "manual";
  if (cadence === "manual") return false;

  const maxDays = CADENCE_DAYS[cadence] || CADENCE_DAYS.monthly;
  const freshness = checkFreshness(datasetKey, config);

  // If data has never been ingested, it's always due
  if (freshness.status === "missing" || freshness.status === "unknown") return true;

  // If days since update exceeds the cadence threshold (with 20% buffer)
  if (freshness.daysSince !== null && freshness.daysSince >= maxDays * 0.8) return true;

  // Also check via cron expression if provided
  if (config.refresh?.cronExpression) {
    return isCronDueToday(config.refresh.cronExpression);
  }

  return false;
}

/**
 * Simple cron-day check: does today match the day-of-month and month fields?
 * Only checks the date fields (not hour/minute — this runs at 4am regardless).
 */
function isCronDueToday(cronExpr) {
  const parts = cronExpr.split(/\s+/);
  if (parts.length < 5) return false;

  const [, , dayOfMonth, month, dayOfWeek] = parts;
  const now = new Date();
  const dom = now.getDate();
  const mon = now.getMonth() + 1;
  const dow = now.getDay(); // 0=Sun

  if (dayOfMonth !== "*" && !matchesCronField(dayOfMonth, dom)) return false;
  if (month !== "*" && !matchesCronField(month, mon)) return false;
  if (dayOfWeek !== "*" && !matchesCronField(dayOfWeek, dow)) return false;

  return true;
}

function matchesCronField(field, value) {
  // Handle ranges like "1,4,7,10" or "1-5"
  return field.split(",").some((part) => {
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return value >= lo && value <= hi;
    }
    return parseInt(part) === value;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CORE: PROCESS ONE DATASET
// ═══════════════════════════════════════════════════════════════════════

async function processDataset(datasetKey, options = {}) {
  const config = DATASET_REGISTRY[datasetKey];
  if (!config) return { datasetKey, status: "unknown_dataset" };

  const adapter = ADAPTER_MAP[datasetKey];
  if (!adapter) return { datasetKey, status: "no_adapter", displayName: config.displayName };

  const runEntry = {
    datasetKey,
    displayName: config.displayName,
    startedAt: new Date().toISOString(),
    cadenceDue: null,
    changeDetected: null,
    ingested: false,
    status: "pending",
    error: null,
  };

  // ── Step 1: Cadence gate ─────────────────────────────────────────
  if (!options.force) {
    const due = isDueForCheck(datasetKey, config);
    runEntry.cadenceDue = due;
    if (!due) {
      runEntry.status = "skipped_not_due";
      runEntry.finishedAt = new Date().toISOString();
      console.log(`[${datasetKey}] Not due for check (cadence: ${config.refresh?.cadence}) — skipping`);
      return runEntry;
    }
  } else {
    runEntry.cadenceDue = true;
  }

  // ── Step 2: Change detection ─────────────────────────────────────
  if (!options.force && config.changeDetection) {
    try {
      const changeResult = await detectChange(datasetKey, config);
      runEntry.changeDetected = changeResult.changed;
      runEntry.changeReason = changeResult.reason;

      if (!changeResult.changed) {
        runEntry.status = "skipped_no_change";
        runEntry.finishedAt = new Date().toISOString();
        console.log(`[${datasetKey}] No change detected: ${changeResult.reason} — skipping`);
        return runEntry;
      }

      console.log(`[${datasetKey}] Change detected: ${changeResult.reason}`);
    } catch (err) {
      console.warn(`[${datasetKey}] Change detection error: ${err.message} — proceeding with ingest`);
      runEntry.changeDetected = true;
      runEntry.changeReason = `detection error: ${err.message}`;
    }
  } else {
    runEntry.changeDetected = true;
    runEntry.changeReason = options.force ? "force flag" : "no changeDetection config";
  }

  if (options.checkOnly) {
    runEntry.status = "check_only";
    runEntry.finishedAt = new Date().toISOString();
    return runEntry;
  }

  // ── Step 3-7: Fetch → Normalize → Validate → Store ──────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  INGESTING: ${config.displayName} (${datasetKey})`);
  console.log(`  Source: ${config.sources?.[0]?.name || "unknown"}`);
  console.log(`${"═".repeat(60)}`);

  try {
    const result = await runIngest(
      datasetKey,
      config,
      adapter.fetchFn,
      adapter.normalizeFn,
      adapter.validateFn || null
    );

    runEntry.ingested = result.success;
    runEntry.recordCount = result.recordCount;
    runEntry.validationResult = result.validationResult;

    if (result.success) {
      runEntry.status = "success";

      // ── Step 8: Save change state for next run ─────────────────
      if (config.changeDetection) {
        saveChangeState(datasetKey, config, result);
      }
    } else {
      runEntry.status = "ingest_failed";
      runEntry.error = result.error;

      // Fallback: ensure last good data stays live
      if (config.fallback?.strategy === "last_successful_snapshot") {
        const fallback = getLastGoodSnapshot(datasetKey);
        if (fallback.found) {
          console.log(`[${datasetKey}] Fallback: last good snapshot preserved`);
          runEntry.fallbackUsed = true;
        }
      }
    }
  } catch (err) {
    runEntry.status = "exception";
    runEntry.error = err.message;
    console.error(`[${datasetKey}] Exception: ${err.message}`);
  }

  runEntry.finishedAt = new Date().toISOString();
  return runEntry;
}

function saveChangeState(datasetKey, config, result) {
  const strategy = config.changeDetection?.strategy;
  try {
    switch (strategy) {
      case "etag_modified":
        if (result.responseHeaders) saveEtagState(datasetKey, result.responseHeaders);
        break;
      case "content_hash":
        if (result.contentHash) saveContentHash(datasetKey, result.contentHash);
        break;
      case "page_date":
        if (result.pageDate) savePageDate(datasetKey, result.pageDate);
        break;
      case "gov_uk_release_page":
        saveGovUKReleaseState(datasetKey, config.changeDetection?.lastDownloadUrl, result.pageDate);
        break;
      case "row_tail":
        if (result.tailValue) saveTailValue(datasetKey, result.tailValue);
        break;
    }
  } catch (err) {
    console.warn(`[${datasetKey}] Could not save change state: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FULL PIPELINE RUN
// ═══════════════════════════════════════════════════════════════════════

async function runDailyRefresh(options = {}) {
  const startTime = Date.now();
  const runId = new Date().toISOString().replace(/[:.]/g, "-");

  console.log(`\n╔${"═".repeat(68)}╗`);
  console.log(`║  SAVING BRITAIN — Daily Refresh   ${runId.slice(0, 19)}`.padEnd(69) + `║`);
  console.log(`╚${"═".repeat(68)}╝\n`);

  // Determine which datasets to process
  let datasetKeys;
  if (options.dataset) {
    datasetKeys = [options.dataset];
  } else if (options.priority) {
    datasetKeys = getByPriority(options.priority).map((d) => d.key);
  } else {
    datasetKeys = Object.keys(ADAPTER_MAP);
  }

  // Process each dataset
  const results = [];
  for (const key of datasetKeys) {
    const result = await processDataset(key, options);
    results.push(result);

    // Write each run entry to the run log immediately (crash-safe)
    appendRunLog(result);
  }

  // Summarize
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const counts = {
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "ingest_failed" || r.status === "exception").length,
    skippedNotDue: results.filter((r) => r.status === "skipped_not_due").length,
    skippedNoChange: results.filter((r) => r.status === "skipped_no_change").length,
    noAdapter: results.filter((r) => r.status === "no_adapter").length,
  };

  console.log(`\n${"─".repeat(68)}`);
  console.log(`  DAILY REFRESH COMPLETE in ${elapsed}s`);
  console.log(`  ✓ Ingested:     ${counts.success}`);
  console.log(`  ✗ Failed:       ${counts.failed}`);
  console.log(`  ○ Not due:      ${counts.skippedNotDue}`);
  console.log(`  ◌ No change:    ${counts.skippedNoChange}`);
  console.log(`  — No adapter:   ${counts.noAdapter}`);
  console.log(`${"─".repeat(68)}\n`);

  // ── Step 9: Monitor & Alert ──────────────────────────────────────
  const status = buildPipelineStatus();
  printStatusReport(status);
  savePipelineStatus(status);

  if (options.alert) {
    await fireAlerts(status, { includeAmber: false });
  }

  return { runId, elapsed, counts, results };
}

function appendRunLog(entry) {
  try {
    fs.appendFileSync(RUN_LOG, JSON.stringify(entry) + "\n");
  } catch { /* non-critical */ }
}

// ═══════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      flags[key] = val || true;
    }
  }

  // Status-only mode
  if (flags.status) {
    const status = buildPipelineStatus();
    printStatusReport(status);
    savePipelineStatus(status);
    process.exit(0);
  }

  const options = {
    force: !!flags.force,
    checkOnly: !!flags["check-only"],
    alert: !!flags.alert,
    dataset: flags.dataset || null,
    priority: flags.priority || null,
  };

  const result = await runDailyRefresh(options);

  // Exit with error if any failures
  process.exit(result.counts.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Daily refresh fatal error:", err);
  process.exit(2);
});

export { processDataset, runDailyRefresh };
