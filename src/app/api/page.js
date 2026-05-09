export const metadata = {
  title: "API — Gracchus",
  description:
    "Public read API over the Gracchus dataset. UK government major projects, contractor research, curated connection records, and the latest MP register / APPG triage snapshots — citation-ready JSON.",
};

const ENDPOINTS = [
  {
    path: "/api/v1",
    method: "GET",
    summary: "Index of available endpoints, rate-limit status, version metadata.",
  },
  {
    path: "/api/v1/health",
    method: "GET",
    summary:
      "Service health and dataset freshness. Returns counts and the latest update date for each curated dataset.",
  },
  {
    path: "/api/v1/projects",
    method: "GET",
    summary:
      "List of all 116 tracked UK government major projects, with original vs latest budget, dates, status, and contractor counts.",
    queryParams: [
      { name: "department", description: "Filter to a single department (exact match, e.g. \"Ministry of Defence\")" },
      { name: "status", description: "Filter by status: \"In Progress\" / \"Completed\" / \"Cancelled\"" },
      { name: "category", description: "Filter by category (e.g. \"Transport\", \"Defence\")" },
    ],
  },
  {
    path: "/api/v1/projects/{slug}",
    method: "GET",
    summary:
      "Single project — full description, all contractor groups (with member firms and contract values), source-quality grade, delay specifics, primary sources.",
  },
  {
    path: "/api/v1/connections",
    method: "GET",
    summary:
      "The curated dataset of person- and firm-level connections (currently 33 records). Each record includes counterparty, regulatory findings, tiered sources, and an embedded person summary.",
    queryParams: [
      { name: "status", description: "closed_with_finding / closed_approved / live_proceedings / public_record / reported" },
      { name: "type", description: "Connection type — see /api/v1/connections meta.filtersAvailable" },
      { name: "personId", description: "Filter to a single person/firm id (e.g. \"lee-laurence\")" },
    ],
  },
  {
    path: "/api/v1/connections/{id}",
    method: "GET",
    summary:
      "Single connection record — the full editorial detail, regulatory findings with neutral citations and quoted text, all sources tiered.",
  },
  {
    path: "/api/v1/register/latest",
    method: "GET",
    summary:
      "The most recent Register of Members' Financial Interests edition (sourced from Parliament's official Interests API), with the full triage candidate list — entries flagged for human review.",
  },
  {
    path: "/api/v1/appgs/latest",
    method: "GET",
    summary:
      "The most recent Register of All-Party Parliamentary Groups edition, with the full triage candidate list — APPGs whose secretariat is a public-affairs firm or whose declared sponsors include a tracked Gracchus supplier.",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-prose mx-auto px-6 py-16">
        <a href="/" className="text-[11px] uppercase tracking-[0.3em] font-mono text-gray-600 hover:text-gray-400 transition-colors">
          &larr; Gracchus
        </a>

        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mt-12 mb-2">
          Gracchus &middot; API
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium text-white leading-tight tracking-[-0.01em] mb-8">
          Public read API
        </h1>

        <div className="space-y-6 text-[17px] leading-relaxed text-gray-400">
          <p>
            Gracchus exposes its curated dataset as a public read API so other
            newsrooms, civic-tech projects and researchers can build on the
            same source-graded data the site uses. All endpoints are read-only,
            return JSON, and require no authentication.
          </p>

          <p>
            Data is licensed{" "}
            <a
              href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
            >
              Open Government Licence v3.0
            </a>{" "}
            (the licence under which most of the underlying primary sources are
            published). Cite as: <em>Gracchus (gracchus.ai) — non-partisan,
            source-backed audit of UK government performance.</em>
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Quick start</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-gray-400">
            <pre className="bg-gray-900/60 border border-gray-800 rounded p-4 overflow-x-auto text-[13px] font-mono text-gray-300">
{`curl https://gracchus.ai/api/v1/projects | jq '.data[:5] | .[] | {name, overrunPct}'

# Top five projects by absolute overrun:
curl https://gracchus.ai/api/v1/projects \\
  | jq '[.data[] | select(.overrunGBP != null)] | sort_by(.overrunGBP) | reverse | .[:5]'

# All connections with a regulatory finding:
curl 'https://gracchus.ai/api/v1/connections?status=closed_with_finding'

# This fortnight's MP register triage:
curl https://gracchus.ai/api/v1/register/latest`}
            </pre>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Endpoints</h2>
          <div className="space-y-6 text-[15px]">
            {ENDPOINTS.map((e, i) => (
              <div key={i} className="border-l-2 border-gray-800 pl-5">
                <div className="font-mono text-[14px] text-emerald-400 mb-1">
                  <span className="text-gray-500 mr-2">{e.method}</span>
                  {e.path}
                </div>
                <p className="text-gray-400 leading-relaxed">{e.summary}</p>
                {e.queryParams && (
                  <div className="mt-2 text-[13px] text-gray-500">
                    Query parameters:
                    <ul className="mt-1 space-y-1 pl-4 list-disc marker:text-gray-700">
                      {e.queryParams.map((q, j) => (
                        <li key={j}>
                          <code className="font-mono text-gray-300">{q.name}</code>
                          <span className="text-gray-500"> &mdash; {q.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Response envelope</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-gray-400">
            <p>Every successful response uses the same JSON shape:</p>
            <pre className="bg-gray-900/60 border border-gray-800 rounded p-4 overflow-x-auto text-[13px] font-mono text-gray-300">
{`{
  "data": { /* or [] for list endpoints */ },
  "meta": {
    "generatedAt": "2026-05-09T...",
    "apiVersion": "v1",
    "license": "Open Government Licence v3.0",
    "attribution": "Cite as: Gracchus..."
  }
}`}
            </pre>
            <p>Errors use:</p>
            <pre className="bg-gray-900/60 border border-gray-800 rounded p-4 overflow-x-auto text-[13px] font-mono text-gray-300">
{`{
  "error": { "code": "not_found", "message": "..." },
  "meta": { "generatedAt": "...", "apiVersion": "v1" }
}`}
            </pre>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Rate limits</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-gray-400">
            <p>
              60 requests per minute per IP. Every response includes:
            </p>
            <ul className="space-y-1 pl-5 list-disc marker:text-gray-600 text-[14px]">
              <li><code className="font-mono text-gray-300">X-RateLimit-Limit</code></li>
              <li><code className="font-mono text-gray-300">X-RateLimit-Remaining</code></li>
              <li><code className="font-mono text-gray-300">X-RateLimit-Reset</code> &mdash; Unix seconds</li>
            </ul>
            <p>
              Exceeding the limit returns <code className="font-mono">429</code>{" "}
              with a <code className="font-mono">Retry-After</code> header in seconds.
              If your use case needs more, get in touch &mdash;{" "}
              <a
                href="mailto:contact@gracchus.ai?subject=API rate limit"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                contact@gracchus.ai
              </a>.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Caching</h2>
          <div className="space-y-3 text-[15px] leading-relaxed text-gray-400">
            <p>
              Most endpoints are CDN-cached for one hour with{" "}
              <code className="font-mono text-gray-300">stale-while-revalidate</code>.
              The underlying data files refresh daily via scheduled tasks (see{" "}
              <a
                href="/standards"
                className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
              >
                editorial standards
              </a>{" "}
              for source grading and refresh cadence).
            </p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-800/60">
          <div className="text-[11px] uppercase tracking-[0.25em] font-mono text-gray-600 mb-4">
            Building something with the API?
          </div>
          <p className="text-[15px] text-gray-400">
            We&rsquo;d love to know &mdash;{" "}
            <a
              href="mailto:contact@gracchus.ai?subject=Built with Gracchus API"
              className="text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 hover:text-white"
            >
              contact@gracchus.ai
            </a>.
            Notable uses get linked from this page.
          </p>
        </div>

        <div className="mt-12 text-[10px] font-mono text-gray-700 tracking-[0.1em]">
          Non-partisan. Source-backed.
        </div>
      </div>
    </div>
  );
}
