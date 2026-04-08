/**
 * GOV.UK Departmental £25k+ Spend Adapter
 *
 * Fetches departmental spending data over £25,000 published on GOV.UK.
 * All central government departments must publish monthly CSV files of
 * payments exceeding £25,000.
 *
 * Used by: departmental-spend (granular per-department payment data)
 *
 * Discovery: https://www.gov.uk/search/transparency-and-freedom-of-information-releases
 *            ?content_store_document_type=transparency
 *            &organisations[]=<org-slug>
 *            &topics[]=spending
 *
 * Source pages follow pattern:
 *   https://www.gov.uk/government/publications/<dept>-spending-over-25000-<month>-<year>
 *
 * No API key required. Open Government Licence v3.0.
 *
 * Note: The CSV schemas vary slightly between departments. This adapter
 * handles the common columns and gracefully ignores department-specific extras.
 */

const GOV_UK_BASE = "https://www.gov.uk";
const SEARCH_API = "https://www.gov.uk/api/search.json";

// Major departments that reliably publish £25k+ data
const DEPARTMENTS = [
  { slug: "cabinet-office", name: "Cabinet Office" },
  { slug: "department-for-education", name: "Department for Education" },
  { slug: "department-for-environment-food-rural-affairs", name: "Defra" },
  { slug: "department-for-transport", name: "Department for Transport" },
  { slug: "department-of-health-and-social-care", name: "DHSC" },
  { slug: "hm-treasury", name: "HM Treasury" },
  { slug: "home-office", name: "Home Office" },
  { slug: "ministry-of-defence", name: "Ministry of Defence" },
  { slug: "ministry-of-justice", name: "Ministry of Justice" },
  { slug: "department-for-energy-security-and-net-zero", name: "DESNZ" },
  { slug: "department-for-science-innovation-and-technology", name: "DSIT" },
  { slug: "department-for-work-and-pensions", name: "DWP" },
  { slug: "foreign-commonwealth-development-office", name: "FCDO" },
  { slug: "department-for-levelling-up-housing-and-communities", name: "DLUHC" },
  { slug: "department-for-business-and-trade", name: "DBT" },
  { slug: "department-for-culture-media-and-sport", name: "DCMS" },
];

/**
 * Search GOV.UK for the latest £25k spend publications from a department.
 *
 * @param {string} deptSlug - Department URL slug (e.g., "cabinet-office")
 * @param {Object} [options]
 * @param {number} [options.count] - Number of results (default 6 = ~6 months)
 * @returns {Promise<Object[]>} Array of publication metadata objects
 */
export async function findSpendPublications(deptSlug, options = {}) {
  const { count = 6 } = options;

  const params = new URLSearchParams({
    filter_organisations: deptSlug,
    filter_content_store_document_type: "transparency",
    q: "spending over 25000",
    count: String(count),
    order: "-public_timestamp",
    fields: "title,link,public_timestamp,description",
  });

  const url = `${SEARCH_API}?${params}`;
  const resp = await fetchJSON(url);

  return (resp.results || []).map((r) => ({
    title: r.title,
    url: `${GOV_UK_BASE}${r.link}`,
    publishedAt: r.public_timestamp,
    description: r.description,
  }));
}

/**
 * Fetch the publication page and extract CSV attachment URLs.
 *
 * @param {string} publicationUrl - Full URL of the GOV.UK publication page
 * @returns {Promise<string[]>} Array of CSV download URLs
 */
export async function extractCSVUrls(publicationUrl) {
  // Use the GOV.UK content API to get structured publication data
  const apiPath = publicationUrl.replace(GOV_UK_BASE, "");
  const url = `${GOV_UK_BASE}/api/content${apiPath}`;

  const content = await fetchJSON(url);
  const csvUrls = [];

  // Traverse the documents/attachments structure
  const documents = content.details?.documents || [];
  for (const doc of documents) {
    // Documents are HTML strings containing <a> tags with attachment URLs
    const csvMatch = doc.match(/href="([^"]+\.csv[^"]*)"/gi);
    if (csvMatch) {
      for (const match of csvMatch) {
        const href = match.match(/href="([^"]+)"/)?.[1];
        if (href) {
          csvUrls.push(href.startsWith("http") ? href : `${GOV_UK_BASE}${href}`);
        }
      }
    }
  }

  // Also check attachments array
  const attachments = content.details?.attachments || [];
  for (const att of attachments) {
    if (att.url && att.content_type === "text/csv") {
      csvUrls.push(att.url.startsWith("http") ? att.url : `${GOV_UK_BASE}${att.url}`);
    }
    if (att.url && att.url.endsWith(".csv")) {
      csvUrls.push(att.url.startsWith("http") ? att.url : `${GOV_UK_BASE}${att.url}`);
    }
  }

  return [...new Set(csvUrls)]; // Deduplicate
}

/**
 * Download and parse a £25k spend CSV file.
 * Handles the common schema variations across departments.
 *
 * @param {string} csvUrl - URL of the CSV file
 * @returns {Promise<Object[]>} Array of parsed payment records
 */
export async function downloadAndParseCSV(csvUrl) {
  const resp = await fetch(csvUrl, {
    headers: {
      Accept: "text/csv, application/csv, */*",
      "User-Agent": "Gracchus Data Pipeline/1.0",
    },
  });

  if (!resp.ok) {
    throw new Error(`GOV.UK CSV ${resp.status}: ${csvUrl}`);
  }

  const text = await resp.text();
  return parseSpendCSV(text);
}

/**
 * Parse a £25k spend CSV string into structured records.
 * Handles common column name variations across departments.
 */
export function parseSpendCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header row (handle quoted fields)
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Map common column name variations to canonical names
  const columnMap = resolveColumns(headers);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 2) continue; // Skip empty/malformed rows

    const amount = parseAmount(fields[columnMap.amount]);
    if (amount === null || amount < 25000) continue; // Filter sub-threshold rows

    records.push({
      department: fields[columnMap.department] || null,
      entity: fields[columnMap.entity] || null,
      date: fields[columnMap.date] || null,
      expenseType: fields[columnMap.expenseType] || null,
      expenseArea: fields[columnMap.expenseArea] || null,
      supplier: fields[columnMap.supplier] || null,
      transactionNumber: fields[columnMap.transactionNumber] || null,
      amount,
      description: fields[columnMap.description] || null,
    });
  }

  return records;
}

/**
 * Fetch the latest spend data for all tracked departments.
 * This is the main entry point used by the pipeline orchestrator.
 *
 * @param {Object} [options]
 * @param {number} [options.monthsBack] - How many months of publications to fetch (default 3)
 * @param {string[]} [options.departments] - Subset of department slugs (default all)
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchAllDepartmentSpend(options = {}) {
  const { monthsBack = 3, departments } = options;
  const deptList = departments
    ? DEPARTMENTS.filter((d) => departments.includes(d.slug))
    : DEPARTMENTS;

  const allRecords = [];
  const deptResults = {};
  const errors = [];

  for (const dept of deptList) {
    try {
      console.log(`  [govuk-spend] Searching ${dept.name}...`);
      const publications = await findSpendPublications(dept.slug, {
        count: monthsBack,
      });

      const deptRecords = [];
      for (const pub of publications) {
        try {
          const csvUrls = await extractCSVUrls(pub.url);
          for (const csvUrl of csvUrls) {
            const records = await downloadAndParseCSV(csvUrl);
            // Tag each record with department info
            const tagged = records.map((r) => ({
              ...r,
              department: r.department || dept.name,
              sourcePublication: pub.title,
              sourceUrl: pub.url,
            }));
            deptRecords.push(...tagged);
          }
        } catch (err) {
          errors.push({
            department: dept.name,
            publication: pub.title,
            error: err.message,
          });
        }
        await new Promise((r) => setTimeout(r, 300)); // Be polite
      }

      deptResults[dept.slug] = {
        name: dept.name,
        recordCount: deptRecords.length,
        publicationsScanned: publications.length,
      };
      allRecords.push(...deptRecords);
    } catch (err) {
      errors.push({ department: dept.name, error: err.message });
    }

    // Rate limit between departments
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    data: allRecords,
    rawPayload: { deptResults, errors, totalRecords: allRecords.length },
    sourceTimestamp: new Date().toISOString(),
    recordCount: allRecords.length,
  };
}

// ─── Normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize raw spend records into the departmental-spend.json format.
 */
export function normalizeDepartmentalSpend(rawData) {
  const records = rawData.data || rawData;
  if (!Array.isArray(records)) return { payments: [], summary: {}, metadata: {} };

  // Aggregate by department
  const byDept = {};
  const bySupplier = {};
  const byMonth = {};
  let totalSpend = 0;

  for (const r of records) {
    const dept = r.department || "Unknown";
    const supplier = r.supplier || "Unknown";
    const amount = r.amount || 0;
    const month = r.date ? r.date.slice(0, 7) : "unknown";

    totalSpend += amount;

    // Department aggregation
    if (!byDept[dept]) byDept[dept] = { total: 0, count: 0, topPayments: [] };
    byDept[dept].total += amount;
    byDept[dept].count += 1;
    byDept[dept].topPayments.push({ supplier, amount, date: r.date, description: r.description });

    // Supplier aggregation
    if (!bySupplier[supplier]) bySupplier[supplier] = { total: 0, count: 0, departments: new Set() };
    bySupplier[supplier].total += amount;
    bySupplier[supplier].count += 1;
    bySupplier[supplier].departments.add(dept);

    // Monthly aggregation
    if (!byMonth[month]) byMonth[month] = { total: 0, count: 0 };
    byMonth[month].total += amount;
    byMonth[month].count += 1;
  }

  // Build sorted outputs
  const departments = Object.entries(byDept)
    .map(([name, d]) => ({
      name,
      totalSpend: Math.round(d.total),
      paymentCount: d.count,
      averagePayment: Math.round(d.total / d.count),
      topPayments: d.topPayments
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((p) => ({
          supplier: p.supplier,
          amount: Math.round(p.amount),
          date: p.date,
          description: p.description,
        })),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const topSuppliers = Object.entries(bySupplier)
    .map(([name, s]) => ({
      name,
      totalReceived: Math.round(s.total),
      paymentCount: s.count,
      departmentCount: s.departments.size,
      departments: [...s.departments].sort(),
    }))
    .sort((a, b) => b.totalReceived - a.totalReceived)
    .slice(0, 100);

  const monthlyTrend = Object.entries(byMonth)
    .map(([month, d]) => ({
      month,
      totalSpend: Math.round(d.total),
      paymentCount: d.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    summary: {
      totalSpend: Math.round(totalSpend),
      totalPayments: records.length,
      departmentCount: Object.keys(byDept).length,
      uniqueSuppliers: Object.keys(bySupplier).length,
      averagePayment: records.length > 0 ? Math.round(totalSpend / records.length) : 0,
    },
    departments,
    topSuppliers,
    monthlyTrend,
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "GOV.UK Transparency — Spending over £25,000",
        url: "https://www.gov.uk/search/transparency-and-freedom-of-information-releases?content_store_document_type=transparency",
      },
      licence: "Open Government Licence v3.0",
      note: "Covers central government departments. CSV schemas vary by department; some fields may be null.",
    },
  };
}

/**
 * Validate normalized departmental spend data.
 */
export function validateDepartmentalSpend(normalized) {
  const errors = [];

  if (!normalized.summary) {
    errors.push("Missing summary object");
  }
  if (!normalized.departments || !Array.isArray(normalized.departments)) {
    errors.push("Missing or invalid 'departments' array");
  } else if (normalized.departments.length === 0) {
    errors.push("No department data found — expected at least one department");
  }
  if (normalized.summary?.totalSpend < 0) {
    errors.push(`Negative total spend: ${normalized.summary.totalSpend}`);
  }
  if (normalized.summary?.totalPayments === 0) {
    errors.push("Zero payments — check CSV parsing");
  }

  // Sanity check: each department's spend should be £25k+ (threshold)
  for (const dept of normalized.departments || []) {
    if (dept.averagePayment < 25000) {
      errors.push(`${dept.name}: average payment £${dept.averagePayment} below £25k threshold — possible parsing issue`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    recordCount: normalized.summary?.totalPayments || 0,
  };
}

// ─── CSV parsing helpers ────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
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
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Map common CSV column name variations to canonical field indices.
 */
function resolveColumns(headers) {
  const find = (patterns) => {
    for (const p of patterns) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  return {
    department: find(["department", "organisation", "entity"]),
    entity: find(["entity", "body", "organisation"]),
    date: find(["date", "payment date", "transaction date", "invoice date"]),
    expenseType: find(["expense type", "expense area", "category", "expenditure type"]),
    expenseArea: find(["expense area", "budget area", "cost centre", "directorate"]),
    supplier: find(["supplier", "vendor", "merchant", "payee", "beneficiary"]),
    transactionNumber: find(["transaction", "invoice", "reference", "purchase order"]),
    amount: find(["amount", "value", "total", "spend", "payment"]),
    description: find(["description", "narrative", "detail", "purpose"]),
  };
}

function parseAmount(raw) {
  if (raw == null || raw === "") return null;
  // Strip currency symbols, commas, quotes, whitespace
  const cleaned = String(raw).replace(/[£$€,"\s]/g, "");
  // Handle brackets as negative: (1234) → -1234
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const numStr = negative ? cleaned.slice(1, -1) : cleaned;
  const num = parseFloat(numStr);
  return isNaN(num) ? null : negative ? -num : num;
}

export default {
  findSpendPublications,
  extractCSVUrls,
  downloadAndParseCSV,
  parseSpendCSV,
  fetchAllDepartmentSpend,
  normalizeDepartmentalSpend,
  validateDepartmentalSpend,
};
