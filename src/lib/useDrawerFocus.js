"use client";

/* ============================================================================
 * useDrawerFocus — focus-trap + focus-restore hook for slide-in drawers.
 *
 * Mount-time: stores document.activeElement (the trigger), then moves
 *   focus into the drawer (first focusable element, else the container).
 * While open: Tab cycles inside the drawer only; Esc calls onClose.
 * Unmount: restores focus to the trigger so keyboard users aren't
 *   dumped at the top of the page.
 *
 * Usage:
 *   const ref = useDrawerFocus(onClose);
 *   return <div ref={ref} tabIndex={-1} ...>
 *
 * Why: ProjectDetail / SupplierDetail / BuyerDetail (in Dashboard.jsx) and
 * the Money Map drawer are all modal-ish slide-ins; without a trap,
 * keyboard users Tab past the backdrop into the page behind, and Esc
 * doesn't close them. Shared here so the a11y behaviour is identical
 * across the app — extracted 2026-04-21.
 * ========================================================================= */

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useDrawerFocus(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const prevActive = typeof document !== "undefined" ? document.activeElement : null;
    const node = ref.current;
    if (!node) return undefined;

    // Focus first focusable, else the container itself (tabIndex=-1).
    const firstFocusable = node.querySelector(FOCUSABLE_SELECTOR);
    (firstFocusable || node).focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      // Restore focus to the element that opened the drawer (if still in DOM).
      if (prevActive && typeof prevActive.focus === "function" && document.contains(prevActive)) {
        try { prevActive.focus(); } catch { /* no-op */ }
      }
    };
  }, [onClose]);
  return ref;
}
