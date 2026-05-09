import { jsonResponse, rateLimit, corsPreflight, errorResponse } from "../_lib";
import projects from "../../../../data/projects.json";
import individualConnections from "../../../../data/individual-connections.json";

export const dynamic = "force-static";
export const revalidate = 3600;

export function OPTIONS() { return corsPreflight(); }

export async function GET(req) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  return jsonResponse({
    status: "ok",
    datasets: {
      projects: {
        count: projects.length,
        lastUpdated: projects.reduce((max, p) => (p.lastUpdated && p.lastUpdated > max ? p.lastUpdated : max), ""),
      },
      individualConnections: {
        people: (individualConnections.people || []).length,
        connections: (individualConnections.connections || []).length,
        lastUpdated: individualConnections.updatedAt || null,
      },
    },
  }, { rate, cacheSeconds: 600 });
}
