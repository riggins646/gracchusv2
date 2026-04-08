/**
 * Companies House API Adapter
 *
 * Fetches company information, officers, and persons with significant
 * control (PSC) from the Companies House REST API.
 *
 * Used by: company-profiles (enriches donor/lobbyist/supplier records)
 *
 * API Docs: https://developer.company-information.service.gov.uk/
 * Base URL: https://api.company-information.service.gov.uk
 *
 * REQUIRES an API key (free registration).
 * Set env: COMPANIES_HOUSE_API_KEY
 *
 * Rate limit: 600 requests per 5 minutes.
 * Licence: Companies House data is Crown Copyright, OGL v3.0.
 */

const BASE_URL = "https://api.company-information.service.gov.uk";

function getApiKey() {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) {
    throw new Error(
      "COMPANIES_HOUSE_API_KEY not set. Register free at https://developer.company-information.service.gov.uk/"
    );
  }
  return key;
}

/**
 * Fetch a company profile by company number.
 *
 * @param {string} companyNumber - 8-digit Companies House number (e.g., "00445790")
 * @returns {Promise<Object>} Company profile object
 */
export async function fetchCompanyProfile(companyNumber) {
  const url = `${BASE_URL}/company/${encodeURIComponent(companyNumber)}`;
  return fetchJSON(url);
}

/**
 * Search for companies by name.
 *
 * @param {string} query - Search term
 * @param {Object} [options]
 * @param {number} [options.itemsPerPage] - Max 100
 * @param {number} [options.startIndex] - Pagination offset
 * @returns {Promise<Object>} Search results with items array
 */
export async function searchCompanies(query, options = {}) {
  const { itemsPerPage = 50, startIndex = 0 } = options;
  const params = new URLSearchParams({
    q: query,
    items_per_page: String(itemsPerPage),
    start_index: String(startIndex),
  });
  const url = `${BASE_URL}/search/companies?${params}`;
  return fetchJSON(url);
}

/**
 * Fetch officers (directors, secretaries) for a company.
 *
 * @param {string} companyNumber
 * @param {Object} [options]
 * @param {number} [options.itemsPerPage]
 * @param {number} [options.startIndex]
 * @returns {Promise<Object>} Officers list with items array
 */
export async function fetchOfficers(companyNumber, options = {}) {
  const { itemsPerPage = 100, startIndex = 0 } = options;
  const params = new URLSearchParams({
    items_per_page: String(itemsPerPage),
    start_index: String(startIndex),
  });
  const url = `${BASE_URL}/company/${encodeURIComponent(companyNumber)}/officers?${params}`;
  return fetchJSON(url);
}

/**
 * Fetch persons with significant control (PSC) for a company.
 *
 * @param {string} companyNumber
 * @returns {Promise<Object>} PSC list with items array
 */
export async function fetchPSC(companyNumber) {
  const url = `${BASE_URL}/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`;
  return fetchJSON(url);
}

/**
 * Fetch filing history for a company.
 *
 * @param {string} companyNumber
 * @param {Object} [options]
 * @param {number} [options.itemsPerPage]
 * @param {number} [options.startIndex]
 * @param {string} [options.category] - e.g., "annual-return", "confirmation-statement", "accounts"
 * @returns {Promise<Object>}
 */
export async function fetchFilingHistory(companyNumber, options = {}) {
  const { itemsPerPage = 50, startIndex = 0, category } = options;
  const params = new URLSearchParams({
    items_per_page: String(itemsPerPage),
    start_index: String(startIndex),
  });
  if (category) params.set("category", category);
  const url = `${BASE_URL}/company/${encodeURIComponent(companyNumber)}/filing-history?${params}`;
  return fetchJSON(url);
}

// ─── Bulk lookup helpers ────────────────────────────────────────────────

/**
 * Look up multiple companies by number, with rate-limit-safe batching.
 * Returns a map of companyNumber → profile.
 *
 * @param {string[]} companyNumbers - Array of company numbers
 * @param {Object} [options]
 * @param {boolean} [options.includeOfficers] - Also fetch officers
 * @param {boolean} [options.includePSC] - Also fetch PSC data
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchCompanyBatch(companyNumbers, options = {}) {
  const { includeOfficers = false, includePSC = false } = options;
  const results = {};
  const errors = [];

  for (const num of companyNumbers) {
    try {
      const profile = await fetchCompanyProfile(num);
      const record = { profile };

      if (includeOfficers) {
        record.officers = await fetchOfficers(num);
        await rateLimitPause();
      }

      if (includePSC) {
        record.psc = await fetchPSC(num);
        await rateLimitPause();
      }

      results[num] = record;
    } catch (err) {
      errors.push({ companyNumber: num, error: err.message });
    }

    // Rate limit: stay well under 600 / 5min = 2 req/sec
    await rateLimitPause();
  }

  return {
    data: results,
    rawPayload: { results, errors },
    sourceTimestamp: new Date().toISOString(),
    recordCount: Object.keys(results).length,
  };
}

// ─── Normalizer: company profiles ───────────────────────────────────────

/**
 * Normalize Companies House data into a structured company-profiles format
 * for the frontend. Input is the result of fetchCompanyBatch.
 */
export function normalizeCompanyProfiles(rawData) {
  const entries = rawData.data || rawData;
  const companies = [];

  for (const [companyNumber, record] of Object.entries(entries)) {
    const p = record.profile || {};
    const officers = (record.officers?.items || []).map((o) => ({
      name: o.name,
      role: o.officer_role,
      appointedOn: o.appointed_on,
      resignedOn: o.resigned_on || null,
      nationality: o.nationality || null,
    }));

    const psc = (record.psc?.items || []).map((p) => ({
      name: p.name || p.name_elements?.forename + " " + p.name_elements?.surname,
      naturesOfControl: p.natures_of_control || [],
      notifiedOn: p.notified_on,
      kind: p.kind,
    }));

    companies.push({
      companyNumber,
      name: p.company_name,
      status: p.company_status,
      type: p.type,
      incorporatedOn: p.date_of_creation,
      dissolvedOn: p.date_of_cessation || null,
      registeredAddress: p.registered_office_address
        ? formatAddress(p.registered_office_address)
        : null,
      sicCodes: p.sic_codes || [],
      accounts: p.accounts
        ? {
            lastMadeUpTo: p.accounts.last_accounts?.made_up_to,
            type: p.accounts.last_accounts?.type,
            overdue: p.accounts.overdue || false,
          }
        : null,
      officers: officers.filter((o) => !o.resignedOn),
      allOfficers: officers,
      psc,
      confirmationStatement: p.confirmation_statement
        ? {
            lastMadeUpTo: p.confirmation_statement.last_made_up_to,
            overdue: p.confirmation_statement.overdue || false,
          }
        : null,
    });
  }

  return {
    companies: companies.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    ),
    summary: {
      total: companies.length,
      active: companies.filter((c) => c.status === "active").length,
      dissolved: companies.filter((c) => c.status === "dissolved").length,
    },
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "Companies House",
        url: "https://find-and-update.company-information.service.gov.uk",
      },
      licence: "Crown Copyright, Open Government Licence v3.0",
    },
  };
}

/**
 * Validate normalized company profiles data.
 */
export function validateCompanyProfiles(normalized) {
  const errors = [];

  if (!normalized.companies || !Array.isArray(normalized.companies)) {
    errors.push("Missing or invalid 'companies' array");
  } else if (normalized.companies.length === 0) {
    errors.push("Empty companies array — expected at least one result");
  } else {
    for (const c of normalized.companies) {
      if (!c.companyNumber) errors.push(`Company missing companyNumber`);
      if (!c.name) errors.push(`Company ${c.companyNumber} missing name`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    recordCount: normalized.companies?.length || 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatAddress(addr) {
  return [
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

async function rateLimitPause() {
  // ~500ms between requests = 120 req/min, well under 600/5min limit
  await new Promise((r) => setTimeout(r, 500));
}

async function fetchJSON(url) {
  const apiKey = getApiKey();
  // Companies House uses HTTP Basic Auth with key as username, empty password
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  const resp = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "User-Agent": "Gracchus Data Pipeline/1.0",
    },
  });

  if (resp.status === 404) {
    throw new Error(`Companies House 404: ${url} — resource not found`);
  }
  if (resp.status === 429) {
    throw new Error(`Companies House 429: rate limit exceeded — back off and retry`);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Companies House ${resp.status}: ${url} — ${text.slice(0, 300)}`);
  }

  return resp.json();
}

export default {
  fetchCompanyProfile,
  searchCompanies,
  fetchOfficers,
  fetchPSC,
  fetchFilingHistory,
  fetchCompanyBatch,
  normalizeCompanyProfiles,
  validateCompanyProfiles,
};
