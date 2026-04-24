"use client";

/**
 * StickySubscribe — non-modal sticky CTA for the weekly briefing.
 *
 * Audit rec #97. Appears only on project dossier drawers (not
 * globally) once the reader is 60s in OR past 50% of page scroll,
 * whichever fires first. localStorage-remembered dismissal
 * (gracchus_sticky_sub_dismissed_v1) so it never nags the same
 * reader twice.
 *
 * Posts to /api/subscribe (the existing Blob-backed endpoint the
 * site already uses) and relies on the origin-check middleware
 * for CSRF. No auth, no cookies, no tracking — just an email and a
 * timestamp on the server.
 *
 * Passed an onSubmit override it will defer to that instead (kept
 * for testability). Default path is fetch('/api/subscribe').
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "gracchus_sticky_sub_dismissed_v1";

async function defaultSubmit(email) {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Subscribe failed");
  }
  return res.json();
}

export default function StickySubscribe({ onSubmit }) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    const t = setTimeout(() => {
      setVisible(true);
    }, 60_000);
    const onScroll = () => {
      const scrolled = window.scrollY;
      const total =
        document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && scrolled / total > 0.5) setVisible(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const handler = onSubmit || defaultSubmit;
      await handler(email);
      setSubmitted(true);
      setTimeout(dismiss, 2500);
    } catch (err) {
      setError(err?.message || "Subscribe failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;
  return (
    <div
      className={
        "fixed bottom-4 left-4 right-4 " +
        "md:left-auto md:right-6 md:w-[380px] " +
        "z-[90] rounded-xl border border-amber-500/40 " +
        "bg-gray-900/95 backdrop-blur p-4 shadow-2xl"
      }
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className={
          "absolute top-2 right-2 w-11 h-11 grid place-items-center " +
          "text-gray-400 hover:text-white"
        }
      >
        <X size={16} />
      </button>
      {submitted ? (
        <p className="text-sm text-amber-300">
          Thanks &mdash; check your inbox.
        </p>
      ) : (
        <>
          <p className="text-base font-semibold text-white mb-1">
            Weekly briefing
          </p>
          <p className="text-sm text-gray-400 mb-3 leading-snug">
            One email a week. New investigations. No ads.
            Unsubscribe anytime.
          </p>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={
                "flex-1 px-3 py-2.5 rounded-md bg-black text-base " +
                "text-white border border-gray-700 " +
                "focus:border-amber-500 focus:outline-none"
              }
            />
            <button
              type="submit"
              disabled={submitting}
              className={
                "px-4 py-2.5 rounded-md bg-amber-500 text-black " +
                "text-sm font-semibold hover:bg-amber-400 " +
                "disabled:opacity-50 min-h-[44px]"
              }
            >
              {submitting ? "\u2026" : "Subscribe"}
            </button>
          </form>
          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
