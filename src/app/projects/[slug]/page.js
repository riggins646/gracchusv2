import projects from "../../../data/projects.json";
import contractorsData from "../../../data/project-contractors.json";
import sourceQualityData from "../../../data/project-source-quality.json";
import delaysData from "../../../data/delays-delivery.json";

// ---------------------------------------------------------------------------
// Slug helpers — projects identified in the URL by a deterministic slug
// derived from the project name. Keeps URLs human-readable and SEO-friendly:
// "HS2 (High Speed 2)" → "hs2-high-speed-2".
// ---------------------------------------------------------------------------

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findProject(slug) {
  return projects.find((p) => slugify(p.name) === slug);
}

// ---------------------------------------------------------------------------
// Static generation — pre-render every project at build time.
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  return projects.map((p) => ({ slug: slugify(p.name) }));
}

export async function generateMetadata({ params }) {
  const project = findProject(params.slug);
  if (!project) return { title: "Project not found — Gracchus" };
  const overrun =
    project.latestBudget && project.originalBudget
      ? Math.round(((project.latestBudget - project.originalBudget) / project.originalBudget) * 100)
      : null;
  const desc =
    project.originalBudget && project.latestBudget
      ? `£${project.originalBudget.toLocaleString()}m promised · £${project.latestBudget.toLocaleString()}m now${overrun ? ` (+${overrun}%)` : ""} · ${project.status}.`
      : `${project.department} · ${project.status}.`;
  return {
    title: `${project.name} — Gracchus`,
    description: desc,
  };
}

// ---------------------------------------------------------------------------
// Lookups across the auxiliary datasets
// ---------------------------------------------------------------------------

function contractorEntry(projectId) {
  return (contractorsData?.projects || []).find((p) => p.projectId === projectId);
}

function sourceQualityEntry(projectId) {
  return (sourceQualityData?.projects || []).find((p) => p.projectId === projectId);
}

function delayEntry(projectId, projectName) {
  const list = delaysData?.projects || [];
  return (
    list.find((d) => d.id === projectId) ||
    list.find((d) => (d.projectName || "").toLowerCase() === (projectName || "").toLowerCase())
  );
}

// ---------------------------------------------------------------------------
// Currency / number formatters
// ---------------------------------------------------------------------------

function fmtMillions(m) {
  if (m == null || Number.isNaN(m)) return "—";
  if (m >= 1000) return `£${(m / 1000).toFixed(m % 1000 ? 1 : 0)}bn`;
  return `£${m.toLocaleString()}m`;
}

function pctChange(from, to) {
  if (!from || !to) return null;
  return Math.round(((to - from) / from) * 100);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectPage({ params }) {
  const project = findProject(params.slug);
  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
        <div className="max-w-prose mx-auto px-6 py-24">
          <a href="/projects" className="text-[11px] uppercase tracking-[0.3em] font-mono text-gray-600 hover:text-gray-400">
            &larr; All projects
          </a>
          <h1 className="text-3xl font-serif text-white mt-12">Project not found</h1>
          <p className="mt-4 text-gray-400">
            That URL doesn&rsquo;t map to a project we&rsquo;re tracking. Try the{" "}
            <a href="/projects" className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400">
              full project index
            </a>.
          </p>
        </div>
      </div>
    );
  }

  const contractors = contractorEntry(project.id);
  const sourceQuality = sourceQualityEntry(project.id);
  const delay = delayEntry(project.id, project.name);

  const overrunPct = pctChange(project.originalBudget, project.latestBudget);

  // For the budget bar: scale relative to the larger of the two values.
  const budgetMax = Math.max(project.originalBudget || 0, project.latestBudget || 0);
  const origPct = budgetMax ? Math.round(((project.originalBudget || 0) / budgetMax) * 100) : 0;
  const latestPct = budgetMax ? Math.round(((project.latestBudget || 0) / budgetMax) * 100) : 0;

  // Status badge styling
  const statusClass =
    project.status === "Completed"
      ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/40"
      : project.status === "Cancelled"
      ? "bg-gray-800 text-gray-400 border-gray-700"
      : "bg-amber-900/30 text-amber-400 border-amber-700/40";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-prose mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <a
          href="/projects"
          className="text-[11px] uppercase tracking-[0.3em] font-mono text-gray-600 hover:text-gray-400 transition-colors"
        >
          &larr; All projects
        </a>

        {/* Department / category eyebrow */}
        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mt-12 mb-2">
          {project.department}
          {project.category ? ` · ${project.category}` : ""}
          {project.subcategory ? ` · ${project.subcategory}` : ""}
        </div>

        {/* Hero — project name */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium text-white leading-tight tracking-[-0.01em] mb-6">
          {project.name}
        </h1>

        {/* Status + headline fact */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <span className={`text-[11px] uppercase tracking-[0.15em] font-mono px-2 py-1 border rounded ${statusClass}`}>
            {project.status}
          </span>
          {overrunPct != null && (
            <span className={`text-[11px] uppercase tracking-[0.15em] font-mono px-2 py-1 border rounded ${overrunPct > 0 ? "bg-red-900/30 text-red-400 border-red-800/50" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
              {overrunPct > 0 ? `+${overrunPct}% over budget` : `${overrunPct}% under budget`}
            </span>
          )}
        </div>

        {/* Killer fact — budget */}
        {project.originalBudget && project.latestBudget && (
          <div className="text-2xl md:text-3xl font-serif text-white leading-snug mb-2">
            {fmtMillions(project.originalBudget)} promised
            {" → "}
            <span className={overrunPct > 0 ? "text-red-400" : "text-emerald-400"}>{fmtMillions(project.latestBudget)} now</span>.
          </div>
        )}

        {/* Killer fact — date */}
        {project.originalDate && project.latestDate && project.originalDate !== project.latestDate && (
          <div className="text-2xl md:text-3xl font-serif text-white leading-snug mb-8">
            {project.originalDate} promised
            {" → "}
            <span className="text-red-400">{project.latestDate}</span>.
          </div>
        )}

        {/* Description */}
        {project.description && (
          <div className="mt-8 space-y-4 text-[17px] leading-relaxed text-gray-400">
            <p>{project.description}</p>
          </div>
        )}

        {/* Budget visualization */}
        {project.originalBudget && project.latestBudget && (
          <section className="mt-14">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-4">
              Budget
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-gray-400">Original</span>
                  <span className="font-mono text-emerald-400">{fmtMillions(project.originalBudget)}</span>
                </div>
                <div className="h-3 bg-gray-900 rounded-sm overflow-hidden">
                  <div className="h-full bg-emerald-500/70" style={{ width: `${origPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-gray-400">Latest estimate</span>
                  <span className="font-mono text-red-400">{fmtMillions(project.latestBudget)}</span>
                </div>
                <div className="h-3 bg-gray-900 rounded-sm overflow-hidden">
                  <div className="h-full bg-red-500/70" style={{ width: `${latestPct}%` }} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Delay specifics — only if we have detailed delay data */}
        {delay && (delay.delayYears || delay.delayDays) && (
          <section className="mt-12">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-4">
              Delay
            </div>
            <div className="text-[17px] leading-relaxed text-gray-400 space-y-2">
              {delay.delayYears && (
                <p>
                  <span className="text-red-400 text-2xl font-serif">+{delay.delayYears.toFixed?.(1) ?? delay.delayYears} years</span>
                  {" "}
                  late versus the original deadline of {delay.originalCompletionDate?.slice?.(0, 4) || project.originalDate}.
                </p>
              )}
              {delay.delayCauseDetail && (
                <p className="text-[15px]">{delay.delayCauseDetail}</p>
              )}
              {delay.revisedDeadlines != null && (
                <p className="text-[14px] text-gray-500">
                  Deadline has been revised {delay.revisedDeadlines} time{delay.revisedDeadlines === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Contractors */}
        {contractors && (contractors.contractors || []).length > 0 && (
          <section className="mt-12">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-4">
              Contractors
            </div>
            <div className="text-[15px] text-gray-400 mb-4">
              {(contractors.contractors || []).length} group{(contractors.contractors || []).length === 1 ? "" : "s"}
              {(() => {
                const memberCount = (contractors.contractors || []).reduce(
                  (acc, g) => acc + ((g.members || []).length),
                  0
                );
                return memberCount ? ` · ${memberCount} member firm${memberCount === 1 ? "" : "s"}` : "";
              })()}
              {sourceQuality?.score != null && (
                <> · source quality <span className="font-mono text-gray-300">{(sourceQuality.score * 100).toFixed(0)}/100</span></>
              )}
            </div>

            <div className="space-y-3">
              {(contractors.contractors || [])
                .slice()
                .sort((a, b) => (b.groupAggregateValueGBP || 0) - (a.groupAggregateValueGBP || 0))
                .map((g, i) => {
                  const memCount = (g.members || []).length;
                  const value = g.groupAggregateValueGBP;
                  return (
                    <div key={i} className="border-l border-gray-800 pl-4 py-1">
                      <div className="text-[15px] text-gray-200">{g.groupName}</div>
                      <div className="text-[12px] font-mono text-gray-500 mt-0.5">
                        {memCount > 0 && <>{memCount} member{memCount === 1 ? "" : "s"}</>}
                        {value && <> · {fmtMillions(value / 1_000_000)}</>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Sources */}
        {(project.sources || []).length > 0 && (
          <section className="mt-12">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-4">
              Sources
            </div>
            <ul className="space-y-2 text-[14px]">
              {project.sources.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer meta */}
        <div className="mt-16 pt-8 border-t border-gray-800/60 text-[11px] font-mono text-gray-600">
          <div>Last updated: {project.lastUpdated || "—"}</div>
          <div className="mt-2">Project ID: {project.id}</div>
        </div>

        <div className="mt-12 text-[10px] font-mono text-gray-700 tracking-[0.1em]">
          Non-partisan. Source-backed.
        </div>
      </div>
    </div>
  );
}
