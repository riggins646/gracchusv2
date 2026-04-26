export const metadata = {
  title: "About — Gracchus",
  description:
    "Non-partisan, source-backed audit of UK government performance. Who we are and how to get in touch.",
};

/* ─────────────────────────────────────────────────────────
   UX audit #9 (2026-04-26): named-masthead pre-stage.

   To put a named editor on the About page, fill in the two
   strings below. The Editorial section will render
   automatically. Leave both blank and the section is
   suppressed (current state).

   EDITOR_NAME      — the name to appear on the masthead.
                      e.g. "Tim Riggins"
   EDITOR_CREDENTIAL — one short line about who you are.
                      e.g. "Independent researcher, formerly at the FT"
                      e.g. "Investigative journalist"
                      e.g. "Open-data developer, ex-Cabinet Office"
                      Keep it ≤ 80 chars — single-sentence.
   EDITOR_BIO        — optional second sentence for context.
                      Leave "" to omit. ≤ 140 chars.
   ─────────────────────────────────────────────────────── */
const EDITOR_NAME = "";
const EDITOR_CREDENTIAL = "";
const EDITOR_BIO = "";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      {/* Audit rec #94 — max-w-prose (65ch) for consistent
          editorial reading width across Gracchus. */}
      <div className="max-w-prose mx-auto px-6 py-24">
        {/* Logo / title */}
        <a
          href="/"
          className={
            "text-[11px] uppercase tracking-[0.3em] " +
            "font-mono text-gray-600 " +
            "hover:text-gray-400 transition-colors"
          }
        >
          &larr; Gracchus
        </a>

        <h1
          className={
            "text-2xl font-black text-white " +
            "tracking-tight mt-12 mb-8"
          }
        >
          About
        </h1>

        <div className="space-y-6 text-[17px] leading-relaxed text-gray-400">
          <p>
            Gracchus is a non-partisan, source-backed audit of UK government
            performance. We track public spending, project delivery,
            procurement, political donations, departmental budgets, cost of
            living and economic indicators — all in one place, all verifiable.
          </p>

          <p>
            Every figure on this site is drawn from official public sources:
            the National Audit Office, GOV.UK, the ONS, OECD, DWP, Cabinet
            Office, IPA and parliamentary registers. Nothing is editorialised
            without attribution. Where we editorially curate (such as the Red
            Flags section), the underlying data is always linked.
          </p>

          <p>
            The goal is simple: make it easy for anyone — journalists,
            researchers, taxpayers — to see how their government is performing
            and whether public money is being spent well.
          </p>
        </div>

        {/* Editorial — UX audit #9 (2026-04-26).
            Renders only when EDITOR_NAME is filled in at the top of
            this file. With it: the named-author trust signal the
            audit flagged as the highest-leverage move. Without it:
            section is silently suppressed, About page reads exactly
            as it does today. */}
        {EDITOR_NAME && (
          <div className="mt-16 pt-8 border-t border-gray-800/60">
            <div
              className={
                "text-[11px] uppercase tracking-[0.25em] " +
                "font-mono text-gray-600 mb-4"
              }
            >
              Editorial
            </div>
            <p className="text-[17px] text-gray-300 leading-relaxed mb-2">
              <span className="text-white font-semibold">{EDITOR_NAME}</span>
              {EDITOR_CREDENTIAL && (
                <>
                  <span className="text-gray-500"> &middot; </span>
                  <span className="text-gray-400">{EDITOR_CREDENTIAL}</span>
                </>
              )}
            </p>
            {EDITOR_BIO && (
              <p className="text-[15px] text-gray-500 leading-relaxed">
                {EDITOR_BIO}
              </p>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="mt-16 pt-8 border-t border-gray-800/60">
          <div
            className={
              "text-[11px] uppercase tracking-[0.25em] " +
              "font-mono text-gray-600 mb-4"
            }
          >
            Contact
          </div>
          <div className="flex flex-col gap-3">
            <a
              href="mailto:contact@gracchus.ai"
              className={
                "text-[15px] text-gray-300 " +
                "hover:text-white transition-colors " +
                "underline underline-offset-4 " +
                "decoration-gray-700 hover:decoration-gray-400"
              }
            >
              contact@gracchus.ai
            </a>
            <a
              href="https://x.com/GracchusHQ"
              target="_blank"
              rel="noopener noreferrer"
              className={
                "flex items-center gap-2 text-[15px] text-gray-300 " +
                "hover:text-white transition-colors " +
                "underline underline-offset-4 " +
                "decoration-gray-700 hover:decoration-gray-400"
              }
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @GracchusHQ
            </a>
          </div>
        </div>

        {/* How Gracchus works — click-through to standards + corrections */}
        <div className="mt-16 pt-8 border-t border-gray-800/60">
          <div
            className={
              "text-[11px] uppercase tracking-[0.25em] " +
              "font-mono text-gray-600 mb-5"
            }
          >
            How Gracchus works
          </div>
          <div className="space-y-5">
            <a
              href="/standards"
              className={
                "block group"
              }
            >
              <div
                className={
                  "text-[15px] text-gray-300 " +
                  "group-hover:text-white transition-colors " +
                  "underline underline-offset-4 " +
                  "decoration-gray-700 group-hover:decoration-gray-400"
                }
              >
                Editorial standards &rarr;
              </div>
              <div className="text-[13px] text-gray-500 mt-1 leading-relaxed no-underline">
                How sources are graded. What &ldquo;undisclosed&rdquo; and &ldquo;adjacent&rdquo; mean. Why live proceedings get reported cautiously.
              </div>
            </a>
            <a
              href="/corrections"
              className={
                "block group"
              }
            >
              <div
                className={
                  "text-[15px] text-gray-300 " +
                  "group-hover:text-white transition-colors " +
                  "underline underline-offset-4 " +
                  "decoration-gray-700 group-hover:decoration-gray-400"
                }
              >
                Corrections &rarr;
              </div>
              <div className="text-[13px] text-gray-500 mt-1 leading-relaxed no-underline">
                Found a mistake? Here&rsquo;s how the process works.
              </div>
            </a>
          </div>
        </div>

        {/* Tiny footer */}
        <div
          className={
            "mt-24 text-[10px] font-mono " +
            "text-gray-700 tracking-[0.1em]"
          }
        >
          Non-partisan. Source-backed.
        </div>
      </div>
    </div>
  );
}
