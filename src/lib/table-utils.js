/**
 * Shared Table System for Gracchus
 * =========================================
 * Standardised sort, filter, search, and display utilities
 * used across all data tables: Projects, Suppliers, Consultants,
 * League Tables, Compare tables.
 */

// ============================================================================
// SORT UTILITIES
// ============================================================================

/**
 * Generic multi-type sort comparator.
 * Handles strings, numbers, null/undefined safely.
 */
export function sortRows(data, sortBy, sortDir) {
  if (!data || !sortBy) return data;
  const dir = sortDir === "asc" ? 1 : -1;
  return [...data].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string") {
      return dir * av.localeCompare(bv);
    }
    return dir * (av - bv);
  });
}

/**
 * Generic text search across multiple fields.
 */
export function searchRows(data, query, fields) {
  if (!query || !query.trim()) return data;
  const q = query.toLowerCase().trim();
  return data.filter((row) =>
    fields.some((f) => {
      const val = row[f];
      return val && String(val).toLowerCase().includes(q);
    })
  );
}

/**
 * Generic filter by field value.
 */
export function filterRows(data, filterField, filterValue) {
  if (!filterValue || filterValue === "All") return data;
  return data.filter((row) => row[filterField] === filterValue);
}

/**
 * Combine search + multiple filters + sort in one pass.
 * filters = [{ field, value }]
 */
export function processTableData(data, { search, searchFields, filters, sortBy, sortDir }) {
  let result = data;
  if (search && searchFields) {
    result = searchRows(result, search, searchFields);
  }
  if (filters) {
    for (const f of filters) {
      result = filterRows(result, f.field, f.value);
    }
  }
  if (sortBy) {
    result = sortRows(result, sortBy, sortDir || "desc");
  }
  return result;
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format millions with £ symbol.
 * 1200 → "£1.2bn", 450 → "£450m"
 */
export function fmtMillions(m) {
  if (m == null) return "—";
  if (m >= 1000) return "£" + (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + "bn";
  return "£" + m + "m";
}

/**
 * Format compact number with suffix.
 * 1234567 → "1.2M", 1234 → "1.2K"
 */
export function fmtCompact(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/**
 * Format currency with £ and commas.
 */
export function fmtCurrency(n, decimals = 0) {
  if (n == null) return "—";
  return "£" + n.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format percentage with sign.
 */
export function fmtPct(n, decimals = 1) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(decimals) + "%";
}

// ============================================================================
// TABLE CONFIG BUILDERS
// ============================================================================

/**
 * Build column definitions for a standardised table.
 * Each column: { key, label, align, width, format, sortable }
 */
export function buildColumns(defs) {
  return defs.map((d) => ({
    key: d.key,
    label: d.label || d.key,
    align: d.align || "left",
    width: d.width || "auto",
    format: d.format || ((v) => v),
    sortable: d.sortable !== false,
    className: d.className || ""
  }));
}

/**
 * Get unique values for a field (for filter dropdowns).
 */
export function getUniqueValues(data, field) {
  const vals = new Set();
  data.forEach((row) => {
    if (row[field]) vals.add(row[field]);
  });
  return ["All", ...Array.from(vals).sort()];
}

// ============================================================================
// SORT PILL DEFINITIONS
// ============================================================================

/**
 * Standard sort pill configs for common table types.
 */
export const SORT_PRESETS = {
  projects: [
    { id: "overrun", label: "Overrun (£)" },
    { id: "overrunPct", label: "Overrun (%)" },
    { id: "latestBudget", label: "Total Cost" },
    { id: "name", label: "Name" }
  ],
  suppliers: [
    { id: "totalValue", label: "Contract Value" },
    { id: "contractCount", label: "Contracts" },
    { id: "name", label: "Name" }
  ],
  consultants: [
    { id: "value", label: "Value" },
    { id: "company", label: "Company" },
    { id: "department", label: "Department" }
  ],
  leagueDepts: [
    { id: "score", label: "Score" },
    { id: "overrun", label: "Overrun" },
    { id: "onTime", label: "On Time %" },
    { id: "dept", label: "Name" }
  ],
  leagueConsultancy: [
    { id: "depScore", label: "Dependency Score" },
    { id: "totalSpend", label: "Total Spend" },
    { id: "dept", label: "Department" }
  ]
};
