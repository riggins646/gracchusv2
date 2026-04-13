"use client";

import { useState, useEffect, useCallback } from "react";
import birthYearData from "../../../../data/birth-year-compare.json";

/**
 * Linear interpolation helper for birth year values
 */
function interpolate(values, year) {
  const years = Object.keys(values).map(Number).sort((a, b) => a - b);
  if (year <= years[0]) return values[years[0]];
  if (year >= years[years.length - 1]) return values[years[years.length - 1]];

  let lo = years[0];
  let hi = years[years.length - 1];

  for (const y of years) {
    if (y <= year) lo = y;
    if (y >= year && y < hi) hi = y;
  }

  if (lo === hi) return values[lo];

  const t = (year - lo) / (hi - lo);
  return values[lo] + t * (values[hi] - values[lo]);
}

/**
 * Format a value based on metric type
 */
function formatValue(value, metric) {
  if (metric.id === "housePrice") {
    return "£" + value.toLocaleString("en-GB", {
      maximumFractionDigits: 0
    });
  }

  if (metric.unit === "k") {
    return (value / 1).toFixed(0) + "k";
  }

  if (metric.unit === "%" || metric.unit === "% of GDP") {
    return value.toFixed(1) + "%";
  }

  if (metric.unit === "x salary") {
    return value.toFixed(1) + "x";
  }

  if (metric.unit === "£bn/year") {
    return "£" + value.toFixed(0) + "bn";
  }

  return value.toString();
}

/**
 * Determine if a metric got worse (higher value) or better (lower value)
 */
function getDirection(thenValue, nowValue, metric) {
  if (metric.worse === "neutral") {
    return "neutral";
  }
  if (metric.worse === "up") {
    return nowValue > thenValue ? "up" : "down";
  }
  if (metric.worse === "down") {
    return nowValue < thenValue ? "down" : "up";
  }
  return "neutral";
}

/**
 * Generate context explainer for birth year
 */
function generateBirthYearContext(year, age) {
  const lines = [];

  lines.push(
    `You were born in ${year}. That's now ${age} years of UK government performance ` +
    `to reflect on—measured in debt, housing, energy, and public spending.`
  );

  lines.push(
    "The metrics shown here are drawn from ONS, OBR, HM Treasury, NAO, Bank of England, " +
    "and Land Registry. Each one tracks something that has shaped—or been shaped by—" +
    "political decisions made during your lifetime."
  );

  lines.push(
    "Some have improved. Others have deteriorated. The pattern tells a story about " +
    "how public institutions, policy priorities, and economic conditions have evolved " +
    "since you were born. The figures are source-backed and verifiable."
  );

  lines.push(
    "Gracchus publishes this data so citizens can hold government to account " +
    "with facts, not opinions."
  );

  return lines;
}

export default function BirthYearShareClient({ year }) {
  const [copied, setCopied] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(!year);

  useEffect(() => {
    if (!year || year < 1960 || year > 2025) {
      setError(true);
      return;
    }

    try {
      const computedMetrics = birthYearData.metrics.map(metric => {
        const thenValue = interpolate(metric.values, year);
        const nowValue = interpolate(metric.values, 2025);
        const direction = getDirection(thenValue, nowValue, metric);
        const change = nowValue - thenValue;

        return {
          ...metric,
          thenValue,
          nowValue,
          direction,
          change,
          thenFormatted: formatValue(thenValue, metric),
          nowFormatted: formatValue(nowValue, metric),
          changeFormatted: formatValue(Math.abs(change), metric)
        };
      });

      setMetrics(computedMetrics);
    } catch {
      setError(true);
    }
  }, [year]);

  const age = year ? 2025 - year : 0;

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }, []);

  const handlePostX = useCallback(() => {
    if (!metrics) return;

    const lines = [
      `Born in ${year}. In my lifetime:\n`
    ];

    // Pick 3 key metrics for tweet
    const selectedMetrics = [
      metrics.find(m => m.id === "debt"),
      metrics.find(m => m.id === "housePrice"),
      metrics.find(m => m.id === "energySelf")
    ].filter(Boolean);

    selectedMetrics.forEach(m => {
      lines.push(
        `${m.label}: ${m.thenFormatted} → ${m.nowFormatted}`
      );
    });

    lines.push("\nvia @GracchusHQ");

    const text = lines.join("\n");
    const url = window.location.href;

    window.open(
      "https://x.com/intent/post?text=" +
        encodeURIComponent(text) +
        "&url=" +
        encodeURIComponent(url),
      "_blank"
    );
  }, [metrics, year]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-gray-600 font-mono mb-4">
            Invalid Share Link
          </div>
          <div className="text-gray-500 text-[15px] mb-6">
            This link may be expired or malformed.
          </div>
          <a
            href="/"
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.15em] px-5 py-2.5 " +
              "border border-gray-700 " +
              "text-gray-400 hover:text-white " +
              "hover:border-gray-500 " +
              "transition-colors"
            }
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-600 text-xs font-mono animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  const context = generateBirthYearContext(year, age);

  return (
    <div className="min-h-screen bg-[#030303]">
      {/* Hero card */}
      <div className="flex flex-col items-center px-4 pt-16 pb-8">
        <div className="w-full max-w-[640px]">
          <div className="bg-[#030303] border border-gray-800/50 overflow-hidden">
            <div className="h-1 bg-[#ef4444]" />
            <div className="px-8 md:px-10 pt-8 pb-7">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-mono mb-4">
                GRACCHUS
              </div>
              <h1 className="text-3xl md:text-[42px] font-black text-white tracking-tight leading-tight mb-3">
                Born in {year}
              </h1>
              <div className="text-lg md:text-xl font-bold uppercase tracking-wide mb-4" style={{ color: "#f59e0b" }}>
                {age} years of change
              </div>
              <div className="mt-6 pt-4 flex items-center justify-between border-t border-gray-800/40">
                <div className="text-[9px] text-gray-700 font-mono tracking-wide">
                  Source-backed estimates {" \u00b7 "} Published UK data
                </div>
                <div className="text-[10px] text-gray-600 font-mono font-bold tracking-[0.1em] uppercase">
                  gracchus.ai
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="flex flex-col items-center px-4 pb-8">
        <div className="w-full max-w-[800px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.map(metric => {
              const isWorse = metric.direction === "up" && metric.worse === "up" ||
                             metric.direction === "down" && metric.worse === "down";
              const color = isWorse ? "#ef4444" : "#22c55e";
              const arrowSymbol = metric.direction === "up" ? "↑" : metric.direction === "down" ? "↓" : "→";

              return (
                <div
                  key={metric.id}
                  className="bg-gray-900/30 border border-gray-800/40 p-5 hover:border-gray-700/60 transition-colors"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-mono mb-3">
                    {metric.label}
                  </div>
                  <div className="text-[13px] text-gray-400 mb-4">
                    <span>{metric.thenFormatted}</span>
                    <span className="mx-2 text-gray-600">→</span>
                    <span>{metric.nowFormatted}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black" style={{ color }}>
                      {arrowSymbol}
                    </span>
                    <span className="text-[13px]" style={{ color }}>
                      {metric.changeFormatted}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      {metric.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explainer */}
      <div className="flex flex-col items-center px-4 pb-8">
        <div className="w-full max-w-[640px]">
          <div className="border-l-2 pl-5 py-1 space-y-3" style={{ borderColor: "#f59e0b40" }}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-600 font-mono">
              Why this matters
            </div>
            {context.map((line, i) => (
              <p
                key={i}
                className="text-[15px] leading-relaxed text-gray-400"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center px-4 pb-16">
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={handleCopy}
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.12em] px-5 py-2.5 " +
              "border border-gray-700 " +
              "text-gray-400 " +
              "hover:text-white " +
              "hover:border-gray-500 " +
              "hover:bg-white/[0.02] " +
              "transition-all"
            }
          >
            {copied ? "\u2713 Copied" : "Copy Link"}
          </button>
          <button
            onClick={handlePostX}
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.12em] px-5 py-2.5 " +
              "border border-gray-700 " +
              "text-gray-400 " +
              "hover:text-white " +
              "hover:border-gray-500 " +
              "hover:bg-white/[0.02] " +
              "transition-all"
            }
          >
            Post to X
          </button>
          <a
            href="/"
            className="text-xs font-mono uppercase tracking-[0.12em] px-5 py-2.5 border hover:bg-white/[0.06] transition-all"
            style={{
              borderColor: "#ef4444",
              color: "#ef4444"
            }}
          >
            Explore the full dashboard {"\u2192"}
          </a>
        </div>

        <div className="mt-10 text-center text-gray-700 text-[10px] font-mono tracking-[0.15em]">
          Non-partisan. Source-backed.
          No editorial position.
        </div>
      </div>
    </div>
  );
}
