/**
 * Electoral Commission API Adapter
 *
 * Fetches political donation data from the Electoral Commission's
 * public search API (CSV and JSON endpoints).
 *
 * Used by: political-donations
 *
 * API: https://search.electoralcommission.org.uk/api/csv/Donations
 * No API key required. Public data under Open Government Licence.
 */

const BASE_URL = "https://search.electoralcommission.org.uk";

/**
 * Fetch political donations from the Electoral Commission API.
 *
 * @param {Object} [options]
 * @param {string} [options.startDate] - ISO date string (e.g., "2024-01-01")
 * @param {string} [options.endDate] - ISO date string
 * @param {string} [options.party] - Filter by party name
 * @param {number} [options.limit] - Max results (default 10000)
 * @param {string} [options.format] - "json" or "csv" (default "json")
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchDonations(options = {}) {
  const {
    startDate,
    endDate,
    party,
    limit = 10000,
    format = "json",
  } = options;

  const params = new URLSearchParams({
    rows: String(limit),
    start: "0",
    sort_by: "AcceptedDate",
    sort_order: "desc",
  });

  // Date filters use dd/MM/yyyy format for the EC API
  if (startDate) {
    const d = new Date(startDate);
    params.set("preDateOfAcceptance", formatECDate(d));
  }
  if (endDate) {
    const d = new Date(endDate);
    params.set("postDateOfAcceptance", formatECDate(d));
  }
  if (party) {
    params.set("query", party);
  }

  const endpoint = format === "csv" ? "csv" : "json";
  const url = `${BASE_URL}/api/${endpoint}/Donations?${params}`;

  const resp = await fetch(url, {
    headers: { Accept: format === "csv" ? "text/csv" : "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`Electoral Commission API ${resp.status}: ${url}`);
  }

  if (format === "csv") {
    const csvText = await resp.text();
    const parsed = parseCSV(csvText);
    return {
      data: parsed,
      rawPayload: csvText,
      sourceTimestamp: new Date().toISOString(),
      recordCount: parsed.length,
    };
  }

  const json = await resp.json();
  const results = json.Result || [];

  return {
    data: results,
    rawPayload: json,
    sourceTimestamp: new Date().toISOString(),
    recordCount: results.length,
  };
}

/**
 * Fetch donations and normalize into the political-donations.json format.
 *
 * @param {Object} [options] - Same as fetchDonations
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchAndNormalizeDonations(options = {}) {
  // Fetch last 5 years of data
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const result = await fetchDonations({
    ...options,
    startDate: options.startDate || fiveYearsAgo.toISOString(),
    limit: options.limit || 50000,
  });

  return result;
}

/**
 * Normalize raw EC donation data into the political-donations.json structure.
 */
export function normalizeDonations(rawDonations) {
  const donations = Array.isArray(rawDonations) ? rawDonations : [];

  // Aggregate by party
  const partyTotals = {};
  const donorTotals = {};
  const yearlyTotals = {};
  const donationTypes = {};

  for (const d of donations) {
    const party = d.RegulatedEntityName || d.Party || "Unknown";
    const donor = d.DonorName || "Unknown";
    const amount = parseFloat(d.Value) || 0;
    const year = d.AcceptedDate ? new Date(d.AcceptedDate).getFullYear().toString() : "Unknown";
    const type = d.DonationType || d.Type || "Unknown";

    // Party aggregation
    if (!partyTotals[party]) partyTotals[party] = { total: 0, count: 0 };
    partyTotals[party].total += amount;
    partyTotals[party].count += 1;

    // Donor aggregation
    if (!donorTotals[donor]) donorTotals[donor] = { total: 0, count: 0, parties: new Set() };
    donorTotals[donor].total += amount;
    donorTotals[donor].count += 1;
    donorTotals[donor].parties.add(party);

    // Yearly aggregation
    if (!yearlyTotals[year]) yearlyTotals[year] = { total: 0, count: 0 };
    yearlyTotals[year].total += amount;
    yearlyTotals[year].count += 1;

    // Donation type
    if (!donationTypes[type]) donationTypes[type] = { total: 0, count: 0 };
    donationTypes[type].total += amount;
    donationTypes[type].count += 1;
  }

  // Format outputs
  const byParty = Object.entries(partyTotals)
    .map(([name, data]) => ({ name, total: Math.round(data.total), count: data.count }))
    .sort((a, b) => b.total - a.total);

  const topDonors = Object.entries(donorTotals)
    .map(([name, data]) => ({
      name,
      total: Math.round(data.total),
      count: data.count,
      parties: [...data.parties],
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  const byYear = Object.entries(yearlyTotals)
    .map(([year, data]) => ({ year, total: Math.round(data.total), count: data.count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const byType = Object.entries(donationTypes)
    .map(([type, data]) => ({ type, total: Math.round(data.total), count: data.count }))
    .sort((a, b) => b.total - a.total);

  return {
    summary: {
      totalDonations: donations.length,
      totalValue: Math.round(donations.reduce((s, d) => s + (parseFloat(d.Value) || 0), 0)),
      parties: byParty.length,
      uniqueDonors: Object.keys(donorTotals).length,
    },
    byParty,
    topDonors,
    byYear,
    byType,
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "Electoral Commission",
        url: "https://search.electoralcommission.org.uk",
      },
      licence: "Open Government Licence v3.0",
      methodologyNote:
        "Includes all registered donations to political parties reported to the Electoral Commission.",
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatECDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseCSV(csvText) {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = values[j];
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

export default {
  fetchDonations,
  fetchAndNormalizeDonations,
  normalizeDonations,
};
