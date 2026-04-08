/**
 * DataFreshness — Displays data source attribution and staleness indicators
 *
 * Shows:
 *  - Source name with link
 *  - Last updated timestamp
 *  - Freshness badge (fresh/stale/critical)
 *  - Methodology note
 *
 * Usage:
 *   <DataFreshness
 *     data={costOfLivingData}
 *     config={{ warningAfterDays: 45, criticalAfterDays: 75 }}
 *   />
 *
 * Or with explicit props:
 *   <DataFreshness
 *     sourceName="Office for National Statistics"
 *     sourceUrl="https://www.ons.gov.uk"
 *     lastUpdated="2024-12-15T10:00:00Z"
 *     methodology="Consumer Price Inflation data..."
 *     warningAfterDays={45}
 *     criticalAfterDays={75}
 *   />
 */

import React from "react";
import { AlertCircle, Clock, CheckCircle, ExternalLink } from "lucide-react";

export function DataFreshness({
  // Auto-detect from data._ingest or data.metadata
  data,
  config,
  // Or explicit props
  sourceName,
  sourceUrl,
  lastUpdated,
  methodology,
  warningAfterDays = 90,
  criticalAfterDays = 180,
  compact = false,
}) {
  // Extract from data object if provided
  const meta = data?.metadata || data?._ingest || {};
  const source = meta.primarySource || {};

  const name = sourceName || source.name || meta.sourceName || "Unknown source";
  const url = sourceUrl || source.url || meta.sourceUrl || null;
  const updated = lastUpdated || meta.fetchedAt || meta.lastUpdated || null;
  const note = methodology || meta.methodologyNote || null;
  const warnDays = config?.warningAfterDays || warningAfterDays;
  const critDays = config?.criticalAfterDays || criticalAfterDays;

  // Calculate freshness
  const daysSince = updated
    ? Math.floor((Date.now() - new Date(updated).getTime()) / 86400000)
    : null;

  let status = "unknown";
  if (daysSince !== null) {
    if (daysSince > critDays) status = "critical";
    else if (daysSince > warnDays) status = "warning";
    else status = "fresh";
  }

  // Validation info
  const validationResult = data?._ingest?.validationResult;
  const validationNotes = data?._ingest?.validationNotes || [];

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <FreshnessBadge status={status} daysSince={daysSince} />
        <span>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-500 transition-colors"
            >
              {name}
            </a>
          ) : (
            name
          )}
        </span>
        {updated && (
          <span className="text-gray-600">
            · Updated {formatRelativeDate(updated)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-800/50 mt-6 pt-4">
      <div className="flex flex-wrap items-start gap-4 text-xs">
        {/* Source attribution */}
        <div className="flex-1 min-w-[200px]">
          <div className="text-gray-500">
            <strong className="text-gray-400">Source:</strong>{" "}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-500 transition-colors inline-flex items-center gap-1"
              >
                {name}
                <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-gray-400">{name}</span>
            )}
          </div>
          {note && <div className="text-gray-600 mt-1 max-w-xl">{note}</div>}
        </div>

        {/* Freshness indicator */}
        <div className="flex items-center gap-3">
          <FreshnessBadge status={status} daysSince={daysSince} />

          {updated && (
            <div className="text-gray-600">
              <Clock size={10} className="inline mr-1" />
              {formatRelativeDate(updated)}
            </div>
          )}

          {validationResult && validationResult !== "pass" && (
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                validationResult === "fail"
                  ? "bg-red-900/30 text-red-400 border border-red-800/50"
                  : "bg-yellow-900/30 text-yellow-400 border border-yellow-800/50"
              }`}
              title={validationNotes.join("; ")}
            >
              {validationResult === "fail" ? "Validation failed" : "Validation warnings"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FreshnessBadge({ status, daysSince }) {
  const configs = {
    fresh: {
      icon: CheckCircle,
      text: "Fresh",
      className: "bg-emerald-900/30 text-emerald-400 border-emerald-800/50",
    },
    warning: {
      icon: Clock,
      text: `Stale (${daysSince}d)`,
      className: "bg-yellow-900/30 text-yellow-400 border-yellow-800/50",
    },
    critical: {
      icon: AlertCircle,
      text: `Critical (${daysSince}d)`,
      className: "bg-red-900/30 text-red-400 border-red-800/50",
    },
    unknown: {
      icon: Clock,
      text: "Unknown age",
      className: "bg-gray-900/30 text-gray-500 border-gray-800/50",
    },
  };

  const cfg = configs[status] || configs.unknown;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono ${cfg.className}`}
    >
      <Icon size={10} />
      {cfg.text}
    </span>
  );
}

function formatRelativeDate(isoString) {
  if (!isoString) return "Unknown";

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * DataPipelineStatus — Admin dashboard showing all dataset statuses.
 * Shows a table of all datasets with their freshness, last ingest, and source info.
 */
export function DataPipelineStatus({ registry, dataFiles }) {
  if (!registry) return null;

  const datasets = Object.entries(registry).map(([key, config]) => {
    const dataFile = dataFiles?.[key];
    const ingest = dataFile?._ingest;
    const freshness = ingest?.fetchedAt
      ? Math.floor((Date.now() - new Date(ingest.fetchedAt).getTime()) / 86400000)
      : null;

    let status = "unknown";
    if (freshness !== null) {
      const warn = config.staleness?.warningAfterDays || 90;
      const crit = config.staleness?.criticalAfterDays || 180;
      if (freshness > crit) status = "critical";
      else if (freshness > warn) status = "warning";
      else status = "fresh";
    }

    return {
      key,
      displayName: config.displayName,
      sourceType: config.recommendedSourceType || config.currentSourceType,
      sourceName: config.sources?.[0]?.name || "—",
      migration: config.migration?.status || "—",
      priority: config.migration?.priority || "—",
      status,
      daysSince: freshness,
      validationResult: ingest?.validationResult || "—",
      lastFetch: ingest?.fetchedAt || "—",
    };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 font-mono uppercase tracking-wider text-[10px]">
            <th className="py-2 px-3 text-left">Dataset</th>
            <th className="py-2 px-3 text-left">Source</th>
            <th className="py-2 px-3 text-center">Type</th>
            <th className="py-2 px-3 text-center">Status</th>
            <th className="py-2 px-3 text-center">Migration</th>
            <th className="py-2 px-3 text-right">Last Fetch</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((d) => (
            <tr
              key={d.key}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="py-2 px-3 text-gray-300">{d.displayName}</td>
              <td className="py-2 px-3 text-gray-500 max-w-[200px] truncate">
                {d.sourceName}
              </td>
              <td className="py-2 px-3 text-center">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    d.sourceType === "api"
                      ? "bg-blue-900/30 text-blue-400"
                      : d.sourceType === "csv_feed"
                        ? "bg-purple-900/30 text-purple-400"
                        : d.sourceType === "ocds"
                          ? "bg-cyan-900/30 text-cyan-400"
                          : "bg-gray-900/30 text-gray-500"
                  }`}
                >
                  {d.sourceType}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <FreshnessBadge status={d.status} daysSince={d.daysSince} />
              </td>
              <td className="py-2 px-3 text-center">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    d.migration === "automated"
                      ? "bg-emerald-900/30 text-emerald-400"
                      : d.migration === "planned"
                        ? "bg-yellow-900/30 text-yellow-400"
                        : "bg-gray-900/30 text-gray-500"
                  }`}
                >
                  {d.priority !== "—" ? `${d.priority} ` : ""}
                  {d.migration}
                </span>
              </td>
              <td className="py-2 px-3 text-right text-gray-600 font-mono">
                {d.lastFetch !== "—"
                  ? formatRelativeDate(d.lastFetch)
                  : "Never"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataFreshness;
