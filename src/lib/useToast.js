"use client";

/**
 * useToast — global toast context for citation-copy and share-link
 * confirmations (audit rec #95, #96).
 *
 * Usage:
 *   // at the app root (Dashboard.jsx App()):
 *   <ToastProvider>
 *     ...app...
 *     <ToastBoundary />   // renders the single Toast node
 *   </ToastProvider>
 *
 *   // any descendant:
 *   const { show } = useToast();
 *   show("Citation copied");
 *
 * Fallback when no provider is mounted (e.g. /share/[id] pages): the
 * hook returns a no-op show() so CiteChip can be reused on SSR-only
 * share pages without wrapping them.
 *
 * Haptic: 10ms navigator.vibrate on show() for iOS/Android feedback.
 * Silent no-op on desktop / browsers without the API.
 */

import { createContext, useContext, useState, useCallback } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ visible: false, message: "" });

  const show = useCallback((message) => {
    setToast({ visible: true, message });
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const dismiss = useCallback(
    () => setToast((t) => ({ ...t, visible: false })),
    []
  );

  return (
    <ToastCtx.Provider value={{ show, toast, dismiss }}>
      {children}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return {
      show: () => {},
      toast: { visible: false, message: "" },
      dismiss: () => {},
    };
  }
  return ctx;
}
