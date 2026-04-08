/**
 * ONS Beta API Adapter
 *
 * Fetches data from the ONS (Office for National Statistics) Beta API.
 * Used by: cost-of-living, economic-output, public-finances, structural-performance
 *
 * API Docs: https://developer.ons.gov.uk/
 * Base URL: https://api.beta.ons.gov.uk/v1
 *
 * No API key required. Rate limit: be polite (< 1 req/sec).
 */

const BASE_URL = "https://api.beta.ons.gov.uk/v1";

/**
 * Fetch a dataset's latest version observations from ONS.
 *
 * @param {string} datasetId - ONS dataset ID (e.g., "cpih01", "gdp-to-4dp")
 * @param {Object} [options] - Query parameters for observation filtering
 * @param {string} [options.time] - Time dimension filter (e.g., "*" for all, "2024" for specific)
 * @param {string} [options.geography] - Geography filter (e.g., "K02000001" for UK)
 * @param {Object} [options.dimensions] - Additional dimension filters
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchONSDataset(datasetId, options = {}) {
  // Step 1: Get latest edition and version
  const editionsUrl = `${BASE_URL}/datasets/${datasetId}/editions`;
  const editionsResp = await fetchJSON(editionsUrl);

  const latestEdition = editionsResp.items?.[0]?.edition || "time-series";

  const versionUrl = `${BASE_URL}/datasets/${datasetId}/editions/${latestEdition}/versions`;
  const versionResp = await fetchJSON(versionUrl);

  const latestVersion = versionResp.items?.[0];
  if (!latestVersion) {
    throw new Error(`No versions found for dataset ${datasetId}`);
  }

  const versionNumber = latestVersion.version;
  const releaseDate = latestVersion.release_date;

  // Step 2: Fetch observations with dimension filters
  const obsUrl = `${BASE_URL}/datasets/${datasetId}/editions/${latestEdition}/versions/${versionNumber}/observations`;
  const queryParams = new URLSearchParams();

  if (options.time) queryParams.set("time", options.time);
  if (options.geography) queryParams.set("geography", options.geography);
  if (options.dimensions) {
    for (const [key, val] of Object.entries(options.dimensions)) {
      queryParams.set(key, val);
    }
  }

  const fullUrl = queryParams.toString() ? `${obsUrl}?${queryParams}` : obsUrl;
  const obsResp = await fetchJSON(fullUrl);

  return {
    data: obsResp.observations || obsResp,
    rawPayload: obsResp,
    sourceTimestamp: releaseDate || new Date().toISOString(),
    recordCount: obsResp.observations?.length || 0,
  };
}

/**
 * Fetch a specific time-series from ONS (by CDID code).
 * Useful for individual indicators like CPI, GDP, unemployment.
 *
 * @param {string} cdid - ONS CDID code (e.g., "L55O" for CPIH annual rate)
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchONSTimeSeries(cdid) {
  const url = `${BASE_URL}/timeseries/${cdid.toLowerCase()}/data`;
  const resp = await fetchJSON(url);

  // ONS time series returns years, quarters, months arrays
  const allPeriods = [
    ...(resp.years || []),
    ...(resp.quarters || []),
    ...(resp.months || []),
  ];

  return {
    data: {
      description: resp.description,
      years: resp.years,
      quarters: resp.quarters,
      months: resp.months,
    },
    rawPayload: resp,
    sourceTimestamp: resp.description?.releaseDate || new Date().toISOString(),
    recordCount: allPeriods.length,
  };
}

/**
 * Fetch multiple ONS time-series at once.
 *
 * @param {Object} seriesMap - { label: cdid } mapping
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchONSMultipleSeries(seriesMap) {
  const results = {};
  const rawPayloads = {};
  let latestTimestamp = null;
  let totalRecords = 0;

  for (const [label, cdid] of Object.entries(seriesMap)) {
    const result = await fetchONSTimeSeries(cdid);
    results[label] = result.data;
    rawPayloads[label] = result.rawPayload;
    totalRecords += result.recordCount;

    if (!latestTimestamp || result.sourceTimestamp > latestTimestamp) {
      latestTimestamp = result.sourceTimestamp;
    }

    // Be polite to the API
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    data: results,
    rawPayload: rawPayloads,
    sourceTimestamp: latestTimestamp,
    recordCount: totalRecords,
  };
}

// ─── Cost of Living normalizer ───────────────────────────────────────────

/**
 * Normalize ONS data into the cost-of-living.json format.
 * Maps multiple CDID series into the structure the frontend expects.
 */
export function normalizeCostOfLiving(rawData) {
  const cpi = rawData.cpiRate;
  const food = rawData.foodInflation;
  const housing = rawData.housingCosts;
  const wages = rawData.wages;

  // Build time series from monthly data
  const buildSeries = (seriesData) => {
    if (!seriesData?.months) return [];
    return seriesData.months
      .filter((m) => m.value && m.value !== "")
      .map((m) => ({
        date: m.date,
        label: m.label,
        value: parseFloat(m.value),
      }))
      .slice(-60); // Last 5 years of monthly data
  };

  const latestValue = (seriesData) => {
    const months = seriesData?.months?.filter((m) => m.value && m.value !== "");
    if (!months?.length) return null;
    return parseFloat(months[months.length - 1].value);
  };

  return {
    headline: {
      cpiRate: latestValue(cpi),
      foodInflation: latestValue(food),
      housingCosts: latestValue(housing),
      wageGrowth: latestValue(wages),
    },
    cpiInflation: {
      series: buildSeries(cpi),
      description: cpi?.description?.mainMeasure || "Consumer Price Inflation",
    },
    foodInflation: {
      series: buildSeries(food),
    },
    housingCosts: {
      series: buildSeries(housing),
    },
    wageGrowth: {
      series: buildSeries(wages),
    },
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "Office for National Statistics",
        url: "https://www.ons.gov.uk",
      },
    },
  };
}

// ─── Economic Output normalizer ──────────────────────────────────────────

export function normalizeEconomicOutput(rawData) {
  const gdp = rawData.gdpGrowth;
  const unemployment = rawData.unemployment;
  const employment = rawData.employmentRate;

  const latestValue = (seriesData) => {
    const arr = seriesData?.quarters || seriesData?.months || [];
    const valid = arr.filter((m) => m.value && m.value !== "");
    return valid.length ? parseFloat(valid[valid.length - 1].value) : null;
  };

  const buildQuarterly = (seriesData) => {
    if (!seriesData?.quarters) return [];
    return seriesData.quarters
      .filter((q) => q.value && q.value !== "")
      .map((q) => ({
        date: q.date,
        label: q.label,
        value: parseFloat(q.value),
      }))
      .slice(-40); // Last 10 years quarterly
  };

  return {
    headline: {
      gdpGrowth: latestValue(gdp),
      unemploymentRate: latestValue(unemployment),
      employmentRate: latestValue(employment),
    },
    gdpSeries: buildQuarterly(gdp),
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "Office for National Statistics",
        url: "https://www.ons.gov.uk",
      },
    },
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ONS API ${resp.status}: ${url} — ${text.slice(0, 200)}`);
  }

  return resp.json();
}

export default {
  fetchONSDataset,
  fetchONSTimeSeries,
  fetchONSMultipleSeries,
  normalizeCostOfLiving,
  normalizeEconomicOutput,
};
