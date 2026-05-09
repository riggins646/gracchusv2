import { jsonResponse, errorResponse, rateLimit, corsPreflight } from "./_lib";

export const dynamic = "force-static";
export const revalidate = 3600;

export function OPTIONS() { return corsPreflight(); }

export async function GET(req) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests. Please slow down.", { status: 429, rate });

  return jsonResponse({
    name: "Gracchus public read API",
    version: "v1",
    description:
      "Read-only access to the Gracchus dataset: UK government major projects, contractor research, " +
      "curated individual-connection records, and the latest MP register / APPG triage snapshots.",
    endpoints: [
      { path: "/api/v1/health", description: "Service health and dataset freshness" },
      { path: "/api/v1/projects", description: "List of all tracked major projects" },
      { path: "/api/v1/projects/{slug}", description: "Single project detail (incl. contractors and source-quality)" },
      { path: "/api/v1/connections", description: "Curated person/firm connection records (33 entries)" },
      { path: "/api/v1/connections/{id}", description: "Single connection record" },
      { path: "/api/v1/register/latest", description: "Most recent MP register snapshot summary" },
      { path: "/api/v1/appgs/latest", description: "Most recent APPG snapshot summary" },
    ],
    docs: "https://gracchus.ai/api",
    rate_limit: {
      requests_per_minute: rate.limit,
      remaining: rate.remaining,
      reset_at: new Date(rate.resetAt).toISOString(),
    },
  }, { rate });
}
