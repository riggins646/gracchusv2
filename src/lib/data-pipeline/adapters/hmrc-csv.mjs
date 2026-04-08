/**
 * HMRC & Government CSV/XLSX Feed Adapter
 *
 * Fetches spreadsheet-format data from HMRC and other government departments.
 *
 * Used by: tax-receipts, apd, energy, spending
 *
 * Sources:
 *  - HMRC Monthly Tax Receipts: https://www.gov.uk/government/statistics/hmrc-tax-and-nics-receipts-for-the-uk
 *  - HMRC Air Passenger Duty: https://www.gov.uk/government/statistics/air-passenger-duty-bulletin
 *  - DESNZ Energy Statistics (DUKES): https://www.gov.uk/government/statistics/digest-of-uk-energy-statistics-dukes
 *  - HMT PESA/DWP spending: https://www.gov.uk/government/statistics/public-expenditure-statistical-analyses
 *
 * Note: These are XLSX files on gov.uk domains. The egress proxy may block
 * direct download — use browser fallback if fetch fails.
 */

import fs from "fs";
import path from "path";

/**
 * Fetch a CSV/XLSX file from a URL.
 *
 * @param {string} url - Direct download URL
 * @param {Object} [options]
 * @param {string} [options.format] - "csv" or "xlsx" (default detected from URL)
 * @param {string} [options.saveTo] - Path to save raw file
 * @returns {Promise<{data: string|Buffer, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchSpreadsheet(url, options = {}) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Gracchus Data Pipeline/1.0",
      Accept: "text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
    },
  });

  if (!resp.ok) {
    throw new Error(`Spreadsheet fetch ${resp.status}: ${url}`);
  }

  const contentType = resp.headers.get("content-type") || "";
  const isXLSX =
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    url.endsWith(".xlsx") ||
    url.endsWith(".xls");

  let data;
  if (isXLSX) {
    data = Buffer.from(await resp.arrayBuffer());
  } else {
    data = await resp.text();
  }

  if (options.saveTo) {
    fs.writeFileSync(options.saveTo, data);
  }

  return {
    data,
    rawPayload: isXLSX ? `[XLSX binary: ${data.length} bytes]` : data,
    sourceTimestamp: resp.headers.get("last-modified") || new Date().toISOString(),
    recordCount: isXLSX ? 0 : data.split("\n").length - 1,
  };
}

/**
 * Parse a simple CSV string into an array of objects.
 * Handles quoted fields and common edge cases.
 *
 * @param {string} csvText - Raw CSV content
 * @param {Object} [options]
 * @param {number} [options.skipRows] - Number of header/preamble rows to skip
 * @param {string} [options.delimiter] - Field delimiter (default ",")
 * @returns {Array<Object>}
 */
export function parseCSV(csvText, options = {}) {
  const { skipRows = 0, delimiter = "," } = options;

  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length <= skipRows) return [];

  const dataLines = lines.slice(skipRows);
  const headers = parseLine(dataLines[0], delimiter).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < dataLines.length; i++) {
    const values = parseLine(dataLines[i], delimiter);
    if (values.length < headers.length * 0.5) continue; // Skip malformed rows

    const row = {};
    headers.forEach((h, j) => {
      if (h) row[h] = values[j]?.trim() || "";
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Normalize HMRC tax receipts data.
 * Expects the "Monthly receipts" sheet data in CSV form.
 */
export function normalizeTaxReceipts(rows) {
  const taxTypes = {};
  const monthlySeries = {};

  for (const row of rows) {
    const taxType = row["Tax"] || row["Receipt Type"] || row["tax_type"];
    const monthStr = row["Month"] || row["Period"] || row["month"];
    const amount = parseNumeric(row["Amount"] || row["Receipts"] || row["amount"]);

    if (!taxType || !amount) continue;

    // Tax type aggregation
    if (!taxTypes[taxType]) taxTypes[taxType] = { total: 0, months: {} };
    taxTypes[taxType].total += amount;
    if (monthStr) taxTypes[taxType].months[monthStr] = amount;

    // Monthly series
    if (monthStr) {
      if (!monthlySeries[monthStr]) monthlySeries[monthStr] = { total: 0, breakdown: {} };
      monthlySeries[monthStr].total += amount;
      monthlySeries[monthStr].breakdown[taxType] = amount;
    }
  }

  return {
    summary: {
      totalReceipts: Math.round(Object.values(taxTypes).reduce((s, t) => s + t.total, 0)),
      taxTypeCount: Object.keys(taxTypes).length,
      monthsCovered: Object.keys(monthlySeries).length,
    },
    byTaxType: Object.entries(taxTypes)
      .map(([name, data]) => ({ taxType: name, total: Math.round(data.total) }))
      .sort((a, b) => b.total - a.total),
    monthlySeries: Object.entries(monthlySeries)
      .map(([month, data]) => ({ month, total: Math.round(data.total), breakdown: data.breakdown }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "HMRC",
        url: "https://www.gov.uk/government/statistics/hmrc-tax-and-nics-receipts-for-the-uk",
      },
      licence: "Open Government Licence v3.0",
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function parseLine(line, delimiter = ",") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function parseNumeric(str) {
  if (!str || typeof str !== "string") return 0;
  // Remove £, commas, spaces; handle parentheses for negatives
  let clean = str.replace(/[£,\s]/g, "");
  const negative = clean.startsWith("(") && clean.endsWith(")");
  if (negative) clean = clean.slice(1, -1);
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : negative ? -val : val;
}

export default {
  fetchSpreadsheet,
  parseCSV,
  normalizeTaxReceipts,
};
