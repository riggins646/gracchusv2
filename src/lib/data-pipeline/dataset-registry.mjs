/**
 * DATASET REGISTRY — Single source of truth for all dataset configurations
 *
 * Each entry defines:
 *  - source provenance (name, URL, type, confidence)
 *  - refresh cadence and staleness thresholds
 *  - fallback strategy
 *  - validation rules
 *  - history retention policy
 *  - migration status and priority
 *
 * Source types:
 *  - "api"         → REST/SDMX API with programmatic access
 *  - "csv_feed"    → Official CSV/XLSX published at known URL
 *  - "scrape"      → Structured scrape of official HTML page
 *  - "static"      → Manual ingestion, no automated feed available
 *  - "iati"        → IATI standard datastore
 *  - "ocds"        → Open Contracting Data Standard API
 */

export const DATASET_REGISTRY = {

  // ═══════════════════════════════════════════════════════════════════
  // COST OF LIVING
  // ═══════════════════════════════════════════════════════════════════

  "cost-of-living": {
    displayName: "Cost of Living",
    file: "cost-of-living.json",
    section: "costOfLiving",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "ONS Consumer Price Inflation",
        url: "https://api.beta.ons.gov.uk/v1/datasets/cpih01",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
      {
        name: "ONS Labour Market Statistics",
        url: "https://api.beta.ons.gov.uk/v1/datasets/lms",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "monthly",
      cronExpression: "0 9 16 * *",  // 16th of each month (ONS release day)
      retryAttempts: 3,
      retryDelayMs: 60000,
    },
    staleness: {
      warningAfterDays: 45,
      criticalAfterDays: 75,
      acceptableForDisplay: true,
    },
    fallback: {
      strategy: "last_successful_snapshot",
      showStaleWarning: true,
    },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://api.beta.ons.gov.uk/v1/timeseries/l55o/data",
    },
    validation: {
      requiredFields: ["cpiInflation", "headline"],
      numericRanges: {
        "headline.cpiRate": { min: -5, max: 30 },
        "headline.foodInflation": { min: -10, max: 50 },
      },
      nullCheckFields: ["cpiInflation.series"],
    },
    history: {
      retention: "append_monthly",
      keepRawSnapshots: 12,
      timeSeriesField: "cpiInflation.series",
    },
    migration: {
      status: "planned",
      priority: 1,  // 1=highest
      effort: "medium",
      notes: "ONS API is free, no key needed. CPI dataset cpih01 has full monthly series. Migrate headline metrics to API-driven.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAX RECEIPTS
  // ═══════════════════════════════════════════════════════════════════

  "tax-receipts": {
    displayName: "HMRC Tax Receipts",
    file: "tax-receipts.json",
    section: "government.taxdebt",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "HMRC Tax & NICs Receipts Monthly Bulletin",
        url: "https://www.gov.uk/government/statistics/hmrc-tax-and-nics-receipts-for-the-uk",
        type: "csv_feed",
        apiKey: false,
        format: "xlsx",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "monthly",
      cronExpression: "0 10 22 * *",  // ~22nd of each month
      retryAttempts: 3,
      retryDelayMs: 120000,
    },
    staleness: {
      warningAfterDays: 40,
      criticalAfterDays: 70,
      acceptableForDisplay: true,
    },
    fallback: {
      strategy: "last_successful_snapshot",
      showStaleWarning: true,
    },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/statistics/hmrc-tax-and-nics-receipts-for-the-uk",
      ext: "xlsx",
    },
    validation: {
      requiredFields: ["series"],
      numericRanges: {
        "series[].incomeTax": { min: 100000, max: 500000 },
        "series[].vat": { min: 50000, max: 300000 },
      },
    },
    history: {
      retention: "append_annual",
      keepRawSnapshots: 24,
      timeSeriesField: "series",
    },
    migration: {
      status: "planned",
      priority: 2,
      effort: "medium",
      notes: "No direct API. HMRC publishes monthly XLSX at known URL. Build scraper for publication page to detect new releases, download XLSX, parse and normalize.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC FINANCES
  // ═══════════════════════════════════════════════════════════════════

  "public-finances": {
    displayName: "Public Sector Finances",
    file: "public-finances.json",
    section: "government",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "ONS Public Sector Finances",
        url: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
      {
        name: "OBR Public Finances Databank",
        url: "https://obr.uk/data/",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "monthly",
      cronExpression: "0 10 23 * *",
      retryAttempts: 3,
      retryDelayMs: 120000,
    },
    staleness: {
      warningAfterDays: 40,
      criticalAfterDays: 75,
      acceptableForDisplay: true,
    },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://api.beta.ons.gov.uk/v1/datasets/public-sector-finances",
    },
    validation: {
      requiredFields: ["series"],
      numericRanges: {
        "series[].totalReceipts": { min: 400, max: 2000 },
        "series[].totalExpenditure": { min: 400, max: 2500 },
      },
    },
    history: {
      retention: "append_annual",
      keepRawSnapshots: 24,
      timeSeriesField: "series",
    },
    migration: {
      status: "planned",
      priority: 2,
      effort: "medium",
      notes: "ONS API has PSF datasets. OBR publishes databank XLSX. Use ONS API as primary, OBR as cross-check.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // ECONOMIC OUTPUT
  // ═══════════════════════════════════════════════════════════════════

  "economic-output": {
    displayName: "Economic Performance (GDP, PMI)",
    file: "economic-output.json",
    section: "economy.output",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "ONS GDP Quarterly National Accounts",
        url: "https://api.beta.ons.gov.uk/v1/datasets/quarterly-gdp",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "quarterly",
      cronExpression: "0 10 1 1,4,7,10 *",
      retryAttempts: 3,
      retryDelayMs: 120000,
    },
    staleness: {
      warningAfterDays: 100,
      criticalAfterDays: 180,
      acceptableForDisplay: true,
    },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://api.beta.ons.gov.uk/v1/timeseries/ihyq/data",
    },
    validation: {
      requiredFields: ["gdpGrowthQuarterly"],
      numericRanges: {
        "headline.gdpGrowthQoQ": { min: -25, max: 25 },
      },
    },
    history: { retention: "append_quarterly", keepRawSnapshots: 12, timeSeriesField: "gdpGrowthQuarterly" },
    migration: {
      status: "planned",
      priority: 3,
      effort: "medium",
      notes: "ONS GDP API available. PMI data (IHS Markit) is commercial — keep as manual with ONS GDP as automated backbone.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENERGY
  // ═══════════════════════════════════════════════════════════════════

  "energy": {
    displayName: "UK Energy Production & Imports",
    file: "energy.json",
    section: "compare.bills",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "DESNZ Digest of UK Energy Statistics (DUKES)",
        url: "https://www.gov.uk/government/collections/digest-of-uk-energy-statistics-dukes",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
      {
        name: "DESNZ Energy Trends",
        url: "https://www.gov.uk/government/collections/energy-trends",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "quarterly",
      cronExpression: "0 10 1 1,4,7,10 *",
      retryAttempts: 2,
      retryDelayMs: 300000,
    },
    staleness: { warningAfterDays: 120, criticalAfterDays: 200, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/collections/digest-of-uk-energy-statistics-dukes",
      ext: "xlsx",
    },
    validation: {
      requiredFields: ["energyBalance", "oilProduction", "gasProduction"],
    },
    history: { retention: "append_annual", keepRawSnapshots: 5, timeSeriesField: "energyBalance" },
    migration: {
      status: "planned",
      priority: 4,
      effort: "medium",
      notes: "No API. DUKES published annually (July), Energy Trends quarterly. Build scheduled download of known XLSX URLs from gov.uk collection pages.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PRODUCTION & IMPORTS
  // ═══════════════════════════════════════════════════════════════════

  "production-imports": {
    displayName: "UK Domestic Production vs Imports",
    file: "production-imports.json",
    section: "compare.infrastructure",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "HMRC Trade Statistics",
        url: "https://www.uktradeinfo.com/trade-data/ots-custom-table/",
        type: "csv_feed",
        confidence: "high",
      },
      {
        name: "ONS Index of Production",
        url: "https://api.beta.ons.gov.uk/v1/datasets/index-of-production",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
    ],
    refresh: { cadence: "quarterly", cronExpression: "0 10 15 1,4,7,10 *", retryAttempts: 2, retryDelayMs: 120000 },
    staleness: { warningAfterDays: 120, criticalAfterDays: 200, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://api.beta.ons.gov.uk/v1/datasets/index-of-production",
    },
    validation: { requiredFields: ["industries"] },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 5,
      effort: "high",
      notes: "Multi-source dataset. ONS API for production indexes. HMRC OTS for trade data. Complex normalization needed across 8 industries.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // FUEL PRICES (COMPARE)
  // ═══════════════════════════════════════════════════════════════════

  "compare-data": {
    displayName: "International Infrastructure & Cost Comparisons",
    file: "compare-data.json",
    section: "compare",
    currentSourceType: "static",
    recommendedSourceType: "mixed",
    sources: [
      {
        name: "GOV.UK Weekly Fuel Prices",
        url: "https://www.gov.uk/government/statistics/weekly-road-fuel-prices",
        type: "csv_feed",
        format: "csv",
        confidence: "high",
        subDataset: "fuel",
      },
      {
        name: "GOV.UK Fuel Finder API",
        url: "https://www.gov.uk/guidance/access-the-latest-fuel-prices-and-forecourt-data-via-api-or-email",
        type: "api",
        apiKey: true,
        confidence: "high",
        subDataset: "fuel_live",
      },
      {
        name: "Eurostat Electricity Prices",
        url: "https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table",
        type: "csv_feed",
        confidence: "high",
        subDataset: "electricity",
      },
    ],
    refresh: {
      cadence: "weekly",
      cronExpression: "0 10 * * 2",  // Every Tuesday
      retryAttempts: 3,
      retryDelayMs: 60000,
    },
    staleness: { warningAfterDays: 14, criticalAfterDays: 30, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/statistics/weekly-road-fuel-prices",
      ext: "csv",
    },
    validation: {
      numericRanges: {
        "fuel.uk_ppl": { min: 80, max: 250 },
        "electricity.uk_kwh": { min: 10, max: 100 },
      },
    },
    history: { retention: "append_weekly", keepRawSnapshots: 52 },
    migration: {
      status: "planned",
      priority: 1,
      effort: "medium",
      notes: "Fuel prices change weekly — highest refresh priority. GOV.UK publishes CSV weekly. Infrastructure comparisons are static reference (infrequent change). Split into fast-refresh (fuel/electricity) and slow-refresh (infrastructure) sub-datasets.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TRANSPORT
  // ═══════════════════════════════════════════════════════════════════

  "transport-compare": {
    displayName: "Transport Cost Comparisons",
    file: "transport-compare.json",
    section: "compare.infrastructure",
    currentSourceType: "static",
    recommendedSourceType: "static",
    sources: [
      {
        name: "National Rail fare tables / operator websites",
        url: "https://www.nationalrail.co.uk/",
        type: "scrape",
        confidence: "medium",
      },
    ],
    refresh: { cadence: "quarterly", retryAttempts: 1, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 120, criticalAfterDays: 200, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: false },
    changeDetection: {
      strategy: "content_hash",
    },
    validation: { requiredFields: ["trainFares", "metroFares"] },
    history: { retention: "append_annual", keepRawSnapshots: 4 },
    migration: {
      status: "keep_static",
      priority: 8,
      effort: "low",
      notes: "No official API for cross-country fare comparison. Dynamic pricing makes automation unreliable. Keep as periodic manual update with snapshot dates clearly shown.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // APD (Air Passenger Duty)
  // ═══════════════════════════════════════════════════════════════════

  "apd": {
    displayName: "Air Passenger Duty",
    file: "apd.json",
    section: "compare.infrastructure",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "HMRC APD Statistics",
        url: "https://www.gov.uk/government/statistics/air-passenger-duty",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
    ],
    refresh: { cadence: "annual", cronExpression: "0 10 1 10 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: false },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/statistics/air-passenger-duty",
      ext: "xlsx",
    },
    validation: { requiredFields: ["rates", "revenue", "passengers"] },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 7,
      effort: "low",
      notes: "Annual dataset. HMRC publishes XLSX. Low refresh need — annual automation sufficient.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PROJECTS & WASTE
  // ═══════════════════════════════════════════════════════════════════

  "projects": {
    displayName: "Major Government Projects",
    file: "projects.json",
    section: "projects",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "NISTA (formerly IPA) Annual Report",
        url: "https://www.gov.uk/government/collections/major-projects-data",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
      {
        name: "NAO Reports on Major Projects",
        url: "https://www.nao.org.uk/search/type/report/",
        type: "scrape",
        confidence: "high",
      },
    ],
    refresh: { cadence: "annual", cronExpression: "0 10 1 7 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: false },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/collections/major-projects-data",
      ext: "xlsx|csv",
    },
    validation: { requiredFields: ["[].name", "[].originalBudget", "[].latestBudget"] },
    history: { retention: "version_snapshots", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 4,
      effort: "high",
      notes: "IPA merged into NISTA (April 2025). Annual Government Major Projects Portfolio published as XLSX. Supplement with NAO reports for individual project updates. Preserve version history for cost growth tracking.",
    },
  },

  "daily-cost-projects": {
    displayName: "Daily Cost of Major Projects",
    file: "daily-cost-projects.json",
    section: "projects",
    currentSourceType: "static",
    recommendedSourceType: "static",
    sources: [{ name: "Derived from projects.json", type: "derived", confidence: "medium" }],
    refresh: { cadence: "on_parent_update" },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "content_hash",
    },
    history: { retention: "version_snapshots", keepRawSnapshots: 3 },
    migration: {
      status: "keep_derived",
      priority: 9,
      effort: "low",
      notes: "Computed from projects.json. Auto-regenerate when parent updates.",
    },
  },

  "delays-delivery": {
    displayName: "Infrastructure Delivery Delays",
    file: "delays-delivery.json",
    section: "delays",
    currentSourceType: "static",
    recommendedSourceType: "static",
    sources: [
      { name: "NAO / IPA / PAC Reports", type: "scrape", confidence: "high" },
      { name: "Official project updates (GOV.UK)", type: "scrape", confidence: "high" },
    ],
    refresh: { cadence: "quarterly" },
    staleness: { warningAfterDays: 120, criticalAfterDays: 200, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "content_hash",
    },
    history: { retention: "version_snapshots", keepRawSnapshots: 4 },
    migration: {
      status: "keep_static",
      priority: 8,
      effort: "low",
      notes: "No single machine-readable source for delay tracking. Derived from multiple official reports. Keep as curated static with quarterly review.",
    },
  },

  "planning-approvals": {
    displayName: "Planning & Approval Delays",
    file: "planning-approvals.json",
    section: "delays",
    currentSourceType: "static",
    recommendedSourceType: "static",
    sources: [
      { name: "Planning Inspectorate (PINS)", url: "https://infrastructure.planninginspectorate.gov.uk/", type: "scrape", confidence: "high" },
    ],
    refresh: { cadence: "quarterly" },
    staleness: { warningAfterDays: 120, criticalAfterDays: 200, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "content_hash",
    },
    history: { retention: "version_snapshots", keepRawSnapshots: 4 },
    migration: {
      status: "keep_static",
      priority: 8,
      effort: "low",
      notes: "PINS has a searchable register but no bulk API. Quarterly manual review is the most reliable approach.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SUPPLIERS & CONTRACTS
  // ═══════════════════════════════════════════════════════════════════

  "suppliers-summary": {
    displayName: "Top Government Suppliers",
    file: "suppliers-summary.json",
    section: "suppliers",
    currentSourceType: "static",
    recommendedSourceType: "ocds",
    sources: [
      {
        name: "Contracts Finder OCDS API",
        url: "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search",
        type: "ocds",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
    ],
    refresh: { cadence: "weekly", cronExpression: "0 6 * * 1", retryAttempts: 3, retryDelayMs: 60000 },
    staleness: { warningAfterDays: 14, criticalAfterDays: 30, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "always",
    },
    validation: { requiredFields: ["[].name", "[].totalValue"] },
    history: { retention: "append_weekly", keepRawSnapshots: 12 },
    migration: {
      status: "in_progress",
      priority: 2,
      effort: "high",
      notes: "Contracts Finder has full OCDS API. Already have ingest-contracts.mjs script. Extend to build supplier aggregation. Cross-reference with spend-over-25k publications.",
    },
  },

  "consultancy-contracts": {
    displayName: "Government Consultancy Contracts",
    file: "consultancy-contracts.json",
    section: "suppliers",
    currentSourceType: "static",
    recommendedSourceType: "ocds",
    sources: [
      {
        name: "Contracts Finder OCDS API (filtered by consultancy category)",
        url: "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search",
        type: "ocds",
        apiKey: false,
        confidence: "high",
      },
    ],
    refresh: { cadence: "weekly", cronExpression: "0 6 * * 1", retryAttempts: 3, retryDelayMs: 60000 },
    staleness: { warningAfterDays: 14, criticalAfterDays: 30, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "always",
    },
    history: { retention: "append_weekly", keepRawSnapshots: 12 },
    migration: {
      status: "planned",
      priority: 3,
      effort: "medium",
      notes: "Subset of Contracts Finder data filtered to management consultancy CPV codes. Can be automated alongside suppliers-summary.",
    },
  },

  "contracts-raw": {
    displayName: "Defence & Major Contracts",
    file: "contracts-raw.json",
    section: "suppliers",
    currentSourceType: "static",
    recommendedSourceType: "ocds",
    sources: [
      { name: "Contracts Finder OCDS API", type: "ocds", confidence: "high" },
      { name: "MOD Defence Equipment Plan", url: "https://www.gov.uk/government/collections/defence-equipment-plan", type: "csv_feed", confidence: "high" },
    ],
    refresh: { cadence: "weekly", cronExpression: "0 6 * * 1", retryAttempts: 3, retryDelayMs: 60000 },
    staleness: { warningAfterDays: 14, criticalAfterDays: 30, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "always",
    },
    history: { retention: "append_weekly", keepRawSnapshots: 12 },
    migration: {
      status: "planned",
      priority: 3,
      effort: "medium",
      notes: "Defence contracts supplement Contracts Finder with MOD Equipment Plan data.",
    },
  },

  "crony-contracts": {
    displayName: "COVID & Politically Connected Contracts",
    file: "crony-contracts.json",
    section: "suppliers",
    currentSourceType: "static",
    recommendedSourceType: "static",
    sources: [
      { name: "NAO COVID Procurement Reports", type: "static", confidence: "high" },
      { name: "Good Law Project / court records", type: "static", confidence: "high" },
    ],
    refresh: { cadence: "quarterly" },
    staleness: { warningAfterDays: 200, criticalAfterDays: 365, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "content_hash",
    },
    history: { retention: "version_snapshots", keepRawSnapshots: 4 },
    migration: {
      status: "keep_static",
      priority: 10,
      effort: "low",
      notes: "Historical investigative dataset. No automated source. Update when new court outcomes or NAO reports emerge. This is curated research, not a feed.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACCOUNTABILITY (TRANSPARENCY)
  // ═══════════════════════════════════════════════════════════════════

  "political-donations": {
    displayName: "Political Party Donations",
    file: "political-donations.json",
    section: "transparency.donations",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "Electoral Commission Donations Search",
        url: "https://search.electoralcommission.org.uk/api/csv/Donations",
        type: "api",
        apiKey: false,
        format: "csv",
        confidence: "high",
      },
    ],
    refresh: { cadence: "quarterly", cronExpression: "0 10 15 1,4,7,10 *", retryAttempts: 3, retryDelayMs: 60000 },
    staleness: { warningAfterDays: 100, criticalAfterDays: 150, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://search.electoralcommission.org.uk/api/json/Donations?rows=1&sort_by=AcceptedDate&sort_order=desc",
    },
    validation: {
      requiredFields: ["annualTotals", "byParty"],
      numericRanges: { "annualTotals[].total": { min: 10000000, max: 500000000 } },
    },
    history: { retention: "append_quarterly", keepRawSnapshots: 8 },
    migration: {
      status: "planned",
      priority: 2,
      effort: "medium",
      notes: "Electoral Commission has CSV API endpoint. Can query by date range, party, donor type. Free, no key needed. High-value automation target.",
    },
  },

  "mp-interests": {
    displayName: "MPs Financial Interests & Expenses",
    file: "mp-interests.json",
    section: "transparency.mp",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "Parliament Register of Interests API",
        url: "https://interests-api.parliament.uk/",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
      {
        name: "IPSA Published Data (Expenses)",
        url: "https://www.theipsa.org.uk/mp-staffing-business-costs/other-published-data",
        type: "csv_feed",
        format: "csv",
        confidence: "high",
      },
    ],
    refresh: { cadence: "monthly", cronExpression: "0 10 1 * *", retryAttempts: 3, retryDelayMs: 120000 },
    staleness: { warningAfterDays: 45, criticalAfterDays: 90, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://members-api.parliament.uk/api/Members/Search?House=1&IsCurrentMember=true&take=1",
    },
    validation: { requiredFields: ["topEarners", "aggregateStats", "expenses"] },
    history: { retention: "append_monthly", keepRawSnapshots: 12 },
    migration: {
      status: "planned",
      priority: 2,
      effort: "high",
      notes: "Parliament has dedicated Interests API (free, no key). IPSA publishes CSV expenses. High public interest — worth automating both.",
    },
  },

  "lobbying": {
    displayName: "Lobbying & Ministerial Transparency",
    file: "lobbying.json",
    section: "transparency.lobbying",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "Office of Registrar of Consultant Lobbyists",
        url: "https://registrarofconsultantlobbyists.org.uk/",
        type: "csv_feed",
        confidence: "medium-high",
      },
      {
        name: "GOV.UK Ministerial Transparency Releases",
        url: "https://www.gov.uk/government/collections/ministerial-gifts-hospitality-travel-and-meetings",
        type: "csv_feed",
        format: "csv",
        confidence: "high",
      },
    ],
    refresh: { cadence: "quarterly", cronExpression: "0 10 20 1,4,7,10 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 120, criticalAfterDays: 200, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "page_date",
      checkUrl: "https://registerofconsultantlobbyists.force.com/CLR_Search",
    },
    history: { retention: "append_quarterly", keepRawSnapshots: 8 },
    migration: {
      status: "planned",
      priority: 5,
      effort: "medium",
      notes: "ORCL register downloadable. Ministerial transparency CSVs on GOV.UK. No API for either but both have structured downloads.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // FOREIGN AID
  // ═══════════════════════════════════════════════════════════════════

  "foreign-aid": {
    displayName: "UK Foreign Aid (ODA)",
    file: "foreign-aid.json",
    section: "transparency.aid",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "FCDO Statistics on International Development",
        url: "https://www.gov.uk/government/collections/statistics-on-international-development",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
      {
        name: "OECD DAC Creditor Reporting System",
        url: "https://data-explorer.oecd.org/vis?fs[0]=Topic%2C1%7CDevelopment%23DEV%23%7COfficial%20Development%20Assistance%20%28ODA%29%23DEV_ODA%23&pg=0&fc=Topic&bp=true&snb=18",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
    ],
    refresh: { cadence: "semi_annual", cronExpression: "0 10 1 4,10 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 200, criticalAfterDays: 365, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/statistics/statistics-on-international-development",
      ext: "xlsx|csv|ods",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 4,
      effort: "medium",
      notes: "FCDO publishes provisional (April) and final (November). OECD DAC has SDMX API for cross-country comparison. Use FCDO as primary, OECD as secondary.",
    },
  },

  "fcdo-programmes": {
    displayName: "FCDO Development Programmes",
    file: "fcdo-programmes.json",
    section: "transparency.aid",
    currentSourceType: "iati",
    recommendedSourceType: "iati",
    sources: [
      {
        name: "IATI Datastore (Code for IATI)",
        url: "https://datastore.codeforiati.org/api/1/access/activity.json?reporting-org.ref=GB-GOV-1",
        type: "iati",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
    ],
    refresh: { cadence: "monthly", cronExpression: "0 6 5 * *", retryAttempts: 3, retryDelayMs: 120000 },
    staleness: { warningAfterDays: 45, criticalAfterDays: 90, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot", showStaleWarning: true },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://datastore.codeforiati.org/api/1/access/activity.json?reporting-org=GB-GOV-1&limit=1",
    },
    validation: {
      requiredFields: ["programmes", "metadata.totalProgrammes"],
      numericRanges: { "metadata.totalProgrammes": { min: 1000, max: 50000 } },
    },
    history: { retention: "version_snapshots", keepRawSnapshots: 12 },
    migration: {
      status: "complete",
      priority: 0,
      effort: "done",
      notes: "Already automated via IATI Datastore API. 4,542 active programmes pulled. Monthly refresh recommended as FCDO updates IATI data monthly.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // DEFENCE
  // ═══════════════════════════════════════════════════════════════════

  "defence": {
    displayName: "Defence Spending (G7 + Peers)",
    file: "defence.json",
    section: "economy.output",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "SIPRI Military Expenditure Database",
        url: "https://milex.sipri.org/sipri_milex/pages/chart",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
      {
        name: "NATO Defence Expenditure",
        url: "https://www.nato.int/cps/en/natohq/topics_49198.htm",
        type: "csv_feed",
        format: "pdf",
        confidence: "high",
      },
    ],
    refresh: { cadence: "annual", cronExpression: "0 10 1 5 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/collections/uk-defence-expenditure-reports",
      ext: "xlsx|pdf",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 6,
      effort: "low",
      notes: "SIPRI publishes annual XLSX download. NATO publishes annual PDF. Low refresh need. OECD SDMX API also has SIPRI-sourced military spend data.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // INNOVATION & ECONOMY
  // ═══════════════════════════════════════════════════════════════════

  "innovation": {
    displayName: "UK Innovation & VC Investment",
    file: "innovation.json",
    section: "economy.innovation",
    currentSourceType: "static",
    recommendedSourceType: "mixed",
    sources: [
      {
        name: "OECD MSTI (R&D Data)",
        url: "https://data.oecd.org/rd/gross-domestic-spending-on-r-d.htm",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
      { name: "BVCA / Crunchbase / GlobalData (VC data)", type: "static", confidence: "medium" },
    ],
    refresh: { cadence: "semi_annual", cronExpression: "0 10 1 3,9 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 200, criticalAfterDays: 365, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "content_hash",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 6,
      effort: "medium",
      notes: "OECD SDMX API for R&D spending (automate). VC/unicorn data from commercial sources — keep as periodic manual with OECD backbone automated.",
    },
  },

  "gov-innovation": {
    displayName: "Government R&D Spending",
    file: "gov-innovation.json",
    section: "economy.innovation",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "OECD MSTI Database",
        url: "https://data.oecd.org/",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
      {
        name: "ONS Science, Engineering & Technology (SET)",
        url: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/researchanddevelopmentexpenditure",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
    ],
    refresh: { cadence: "semi_annual", cronExpression: "0 10 1 3,9 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 200, criticalAfterDays: 365, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "always",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 6,
      effort: "medium",
      notes: "Both OECD and ONS have APIs for R&D data. Automate GERD and GBARD series.",
    },
  },

  "lse-markets": {
    displayName: "London Stock Exchange Market Data",
    file: "lse-markets.json",
    section: "economy.innovation",
    currentSourceType: "static",
    recommendedSourceType: "static",
    sources: [
      { name: "FCA / LSE Annual Statistics", type: "csv_feed", confidence: "high" },
      { name: "EY IPO Reports", type: "static", confidence: "medium" },
    ],
    refresh: { cadence: "annual" },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "content_hash",
    },
    history: { retention: "append_annual", keepRawSnapshots: 3 },
    migration: {
      status: "keep_static",
      priority: 9,
      effort: "low",
      notes: "LSEG real-time APIs are commercial (paid). Annual listing/IPO counts from FCA/EY are sufficient. Keep as static annual update.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // STRUCTURAL / INTERNATIONAL COMPARISON
  // ═══════════════════════════════════════════════════════════════════

  "structural-performance": {
    displayName: "UK Structural Performance vs Peers",
    file: "structural-performance.json",
    section: "economy.output",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "OECD Productivity & Wages Data",
        url: "https://data.oecd.org/",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
    ],
    refresh: { cadence: "semi_annual", cronExpression: "0 10 1 3,9 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 200, criticalAfterDays: 365, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "always",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 5,
      effort: "medium",
      notes: "OECD SDMX API has productivity, wages, and employment data. Automate G7 comparison pulls.",
    },
  },

  "international": {
    displayName: "International Government Spending Comparison",
    file: "international.json",
    section: "economy",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "OECD Government at a Glance",
        url: "https://data.oecd.org/gga/general-government-spending.htm",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
    ],
    refresh: { cadence: "annual", cronExpression: "0 10 1 11 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "always",
    },
    history: { retention: "append_annual", keepRawSnapshots: 3 },
    migration: {
      status: "planned",
      priority: 7,
      effort: "low",
      notes: "Small dataset. OECD API for government spending comparison. Annual refresh sufficient.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // OTHER
  // ═══════════════════════════════════════════════════════════════════

  "civil-service": {
    displayName: "Civil Service Headcount",
    file: "civil-service.json",
    section: "government",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "ONS Civil Service Statistics",
        url: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/publicsectorpersonnel",
        type: "api",
        apiKey: false,
        confidence: "high",
      },
    ],
    refresh: { cadence: "annual", cronExpression: "0 10 1 10 *", retryAttempts: 2, retryDelayMs: 120000 },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/statistics/civil-service-statistics",
      ext: "xlsx|csv|ods",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 8,
      effort: "low",
      notes: "ONS publishes annual civil service stats. Simple time series — easy to automate.",
    },
  },

  "spending": {
    displayName: "Welfare & Government Spending Breakdown",
    file: "spending.json",
    section: "government",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "DWP Benefit Expenditure Tables",
        url: "https://www.gov.uk/government/collections/benefit-expenditure-and-caseload-tables",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
      {
        name: "HM Treasury PESA",
        url: "https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
      },
    ],
    refresh: { cadence: "annual", cronExpression: "0 10 1 7 *", retryAttempts: 2, retryDelayMs: 300000 },
    staleness: { warningAfterDays: 400, criticalAfterDays: 500, acceptableForDisplay: true },
    fallback: { strategy: "last_successful_snapshot" },
    changeDetection: {
      strategy: "gov_uk_release_page",
      checkUrl: "https://www.gov.uk/government/statistics/public-expenditure-statistical-analyses-pesa",
      ext: "xlsx",
    },
    history: { retention: "append_annual", keepRawSnapshots: 5 },
    migration: {
      status: "planned",
      priority: 5,
      effort: "medium",
      notes: "DWP publishes benefit expenditure XLSX. HMT PESA for full spending breakdown. Both annual publications at known URLs.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // COMPANIES HOUSE — Company profiles, officers, PSC
  // ═══════════════════════════════════════════════════════════════════

  "company-profiles": {
    displayName: "Company Profiles (Companies House)",
    file: "company-profiles.json",
    section: "enrichment",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "Companies House REST API",
        url: "https://api.company-information.service.gov.uk",
        type: "api",
        apiKey: true,
        format: "json",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "weekly",
      cronExpression: "0 6 * * 1",  // Every Monday at 6am
      retryAttempts: 3,
      retryDelayMs: 120000,
    },
    staleness: {
      warningAfterDays: 21,
      criticalAfterDays: 60,
      acceptableForDisplay: true,
    },
    fallback: {
      strategy: "last_successful_snapshot",
      showStaleWarning: true,
    },
    changeDetection: {
      strategy: "content_hash",
    },
    validation: {
      requiredFields: ["companies", "summary"],
      numericRanges: {
        "summary.total": { min: 1, max: 10000 },
      },
    },
    history: {
      retention: "append_weekly",
      keepRawSnapshots: 12,
    },
    migration: {
      status: "planned",
      priority: 3,
      effort: "medium",
      notes: "Companies House API is free but requires registration for an API key. Enriches donor, supplier, and lobbyist data with company details, directors, and PSC (persons with significant control). Rate limit: 600 req / 5 min.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // GOV.UK DEPARTMENTAL SPEND (£25k+)
  // ═══════════════════════════════════════════════════════════════════

  "departmental-spend": {
    displayName: "Departmental Spending over £25,000",
    file: "departmental-spend.json",
    section: "government.spend",
    currentSourceType: "static",
    recommendedSourceType: "csv_feed",
    sources: [
      {
        name: "GOV.UK Transparency — Spending over £25,000",
        url: "https://www.gov.uk/search/transparency-and-freedom-of-information-releases?content_store_document_type=transparency",
        type: "csv_feed",
        apiKey: false,
        format: "csv",
        confidence: "high",
      },
    ],
    refresh: {
      cadence: "monthly",
      cronExpression: "0 8 5 * *",  // 5th of each month
      retryAttempts: 3,
      retryDelayMs: 120000,
    },
    staleness: {
      warningAfterDays: 45,
      criticalAfterDays: 90,
      acceptableForDisplay: true,
    },
    fallback: {
      strategy: "last_successful_snapshot",
      showStaleWarning: true,
    },
    changeDetection: {
      strategy: "page_date",
      checkUrl: "https://www.gov.uk/government/publications?departments[]=cabinet-office&publication_filter_option=transparency-data",
    },
    validation: {
      requiredFields: ["summary", "departments", "topSuppliers"],
      numericRanges: {
        "summary.totalSpend": { min: 1000000, max: 100000000000 },
        "summary.totalPayments": { min: 10, max: 500000 },
      },
    },
    history: {
      retention: "append_monthly",
      keepRawSnapshots: 12,
      timeSeriesField: "monthlyTrend",
    },
    migration: {
      status: "planned",
      priority: 2,
      effort: "high",
      notes: "All central government departments publish monthly CSV files of payments over £25k. CSV schemas vary between departments — adapter handles common column variations. Covers ~16 major departments. High-value: granular payment-level data showing exactly where money goes.",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC FINANCES FLOW — Receipts → Spending → Borrowing
  // ═══════════════════════════════════════════════════════════════════

  "public-finances-flow": {
    displayName: "Public Finances Flow (Receipts → Spending → Borrowing)",
    file: "public-finances-flow.json",
    section: "government.flow",
    currentSourceType: "static",
    recommendedSourceType: "api",
    sources: [
      {
        name: "ONS Public Sector Finances (time series CDIDs)",
        url: "https://api.beta.ons.gov.uk/v1/timeseries",
        type: "api",
        apiKey: false,
        format: "json",
        confidence: "high",
      },
      {
        name: "OBR Economic and Fiscal Outlook",
        url: "https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/",
        type: "csv_feed",
        format: "xlsx",
        confidence: "high",
        notes: "Used for spending category breakdown (COFOG). Annual only.",
      },
    ],
    refresh: {
      cadence: "monthly",
      cronExpression: "0 10 25 * *",
      retryAttempts: 3,
      retryDelayMs: 120000,
    },
    staleness: {
      warningAfterDays: 40,
      criticalAfterDays: 70,
      acceptableForDisplay: true,
    },
    fallback: {
      strategy: "last_successful_snapshot",
      showStaleWarning: true,
    },
    changeDetection: {
      strategy: "etag_modified",
      checkUrl: "https://api.beta.ons.gov.uk/v1/timeseries/anbv/data",
    },
    validation: {
      requiredFields: ["annual", "metadata"],
      numericRanges: {
        "annual[].receipts.total": { min: 300, max: 3000 },
        "annual[].spending.total": { min: 300, max: 3000 },
      },
    },
    history: {
      retention: "append_monthly",
      keepRawSnapshots: 12,
      timeSeriesField: "annual",
    },
    migration: {
      status: "planned",
      priority: 1,
      effort: "medium",
      notes: "ONS API provides key fiscal aggregates via CDID time series (no key required). Tax receipt breakdown via individual CDIDs. Spending categories require OBR data (annual) — proportional shares applied to ONS TME total for monthly estimates.",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get all datasets sorted by migration priority (1 = highest)
 */
export function getByPriority() {
  return Object.entries(DATASET_REGISTRY)
    .filter(([, v]) => v.migration?.priority)
    .sort(([, a], [, b]) => (a.migration.priority || 99) - (b.migration.priority || 99));
}

/**
 * Get datasets that should use API-first ingestion
 */
export function getAPIDatasets() {
  return Object.entries(DATASET_REGISTRY)
    .filter(([, v]) => v.recommendedSourceType === "api" || v.recommendedSourceType === "ocds" || v.recommendedSourceType === "iati");
}

/**
 * Get datasets that should use scheduled CSV/XLSX download
 */
export function getCSVDatasets() {
  return Object.entries(DATASET_REGISTRY)
    .filter(([, v]) => v.recommendedSourceType === "csv_feed");
}

/**
 * Get datasets that should remain static/manual
 */
export function getStaticDatasets() {
  return Object.entries(DATASET_REGISTRY)
    .filter(([, v]) => v.recommendedSourceType === "static" || v.migration?.status === "keep_static");
}

/**
 * Get staleness status for a dataset given its last update timestamp
 */
export function getStalenessStatus(datasetKey, lastUpdatedISO) {
  const config = DATASET_REGISTRY[datasetKey];
  if (!config) return { status: "unknown" };

  const daysSince = Math.floor((Date.now() - new Date(lastUpdatedISO).getTime()) / 86400000);
  const { warningAfterDays, criticalAfterDays } = config.staleness || {};

  if (daysSince > criticalAfterDays) return { status: "critical", daysSince, message: "Data critically stale" };
  if (daysSince > warningAfterDays) return { status: "warning", daysSince, message: "Data may be stale" };
  return { status: "fresh", daysSince };
}

export default DATASET_REGISTRY;
