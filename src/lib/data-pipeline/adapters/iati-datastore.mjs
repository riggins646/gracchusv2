/**
 * IATI Datastore Adapter
 *
 * Fetches international development programme data from the
 * Code for IATI Datastore (powers FCDO DevTracker).
 *
 * Used by: fcdo-programmes, foreign-aid
 *
 * API: https://datastore.codeforiati.org/api/1/access/activity.json
 * Note: The egress proxy blocks codeforiati.org — browser fallback required.
 */

const BASE_URL = "https://datastore.codeforiati.org/api/1/access";

/**
 * Fetch IATI activities for a given reporting org.
 *
 * @param {Object} [options]
 * @param {string} [options.reportingOrg] - Org ref (e.g., "GB-GOV-1" for FCDO)
 * @param {number} [options.hierarchy] - 1 = programmes, 2 = sub-components
 * @param {string} [options.status] - Activity status code (2 = implementation)
 * @param {number} [options.limit] - Results per page (max 50)
 * @param {number} [options.offset] - Pagination offset
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchActivities(options = {}) {
  const {
    reportingOrg = "GB-GOV-1",
    hierarchy = 1,
    status,
    limit = 50,
    offset = 0,
  } = options;

  const params = new URLSearchParams({
    "reporting-org": reportingOrg,
    hierarchy: String(hierarchy),
    limit: String(limit),
    offset: String(offset),
  });

  if (status) params.set("activity-status", status);

  const url = `${BASE_URL}/activity.json?${params}`;
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`IATI Datastore ${resp.status}: ${url}`);
  }

  const json = await resp.json();
  const activities = json["iati-activities"] || [];
  const total = json["total-count"] || activities.length;

  return {
    data: activities,
    rawPayload: json,
    sourceTimestamp: new Date().toISOString(),
    recordCount: activities.length,
    totalAvailable: total,
  };
}

/**
 * Fetch all activities with automatic pagination.
 * Warning: This can be slow for large orgs (4000+ activities).
 *
 * @param {Object} options - Same as fetchActivities
 * @param {number} [maxPages=100] - Safety cap
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchAllActivities(options = {}, maxPages = 100) {
  const allActivities = [];
  let offset = 0;
  const limit = 50;
  let total = Infinity;
  let page = 0;

  while (offset < total && page < maxPages) {
    const result = await fetchActivities({ ...options, limit, offset });
    allActivities.push(...result.data);
    total = result.totalAvailable;
    offset += limit;
    page++;

    console.log(`[iati] Page ${page}: ${allActivities.length}/${total} activities`);
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    data: allActivities,
    rawPayload: { totalFetched: allActivities.length, pagesScanned: page },
    sourceTimestamp: new Date().toISOString(),
    recordCount: allActivities.length,
  };
}

/**
 * Normalize IATI activities into the fcdo-programmes.json format.
 */
export function normalizeFCDOProgrammes(activities) {
  const programmes = [];

  for (const act of activities) {
    const id = act["iati-identifier"] || "";
    const title = (act.title?.narrative?.[0]?.text || act.title || "").slice(0, 120);
    const status = act["activity-status"]?.code || "";
    const budget = sumTransactions(act, "budget") || sumBudgets(act);
    const spend = sumTransactions(act, "disbursement") + sumTransactions(act, "expenditure");
    const startDate = act["activity-date"]?.find((d) => d.type === "1" || d.type === "2")?.["iso-date"] || "";
    const endDate = act["activity-date"]?.find((d) => d.type === "3" || d.type === "4")?.["iso-date"] || "";
    const country = act["recipient-country"]?.[0]?.narrative?.[0]?.text || "";
    const countryCode = act["recipient-country"]?.[0]?.code || "";
    const region = act["recipient-region"]?.[0]?.narrative?.[0]?.text || "";
    const sector = act.sector?.[0]?.narrative?.[0]?.text || "";
    const imp = act["participating-org"]?.find((o) => o.role === "4")?.narrative?.[0]?.text || "";

    programmes.push({
      id,
      t: title,
      b: Math.round(budget),
      s: Math.round(spend),
      sd: startDate?.slice(0, 10) || "",
      ed: endDate?.slice(0, 10) || "",
      co: country.slice(0, 50),
      cc: countryCode,
      rg: region.slice(0, 50),
      sec: sector.slice(0, 60),
      imp: imp.slice(0, 80),
      statusCode: status,
    });
  }

  // Sort by budget desc
  programmes.sort((a, b) => b.b - a.b);

  // Active only
  const active = programmes.filter((p) => p.statusCode === "2");

  // Aggregations
  const countryAgg = aggregate(active, "co", "b", "s");
  const sectorAgg = aggregate(active, "sec", "b", "s");

  return {
    metadata: {
      source: "IATI Datastore via FCDO DevTracker",
      sourceUrl: "https://devtracker.fcdo.gov.uk",
      devTrackerBase: "https://devtracker.fcdo.gov.uk/programme/",
      totalProgrammes: active.length,
      lastUpdated: new Date().toISOString().slice(0, 7),
      licence: "Open Government Licence v3.0",
      fields: {
        id: "IATI identifier",
        t: "Programme title",
        b: "Total budget (GBP)",
        s: "Total spend (GBP)",
        sd: "Start date",
        ed: "End date",
        co: "Recipient country",
        cc: "Country code",
        rg: "Recipient region",
        sec: "Primary sector",
        imp: "Implementing organisation",
      },
    },
    summary: {
      totalActiveBudget: active.reduce((s, p) => s + p.b, 0),
      totalActiveSpend: active.reduce((s, p) => s + p.s, 0),
      programmesWithBudget: active.filter((p) => p.b > 0).length,
      programmesWithCountry: active.filter((p) => p.co).length,
      topCountries: countryAgg.slice(0, 30),
      topSectors: sectorAgg.slice(0, 20),
    },
    programmes: active.map(({ statusCode, ...rest }) => rest),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function sumTransactions(activity, type) {
  const transactions = activity.transaction || [];
  const typeMap = { budget: "C", disbursement: "D", expenditure: "E" };
  const code = typeMap[type];

  return transactions
    .filter((t) => t["transaction-type"]?.code === code)
    .reduce((sum, t) => sum + (parseFloat(t.value?.text || t.value || 0)), 0);
}

function sumBudgets(activity) {
  const budgets = activity.budget || [];
  return budgets.reduce((sum, b) => sum + (parseFloat(b.value?.text || b.value || 0)), 0);
}

function aggregate(items, groupField, budgetField, spendField) {
  const groups = {};
  for (const item of items) {
    const key = item[groupField];
    if (!key) continue;
    if (!groups[key]) groups[key] = { budget: 0, spend: 0, count: 0 };
    groups[key].budget += item[budgetField] || 0;
    groups[key].spend += item[spendField] || 0;
    groups[key].count += 1;
  }

  return Object.entries(groups)
    .map(([name, data]) => ({
      [groupField === "co" ? "country" : "sector"]: name,
      budget: data.budget,
      spend: data.spend,
      programmes: data.count,
    }))
    .sort((a, b) => b.budget - a.budget);
}

export default {
  fetchActivities,
  fetchAllActivities,
  normalizeFCDOProgrammes,
};
