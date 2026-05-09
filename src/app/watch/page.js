import fs from "node:fs";
import path from "node:path";

export const metadata = {
  title: "Watch — Gracchus",
  description:
    "This fortnight in MP declarations and APPG industry sponsorship — the most recent triage candidates, sourced directly from Parliament's primary data feeds.",
};

// ---------------------------------------------------------------------------
// Server-side data loaders. These read the most recent snapshot/triage files
// produced by `npm run ingest:register` (Mon Tuesday) and `npm run ingest:appgs`
// (15th of each month). If neither has run yet, the page renders the
// onboarding state explaining what populates here.
// ---------------------------------------------------------------------------

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function loadLatestRegister() {
  const root = path.join(process.cwd(), "src", "data", "register");
  const idx = readJson(path.join(root, "index.json"));
  if (!idx?.editions?.length) return null;
  const latest = idx.editions[0]; // index keeps editions newest-first
  const triagePath = path.join(root, "triage", `${latest.id}-${latest.publishedDate}.json`);
  const diffPath = path.join(root, "diffs", `${latest.id}-${latest.publishedDate}.md`);
  const triage = readJson(triagePath);
  const diffMd = (() => { try { return fs.readFileSync(diffPath, "utf8"); } catch { return null; } })();
  return { meta: latest, triage, diffMd };
}

function loadLatestAppgs() {
  const root = path.join(process.cwd(), "src", "data", "appgs");
  const idx = readJson(path.join(root, "index.json"));
  if (!idx?.editions?.length) return null;
  const latest = idx.editions[0];
  const triagePath = path.join(root, "triage", `${latest.id}.json`);
  const triage = readJson(triagePath);
  return { meta: latest, triage };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export default function WatchPage() {
  const reg = loadLatestRegister();
  const appgs = loadLatestAppgs();
  const noData = !reg && !appgs;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-prose mx-auto px-6 py-24">
        <a
          href="/"
          className="text-[11px] uppercase tracking-[0.3em] font-mono text-gray-600 hover:text-gray-400 transition-colors"
        >
          &larr; Gracchus
        </a>

        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mt-12 mb-2">
          Gracchus &middot; Watch
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium text-white leading-tight tracking-[-0.01em] mb-8">
          This fortnight in declarations
        </h1>

        <div className="space-y-6 text-[17px] leading-relaxed text-gray-400">
          <p>
            What changed in the last published edition of the Register of
            Members&rsquo; Financial Interests, and what changed in the
            most-recent edition of the Register of All-Party Parliamentary
            Groups. Both are pulled directly from Parliament&rsquo;s primary
            data feeds. The lists below are <em>triage candidates</em>: entries
            whose pattern (large gifts, late registrations, lobbying-firm
            secretariats, tracked-supplier sponsors) flags them for human
            review. Inclusion here is not a finding of wrongdoing.
          </p>
        </div>

        {noData && (
          <div className="mt-12 rounded border border-gray-800 bg-gray-900/30 p-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              No editions ingested yet
            </h2>
            <p className="text-gray-400 text-[15px] leading-relaxed">
              This page populates after the first scheduled run of the Register
              and APPG ingesters. The MP register runs every Tuesday at 9am
              local time; the APPG register runs on the 15th of each month at
              10am.
            </p>
            <p className="text-gray-500 text-[14px] mt-3">
              To populate manually: <code className="font-mono text-gray-300">npm run ingest:register</code> and <code className="font-mono text-gray-300">npm run ingest:appgs</code>.
            </p>
          </div>
        )}

        {/* Register of Members' Financial Interests */}
        {reg && (
          <section className="mt-12">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-2">
              Register of Members&rsquo; Financial Interests
            </div>
            <h2 className="text-xl font-semibold text-white mb-3">
              Edition {reg.meta.id} &mdash; as at {formatDate(reg.meta.publishedDate)}
            </h2>
            <div className="text-[15px] text-gray-500 mb-6">
              {reg.meta.interests} interests on the register
              {Number.isFinite(reg.meta.addedSincePrevious) && reg.meta.addedSincePrevious > 0 && (
                <> &middot; <span className="text-emerald-400">{reg.meta.addedSincePrevious} added</span> since the previous edition</>
              )}
              {Number.isFinite(reg.meta.triageCandidates) && reg.meta.triageCandidates > 0 && (
                <> &middot; <span className="text-amber-400">{reg.meta.triageCandidates} triage candidates</span></>
              )}
            </div>

            <RegisterTriageList candidates={(reg.triage?.candidates) || []} />

            <div className="mt-6 text-[12px] font-mono text-gray-600">
              Source:{" "}
              <a
                href={`https://members.parliament.uk/members/commons/interests/publications`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-gray-700 hover:decoration-gray-400 hover:text-gray-400"
              >
                members.parliament.uk
              </a>
              {" "}&middot;{" "}
              Pulled via Parliament&rsquo;s Interests API
            </div>
          </section>
        )}

        {/* APPG register */}
        {appgs && (
          <section className="mt-16">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-2">
              Register of All-Party Parliamentary Groups
            </div>
            <h2 className="text-xl font-semibold text-white mb-3">
              Edition {appgs.meta.id} &mdash; as at {formatDate(appgs.meta.editionDate)}
            </h2>
            <div className="text-[15px] text-gray-500 mb-6">
              {appgs.meta.groups} groups on the register
              {Number.isFinite(appgs.meta.triageCandidates) && appgs.meta.triageCandidates > 0 && (
                <> &middot; <span className="text-amber-400">{appgs.meta.triageCandidates} triage candidates</span></>
              )}
            </div>

            <AppgTriageList candidates={(appgs.triage?.candidates) || []} />

            <div className="mt-6 text-[12px] font-mono text-gray-600">
              Source:{" "}
              <a
                href={`https://publications.parliament.uk/pa/cm/cmallparty/${appgs.meta.id}/contents.htm`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-gray-700 hover:decoration-gray-400 hover:text-gray-400"
              >
                publications.parliament.uk
              </a>
            </div>
          </section>
        )}

        <div className="mt-24 text-[10px] font-mono text-gray-700 tracking-[0.1em]">
          Non-partisan. Source-backed.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

function RegisterTriageList({ candidates }) {
  if (!candidates?.length) {
    return <p className="text-gray-500 text-[15px]"><em>No triage candidates this edition.</em></p>;
  }
  // Show the top 12 by reasons-count then registration date
  const top = candidates.slice().sort((a, b) =>
    (b.reasons?.length || 0) - (a.reasons?.length || 0)
  ).slice(0, 12);
  return (
    <div className="space-y-5">
      {top.map((c, i) => (
        <div key={`${c.interestId}-${i}`} className="border-l-2 border-amber-500/40 pl-5">
          <div className="text-white font-medium text-[15px]">
            {c.memberName}
            {c.memberParty && <span className="text-gray-500 font-normal"> · {c.memberParty}</span>}
            {c.memberConstituency && <span className="text-gray-500 font-normal"> · {c.memberConstituency}</span>}
          </div>
          <div className="text-[13px] font-mono text-gray-500 mt-0.5">
            Category {c.category} · registered {c.registrationDate || "?"}
          </div>
          {c.summary && (
            <div className="text-[14px] text-gray-400 mt-1 italic">&ldquo;{c.summary}&rdquo;</div>
          )}
          <ul className="mt-2 space-y-0.5 text-[13px] text-gray-500">
            {(c.reasons || []).map((r, j) => (
              <li key={j}>&middot; {r}</li>
            ))}
          </ul>
        </div>
      ))}
      {candidates.length > top.length && (
        <p className="text-[13px] text-gray-600 italic mt-4">
          + {candidates.length - top.length} more candidates in this edition&rsquo;s triage report.
        </p>
      )}
    </div>
  );
}

function AppgTriageList({ candidates }) {
  if (!candidates?.length) {
    return <p className="text-gray-500 text-[15px]"><em>No triage candidates this edition.</em></p>;
  }
  // Sort by upper-band benefit, descending
  const top = candidates.slice().sort((a, b) =>
    (b.totalDeclaredBenefitUpperGBP || 0) - (a.totalDeclaredBenefitUpperGBP || 0)
  ).slice(0, 12);
  return (
    <div className="space-y-5">
      {top.map((c, i) => (
        <div key={`${c.groupId}-${i}`} className="border-l-2 border-amber-500/40 pl-5">
          <div className="text-white font-medium text-[15px]">
            {c.title || c.groupId}
          </div>
          <div className="text-[13px] font-mono text-gray-500 mt-0.5">
            {c.category || "—"}
            {c.totalDeclaredBenefitUpperGBP > 0 && (
              <> · up to £{(c.totalDeclaredBenefitUpperGBP).toLocaleString()}/year disclosed</>
            )}
          </div>
          {c.secretariat?.length > 0 && (
            <div className="text-[14px] text-gray-400 mt-1">
              <span className="text-gray-500 text-[12px] uppercase tracking-wider mr-1">Secretariat:</span>
              {c.secretariat.map((s, j) => (
                <span key={j}>{j > 0 ? ", " : ""}{s.name}</span>
              ))}
            </div>
          )}
          {c.sponsors?.length > 0 && (
            <div className="text-[13px] text-gray-500 mt-1">
              <span className="text-gray-500 text-[12px] uppercase tracking-wider mr-1">Sponsors ({c.sponsors.length}):</span>
              {c.sponsors.slice(0, 12).join(", ")}
              {c.sponsors.length > 12 && ", …"}
            </div>
          )}
          <ul className="mt-2 space-y-0.5 text-[13px] text-gray-500">
            {(c.reasons || []).map((r, j) => (
              <li key={j}>&middot; {r}</li>
            ))}
          </ul>
        </div>
      ))}
      {candidates.length > top.length && (
        <p className="text-[13px] text-gray-600 italic mt-4">
          + {candidates.length - top.length} more candidates in this edition&rsquo;s triage report.
        </p>
      )}
    </div>
  );
}
