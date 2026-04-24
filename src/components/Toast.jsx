"use client";

/**
 * Toast — transient confirmation for silent UI actions.
 *
 * Shipped for audit rec #95: citation-copy on mobile used to be
 * silent (the "©" → "✓" flip in CiteChip is invisible when the
 * user has already tapped away), leaving the reader unsure whether
 * the clipboard actually holds the citation. Toast is the single
 * global confirmation surface.
 *
 * aria-live="polite" so screen readers announce on copy, but
 * non-urgently. 2.4s auto-dismiss. Z-index above Money Map drawer
 * (which sits at z-50 in MoneyMapStyles).
 */

import { useEffect } from "react";

export default function Toast({ message, visible, onDismiss }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 2400);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] " +
        "px-4 py-3 rounded-lg bg-gray-900 text-white " +
        "text-sm shadow-2xl border border-amber-500/30 " +
        "transition-all duration-200 " +
        (visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 pointer-events-none")
      }
    >
      {message}
    </div>
  );
}
