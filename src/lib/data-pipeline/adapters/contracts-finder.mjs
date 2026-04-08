/**
 * Contracts Finder OCDS Adapter
 *
 * Fetches UK government contract data from Contracts Finder using the
 * Open Contracting Data Standard (OCDS) API.
 *
 * Used by: suppliers-summary, consultancy-contracts, contracts-raw
 *
 * API Docs: https://www.contractsfinder.service.gov.uk/apidocumentation/home
 * Base URL: https://www.contractsfinder.service.gov.uk/Published/
 * No API key required. Open Government Licence.
 */

const BASE_URL = "https://www.contractsfinder.service.gov.uk";

/**
 * Search for published notices (contract opportunities and awards).
 *
 * @param {Object} [options]
 * @param {string} [options.keyword] - Search keyword
 * @param {string} [options.publishedFrom] - ISO date
 * @param {string} [options.publishedTo] - ISO date
 * @param {number} [options.size] - Results per page (max 100)
 * @param {number} [options.page] - Page number (0-indexed)
 * @param {string} [options.stage] - "tender" | "award" | "any"
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function searchNotices(options = {}) {
  const {
    keyword = "",
    publishedFrom,
    publishedTo,
    size = 100,
    page = 0,
    stage = "any",
  } = options;

  // Use the search API endpoint
  const searchBody = {
    searchCriteria: {
      keyword: keyword || undefined,
      publishedFrom: publishedFrom || undefined,
      publishedTo: publishedTo || undefined,
      stages: stage === "any" ? ["tender", "award"] : [stage],
      size,
      page,
    },
  };

  const url = `${BASE_URL}/Published/Notices/OCDS/Search`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Contracts Finder ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const releases = json.releases || [];

  return {
    data: releases,
    rawPayload: json,
    sourceTimestamp: new Date().toISOString(),
    recordCount: releases.length,
  };
}

/**
 * Fetch all notices matching criteria, paginating automatically.
 * Caps at maxPages to avoid runaway fetches.
 *
 * @param {Object} options - Same as searchNotices
 * @param {number} [maxPages=20] - Maximum pages to fetch
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchAllNotices(options = {}, maxPages = 20) {
  const allReleases = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < maxPages) {
    const result = await searchNotices({ ...options, page, size: 100 });
    allReleases.push(...result.data);

    // If we got fewer than 100, we've reached the end
    hasMore = result.data.length === 100;
    page++;

    // Be polite
    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    data: allReleases,
    rawPayload: { totalReleases: allReleases.length, pagesScanned: page },
    sourceTimestamp: new Date().toISOString(),
    recordCount: allReleases.length,
  };
}

/**
 * Normalize OCDS releases into the suppliers-summary.json format.
 * Aggregates by supplier and buying organisation.
 */
export function normalizeSuppliersSummary(releases) {
  const suppliers = {};
  const buyers = {};
  const monthlyTotals = {};

  for (const release of releases) {
    const awards = release.awards || [];
    const buyer = release.buyer?.name || "Unknown";
    const tender = release.tender || {};

    for (const award of awards) {
      const value = award.value?.amount || 0;
      const currency = award.value?.currency || "GBP";
      const date = award.date || release.date;
      const month = date ? date.slice(0, 7) : "unknown";

      for (const supplier of award.suppliers || []) {
        const name = supplier.name || "Unknown";
        if (!suppliers[name]) {
          suppliers[name] = { total: 0, count: 0, contracts: [] };
        }
        suppliers[name].total += value;
        suppliers[name].count += 1;
        suppliers[name].contracts.push({
          title: tender.title || release.tag?.[0] || "Untitled",
          value,
          currency,
          date,
          buyer,
        });
      }

      // Buyer aggregation
      if (!buyers[buyer]) buyers[buyer] = { total: 0, count: 0 };
      buyers[buyer].total += value;
      buyers[buyer].count += 1;

      // Monthly
      if (!monthlyTotals[month]) monthlyTotals[month] = { total: 0, count: 0 };
      monthlyTotals[month].total += value;
      monthlyTotals[month].count += 1;
    }
  }

  const topSuppliers = Object.entries(suppliers)
    .map(([name, data]) => ({
      name,
      totalValue: Math.round(data.total),
      contractCount: data.count,
      topContracts: data.contracts
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((c) => ({ title: c.title, value: c.value, buyer: c.buyer, date: c.date })),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 100);

  const topBuyers = Object.entries(buyers)
    .map(([name, data]) => ({ name, totalValue: Math.round(data.total), contractCount: data.count }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 50);

  const monthly = Object.entries(monthlyTotals)
    .map(([month, data]) => ({ month, totalValue: Math.round(data.total), count: data.count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    summary: {
      totalContracts: releases.length,
      totalValue: Math.round(Object.values(suppliers).reduce((s, d) => s + d.total, 0)),
      uniqueSuppliers: Object.keys(suppliers).length,
      uniqueBuyers: Object.keys(buyers).length,
    },
    topSuppliers,
    topBuyers,
    monthlyTrend: monthly,
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "Contracts Finder",
        url: "https://www.contractsfinder.service.gov.uk",
      },
      standard: "Open Contracting Data Standard (OCDS)",
      licence: "Open Government Licence v3.0",
    },
  };
}

/**
 * Normalize OCDS releases for consultancy-specific contracts.
 * Filters for consultancy/advisory services by keyword matching.
 */
export function normalizeConsultancyContracts(releases) {
  const consultancyKeywords = [
    "consultancy",
    "consulting",
    "advisory",
    "professional services",
    "management consultancy",
    "strategy",
    "transformation",
  ];

  const isConsultancy = (release) => {
    const title = (release.tender?.title || "").toLowerCase();
    const desc = (release.tender?.description || "").toLowerCase();
    return consultancyKeywords.some((kw) => title.includes(kw) || desc.includes(kw));
  };

  const consultancyReleases = releases.filter(isConsultancy);

  // Use the same supplier summary logic but with filtered set
  const base = normalizeSuppliersSummary(consultancyReleases);

  return {
    ...base,
    summary: {
      ...base.summary,
      totalContracts: consultancyReleases.length,
      filterNote: "Filtered for consultancy/advisory contracts by keyword matching",
    },
  };
}

export default {
  searchNotices,
  fetchAllNotices,
  normalizeSuppliersSummary,
  normalizeConsultancyContracts,
};
