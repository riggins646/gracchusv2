export const metadata = {
  title: "About — Gracchus",
  description:
    "Non-partisan, source-backed audit of UK government spending. Who we are and how to get in touch.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-xl mx-auto px-6 py-24">
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

        <div className="space-y-6 text-[15px] leading-relaxed text-gray-400">
          <p>
            Gracchus is a non-partisan, source-backed audit of UK government
            spending. We track public projects, procurement, political
            donations, departmental budgets and economic indicators — all in
            one place, all verifiable.
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
            researchers, taxpayers — to see where the money goes and whether
            it is being spent well.
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
