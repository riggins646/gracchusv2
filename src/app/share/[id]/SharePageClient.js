"use client";

import {
  useState, useEffect, useCallback
} from "react";
import {
  decodeShareId,
  resolveItems,
  fmtEquivNum,
  fmtAmt,
  buildContextLine,
  renderCardToCanvas
} from "../../../lib/share-utils";

// ---- Context generator ----
function generateWasteContext(data, resolved) {
  const amt = data.a;
  const lines = [];

  // Scale-based opening
  if (amt >= 10000) {
    lines.push(
      "This figure is measured in tens of billions\u2014a scale that is " +
      "difficult to comprehend without comparison. It exceeds the entire " +
      "annual budget of most government departments and represents a " +
      "significant fraction of total public spending."
    );
  } else if (amt >= 1000) {
    lines.push(
      "At over \u00a31 billion, this is not a rounding error. It represents " +
      "real infrastructure that was never built, services that were never " +
      "delivered, and opportunity costs that compound year after year."
    );
  } else if (amt >= 100) {
    lines.push(
      "Hundreds of millions of pounds of public money\u2014enough to " +
      "transform outcomes in education, healthcare, or housing\u2014" +
      "committed to a project that failed to deliver its promised value."
    );
  } else {
    lines.push(
      "Every million pounds of public money represents real choices: " +
      "nurses hired or not hired, roads repaired or left to deteriorate, " +
      "schools built or delayed another year."
    );
  }

  // Type-based context
  const t = (data.t || "").toLowerCase();
  if (t === "cancelled") {
    lines.push(
      "When a project is cancelled, the money already spent doesn\u2019t come back. " +
      "Planning costs, procurement fees, early-stage contracts, and staff time " +
      "are all sunk. The public bears the full cost with none of the intended benefit."
    );
  } else if (t === "wasted") {
    lines.push(
      "Waste in public spending takes many forms: cost overruns, failed IT systems, " +
      "abandoned contracts, and duplicate procurement. What unites them is that " +
      "taxpayers paid for something they did not receive."
    );
  }

  // Equivalence hook
  if (resolved.length > 0) {
    lines.push(
      "The equivalences above are not rhetorical\u2014they are calculated " +
      "from published unit costs. They show what this money could have " +
      "delivered if it had been spent effectively."
    );
  }

  return lines;
}

// ============================================
// EDITORIAL CARD (HTML preview)
// ============================================
function ShareCard({ data, resolved }) {
  const ctxLine = buildContextLine(data);
  return (
    <div className={
      "bg-[#030303] border " +
      "border-gray-800/50 overflow-hidden"
    }>
      <div className="h-1 bg-red-500" />
      <div className="px-8 md:px-10 pt-8 pb-7">
        <div className={
          "text-[10px] uppercase " +
          "tracking-[0.3em] " +
          "text-gray-600 font-mono mb-6"
        }>
          GRACCHUS
        </div>
        <div className="relative pl-5 mb-4">
          <div className={
            "absolute left-0 top-0 " +
            "w-[3px] h-full bg-red-500"
          } />
          <div className={
            "text-3xl sm:text-5xl " +
            "md:text-[72px] " +
            "font-black text-white " +
            "tracking-tighter leading-none " +
            "break-words"
          }>
            {fmtAmt(data.a)}
          </div>
          <div className={
            "text-2xl sm:text-3xl " +
            "md:text-[42px] " +
            "font-black text-red-500 " +
            "tracking-tight " +
            "leading-tight mt-0.5"
          }>
            WASTED.
          </div>
        </div>
        <div className={
          "text-lg md:text-xl " +
          "font-bold text-gray-300"
        }>
          {data.n}
        </div>
        {ctxLine && (
          <div className={
            "text-[11px] font-mono " +
            "text-gray-600 " +
            "tracking-[0.12em] " +
            "uppercase mt-1"
          }>
            {ctxLine}
          </div>
        )}
        <div className="mt-6 mb-4">
          <div className={
            "text-[10px] uppercase " +
            "tracking-[0.25em] " +
            "text-gray-600 font-mono"
          }>
            Equivalent to:
          </div>
        </div>
        <div className="space-y-2.5">
          {resolved.map((r) => (
            <div
              key={r.item.id}
              className={
                "flex items-baseline gap-3"
              }
            >
              <span className={
                "text-2xl md:text-[30px] " +
                "font-black text-white " +
                "tracking-tight leading-none"
              }>
                {fmtEquivNum(r.count)}
              </span>
              <span className={
                "text-[15px] text-gray-500"
              }>
                {r.item.unitLabel}
              </span>
            </div>
          ))}
        </div>
        <div className={
          "mt-7 pt-4 flex items-center " +
          "justify-between"
        }>
          <div className={
            "text-[9px] text-gray-700 " +
            "font-mono tracking-wide"
          }>
            Source-backed estimates from
            published UK data.
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
  );
}

// ============================================
// MAIN PAGE (Client)
// ============================================
export default function SharePageClient({ id }) {
  const [data, setData] = useState(null);
  const [resolved, setResolved] = useState([]);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const decoded = decodeShareId(id);
    if (!decoded) {
      setError(true);
      return;
    }
    setData(decoded);
    setResolved(
      resolveItems(decoded.a, decoded.i)
    );
  }, [id]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(
      window.location.href
    ).then(() => {
      setCopied(true);
      setTimeout(
        () => setCopied(false), 2000
      );
    });
  }, []);

  const handleDownload = useCallback(() => {
    if (!data || resolved.length === 0) return;
    const dataUrl = renderCardToCanvas(
      data, resolved
    );
    const a = document.createElement("a");
    a.download = "gracchus-"
      + (data.n || "card")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 30)
      + ".png";
    a.href = dataUrl;
    a.click();
  }, [data, resolved]);

  const handlePostX = useCallback(() => {
    if (!data) return;
    const amt = data.a >= 1000
      ? "\u00a3" + (data.a / 1000).toFixed(1) + "bn"
      : "\u00a3" + data.a.toLocaleString("en-GB") + "m";
    const text =
      amt + " wasted on " + data.n +
      "\n\nSee what it could have paid for instead." +
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
            This link may be expired
            or malformed.
          </div>
          <a
            href="/"
            className={
              "text-xs font-mono " +
              "uppercase " +
              "tracking-[0.15em] " +
              "px-5 py-2.5 border " +
              "border-gray-700 " +
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

  const context = generateWasteContext(
    data, resolved
  );

  return (
    <div className="min-h-screen bg-[#030303]">
      {/* Hero card */}
      <div className={
        "flex flex-col items-center " +
        "px-4 pt-16 pb-8"
      }>
        <div className="w-full max-w-[640px]">
          <ShareCard
            data={data}
            resolved={resolved}
          />
        </div>
      </div>

      {/* Explainer */}
      <div className={
        "flex flex-col items-center px-4 pb-8"
      }>
        <div className="w-full max-w-[640px]">
          <div className={
            "border-l-2 border-red-500/25 " +
            "pl-5 py-1 space-y-3"
          }>
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
            onClick={handleCopyLink}
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
              "flex-1 sm:flex-initial " +
              "min-w-[120px]"
            }
          >
            {copied
              ? "\u2713 Copied"
              : "Copy Link"}
          </button>
          <button
            onClick={handleDownload}
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
              "flex-1 sm:flex-initial " +
              "min-w-[120px]"
            }
          >
            Download PNG
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
              "flex-1 sm:flex-initial " +
              "min-w-[120px]"
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
              "border border-red-900/60 " +
              "text-red-400 " +
              "hover:text-red-300 " +
              "hover:border-red-700 " +
              "hover:bg-red-500/[0.04] " +
              "transition-all " +
              "w-full sm:w-auto"
            }
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
