import projects from "../../data/projects.json";

export const metadata = {
  title: "Projects — Gracchus",
  description:
    "Every UK government major project we track, ranked by budget overrun. £-promised vs £-now, original vs revised deadline, every figure linked to its primary source.",
};

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtMillions(m) {
  if (m == null || Number.isNaN(m)) return "—";
  if (m >= 1000) return `£${(m / 1000).toFixed(m % 1000 ? 1 : 0)}bn`;
  return `£${m.toLocaleString()}m`;
}

function pctChange(from, to) {
  if (!from || !to) return null;
  return Math.round(((to - from) / from) * 100);
}

export default function ProjectsIndexPage() {
  // Rank projects by absolute budget overrun (£ amount). Falls back to %.
  const ranked = projects
    .map((p) => ({
      ...p,
      _slug: slugify(p.name),
      _overrunGbp: p.originalBudget && p.latestBudget ? p.latestBudget - p.originalBudget : null,
      _overrunPct: pctChange(p.originalBudget, p.latestBudget),
    }))
    .sort((a, b) => {
      const ag = a._overrunGbp ?? -Infinity;
      const bg = b._overrunGbp ?? -Infinity;
      return bg - ag;
    });

  const totalOverrun = ranked.reduce((acc, p) => acc + (p._overrunGbp || 0), 0);
  const completed = ranked.filter((p) => p.status === "Completed").length;
  const inProgress = ranked.filter((p) => p.status === "In Progress").length;
  const cancelled = ranked.filter((p) => p.status === "Cancelled").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <a href="/" className="text-[11px] uppercase tracking-[0.3em] font-mono text-gray-600 hover:text-gray-400 transition-colors">
          &larr; Gracchus
        </a>

        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mt-12 mb-2">
          Gracchus &middot; Projects
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium text-white leading-tight tracking-[-0.01em] mb-6">
          UK government major projects
        </h1>

        {/* One-line headline fact */}
        <div className="text-[18px] text-gray-400 leading-relaxed mb-12">
          {projects.length} projects tracked. Cumulative budget overrun:{" "}
          <span className="text-red-400 font-medium">{fmtMillions(totalOverrun)}</span>.
          Ranked by absolute overrun, worst first.
        </div>

        {/* Status counts */}
        <div className="flex gap-6 mb-12 text-[13px] font-mono">
          <span><span className="text-amber-400">{inProgress}</span> <span className="text-gray-500">in progress</span></span>
          <span><span className="text-emerald-400">{completed}</span> <span className="text-gray-500">completed</span></span>
          <span><span className="text-gray-400">{cancelled}</span> <span className="text-gray-500">cancelled</span></span>
        </div>

        {/* Project list */}
        <div className="border-t border-gray-800">
          {ranked.map((p) => (
            <a
              key={p.id}
              href={`/projects/${p._slug}`}
              className="block py-4 border-b border-gray-800 hover:bg-gray-900/40 transition-colors -mx-3 px-3"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-mono text-gray-600 mb-0.5 truncate">
                    {p.department}
                  </div>
                  <div className="text-[16px] text-white font-medium truncate">{p.name}</div>
                  <div className="text-[12px] font-mono text-gray-500 mt-0.5">
                    {p.originalBudget && p.latestBudget && (
                      <>
                        {fmtMillions(p.originalBudget)} → {fmtMillions(p.latestBudget)}
                      </>
                    )}
                    {p.originalDate && p.latestDate && p.originalDate !== p.latestDate && (
                      <> · {p.originalDate} → {p.latestDate}</>
                    )}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  {p._overrunPct != null && p._overrunPct > 0 && (
                    <div className="text-[15px] font-mono text-red-400">
                      +{p._overrunPct}%
                    </div>
                  )}
                  {p._overrunGbp != null && p._overrunGbp > 0 && (
                    <div className="text-[12px] font-mono text-gray-500">
                      +{fmtMillions(p._overrunGbp)}
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-16 text-[10px] font-mono text-gray-700 tracking-[0.1em]">
          Non-partisan. Source-backed.
        </div>
      </div>
    </div>
  );
}
