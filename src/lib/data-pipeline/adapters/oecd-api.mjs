/**
 * OECD SDMX API Adapter
 *
 * Fetches international comparison data from the OECD's SDMX REST API.
 *
 * Used by: structural-performance, gov-innovation, international (comparisons)
 *
 * API Docs: https://data.oecd.org/api/sdmx-json-documentation/
 * Base URL: https://sdmx.oecd.org/public/rest
 * No API key required (public access).
 */

const BASE_URL = "https://sdmx.oecd.org/public/rest";

// G7 + key comparison countries
const G7_COUNTRIES = "GBR+USA+DEU+FRA+JPN+ITA+CAN";
const OECD_AVERAGE = "OECD";

/**
 * Fetch data from the OECD SDMX API.
 *
 * @param {string} dataflow - OECD dataflow ID (e.g., "QNA" for quarterly national accounts)
 * @param {string} key - SDMX key filter (e.g., "GBR+USA.B1_GE.VOBARSA.Q")
 * @param {Object} [options]
 * @param {string} [options.startPeriod] - Start date (e.g., "2015")
 * @param {string} [options.endPeriod] - End date (e.g., "2024")
 * @param {string} [options.agency] - Agency ID (default "OECD.SDD.NAD")
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchOECDData(dataflow, key, options = {}) {
  const { startPeriod, endPeriod, agency = "OECD.SDD.NAD" } = options;

  let url = `${BASE_URL}/data/${agency},${dataflow},1.0/${key}`;

  const params = new URLSearchParams();
  if (startPeriod) params.set("startPeriod", startPeriod);
  if (endPeriod) params.set("endPeriod", endPeriod);
  params.set("dimensionAtObservation", "TIME_PERIOD");

  url += `?${params}`;

  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.sdmx.data+json;version=2.0.0",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OECD API ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const observations = extractObservations(json);

  return {
    data: observations,
    rawPayload: json,
    sourceTimestamp: new Date().toISOString(),
    recordCount: observations.length,
  };
}

/**
 * Fetch GDP growth comparison across G7 countries.
 */
export async function fetchGDPComparison(options = {}) {
  const { startPeriod = "2015", endPeriod } = options;
  const countries = options.countries || G7_COUNTRIES;

  return fetchOECDData(
    "QNA",
    `${countries}.B1_GE.GYSA.Q`,
    {
      startPeriod,
      endPeriod,
      agency: "OECD.SDD.NAD",
    }
  );
}

/**
 * Fetch government spending as % of GDP for international comparison.
 */
export async function fetchGovSpendingComparison(options = {}) {
  const countries = options.countries || G7_COUNTRIES;

  return fetchOECDData(
    "SNA_TABLE11",
    `${countries}.GOVEXP.PC_GDP`,
    {
      startPeriod: options.startPeriod || "2015",
      agency: "OECD.SDD.NAD",
    }
  );
}

/**
 * Fetch tax revenue comparison (tax-to-GDP ratio).
 */
export async function fetchTaxRevenueComparison(options = {}) {
  const countries = options.countries || `${G7_COUNTRIES}+${OECD_AVERAGE}`;

  return fetchOECDData(
    "RS_GBL",
    `${countries}.NES.TAXGDP.TOTAL`,
    {
      startPeriod: options.startPeriod || "2015",
      agency: "OECD.CTP.TAS",
    }
  );
}

/**
 * Normalize OECD SDMX JSON into a simpler format for the frontend.
 */
export function normalizeOECDData(observations) {
  // Group by country
  const byCountry = {};

  for (const obs of observations) {
    const country = obs.country || obs.ref_area || "Unknown";
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push({
      period: obs.period,
      value: obs.value,
    });
  }

  // Sort each country's series chronologically
  for (const series of Object.values(byCountry)) {
    series.sort((a, b) => a.period.localeCompare(b.period));
  }

  return {
    countries: byCountry,
    periods: [...new Set(observations.map((o) => o.period))].sort(),
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "OECD",
        url: "https://data.oecd.org",
      },
    },
  };
}

/**
 * Normalize for structural-performance.json format.
 * Combines multiple OECD indicators.
 */
export function normalizeStructuralPerformance(datasets) {
  const { gdp, govSpending, taxRevenue } = datasets;

  return {
    gdpGrowth: normalizeOECDData(gdp || []),
    governmentSpending: normalizeOECDData(govSpending || []),
    taxRevenue: normalizeOECDData(taxRevenue || []),
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "OECD Statistics",
        url: "https://data.oecd.org",
      },
      methodologyNote:
        "International comparisons sourced from OECD SDMX API. G7 nations plus OECD average where available.",
    },
  };
}

// ─── SDMX JSON parser ───────────────────────────────────────────────────

function extractObservations(sdmxJson) {
  const observations = [];

  try {
    const dataSets = sdmxJson.data?.dataSets || sdmxJson.dataSets || [];
    const structure = sdmxJson.data?.structure || sdmxJson.structure;

    if (!structure || !dataSets.length) return observations;

    const dimensions = structure.dimensions?.observation || [];
    const seriesDims = structure.dimensions?.series || [];

    // Map dimension positions to lookup tables
    const dimLookups = {};
    for (const dim of [...seriesDims, ...dimensions]) {
      dimLookups[dim.id] = dim.values || [];
    }

    for (const dataSet of dataSets) {
      const series = dataSet.series || {};

      for (const [seriesKey, seriesData] of Object.entries(series)) {
        const seriesIndices = seriesKey.split(":").map(Number);
        const seriesAttrs = {};

        seriesDims.forEach((dim, i) => {
          const val = dimLookups[dim.id]?.[seriesIndices[i]];
          if (val) seriesAttrs[dim.id.toLowerCase()] = val.id || val.name;
        });

        const obs = seriesData.observations || {};
        for (const [obsKey, obsValues] of Object.entries(obs)) {
          const obsIndex = parseInt(obsKey);
          const timeDim = dimensions.find((d) => d.id === "TIME_PERIOD");
          const period = timeDim?.values?.[obsIndex]?.id || obsKey;

          observations.push({
            ...seriesAttrs,
            period,
            value: obsValues[0],
          });
        }
      }
    }
  } catch (err) {
    console.error("SDMX parse error:", err.message);
  }

  return observations;
}

export default {
  fetchOECDData,
  fetchGDPComparison,
  fetchGovSpendingComparison,
  fetchTaxRevenueComparison,
  normalizeOECDData,
  normalizeStructuralPerformance,
};
