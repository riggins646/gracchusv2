import { jsonResponse, errorResponse, rateLimit, corsPreflight, slugify } from "../_lib";
import projects from "../../../../data/projects.json";

export const dynamic = "force-static";
export const revalidate = 3600;

export function OPTIONS() { return corsPreflight(); }

export async function GET(req) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  const url = new URL(req.url);
  const department = url.searchParams.get("department");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  let list = projects;
  if (department) list = list.filter((p) => p.department === department);
  if (status) list = list.filter((p) => p.status === status);
  if (category) list = list.filter((p) => p.category === category);

  // Standardised public schema — stable even if internal file shape evolves.
  const data = list.map((p) => ({
    id: p.id,
    slug: slugify(p.name),
    name: p.name,
    department: p.department,
    category: p.category,
    subcategory: p.subcategory || null,
    status: p.status,
    originalBudgetGBP: p.originalBudget != null ? p.originalBudget * 1_000_000 : null,
    latestBudgetGBP: p.latestBudget != null ? p.latestBudget * 1_000_000 : null,
    overrunGBP:
      p.originalBudget != null && p.latestBudget != null
        ? (p.latestBudget - p.originalBudget) * 1_000_000
        : null,
    overrunPct:
      p.originalBudget && p.latestBudget
        ? Math.round(((p.latestBudget - p.originalBudget) / p.originalBudget) * 100)
        : null,
    originalDate: p.originalDate || null,
    latestDate: p.latestDate || null,
    contractorGroupCount: (p.contractorResearch && p.contractorResearch.groups) || 0,
    memberFirmCount: (p.contractorResearch && p.contractorResearch.members) || 0,
    primarySources: p.sources || [],
    href: `https://gracchus.ai/projects/${slugify(p.name)}`,
    apiHref: `https://gracchus.ai/api/v1/projects/${slugify(p.name)}`,
    lastUpdated: p.lastUpdated || null,
  }));

  return jsonResponse(data, {
    rate,
    meta: {
      total: data.length,
      filters: { department, status, category },
    },
  });
}
