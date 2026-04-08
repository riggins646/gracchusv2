#!/usr/bin/env node
/**
 * INGESTION RUNNER — Orchestrates all dataset refreshes
 *
 * Usage:
 *   node run-ingest.mjs                    # Run all due datasets
 *   node run-ingest.mjs --dataset=cost-of-living  # Run specific dataset
 *   node run-ingest.mjs --priority=P0      # Run all P0 priority datasets
 *   node run-ingest.mjs --type=api         # Run all API-sourced datasets
 *   node run-ingest.mjs --force            # Ignore staleness, force refresh
 *   node run-ingest.mjs --dry-run          # Show what would run, don't fetch
 *
 * This runner connects the dataset registry to source adapters and
 * feeds them through the ingest engine.
 */

import { DATASET_REGISTRY, getByPriority, getAPIDatasets } from "./dataset-registry.mjs";
import { runIngest, checkFreshness, getLastGoodSnapshot } from "./ingest-engine.mjs";

// Source adapters
import * as onsApi from "./adapters/ons-api.mjs";
import * as electoralCommission from "./adapters/electoral-commission.mjs";
import * as contractsFinder from "./adapters/contracts-finder.mjs";
import * as parliamentApi from "./adapters/parliament-api.mjs";
import * as oecdApi from "./adapters/oecd-api.mjs";
import * as hmrcCsv from "./adapters/hmrc-csv.mjs";
import * as iatiDatastore from "./adapters/iati-datastore.mjs";

// ═══════════════════════════════════════════════════════════════════════
// ADAPTER MAP — Links dataset keys to their fetch/normalize functions
// ═══════════════════════════════════════════════════════════════════════

const ADAPTER_MAP = {
  // ── ONS API datasets ─────────────────────────────────────────────
  "cost-of-living": {
    fetchFn: () =>
      onsApi.fetchONSMultipleSeries({
        cpiRate: "L55O",       // CPIH annual rate
        foodInflation: "L55P", // CPIH food annual rate
        housingCosts: "L55Q",  // CPIH housing annual rate
        wages: "KAC3",         // Average weekly earnings growth
      }),
    normalizeFn: onsApi.normalizeCostOfLiving,
  },

  "economic-output": {
    fetchFn: () =>
      onsApi.fetchONSMultipleSeries({
        gdpGrowth: "IHYQ",       // GDP quarterly growth
        unemployment: "MGSX",     // Unemployment rate
        employmentRate: "LF24",   // Employment rate
      }),
    normalizeFn: onsApi.normalizeEconomicOutput,
  },

  // ── Electoral Commission ─────────────────────────────────────────
  "political-donations": {
    fetchFn: () => electoralCommission.fetchAndNormalizeDonations(),
    normalizeFn: electoralCommission.normalizeDonations,
  },

  // ── Contracts Finder OCDS ────────────────────────────────────────
  "suppliers-summary": {
    fetchFn: () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return contractsFinder.fetchAllNotices({
        publishedFrom: threeMonthsAgo.toISOString(),
        stage: "award",
      });
    },
    normalizeFn: contractsFinder.normalizeSuppliersSummary,
  },

  "consultancy-contracts": {
    fetchFn: () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return contractsFinder.fetchAllNotices({
        keyword: "consultancy OR consulting OR advisory",
        publishedFrom: sixMonthsAgo.toISOString(),
        stage: "award",
      });
    },
    normalizeFn: contractsFinder.normalizeConsultancyContracts,
  },

  "contracts-raw": {
    fetchFn: () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return contractsFinder.fetchAllNotices({
        publishedFrom: oneMonthAgo.toISOString(),
      });
    },
    normalizeFn: contractsFinder.normalizeSuppliersSummary,
  },

  // ── Parliament API ───────────────────────────────────────────────
  "mp-interests": {
    fetchFn: async () => {
      const members = await parliamentApi.fetchAllCurrentMPs();
      return parliamentApi.fetchAllInterests(members.data);
    },
    normalizeFn: parliamentApi.normalizeMPInterests,
  },

  // ── OECD SDMX ───────────────────────────────────────────────────
  "structural-performance": {
    fetchFn: async () => {
      const [gdp, govSpending, taxRevenue] = await Promise.all([
        oecdApi.fetchGDPComparison(),
        oecdApi.fetchGovSpendingComparison(),
        oecdApi.fetchTaxRevenueComparison(),
      ]);
      return {
        data: { gdp: gdp.data, govSpending: govSpending.data, taxRevenue: taxRevenue.data },
        rawPayload: { gdp: gdp.rawPayload, govSpending: govSpending.rawPayload, taxRevenue: taxRevenue.rawPayload },
        sourceTimestamp: new Date().toISOString(),
        recordCount: gdp.recordCount + govSpending.recordCount + taxRevenue.recordCount,
      };
    },
    normalizeFn: oecdApi.normalizeStructuralPerformance,
  },

  // ── IATI Datastore ───────────────────────────────────────────────
  "fcdo-programmes": {
    fetchFn: () =>
      iatiDatastore.fetchAllActivities({
        reportingOrg: "GB-GOV-1",
        hierarchy: 1,
        status: "2",
      }),
    normalizeFn: iatiDatastore.normalizeFCDOProgrammes,
  },

  // ── HMRC CSV feeds ───────────────────────────────────────────────
  // These require known download URLs which change with each release.
  // Listed here as placeholders — URLs need updating each quarter.
  "tax-receipts": {
    fetchFn: () =>
      hmrcCsv.fetchSpreadsheet(
        "https://assets.publishing.service.gov.uk/media/hmrc-receipts.csv"
        // NOTE: This URL is a placeholder. The actual URL changes with each
        // monthly release. Update via the gov.uk statistics page.
      ),
    normalizeFn: (raw) => {
      if (typeof raw === "string") {
        const rows = hmrcCsv.parseCSV(raw);
        return hmrcCsv.normalizeTaxReceipts(rows);
      }
      return raw;
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════
// RUNNER LOGIC
// ═══════════════════════════════════════════════════════════════════════

/**
 * Run ingestion for a specific dataset.
 */
async function ingestDataset(datasetKey, options = {}) {
  const config = DATASET_REGISTRY[datasetKey];
  if (!config) {
    console.error(`Unknown dataset: ${datasetKey}`);
    return null;
  }

  const adapter = ADAPTER_MAP[datasetKey];
  if (!adapter) {
    console.log(`[${datasetKey}] No adapter configured — skipping (source type: ${config.currentSourceType})`);
    return null;
  }

  // Check freshness unless forced
  if (!options.force) {
    const freshness = checkFreshness(datasetKey, config);
    if (freshness.status === "fresh") {
      console.log(`[${datasetKey}] Data is fresh (${freshness.daysSince} days old) — skipping`);
      return { datasetKey, skipped: true, reason: "fresh", daysSince: freshness.daysSince };
    }
  }

  if (options.dryRun) {
    console.log(`[${datasetKey}] DRY RUN — would fetch from ${config.sources?.[0]?.name || "unknown"}`);
    return { datasetKey, dryRun: true };
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`INGESTING: ${config.displayName} (${datasetKey})`);
  console.log(`Source: ${config.sources?.[0]?.name || "unknown"}`);
  console.log(`${"═".repeat(60)}`);

  try {
    const result = await runIngest(
      datasetKey,
      config,
      adapter.fetchFn,
      adapter.normalizeFn,
      adapter.validateFn || null
    );

    // If ingest failed, try fallback
    if (!result.success && config.fallback?.strategy === "last_successful_snapshot") {
      const fallback = getLastGoodSnapshot(datasetKey);
      if (fallback.found) {
        console.log(`[${datasetKey}] Using fallback snapshot from ${fallback.path}`);
        result.fallbackUsed = true;
      }
    }

    return result;
  } catch (err) {
    console.error(`[${datasetKey}] Unexpected error: ${err.message}`);
    return {
      datasetKey,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Run ingestion for multiple datasets.
 */
async function ingestMultiple(datasetKeys, options = {}) {
  const results = [];
  const startTime = Date.now();

  console.log(`\n${"╔".padEnd(60, "═")}╗`);
  console.log(`║ SAVING BRITAIN — Data Pipeline Run`.padEnd(60) + `║`);
  console.log(`║ ${new Date().toISOString()}`.padEnd(60) + `║`);
  console.log(`║ Datasets: ${datasetKeys.length}`.padEnd(60) + `║`);
  console.log(`${"╚".padEnd(60, "═")}╝\n`);

  for (const key of datasetKeys) {
    const result = await ingestDataset(key, options);
    if (result) results.push(result);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => r.success === false).length;
  const skipped = results.filter((r) => r.skipped).length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`PIPELINE COMPLETE in ${elapsed}s`);
  console.log(`  ✓ Succeeded: ${succeeded}`);
  console.log(`  ✗ Failed:    ${failed}`);
  console.log(`  ○ Skipped:   ${skipped}`);
  console.log(`${"─".repeat(60)}\n`);

  return results;
}

// ═══════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT
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

  const options = {
    force: !!flags.force,
    dryRun: !!flags["dry-run"],
  };

  let datasetKeys;

  if (flags.dataset) {
    // Single dataset
    datasetKeys = [flags.dataset];
  } else if (flags.priority) {
    // By priority level
    datasetKeys = getByPriority(flags.priority).map((d) => d.key);
  } else if (flags.type) {
    // By source type
    const typeMap = { api: getAPIDatasets };
    const getter = typeMap[flags.type];
    datasetKeys = getter ? getter().map((d) => d.key) : [];
  } else {
    // All datasets that have adapters
    datasetKeys = Object.keys(ADAPTER_MAP);
  }

  if (datasetKeys.length === 0) {
    console.log("No datasets match the given filters.");
    process.exit(0);
  }

  const results = await ingestMultiple(datasetKeys, options);

  // Exit with error code if any failed
  const anyFailed = results.some((r) => r.success === false && !r.skipped);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Pipeline fatal error:", err);
  process.exit(2);
});

export { ingestDataset, ingestMultiple, ADAPTER_MAP };
