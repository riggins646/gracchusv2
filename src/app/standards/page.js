export const metadata = {
  title: "Editorial standards — Gracchus",
  description:
    "How sources are graded. What 'undisclosed' and 'adjacent' mean. Why live proceedings get reported cautiously.",
};

export default function StandardsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-prose mx-auto px-6 py-24">
        {/* Back link */}
        <a
          href="/about"
          className={
            "text-[11px] uppercase tracking-[0.3em] " +
            "font-mono text-gray-600 " +
            "hover:text-gray-400 transition-colors"
          }
        >
          &larr; About Gracchus
        </a>

        <h1
          className={
            "text-2xl font-black text-white " +
            "tracking-tight mt-12 mb-8"
          }
        >
          Editorial standards
        </h1>

        <div className="space-y-6 text-[17px] leading-relaxed text-gray-400">
          <p>
            Gracchus is a public-interest data tracker. Every figure, every
            finding, every connection on the site points back to a source —
            usually a government record, a Parliamentary document, a National
            Audit Office report, a court ruling, or credible investigative
            journalism. If a claim does not have a source behind it, it does
            not belong here.
          </p>
        </div>

        {/* How sources get graded */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            How sources get graded
          </h2>
          <div className="space-y-5 text-[17px] leading-relaxed text-gray-400">
            <p>
              Sources come in three tiers. They show up as coloured chips next
              to every claim — click the chip to open the source document.
            </p>
            <p>
              <span className="text-emerald-400 font-medium">Primary sources</span>{" "}
              are documents published by Parliament, the government, the courts
              or official regulators. ACOBA rulings, Committee on Standards
              reports, High Court judgments, National Audit Office
              investigations, Hansard. These carry the strongest evidentiary
              weight — regulators and judges have put their names to them, and
              quoting them is protected in law.
            </p>
            <p>
              <span className="text-gray-200 font-medium">News sources</span>{" "}
              are reported pieces from established outlets — Guardian, FT, BBC,
              Reuters, the Bureau of Investigative Journalism, Private Eye,
              Byline Times. Where a fact appears in reporting but has not yet
              been confirmed by a primary source, it is flagged as reported
              rather than established.
            </p>
            <p>
              <span className="text-purple-300 font-medium">Analysis sources</span>{" "}
              come from transparency NGOs and research institutes —
              Transparency International UK, the Institute for Government,
              Spotlight on Corruption, openDemocracy. Useful for context and
              pattern-spotting, treated as argued-from-evidence rather than
              adjudicated fact.
            </p>
            <p>
              Every claim should carry at least one chip. The heavier the
              claim, the more sources behind it.
            </p>
          </div>
        </div>

        {/* Undisclosed */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            What &ldquo;Undisclosed&rdquo; means
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              Plenty of government contract figures are not public. Rather than
              guessing, Gracchus marks those as &ldquo;Undisclosed&rdquo; —
              dashed strokes on Money Map bubbles, blank cells in tables. If a
              number is there, it is a real published number. If the field is
              empty, the record exists but the figure has not been released.
            </p>
          </div>
        </div>

        {/* Adjacent */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            What &ldquo;Adjacent&rdquo; means
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              Some connections point to firms or departments that are not in
              Gracchus&rsquo;s core tracked set but sit one step away — Greensill
              Capital lobbying the Treasury for COVID loan access, for example.
              Those are flagged as &ldquo;adjacent&rdquo; rather than presented
              as direct. The connection is real; the relationship is just a
              little arms-length.
            </p>
          </div>
        </div>

        {/* Live proceedings */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Live proceedings
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              When a case is still being investigated or litigated, only
              findings already in the public record get reported. The card
              shows a &ldquo;Live proceedings&rdquo; banner. In practice that
              means no speculation, no inference of guilt, nothing beyond what
              the regulator or court has said in their own words. As
              proceedings move on, the record updates.
            </p>
          </div>
        </div>

        {/* Right of reply */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Right of reply
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              Anyone named on the site can respond. Email{" "}
              <a
                href="mailto:contact@gracchus.ai?subject=Right of reply"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>{" "}
              with &ldquo;Right of reply&rdquo; plus the name or topic in the
              subject line. Responses are read and considered. Where
              appropriate, the record is updated or a statement added alongside
              the original claim. Disagreements that cannot be resolved get
              recorded transparently so readers see both sides.
            </p>
          </div>
        </div>

        {/* Contact footer */}
        <div className="mt-16 pt-8 border-t border-gray-800/60">
          <div
            className={
              "text-[11px] uppercase tracking-[0.25em] " +
              "font-mono text-gray-600 mb-4"
            }
          >
            Getting in touch
          </div>
          <div className="space-y-2 text-[15px]">
            <p className="text-gray-400">
              Corrections:{" "}
              <a
                href="mailto:contact@gracchus.ai?subject=Correction"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>
            </p>
            <p className="text-gray-400">
              Editorial queries:{" "}
              <a
                href="mailto:contact@gracchus.ai"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>
            </p>
            <p className="text-gray-400">
              Right of reply:{" "}
              <a
                href="mailto:contact@gracchus.ai?subject=Right of reply"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>{" "}
              with the name or topic in the subject line
            </p>
          </div>
        </div>

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
