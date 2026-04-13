"use client";

import { useState, useEffect, useCallback } from "react";

// ---- Context generator ----
function generateChartContext(data) {
  const h = (data.h || "").toLowerCase();
  const lines = [];

  if (h.includes("nhs") || h.includes("health")) {
    lines.push(
      "NHS spending is one of the largest single commitments in the UK budget. " +
      "Small percentage shifts represent billions in real terms, affecting waiting " +
      "lists, staffing levels, and frontline care across every trust in the country."
    );
  } else if (h.includes("defence") || h.includes("military")) {
    lines.push(
      "UK defence spending has been under sustained pressure as NATO commitments, " +
      "equipment modernisation, and geopolitical instability compete for a share " +
      "of GDP that successive governments have struggled to grow."
    );
  } else if (h.includes("education") || h.includes("school")) {
    lines.push(
      "Education spending shapes outcomes for decades. Per-pupil funding, teacher " +
      "retention, and capital investment in school buildings are all sensitive to " +
      "the budget decisions captured in this data."
    );
  } else if (h.includes("transport") || h.includes("rail") || h.includes("road")) {
    lines.push(
      "Transport infrastructure is consistently one of the most over-budget, " +
      "over-deadline categories in UK public spending. Projects routinely exceed " +
      "initial estimates by 50\u2013200%, with knock-on effects across the economy."
    );
  } else if (h.includes("housing") || h.includes("homes")) {
    lines.push(
      "Housing delivery has fallen short of targets in every decade since the 1970s. " +
      "The gap between planned and delivered units continues to widen, driving up " +
      "costs and deepening regional inequality."
    );
  } else if (h.includes("debt") || h.includes("borrowing") || h.includes("deficit")) {
    lines.push(
      "UK public sector net debt now exceeds 100% of GDP for the first time since " +
      "the 1960s. Debt servicing costs compete directly with departmental spending, " +
      "constraining every other line in the budget."
    );
  } else if (h.includes("cancel") || h.includes("scrap")) {
    lines.push(
      "Cancelled projects represent sunk costs with zero public return. The money " +
      "spent before cancellation\u2014on planning, procurement, and early works\u2014is " +
      "rarely recovered and almost never accounted for transparently."
    );
  } else if (h.includes("cost") || h.includes("overrun") || h.includes("budget")) {
    lines.push(
      "Cost overruns are not accidents\u2014they follow predictable patterns. Optimism " +
      "bias in initial estimates, scope creep during delivery, and weak contract " +
      "enforcement combine to make overspend the norm, not the exception."
    );
  } else if (h.includes("delay") || h.includes("late") || h.includes("slow")) {
    lines.push(
      "Delivery delays compound costs and erode public trust. Every year a project " +
      "runs late, inflation, contract renegotiations, and opportunity costs push the " +
      "final bill further from the original estimate."
    );
  } else {
    lines.push(
      "This data is drawn from published UK government accounts, departmental " +
      "reports, and official statistics. The figures represent real public money\u2014" +
      "collected through taxation and allocated through parliamentary votes."
    );
  }

  lines.push(
    "Gracchus tracks this data so citizens can hold government to account " +
    "with facts, not opinions. Every figure is source-backed and verifiable."
  );

  return lines;
}

export default function ChartShareClient({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = id
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const json = atob(raw);
      const payload = JSON.parse(json);
      if (!payload.h) {
        setError(true);
        return;
      }
      setData(payload);
    } catch {
      setError(true);
    }
  }, [id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }, []);

  const handlePostX = useCallback(() => {
    if (!data) return;
    const text =
      data.h +
      (data.s ? "\n\n" + data.s : "") +
      "\n\nvia @GracchusHQ";
    const url = window.location.href;
    window.open(
      "https://x.com/intent/post?text=" +
        encodeURIComponent(text) +
        "&url=" +
        encodeURIComponent(url),
      "_blank"
    );
  }, [data]);

  if (error) {
    return (
      <div className={
        "min-h-screen bg-black flex " +
        "items-center justify-center"
      }>
        <div className="text-center">
          <div className={
            "text-[11px] uppercase " +
            "tracking-[0.25em] " +
            "text-gray-600 font-mono mb-4"
          }>
            Invalid Share Link
          </div>
          <div className={
            "text-gray-500 text-[15px] mb-6"
          }>
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

  if (!data) {
    return (
      <div className={
        "min-h-screen bg-black flex " +
        "items-center justify-center"
      }>
        <div className={
          "text-gray-600 text-xs " +
          "font-mono animate-pulse"
        }>
          Loading...
        </div>
      </div>
    );
  }

  const accent = data.a || "#ef4444";
  const context = generateChartContext(data);

  return (
    <div className="min-h-screen bg-[#030303]">
      {/* Hero card */}
      <div className={
        "flex flex-col items-center " +
        "px-4 pt-16 pb-8"
      }>
        <div className="w-full max-w-[640px]">
          <div className={
            "bg-[#030303] border " +
            "border-gray-800/50 overflow-hidden"
          }>
            <div
              className="h-1"
              style={{ backgroundColor: accent }}
            />
            <div className="px-8 md:px-10 pt-8 pb-7">
              <div className={
                "text-[10px] uppercase " +
                "tracking-[0.3em] " +
                "text-gray-600 font-mono mb-4"
              }>
                GRACCHUS
              </div>
              {data.t && (
                <div
                  className={
                    "text-[10px] uppercase " +
                    "tracking-[0.2em] " +
                    "font-mono mb-3"
                  }
                  style={{ color: accent }}
                >
                  {data.t}
                </div>
              )}
              <h1 className={
                "text-3xl md:text-[42px] " +
                "font-black text-white " +
                "tracking-tight " +
                "leading-tight mb-3"
              }>
                {data.h}
              </h1>
              {data.s && (
                <div
                  className={
                    "text-lg md:text-xl " +
                    "font-bold uppercase " +
                    "tracking-wide mb-4"
                  }
                  style={{ color: accent }}
                >
                  {data.s}
                </div>
              )}
              <div className={
                "mt-6 pt-4 flex items-center " +
                "justify-between " +
                "border-t border-gray-800/40"
              }>
                <div className={
                  "text-[9px] text-gray-700 " +
                  "font-mono tracking-wide"
                }>
                  Source-backed estimates
                  {" \u00b7 "}Published UK data
                </div>
                <div className={
                  "text-[10px] text-gray-600 " +
                  "font-mono font-bold " +
                  "tracking-[0.1em] uppercase"
                }>
                  gracchus.ai
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explainer */}
      <div className={
        "flex flex-col items-center px-4 pb-8"
      }>
        <div className="w-full max-w-[640px]">
          <div
            className={
              "border-l-2 pl-5 py-1 space-y-3"
            }
            style={{
              borderColor: accent + "40"
            }}
          >
            <div className={
              "text-[10px] uppercase " +
              "tracking-[0.25em] " +
              "text-gray-600 font-mono"
            }>
              Why this matters
            </div>
            {context.map((line, i) => (
              <p
                key={i}
                className={
                  "text-[15px] " +
                  "leading-relaxed " +
                  "text-gray-400"
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={
        "flex flex-col items-center " +
        "px-4 pb-16"
      }>
        <div className={
          "flex gap-3 flex-wrap " +
          "justify-center w-full " +
          "max-w-[640px]"
        }>
          <button
            onClick={handleCopy}
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.12em] px-5 py-3 " +
              "min-h-[44px] " +
              "border border-gray-700 " +
              "text-gray-400 " +
              "hover:text-white " +
              "hover:border-gray-500 " +
              "hover:bg-white/[0.02] " +
              "transition-all " +
              "flex-1 sm:flex-initial"
            }
          >
            {copied
              ? "\u2713 Copied"
              : "Copy Link"}
          </button>
          <button
            onClick={handlePostX}
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.12em] px-5 py-3 " +
              "min-h-[44px] " +
              "border border-gray-700 " +
              "text-gray-400 " +
              "hover:text-white " +
              "hover:border-gray-500 " +
              "hover:bg-white/[0.02] " +
              "transition-all " +
              "flex-1 sm:flex-initial"
            }
          >
            Post to X
          </button>
          <a
            href="/"
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.12em] px-5 py-3 " +
              "min-h-[44px] inline-flex " +
              "items-center justify-center " +
              "border hover:bg-white/[0.06] " +
              "transition-all " +
              "w-full sm:w-auto"
            }
            style={{
              borderColor: accent,
              color: accent
            }}
          >
            Explore the full dashboard
            {" \u2192"}
          </a>
        </div>

        <div className={
          "mt-10 text-center text-gray-700 " +
          "text-[10px] font-mono " +
          "tracking-[0.15em]"
        }>
          Non-partisan. Source-backed.
          No editorial position.
        </div>
      </div>
    </div>
  );
}
