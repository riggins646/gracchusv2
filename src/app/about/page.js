export const metadata = {
  title: "About — Gracchus",
  description:
    "Non-partisan, source-backed audit of UK government performance. Who we are and how to get in touch.",
};

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

        <div
          className={
            "text-[10px] uppercase tracking-[0.2em] " +
            "font-mono text-gray-600 mt-12 mb-2"
          }
        >
          Gracchus
        </div>
        <h1
          className={
            "text-3xl md:text-4xl font-serif " +
            "font-medium text-white leading-tight " +
            "tracking-[-0.01em] mb-8"
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
