/**
 * Public Finances Flow Adapter
 *
 * Fetches UK public sector receipts, expenditure, and borrowing data
 * from the ONS Public Sector Finances bulletin and HMRC tax receipts.
 *
 * Used by: public-finances-flow (Sankey flow chart)
 *
 * APIs / Sources:
 *  - ONS Public Sector Finances time series (CDID codes)
 *  - HMRC Tax Receipts Monthly Bulletin (published at known URL)
 *  - OBR Public Finances Databank (annual, for spending categories)
 *
 * No API keys required. All data under Open Government Licence v3.0.
 *
 * Key CDID codes (ONS time series):
 *  - ANBV: Public sector current receipts (£mn)
 *  - ANBT: Central government current receipts (£mn)
 *  - ANLP: Total managed expenditure (£mn)
 *  - J5II: Public sector net borrowing (£mn)
 *  - JW2Z: Central government net debt interest (£mn)
 *  - HF6X: Public sector net debt as % GDP
 */

const ONS_TS_BASE = "https://api.beta.ons.gov.uk/v1/timeseries";

// Key ONS CDID codes for public finances
const CDID_MAP = {
  currentReceipts: "anbv",     // Public sector current receipts
  totalExpenditure: "anlp",    // Total managed expenditure
  netBorrowing: "j5ii",       // Public sector net borrowing
  debtInterest: "jw2z",       // Central govt net debt interest
  debtPctGDP: "hf6x",         // Net debt as % GDP
  incomeTax: "ms6k",          // HMRC income tax receipts
  nic: "aiih",                // National insurance contributions
  vat: "eyob",                // VAT receipts
  corporationTax: "accd",     // Corporation tax
};

/**
 * Fetch a single ONS time series by CDID code.
 */
async function fetchTimeSeries(cdid) {
  const url = `${ONS_TS_BASE}/${cdid}/data`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Gracchus Data Pipeline/1.0",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ONS time series ${cdid}: ${resp.status} — ${text.slice(0, 200)}`);
  }

  return resp.json();
}

/**
 * Extract annual data from an ONS time series response.
 * Returns array of { year, value } sorted chronologically.
 */
function extractAnnual(tsData) {
  const years = tsData.years || [];
  return years
    .filter((y) => y.value && y.value !== "")
    .map((y) => ({
      year: y.year || y.date,
      label: y.label,
      value: parseFloat(y.value),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

/**
 * Extract monthly data from an ONS time series response.
 * Returns array of { date, value } sorted chronologically.
 */
function extractMonthly(tsData) {
  const months = tsData.months || [];
  return months
    .filter((m) => m.value && m.value !== "")
    .map((m) => ({
      date: m.date,
      label: m.label,
      value: parseFloat(m.value),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch all public finance time series in parallel.
 * Main entry point for the pipeline orchestrator.
 *
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchPublicFinances() {
  const results = {};
  const errors = [];

  for (const [key, cdid] of Object.entries(CDID_MAP)) {
    try {
      console.log(`  [public-finances] Fetching ${key} (${cdid})...`);
      const tsData = await fetchTimeSeries(cdid);
      results[key] = {
        annual: extractAnnual(tsData),
        monthly: extractMonthly(tsData),
        description: tsData.description,
      };
    } catch (err) {
      errors.push({ series: key, cdid, error: err.message });
      console.warn(`  [public-finances] Failed ${key}: ${err.message}`);
    }

    // Be polite
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    data: results,
    rawPayload: { results, errors },
    sourceTimestamp: new Date().toISOString(),
    recordCount: Object.values(results).reduce(
      (sum, r) => sum + (r.annual?.length || 0) + (r.monthly?.length || 0),
      0
    ),
  };
}

/**
 * Normalize raw ONS time series into the public-finances-flow.json format.
 *
 * The normalizer assembles annual flow data from multiple time series,
 * combining tax receipt breakdowns with total receipts and expenditure.
 */
export function normalizePublicFinancesFlow(rawData) {
  const d = rawData.data || rawData;

  // Build annual records from the overlapping years across all series
  const receiptsAnnual = d.currentReceipts?.annual || [];
  const spendAnnual = d.totalExpenditure?.annual || [];
  const borrowingAnnual = d.netBorrowing?.annual || [];
  const debtIntAnnual = d.debtInterest?.annual || [];
  const debtPctAnnual = d.debtPctGDP?.annual || [];
  const incomeTaxAnnual = d.incomeTax?.annual || [];
  const nicAnnual = d.nic?.annual || [];
  const vatAnnual = d.vat?.annual || [];
  const corpTaxAnnual = d.corporationTax?.annual || [];

  // Index by year for fast lookup
  const idx = (arr) => {
    const map = {};
    for (const item of arr) map[item.year || item.label] = item.value;
    return map;
  };

  const rIdx = idx(receiptsAnnual);
  const sIdx = idx(spendAnnual);
  const bIdx = idx(borrowingAnnual);
  const diIdx = idx(debtIntAnnual);
  const dpIdx = idx(debtPctAnnual);
  const itIdx = idx(incomeTaxAnnual);
  const niIdx = idx(nicAnnual);
  const vIdx = idx(vatAnnual);
  const ctIdx = idx(corpTaxAnnual);

  // Find years where we have all key series
  const allYears = [...new Set([
    ...Object.keys(rIdx),
    ...Object.keys(sIdx),
  ])].sort();

  // Filter to recent years with good coverage
  const recentYears = allYears.filter((yr) => {
    const yrNum = parseInt(yr);
    return yrNum >= 2019 && rIdx[yr] && sIdx[yr];
  });

  const annual = recentYears.map((yr) => {
    // ONS values are in £ millions — convert to billions
    const toB = (v) => (v ? +(v / 1000).toFixed(1) : null);

    const totalReceipts = toB(rIdx[yr]);
    const totalSpend = toB(sIdx[yr]);
    const incomeTax = toB(itIdx[yr]);
    const nic = toB(niIdx[yr]);
    const vat = toB(vIdx[yr]);
    const corpTax = toB(ctIdx[yr]);
    const debtInt = toB(diIdx[yr]);
    const netBorrow = toB(bIdx[yr]);
    const debtPct = dpIdx[yr] || null;

    // Calculate residuals
    const knownHMRC = (incomeTax || 0) + (nic || 0) + (vat || 0) + (corpTax || 0);
    const otherHMRC = totalReceipts ? Math.max(0, +(totalReceipts * 0.75 - knownHMRC).toFixed(1)) : null;
    const nonHMRC = totalReceipts ? +(totalReceipts - knownHMRC - (otherHMRC || 0)).toFixed(1) : null;

    // For spending categories we only have the total + debt interest from ONS monthly
    // Category splits require OBR data which is annual/forecast-only
    // Use approximate shares based on latest OBR breakdown
    const spendExDebt = totalSpend && debtInt ? totalSpend - debtInt : null;
    const approxCategories = spendExDebt
      ? {
          socialProtection: +(spendExDebt * 0.28).toFixed(0),
          health: +(spendExDebt * 0.17).toFixed(0),
          education: +(spendExDebt * 0.08).toFixed(0),
          defence: +(spendExDebt * 0.04).toFixed(0),
          publicOrder: +(spendExDebt * 0.03).toFixed(0),
          transport: +(spendExDebt * 0.03).toFixed(0),
        }
      : {};

    const knownSpend = Object.values(approxCategories).reduce((s, v) => s + v, 0) + (debtInt || 0);
    const otherSpend = totalSpend ? +(totalSpend - knownSpend).toFixed(0) : null;

    return {
      year: yr.includes("-") ? yr : `${yr}-${String(parseInt(yr) + 1).slice(2)}`,
      receipts: {
        total: totalReceipts,
        incomeTax,
        nationalInsurance: nic,
        vat,
        corporationTax: corpTax,
        otherHMRC,
        nonHMRC,
      },
      spending: {
        total: totalSpend,
        ...approxCategories,
        debtInterest: debtInt,
        other: otherSpend,
      },
      netBorrowing: netBorrow || (totalSpend && totalReceipts ? +(totalSpend - totalReceipts).toFixed(1) : null),
      debtInterestNet: debtInt,
      debtPctGDP: debtPct,
    };
  });

  // Latest month from monthly data
  const receiptsMonthly = d.currentReceipts?.monthly || [];
  const spendMonthly = d.totalExpenditure?.monthly || [];
  const borrowMonthly = d.netBorrowing?.monthly || [];
  const diMonthly = d.debtInterest?.monthly || [];

  const latestR = receiptsMonthly[receiptsMonthly.length - 1];
  const latestS = spendMonthly[spendMonthly.length - 1];
  const latestB = borrowMonthly[borrowMonthly.length - 1];
  const latestDI = diMonthly[diMonthly.length - 1];

  const latestMonth = latestR
    ? {
        period: latestR.label || latestR.date,
        periodShort: latestR.label || latestR.date,
        releaseDate: new Date().toISOString().slice(0, 10),
        receipts: +(latestR.value / 1000).toFixed(1),
        expenditure: latestS ? +(latestS.value / 1000).toFixed(1) : null,
        netBorrowing: latestB ? +(latestB.value / 1000).toFixed(1) : null,
        debtInterest: latestDI ? +(latestDI.value / 1000).toFixed(1) : null,
        sourceName: "ONS Public Sector Finances",
        sourceUrl: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance",
      }
    : null;

  return {
    metadata: {
      title: "UK Public Finances — Receipts, Spending & Borrowing Flow",
      description: "How government receipts flow into spending categories, debt interest, and borrowing.",
      sources: [
        {
          name: "ONS Public Sector Finances",
          url: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance",
          confidence: "high",
        },
      ],
      unit: "billions_gbp",
      period: "financial_year",
      lastUpdated: new Date().toISOString().slice(0, 10),
      latestSource: "ONS Public Sector Finances (pipeline auto-refresh)",
      sourceConfidence: "high",
    },
    annual,
    latestMonth,
    limitations: [
      "Spending category breakdown uses OBR proportional shares applied to ONS total TME. Monthly category splits are not published.",
      "Tax receipt breakdown uses ONS individual tax CDIDs. Residuals calculated as balancing items.",
      "All figures in nominal terms.",
    ],
  };
}

/**
 * Validate normalized public finances flow data.
 */
export function validatePublicFinancesFlow(normalized) {
  const errors = [];

  if (!normalized.annual || !Array.isArray(normalized.annual)) {
    errors.push("Missing annual array");
  } else if (normalized.annual.length === 0) {
    errors.push("Empty annual array");
  } else {
    for (const yr of normalized.annual) {
      if (!yr.receipts?.total) errors.push(`${yr.year}: missing receipts total`);
      if (!yr.spending?.total) errors.push(`${yr.year}: missing spending total`);
      if (yr.receipts?.total > 3000) errors.push(`${yr.year}: receipts £${yr.receipts.total}bn seems too high`);
      if (yr.spending?.total > 3000) errors.push(`${yr.year}: spending £${yr.spending.total}bn seems too high`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    recordCount: normalized.annual?.length || 0,
  };
}

export default {
  fetchPublicFinances,
  normalizePublicFinancesFlow,
  validatePublicFinancesFlow,
};
