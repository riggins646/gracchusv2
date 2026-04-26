export const metadata = {
  title: "Corrections — Gracchus",
  description:
    "Found a mistake? Here's how the correction process works.",
};

export default function CorrectionsPage() {
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

        <div
          className={
            "text-[10px] uppercase tracking-[0.2em] " +
            "font-mono text-gray-600 mt-12 mb-2"
          }
        >
          Gracchus &middot; Corrections
        </div>
        <h1
          className={
            "text-3xl md:text-4xl font-serif " +
            "font-medium text-white leading-tight " +
            "tracking-[-0.01em] mb-8"
          }
        >
          Corrections
        </h1>

        <div className="space-y-6 text-[17px] leading-relaxed text-gray-400">
          <p>
            Mistakes happen. Sources change. New information surfaces.
            Corrections are a normal part of running a data tracker — what
            matters is catching them quickly and fixing them in the open.
          </p>
        </div>

        {/* Spotted something wrong */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Spotted something wrong?
          </h2>
          <div className="space-y-5 text-[17px] leading-relaxed text-gray-400">
            <p>
              Email{" "}
              <a
                href="mailto:contact@gracchus.ai?subject=Correction"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>{" "}
              with:
            </p>
            <ul className="space-y-2 pl-5 list-disc marker:text-gray-600">
              <li>Where the error is — a page, a section or a direct link works best</li>
              <li>What the current text or figure says</li>
              <li>What it should say instead</li>
              <li>Any source for the corrected version (optional, but it speeds things up)</li>
            </ul>
            <p>
              Every correction request gets a reply within three working days.
              Most are reviewed and resolved within two weeks. Some take
              longer when the underlying data needs re-sourcing from primary
              records.
            </p>
          </div>
        </div>

        {/* What happens next */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            What happens next
          </h2>
          <div className="space-y-5 text-[17px] leading-relaxed text-gray-400">
            <p>
              Three possible outcomes:
            </p>
            <p>
              <span className="text-white font-medium">The claim is wrong.</span>{" "}
              The page gets updated. A dated correction note appears on the
              page so readers can see what changed and when. Significant
              corrections also show up in the Recent Additions feed tagged as
              a correction.
            </p>
            <p>
              <span className="text-white font-medium">The claim is right but could be clearer.</span>{" "}
              The wording gets tightened. No correction note if the meaning has
              not changed — just a better edit.
            </p>
            <p>
              <span className="text-white font-medium">The claim stands.</span>{" "}
              An explanation goes back to whoever raised it, with the sources
              behind the claim. If they still disagree, their statement can be
              added alongside the original — both sides visible.
            </p>
          </div>
        </div>

        {/* What isn't a correction */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Things that are not corrections
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              Disagreement with the overall editorial line — that is a
              complaint, not a correction. Use{" "}
              <a
                href="mailto:contact@gracchus.ai"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>.
            </p>
            <p>
              Threats of legal action without a specific factual correction.
              Those get passed to Gracchus&rsquo;s legal contact.
            </p>
            <p>
              Attempts to remove true, sourced information from the public
              record. Those do not succeed. The site is built on
              public-interest transparency.
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
              Separate from corrections. If a named individual wants to add
              context, deny a characterisation or respond to a finding, that
              is a right-of-reply request rather than a correction. Same
              email, &ldquo;Right of reply&rdquo; plus the name or topic in
              the subject line.
            </p>
          </div>
        </div>

        {/* Where corrections live */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Where past corrections live
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              Significant corrections are noted inline on the affected page
              and mirrored in the Recent Additions feed with a correction
              tag. Nothing gets silently edited.
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
