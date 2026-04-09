"use client";

import { useState, useEffect, useCallback } from "react";
import { decodeShareId } from "../../../../lib/share-utils";

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

  return (
    <div className={
      "min-h-screen bg-[#030303] flex " +
      "flex-col items-center " +
      "justify-center px-4 py-12"
    }>
      {/* Card */}
      <div className="w-full max-w-[640px]">
        <div className={
          "bg-[#030303] border " +
          "border-gray-800/50 overflow-hidden"
        }>
          <div className="h-1 bg-red-500" />
          <div className="px-8 md:px-10 pt-8 pb-7">
            <div className={
              "text-[10px] uppercase " +
              "tracking-[0.3em] " +
              "text-gray-600 font-mono mb-4"
            }>
              GRACCHUS
            </div>
            <h1 className={
              "text-3xl md:text-[42px] " +
              "font-black text-white " +
              "tracking-tight leading-tight mb-3"
            }>
              {data.h}
            </h1>
            {data.s && (
              <div className={
                "text-lg md:text-xl " +
                "font-bold text-red-500 " +
                "uppercase tracking-wide mb-4"
              }>
                {data.s}
              </div>
            )}
            {data.t && (
              <div className={
                "text-sm text-gray-500 mb-4"
              }>
                {data.t}
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
                {" \u00B7 "}Published UK data
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

      {/* Actions */}
      <div className={
        "flex gap-3 mt-8 flex-wrap justify-center"
      }>
        <button
          onClick={handleCopy}
          className={
            "text-xs font-mono uppercase " +
            "tracking-[0.12em] px-5 py-2.5 " +
            "border border-gray-700 " +
            "text-gray-400 hover:text-white " +
            "hover:border-gray-500 " +
            "hover:bg-white/[0.02] " +
            "transition-all"
          }
        >
          {copied ? "\u2713 Copied" : "Copy Link"}
        </button>
        <a
          href="/"
          className={
            "text-xs font-mono uppercase " +
            "tracking-[0.12em] px-5 py-2.5 " +
            "border border-red-900/60 " +
            "text-red-400 hover:text-red-300 " +
            "hover:border-red-700 " +
            "hover:bg-red-500/[0.04] " +
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
