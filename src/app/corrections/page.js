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
            "text-4xl md:text-5xl lg:text-6xl font-serif " +
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

        {/* Recent material corrections */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">
            Recent material corrections
          </h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>
              The most substantive recent fixes &mdash; not every typo, just
              the ones that changed dates, parties, regulatory findings, or
              source citations against primary records.
            </p>
          </div>

          <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-gray-400">
            <div className="border-l-2 border-amber-500/40 pl-5">
              <div
                className={
                  "text-[10px] uppercase tracking-[0.2em] " +
                  "font-mono text-amber-500/80 mb-1"
                }
              >
                30 April 2026 &middot; data audit
              </div>
              <div className="text-white font-medium mb-1">
                Fifteen individual-connection records corrected against primary filings
              </div>
              <p>
                Triggered by a reader catching a Laurence Lee tile that
                misstated his MOD tenure dates, the Palantir entity name, and
                his appointment start date. A full sweep of the curated 33-record
                dataset followed. Specific corrections, with the primary source
                each was checked against:
              </p>
              <ul className="mt-3 space-y-1 pl-5 list-disc marker:text-gray-700 text-[14px]">
                <li>
                  Laurence Lee &mdash; MOD dates 2018-01&ndash;2023-01 corrected
                  to 2021-03&ndash;2023-05; entity changed from &ldquo;Palantir Technologies UK&rdquo;
                  to &ldquo;Palantir Technologies Limited&rdquo;; appointment start
                  changed from 2023-06 to 2025-08; FCDO interim role added; an
                  unsourced &pound;25m contract figure removed. (ACOBA letter)
                </li>
                <li>
                  Baroness Harding &mdash; finding re-described as a public-sector
                  equality duty breach (s.149 Equality Act) per [2022] EWHC 298 (Admin),
                  not &ldquo;indirect discrimination&rdquo;; Good Law Project
                  claim noted as dismissed on standing.
                </li>
                <li>
                  David Meller &mdash; detail rewritten against [2022] EWHC 46 (TCC)
                  to reflect that the High Court refused relief and that Meller Designs
                  was not a party to the proceedings.
                </li>
                <li>
                  Baroness Mone / PPE Medpro &mdash; judgment date corrected from
                  2024-11-06 to <span className="font-mono">2025-10-01</span>;
                  neutral citation [2025] EWHC 2486 (Comm) and Mrs Justice Cockerill
                  added; civil judgment distinguished from the still-active NCA
                  criminal investigation.
                </li>
                <li>
                  Lord Hammond &mdash; ACOBA letter date corrected to 2021-08-31;
                  quoted text updated to verbatim ACOBA wording.
                </li>
                <li>
                  Sir John Whittingdale &mdash; ACOBA correspondence date
                  corrected from a vague &ldquo;2022-03&rdquo; to the actual
                  publication date of 2022-04-11.
                </li>
                <li>
                  Dame Priti Patel &mdash; Monckton Chambers case note demoted
                  from primary to analysis; the actual Upper Tribunal ruling
                  [2024] UKUT 76 (AAC) added as primary; record reframed to
                  make clear the ruling is FOI disclosure, not a determination
                  on Patel&rsquo;s compliance.
                </li>
                <li>
                  George Osborne &mdash; ACOBA conditions corrected to include
                  the three-month waiting period and the privileged-information
                  condition; PACAC report HC 252 added as a second primary source.
                </li>
                <li>
                  Sir Nick Clegg &mdash; status changed from &ldquo;closed_approved&rdquo;
                  to &ldquo;public_record&rdquo;; the 2018 Facebook role fell outside
                  ACOBA&rsquo;s two-year window so no ACOBA approval exists.
                </li>
                <li>
                  Cameron / Crothers &mdash; PACAC report HC 888 date corrected
                  from 2022-03-17 to actual publication date 2022-12-02.
                </li>
                <li>
                  Sir Geoffrey Cox &mdash; summary corrected to distinguish
                  &pound;800k aggregate Withers earnings from the &pound;150k+
                  specifically for BVI work.
                </li>
                <li>
                  Iain Liddell / Uniserve &mdash; Good Law Project demoted from
                  primary to news; NAO retained as the government primary.
                </li>
                <li>
                  Money Map Lee guided-tour string &mdash; corrected
                  &ldquo;Lt Gen&rdquo; (he is not a military officer) to
                  &ldquo;Laurence Lee CMG&rdquo;; replaced an incorrect
                  attribution of the Federated Data Platform contract to
                  the MOD (it&rsquo;s NHS England).
                </li>
              </ul>
            </div>

            <div className="border-l-2 border-emerald-500/40 pl-5">
              <div
                className={
                  "text-[10px] uppercase tracking-[0.2em] " +
                  "font-mono text-emerald-500/80 mb-1"
                }
              >
                30 April 2026 &middot; new records
              </div>
              <div className="text-white font-medium mb-1">
                Four new MP / minister declaration records added; ACOBA closure noted
              </div>
              <p>
                ACOBA &mdash; the Advisory Committee on Business Appointments
                &mdash; closed on <span className="font-mono">13 October 2025</span>.
                Its functions transferred to the Independent Adviser on Ministerial
                Standards (for ministers) and the Civil Service Commission (for
                senior civil servants). Editorial notes updated to flag this;
                pre-closure records continue to cite ACOBA, post-closure records
                cite the new bodies.
              </p>
              <p className="mt-3">New records added:</p>
              <ul className="mt-2 space-y-1 pl-5 list-disc marker:text-gray-700 text-[14px]">
                <li>
                  Angela Rayner &mdash; the Independent Adviser on Ministerial
                  Standards found a Ministerial Code breach over a c. &pound;40k
                  stamp duty underpayment; resigned 5 September 2025. Subsequent
                  Chartwell Speakers role approved 15 January 2026 with
                  two-year UK-government lobbying restrictions.
                </li>
                <li>
                  Lord Gove &mdash; March 2026 approval to take up paid speaker
                  engagements with Chartwell Speakers Bureau and London Speaker
                  Bureau under standard conditions.
                </li>
                <li>
                  Andrew Bridgen &mdash; Committee on Standards report HC 832
                  (1 May 2025) found he had registered a &pound;4,470,576
                  interest-free loan from Conservative donor Jeremy Hosking
                  1,135 days late.
                </li>
                <li>
                  Sir Andrew Mitchell &mdash; 3 February 2026 advice approving
                  appointment as Senior Adviser to Subaha Investments under
                  standard post-ministerial conditions.
                </li>
              </ul>
            </div>
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
