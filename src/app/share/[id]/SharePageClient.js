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
        <div className={
          "relative pl-5 mb-4"
        }>
          <div className={
            "absolute left-0 top-0 " +
            "w-[3px] h-full bg-red-500"
          } />
          <div className={
            "text-5xl md:text-[72px] " +
            "font-black text-white " +
            "tracking-tighter " +
            "leading-none"
          }>
            {fmtAmt(data.a)}
          </div>
          <div className={
            "text-3xl md:text-[42px] " +
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
        <div className={
          "mt-6 mb-4"
        }>
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
                "tracking-tight " +
                "leading-none"
              }>
                {fmtEquivNum(r.count)}
              </span>
              <span className={
                "text-[15px] " +
                "text-gray-500"
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

  return (
    <div className={
      "min-h-screen bg-[#030303] flex " +
      "flex-col items-center " +
      "justify-center px-4 py-12"
    }>
      {/* Card */}
      <div className={
        "w-full max-w-[640px]"
      }>
        <ShareCard
          data={data}
          resolved={resolved}
        />
      </div>

      {/* Actions */}
      <div className={
        "flex gap-3 mt-8 flex-wrap " +
        "justify-center"
      }>
        <button
          onClick={handleCopyLink}
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
          {copied
            ? "\u2713 Copied"
            : "Copy Link"}
        </button>
        <button
          onClick={handleDownload}
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
          Download PNG
        </button>
        <a
          href="/"
          className={
            "text-xs font-mono uppercase " +
            "tracking-[0.12em] px-5 py-2.5 " +
            "border border-gray-800 " +
            "text-gray-600 " +
            "hover:text-gray-400 " +
            "hover:border-gray-700 " +
            "transition-all"
          }
        >
          Explore the data {"\u2192"}
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
  );
}
