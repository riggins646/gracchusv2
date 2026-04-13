"use client";

import { useState, useEffect, useCallback } from "react";

const TREND_DATA = {
  approval: {
    headline:
      "Planning approval now takes 3x longer",
    subline:
      "Average time to approve major projects " +
      "has tripled since 2010",
    accent: "#f59e0b",
    label: "Planning Approvals",
    view: "projects.planning",
    context: [
      "The UK planning system was designed for a " +
      "different era. Major infrastructure projects " +
      "now spend more time in planning than in " +
      "construction\u2014a reversal that would have " +
      "been unthinkable a generation ago.",
      "Every year of delay adds cost: inflation " +
      "erodes budgets, supply chains move on, and " +
      "the economic benefits the project was " +
      "supposed to deliver are deferred further " +
      "into the future.",
      "Countries that have streamlined planning " +
      "\u2014Denmark, the Netherlands, Singapore\u2014" +
      "deliver equivalent projects in a fraction " +
      "of the time. The UK\u2019s system is not " +
      "more thorough; it is more fragmented."
    ],
    stats: [
      { value: "3x", label: "Longer to approve" },
      { value: "7.2 yrs",
        label: "Avg. approval time" },
      { value: "\u00a3100bn+",
        label: "Stuck in planning" }
    ]
  },
  delays: {
    headline:
      "Projects delivered later and further " +
      "over budget",
    subline:
      "Average delays and cost overruns have " +
      "worsened every decade",
    accent: "#ef4444",
    label: "Delivery Delays",
    view: "projects.delays",
    context: [
      "UK infrastructure delivery has deteriorated " +
      "across every measurable dimension. Projects " +
      "take longer, cost more, and deliver less " +
      "than their original business cases promised.",
      "This is not random bad luck\u2014it follows " +
      "structural patterns. Optimism bias in " +
      "initial estimates, weak contract enforcement, " +
      "and political reluctance to cancel failing " +
      "projects create a system that rewards " +
      "under-bidding and tolerates over-spending.",
      "The result is a compounding credibility gap: " +
      "each decade of overruns makes the next " +
      "generation of projects harder to fund, " +
      "harder to approve, and harder to trust."
    ],
    stats: [
      { value: "60%",
        label: "Avg. cost overrun" },
      { value: "4.1 yrs",
        label: "Avg. delay" },
      { value: "\u00a345bn",
        label: "Total overruns (decade)" }
    ]
  }
};

export default function TrendShareClient({
  trendType
}) {
  const [copied, setCopied] = useState(false);
  const trend = TREND_DATA[trendType];

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(
          () => setCopied(false), 2000
        );
      });
  }, []);

  const handlePostX = useCallback(() => {
    if (!trend) return;
    const text =
      trend.headline +
      "\n\n" + trend.subline +
      "\n\nvia @GracchusHQ";
    const url = window.location.href;
    window.open(
      "https://x.com/intent/post?text=" +
        encodeURIComponent(text) +
        "&url=" +
        encodeURIComponent(url),
      "_blank"
    );
  }, [trend]);

  if (!trend) {
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
            This trend could not be found.
          </div>
          <a
            href="/"
            className={
              "text-xs font-mono uppercase " +
              "tracking-[0.15em] px-5 py-2.5 " +
              "border border-gray-700 " +
              "text-gray-400 " +
              "hover:text-white " +
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
              style={{
                backgroundColor: trend.accent
              }}
            />
            <div className={
              "px-5 sm:px-8 md:px-10 " +
              "pt-6 sm:pt-8 pb-6 sm:pb-7"
            }>
              <div className={
                "text-[10px] uppercase " +
                "tracking-[0.3em] " +
                "text-gray-600 font-mono mb-4"
              }>
                GRACCHUS
              </div>
              <div
                className={
                  "text-[10px] uppercase " +
                  "tracking-[0.2em] " +
                  "font-mono mb-3"
                }
                style={{ color: trend.accent }}
              >
                {trend.label}
              </div>
              <h1 className={
                "text-3xl md:text-[42px] " +
                "font-black text-white " +
                "tracking-tight " +
                "leading-tight mb-3"
              }>
                {trend.headline}
              </h1>
              <div
                className={
                  "text-lg md:text-xl " +
                  "font-bold uppercase " +
                  "tracking-wide mb-6"
                }
                style={{ color: trend.accent }}
              >
                {trend.subline}
              </div>

              {/* Key stats */}
              <div className={
                "grid grid-cols-1 " +
                "sm:grid-cols-3 gap-4 " +
                "py-4 border-t " +
                "border-gray-800/40"
              }>
                {trend.stats.map((s, i) => (
                  <div key={i} className={
                    "flex sm:block items-baseline " +
                    "sm:items-start gap-2"
                  }>
                    <div
                      className={
                        "text-xl sm:text-2xl " +
                        "md:text-3xl " +
                        "font-black tracking-tight"
                      }
                      style={{
                        color: trend.accent
                      }}
                    >
                      {s.value}
                    </div>
                    <div className={
                      "text-[10px] " +
                      "text-gray-600 " +
                      "font-mono uppercase " +
                      "tracking-[0.1em] mt-1"
                    }>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className={
                "mt-4 pt-4 flex items-center " +
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
              "border-l-2 pl-5 " +
              "py-1 space-y-3"
            }
            style={{
              borderColor: trend.accent + "40"
            }}
          >
            <div className={
              "text-[10px] uppercase " +
              "tracking-[0.25em] " +
              "text-gray-600 font-mono"
            }>
              Why this matters
            </div>
            {trend.context.map((line, i) => (
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
            href={
              "/?view=" + trend.view
            }
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
              borderColor: trend.accent,
              color: trend.accent
            }}
          >
            See the full trend data
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
