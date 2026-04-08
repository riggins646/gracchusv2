/**
 * UK Government Contracts Finder API Ingestion Script
 *
 * Fetches awarded contract notices from the Contracts Finder API
 * and enriches project data with supplier/contractor information.
 *
 * API docs: https://www.contractsfinder.service.gov.uk/apidocumentation/home
 *
 * Usage:
 *   node scripts/ingest-contracts.mjs
 *   node scripts/ingest-contracts.mjs --supplier "BAE Systems"
 *   node scripts/ingest-contracts.mjs --department "Ministry of Defence"
 *   node scripts/ingest-contracts.mjs --min-value 1000000
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");

// ============================================================================
// CONFIG
// ============================================================================
const CONTRACTS_FINDER_API = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
const SPEND_OVER_25K_BASE = "https://www.gov.uk/government/collections/dfe-department-and-executive-agency-spend-over-25-000";

const ARGS = process.argv.slice(2);
const getArg = (name) => {
  const idx = ARGS.indexOf("--" + name);
  return idx >= 0 && ARGS[idx + 1] ? ARGS[idx + 1] : null;
};

// ============================================================================
// CONTRACTS FINDER API
// ============================================================================

/**
 * Search Contracts Finder for awarded notices.
 * Returns OCDS-format release data.
 */
async function searchContracts({
  keyword = "",
  supplier = "",
  publishedFrom = "2020-01-01",
  publishedTo = "",
  minValue = 0,
  maxValue = 0,
  page = 1,
  size = 50,
} = {}) {
  const params = new URLSearchParams();
  if (keyword) params.set("keyword", keyword);
  if (supplier) params.set("supplierName", supplier);
  params.set("publishedFrom", publishedFrom);
  if (publishedTo) params.set("publishedTo", publishedTo);
  if (minValue) params.set("minValue", String(minValue));
  if (maxValue) params.set("maxValue", String(maxValue));
  params.set("stages", "award"); // Only awarded contracts
  params.set("size", String(size));
  params.set("page", String(page));

  const url = `${CONTRACTS_FINDER_API}?${params.toString()}`;
  console.log(`[Contracts Finder] Fetching: ${url}`);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Extract structured contract data from OCDS releases.
 */
function parseContracts(ocdsData) {
  const contracts = [];

  const releases = ocdsData?.releases || [];
  for (const release of releases) {
    const tender = release?.tender || {};
    const awards = release?.awards || [];
    const buyer = release?.buyer || {};

    for (const award of awards) {
      const suppliers = (award.suppliers || []).map((s) => ({
        name: s.name || "Unknown",
        id: s.id || "",
      }));

      contracts.push({
        id: release.id || "",
        title: tender.title || award.title || "Untitled",
        description: tender.description || award.description || "",
        buyer: buyer.name || "Unknown",
        buyerId: buyer.id || "",
        status: award.status || "unknown",
        publishedDate: release.date || "",
        awardDate: award.date || "",
        value: award.value?.amount || 0,
        currency: award.value?.currency || "GBP",
        suppliers,
        category: tender.mainProcurementCategory || "",
      });
    }
  }

  return contracts;
}

/**
 * Fetch all pages of contracts for a given query.
 */
async function fetchAllContracts(query, maxPages = 5) {
  const allContracts = [];
  let page = 1;

  while (page <= maxPages) {
    const data = await searchContracts({ ...query, page });
    const contracts = parseContracts(data);

    if (contracts.length === 0) break;

    allContracts.push(...contracts);
    console.log(`  Page ${page}: ${contracts.length} contracts found`);
    page++;

    // Rate limit: wait 500ms between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  return allContracts;
}

// ============================================================================
// SUPPLIER ENTITY RESOLUTION
// ============================================================================

/**
 * Normalise supplier names for matching.
 * Handles common variations like "PwC" vs "PricewaterhouseCoopers".
 */
const SUPPLIER_ALIASES = {
  "pricewaterhousecoopers": "PwC",
  "pwc llp": "PwC",
  "pwc uk": "PwC",
  "deloitte llp": "Deloitte",
  "deloitte mcs limited": "Deloitte",
  "ernst & young": "EY",
  "ernst and young": "EY",
  "ey llp": "EY",
  "kpmg llp": "KPMG",
  "kpmg uk": "KPMG",
  "accenture (uk) limited": "Accenture",
  "accenture uk": "Accenture",
  "capita plc": "Capita",
  "capita business services": "Capita",
  "serco group": "Serco",
  "serco limited": "Serco",
  "g4s": "G4S",
  "g4s secure solutions": "G4S",
  "bae systems plc": "BAE Systems",
  "bae systems": "BAE Systems",
  "bae systems (operations) ltd": "BAE Systems",
  "fujitsu services": "Fujitsu",
  "fujitsu services limited": "Fujitsu",
  "capgemini uk plc": "Capgemini",
  "capgemini consulting": "Capgemini",
  "balfour beatty plc": "Balfour Beatty",
  "balfour beatty group": "Balfour Beatty",
};

function normaliseSupplier(name) {
  const lower = name.toLowerCase().trim();
  return SUPPLIER_ALIASES[lower] || name.trim();
}

// ============================================================================
// ENRICHMENT: MATCH CONTRACTS TO PROJECTS
// ============================================================================

/**
 * Try to match a contract to one of our tracked projects
 * using keyword matching on title/description.
 */
function matchToProject(contract, projects) {
  const text = (contract.title + " " + contract.description).toLowerCase();

  const projectKeywords = {
    "HS2": ["hs2", "high speed 2", "high speed two", "high speed rail"],
    "Crossrail": ["crossrail", "elizabeth line"],
    "Hinkley Point C": ["hinkley", "hpc"],
    "Ajax": ["ajax", "armoured vehicle", "scout sv"],
    "Emergency Services Network": ["esn", "emergency services network", "airwave"],
    "Lower Thames Crossing": ["lower thames crossing", "ltc"],
    "Type 26": ["type 26", "city class frigate"],
    "Astute": ["astute", "submarine programme"],
    "Tempest": ["tempest", "gcap", "future combat air"],
  };

  for (const [projectName, keywords] of Object.entries(projectKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return projectName;
    }
  }

  return null;
}

// ============================================================================
// OUTPUT
// ============================================================================

function saveContracts(contracts, filename) {
  const outPath = path.join(DATA_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(contracts, null, 2));
  console.log(`\nSaved ${contracts.length} contracts to ${outPath}`);
}

function printSummary(contracts) {
  console.log("\n=== INGESTION SUMMARY ===");
  console.log(`Total contracts: ${contracts.length}`);

  const totalValue = contracts.reduce((s, c) => s + c.value, 0);
  console.log(`Total value: GBP ${(totalValue / 1e9).toFixed(2)}bn`);

  // Top suppliers
  const supplierTotals = {};
  for (const c of contracts) {
    for (const s of c.suppliers) {
      const name = normaliseSupplier(s.name);
      if (!supplierTotals[name]) {
        supplierTotals[name] = { count: 0, value: 0 };
      }
      supplierTotals[name].count++;
      supplierTotals[name].value += c.value;
    }
  }

  const topSuppliers = Object.entries(supplierTotals)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, 15);

  console.log("\nTop 15 suppliers by contract value:");
  for (const [name, data] of topSuppliers) {
    console.log(
      `  ${name}: ${data.count} contracts, GBP ${(data.value / 1e6).toFixed(1)}m`
    );
  }

  // Top buyers
  const buyerTotals = {};
  for (const c of contracts) {
    if (!buyerTotals[c.buyer]) {
      buyerTotals[c.buyer] = { count: 0, value: 0 };
    }
    buyerTotals[c.buyer].count++;
    buyerTotals[c.buyer].value += c.value;
  }

  const topBuyers = Object.entries(buyerTotals)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, 10);

  console.log("\nTop 10 government buyers:");
  for (const [name, data] of topBuyers) {
    console.log(
      `  ${name}: ${data.count} contracts, GBP ${(data.value / 1e6).toFixed(1)}m`
    );
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("Gracchus - Contract Ingestion");
  console.log("===================================================\n");

  const supplier = getArg("supplier");
  const department = getArg("department");
  const minValue = parseInt(getArg("min-value") || "0", 10);

  const projects = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "projects.json"), "utf-8")
  );

  const query = {};
  if (supplier) {
    query.supplier = supplier;
    console.log(`Filtering by supplier: ${supplier}`);
  }
  if (department) {
    query.keyword = department;
    console.log(`Filtering by department: ${department}`);
  }
  if (minValue) {
    query.minValue = minValue;
    console.log(`Min contract value: GBP ${minValue.toLocaleString()}`);
  }

  try {
    const contracts = await fetchAllContracts(query, 10);

    // Normalise supplier names
    for (const c of contracts) {
      c.suppliers = c.suppliers.map((s) => ({
        ...s,
        name: normaliseSupplier(s.name),
      }));
    }

    // Match to tracked projects
    for (const c of contracts) {
      c.matchedProject = matchToProject(c, projects);
    }

    const matched = contracts.filter((c) => c.matchedProject);
    console.log(
      `\nMatched ${matched.length}/${contracts.length} contracts to tracked projects`
    );

    printSummary(contracts);
    saveContracts(contracts, "contracts-raw.json");

    // Also save a summary by supplier
    const supplierSummary = {};
    for (const c of contracts) {
      for (const s of c.suppliers) {
        if (!supplierSummary[s.name]) {
          supplierSummary[s.name] = {
            name: s.name,
            contractCount: 0,
            totalValue: 0,
            departments: new Set(),
            projects: new Set(),
          };
        }
        supplierSummary[s.name].contractCount++;
        supplierSummary[s.name].totalValue += c.value;
        supplierSummary[s.name].departments.add(c.buyer);
        if (c.matchedProject) {
          supplierSummary[s.name].projects.add(c.matchedProject);
        }
      }
    }

    // Convert Sets to arrays for JSON
    const supplierArray = Object.values(supplierSummary)
      .map((s) => ({
        ...s,
        departments: [...s.departments],
        projects: [...s.projects],
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    saveContracts(supplierArray, "suppliers-summary.json");
  } catch (err) {
    console.error("Ingestion failed:", err.message);
    process.exit(1);
  }
}

main();
