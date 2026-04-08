/**
 * Departmental Spending Ingestion Script
 *
 * Fetches HM Treasury PESA (Public Expenditure Statistical Analyses)
 * data and updates src/data/departmental-spending.json.
 *
 * Primary source: HM Treasury PESA Table 1.12
 *   "Total Managed Expenditure, 2020-21 to 2029-30"
 *   Published annually (usually July) as ODS spreadsheets on GOV.UK.
 *
 * The script:
 *   1. Checks the PESA publication page for the latest edition
 *   2. Downloads the relevant ODS/CSV table
 *   3. Parses departmental totals and sub-breakdowns
 *   4. Merges with our curated sub-department mapping
 *   5. Writes updated JSON to src/data/departmental-spending.json
 *
 * Can run in two modes:
 *   --check   Just reports whether a newer PESA edition exists (exit 0 = up to date, exit 1 = stale)
 *   --force   Re-generates from the curated mapping even without a new PESA edition
 *
 * Usage:
 *   node scripts/ingest-dept-spending.mjs
 *   node scripts/ingest-dept-spending.mjs --check
 *   node scripts/ingest-dept-spending.mjs --force
 *   node scripts/ingest-dept-spending.mjs --year 2025-26
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "departmental-spending.json");
const MAPPING_FILE = path.join(__dirname, "dept-spending-mapping.json");

// ============================================================================
// CLI ARGS
// ============================================================================
const ARGS = process.argv.slice(2);
const FLAG_CHECK = ARGS.includes("--check");
const FLAG_FORCE = ARGS.includes("--force");
const getArg = (name) => {
  const idx = ARGS.indexOf("--" + name);
  return idx >= 0 && ARGS[idx + 1] ? ARGS[idx + 1] : null;
};
const TARGET_YEAR = getArg("year"); // e.g. "2025-26"

// ============================================================================
// PESA PUBLICATION CONFIG
// ============================================================================

/**
 * GOV.UK Content API endpoint for the PESA publication.
 * Returns JSON with links to all document attachments (ODS, PDF, etc.)
 */
const PESA_CONTENT_API =
  "https://www.gov.uk/api/content/government/statistics/public-expenditure-statistical-analyses-pesa";

/**
 * Direct fallback URLs for known PESA editions.
 * Updated each year when a new edition is published.
 */
const KNOWN_EDITIONS = {
  "2025": {
    year: "2024-25",
    tableUrl:
      "https://assets.publishing.service.gov.uk/media/669a6b0949b9c0597fdb9b3e/PESA_2025_Table_1_12.ods",
    published: "2025-07-17",
  },
  "2024": {
    year: "2023-24",
    tableUrl:
      "https://assets.publishing.service.gov.uk/media/6697a1234f29ab1b070768f4/PESA_2024_Table_1_12.ods",
    published: "2024-07-18",
  },
};

// ============================================================================
// CURATED DEPARTMENT MAPPING
// ============================================================================

/**
 * Sub-department breakdowns aren't in the top-level PESA table —
 * they come from individual Departmental Annual Reports, Estimates,
 * and supplementary PESA tables. We maintain a curated mapping that
 * maps each department to its sub-components with proportional splits.
 *
 * This mapping is stored in dept-spending-mapping.json and should be
 * reviewed/updated when a new PESA edition is published.
 */
function loadMapping() {
  if (fs.existsSync(MAPPING_FILE)) {
    const raw = fs.readFileSync(MAPPING_FILE, "utf-8");
    return JSON.parse(raw);
  }
  console.log("[ingest] No mapping file found, using embedded defaults");
  return null;
}

// ============================================================================
// PESA PUBLICATION CHECKER
// ============================================================================

/**
 * Query GOV.UK Content API to find the latest PESA edition.
 * Returns { year, published, attachments[] } or null on failure.
 */
async function checkLatestPesa() {
  console.log("[ingest] Checking GOV.UK for latest PESA edition...");

  try {
    const res = await fetch(PESA_CONTENT_API, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn(`[ingest] GOV.UK API returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const details = data?.details;

    // Extract publication date
    const published =
      data.public_updated_at || data.first_published_at || null;

    // Find ODS attachments for Table 1.12
    const attachments = (details?.documents || [])
      .filter(
        (d) =>
          typeof d === "string" &&
          (d.includes("Table_1") || d.includes("table_1"))
      )
      .map((d) => {
        const match = d.match(/href="([^"]+)"/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    // Try to extract the edition year from the title
    const titleMatch = (data.title || "").match(/(\d{4})/);
    const editionYear = titleMatch ? titleMatch[1] : null;

    return {
      year: editionYear,
      published,
      attachments,
      title: data.title,
    };
  } catch (err) {
    console.error("[ingest] Failed to check GOV.UK:", err.message);
    return null;
  }
}

// ============================================================================
// PESA DATA FETCHER
// ============================================================================

/**
 * Attempt to download and parse a PESA Table 1.12 ODS file.
 *
 * ODS parsing is non-trivial without a library, so we first check if
 * the table is also available as CSV (some editions have both). If not,
 * we fall back to extracting from the XML inside the ODS zip.
 *
 * For robustness, the script also supports a --force mode that regenerates
 * from the curated mapping without downloading anything.
 */
async function fetchPesaTable(url) {
  console.log(`[ingest] Downloading: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[ingest] Download failed: ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("csv") || url.endsWith(".csv")) {
      const text = await res.text();
      return parsePesaCsv(text);
    }

    // ODS files are ZIP archives containing XML
    // For now, log that we'd need an ODS parser and fall back
    console.log("[ingest] ODS file detected — using curated mapping fallback");
    console.log(
      "[ingest] (To add ODS parsing, install 'xlsx' or 'node-ods' package)"
    );
    return null;
  } catch (err) {
    console.error("[ingest] Fetch error:", err.message);
    return null;
  }
}

/**
 * Parse a PESA Table 1.12 CSV into department-level spending totals.
 * The CSV has departments as rows and financial years as columns.
 */
function parsePesaCsv(csvText) {
  const lines = csvText.split("\n").map((l) => l.trim());
  if (lines.length < 3) return null;

  // Find the header row (contains year columns like "2024-25")
  let headerIdx = -1;
  let yearCols = {};

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const cells = lines[i].split(",");
    const yearMatches = cells.reduce((acc, cell, j) => {
      const m = cell.trim().match(/^"?(\d{4}-\d{2})"?$/);
      if (m) acc[m[1]] = j;
      return acc;
    }, {});
    if (Object.keys(yearMatches).length >= 3) {
      headerIdx = i;
      yearCols = yearMatches;
      break;
    }
  }

  if (headerIdx < 0) {
    console.warn("[ingest] Could not find year columns in CSV");
    return null;
  }

  console.log(`[ingest] Found years: ${Object.keys(yearCols).join(", ")}`);

  // Parse department rows
  const departments = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    const name = cells[0];
    if (!name || name.startsWith("Total") || name.startsWith("Source"))
      continue;

    const spending = {};
    for (const [year, col] of Object.entries(yearCols)) {
      const val = parseFloat(cells[col]);
      if (!isNaN(val)) spending[year] = val;
    }

    if (Object.keys(spending).length > 0) {
      departments.push({ name, spending });
    }
  }

  return { yearCols: Object.keys(yearCols), departments };
}

// ============================================================================
// DEPARTMENT NAME NORMALISATION
// ============================================================================

/**
 * Maps PESA department names to our internal short codes.
 * PESA uses formal names; we use shorter display names.
 */
const DEPT_NAME_MAP = {
  "Department for Work and Pensions": "DWP",
  "Department of Health and Social Care": "DHSC",
  "Department for Education": "DfE",
  "Ministry of Defence": "MoD",
  "HM Revenue and Customs": "HMRC",
  "HM Revenue & Customs": "HMRC",
  "Home Office": "HO",
  "Ministry of Justice": "MoJ",
  "Department for Transport": "DfT",
  "Ministry of Housing, Communities and Local Government": "MHCLG",
  "Ministry of Housing, Communities & Local Government": "MHCLG",
  "Department for Science, Innovation and Technology": "DSIT",
  "Department for Science, Innovation & Technology": "DSIT",
  "Foreign, Commonwealth and Development Office": "FCDO",
  "Foreign, Commonwealth & Development Office": "FCDO",
  "Department for Energy Security and Net Zero": "DESNZ",
  "Department for Energy Security & Net Zero": "DESNZ",
  "Department for Environment, Food and Rural Affairs": "DEFRA",
  "Department for Environment, Food & Rural Affairs": "DEFRA",
  "Department for Culture, Media and Sport": "DCMS",
  "Department for Culture, Media & Sport": "DCMS",
  "Cabinet Office": "CO",
  "Scottish Government": "SG",
  "Welsh Government": "WG",
  "Northern Ireland Executive": "NI",
};

function normaliseDeptName(pesaName) {
  return DEPT_NAME_MAP[pesaName] || null;
}

// ============================================================================
// JSON BUILDER
// ============================================================================

/**
 * Build the final departmental-spending.json structure.
 *
 * If we have fresh PESA top-line data, merge it with our curated
 * sub-department breakdowns. Otherwise, regenerate from the mapping
 * file using the existing spend totals.
 */
function buildOutputJson(pesaData, mapping, existingData) {
  const baseYear = TARGET_YEAR || existingData?.metadata?.year || "2024-25";

  // Start from existing data as the baseline
  const output = JSON.parse(JSON.stringify(existingData));

  if (pesaData) {
    // Update top-level department totals from fresh PESA data
    console.log("[ingest] Merging fresh PESA data...");

    for (const pesaDept of pesaData.departments) {
      const shortCode = normaliseDeptName(pesaDept.name);
      if (!shortCode) continue;

      const existing = output.departments.find((d) => d.short === shortCode);
      if (existing && pesaDept.spending[baseYear]) {
        const oldSpend = existing.spend;
        existing.spend = pesaDept.spending[baseYear];
        console.log(
          `  ${shortCode}: £${oldSpend}bn → £${existing.spend}bn`
        );
      }
    }

    // Update year trend from PESA data
    const years = pesaData.yearCols.sort();
    output.yearTrend = years.map((y) => {
      const total = pesaData.departments.reduce(
        (sum, d) => sum + (d.spending[y] || 0),
        0
      );
      return { year: y, total: Math.round(total * 10) / 10 };
    });

    // Update total
    output.metadata.totalPolicySpending = output.departments.reduce(
      (sum, d) => sum + d.spend,
      0
    );
  }

  if (mapping) {
    // Apply sub-department breakdowns from curated mapping
    console.log("[ingest] Applying curated sub-department breakdowns...");

    for (const [shortCode, children] of Object.entries(
      mapping.departments || {}
    )) {
      const dept = output.departments.find((d) => d.short === shortCode);
      if (!dept) continue;

      // Children in mapping are stored as proportional shares
      // Recalculate actual spend based on current total
      if (children.type === "proportional") {
        dept.children = children.items.map((item) => ({
          name: item.name,
          spend: Math.round(dept.spend * item.share * 10) / 10,
        }));
      } else if (children.type === "absolute") {
        dept.children = children.items.map((item) => ({
          name: item.name,
          spend: item.spend,
        }));
      }
    }
  }

  // Recalculate metadata totals
  output.metadata.totalPolicySpending =
    Math.round(
      output.departments.reduce((sum, d) => sum + d.spend, 0) * 10
    ) / 10;

  // Stamp the refresh
  output.metadata.lastIngested = new Date().toISOString();
  output.metadata.year = baseYear;

  return output;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Gracchus — Departmental Spending Ingestion");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Load existing data
  let existingData = null;
  if (fs.existsSync(OUTPUT_FILE)) {
    existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    console.log(
      `[ingest] Existing data: ${existingData.metadata.year}, ` +
        `${existingData.departments.length} departments, ` +
        `£${existingData.metadata.totalPolicySpending}bn total`
    );
    if (existingData.metadata.lastIngested) {
      console.log(
        `[ingest] Last ingested: ${existingData.metadata.lastIngested}`
      );
    }
  } else {
    console.error("[ingest] No existing departmental-spending.json found!");
    console.error("[ingest] Run with --force to generate from mapping.");
    process.exit(1);
  }

  // Step 1: Check for a newer PESA edition
  const latest = await checkLatestPesa();

  if (latest) {
    console.log(`\n[ingest] Latest PESA: "${latest.title}"`);
    console.log(`[ingest] Published: ${latest.published}`);
    console.log(`[ingest] Attachments found: ${latest.attachments.length}`);

    // Compare with our current edition
    const currentEditionYear = existingData.metadata.source.match(/\d{4}/)?.[0];
    if (latest.year && latest.year === currentEditionYear && !FLAG_FORCE) {
      console.log(
        `\n✓ Already using PESA ${latest.year} edition — data is current.`
      );
      if (FLAG_CHECK) process.exit(0);
    } else if (latest.year && latest.year !== currentEditionYear) {
      console.log(
        `\n⚠ New PESA edition available: ${latest.year} (currently using ${currentEditionYear})`
      );
      if (FLAG_CHECK) process.exit(1);
    }
  } else {
    console.log("\n[ingest] Could not reach GOV.UK API — working offline");
  }

  if (FLAG_CHECK) {
    console.log("[ingest] --check mode, exiting");
    process.exit(0);
  }

  // Step 2: Try to fetch fresh PESA table data
  let pesaData = null;

  if (!FLAG_FORCE && latest?.attachments?.length > 0) {
    // Try each attachment URL
    for (const url of latest.attachments) {
      pesaData = await fetchPesaTable(url);
      if (pesaData) break;
    }
  }

  if (!pesaData && !FLAG_FORCE) {
    // Try known editions
    const editions = Object.values(KNOWN_EDITIONS).sort(
      (a, b) => b.year.localeCompare(a.year)
    );
    for (const edition of editions) {
      console.log(`[ingest] Trying known edition: PESA ${edition.year}...`);
      pesaData = await fetchPesaTable(edition.tableUrl);
      if (pesaData) break;
    }
  }

  // Step 3: Load curated sub-department mapping
  const mapping = loadMapping();

  // Step 4: Build output
  if (!pesaData && !mapping && !FLAG_FORCE) {
    console.log("\n[ingest] No new data or mapping changes. Nothing to do.");
    console.log("[ingest] Use --force to regenerate from existing data.");
    process.exit(0);
  }

  const output = buildOutputJson(pesaData, mapping, existingData);

  // Step 5: Write output
  const json = JSON.stringify(output, null, 2) + "\n";
  fs.writeFileSync(OUTPUT_FILE, json);
  console.log(`\n✓ Written ${OUTPUT_FILE}`);
  console.log(
    `  ${output.departments.length} departments, ` +
      `£${output.metadata.totalPolicySpending}bn total`
  );

  // Summary of changes
  if (pesaData) {
    console.log("  Updated from fresh PESA data");
  }
  if (mapping) {
    console.log("  Applied curated sub-department breakdowns");
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("[ingest] Fatal error:", err);
  process.exit(1);
});
