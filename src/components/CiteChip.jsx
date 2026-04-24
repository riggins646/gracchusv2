"use client";

import { useState } from "react";
import { useToast } from "../lib/useToast";

/**
 * CiteChip — tiny hover-revealed citation copy affordance.
 *
 * Wrap any figure (£ value, %, count) like this:
 *
 *   <span className="group inline-flex items-baseline gap-1">
 *     <span className="font-mono">{fmt(value)}</span>
 *     <CiteChip citation="Project X — latest budget £15.8bn, projects.json, Gracchus 2026-04-21" />
 *   </span>
 *
 * The chip is invisible until the parent `.group` is hovered, at which
 * point a subtle "©" superscript appears. Clicking it copies the
 * formatted citation string to the clipboard and briefly confirms with
 * a check mark.
 *
 * Keep the citation string terse: {source name} — {finding} ({file,
 * date}). The chip is a trust artefact, not a footnote dump.
 *
 * Nested-button gotcha: CiteChip renders a <button>. If the parent is
 * also a <button>, nesting is invalid HTML. Use role="button" +
 * tabIndex={0} + onKeyDown on the outer element instead. See the
 * entry-grid cards in Dashboard.jsx for the pattern.
 */
export default function CiteChip({ citation, label = "copy citation" }) {
  const [copied, setCopied] = useState(false);
  // Audit rec #95 — wire copy through the global toast so mobile
  // users get an aria-live confirmation + a 10ms haptic. Hook is
  // safe to call when no provider is mounted (useToast returns a
  // no-op show()).
  const { show } = useToast();
  if (!citation) return null;
  const onCopy = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const writer = navigator.clipboard?.writeText(citation);
      // writeText returns a Promise — show the toast on resolve so
      // the confirmation doesn't fire if the clipboard API is
      // blocked (e.g. insecure origin). Fall back to synchronous
      // path for older browsers that may not return a thenable.
      if (writer && typeof writer.then === "function") {
        writer.then(() => show("Citation copied")).catch(() => {});
      } else {
        show("Citation copied");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title={label}
      aria-label={label}
      className={
        "ml-1 text-[10px] font-mono align-super " +
        "text-gray-600 hover:text-ember-400 " +
        "opacity-0 group-hover:opacity-100 " +
        "focus:opacity-100 transition-opacity " +
        "leading-none select-none"
      }
    >
      {copied ? "✓" : "©"}
    </button>
  );
}
