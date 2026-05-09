import { jsonResponse, errorResponse, rateLimit, corsPreflight, slugify } from "../../_lib";
import projects from "../../../../../data/projects.json";
import contractorsData from "../../../../../data/project-contractors.json";
import sourceQualityData from "../../../../../data/project-source-quality.json";
import delaysData from "../../../../../data/delays-delivery.json";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  return projects.map((p) => ({ slug: slugify(p.name) }));
}

export function OPTIONS() { return corsPreflight(); }

export async function GET(req, { params }) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  const project = projects.find((p) => slugify(p.name) === params.slug);
  if (!project) return errorResponse("not_found", `No project at slug "${params.slug}"`, { status: 404, rate });

  const contractors = (contractorsData?.projects || []).find((p) => p.projectId === project.id) || null;
  const sourceQuality = (sourceQualityData?.projects || []).find((p) => p.projectId === project.id) || null;
  const delay = (delaysData?.projects || []).find(
    (d) => d.id === project.id || (d.projectName || "").toLowerCase() === (project.name || "").toLowerCase()
  ) || null;

  const data = {
    id: project.id,
    slug: slugify(project.name),
    name: project.name,
    department: project.department,
    category: project.category,
    subcategory: project.subcategory || null,
    status: project.status,
    description: project.description,
    originalBudgetGBP: project.originalBudget != null ? project.originalBudget * 1_000_000 : null,
    latestBudgetGBP: project.latestBudget != null ? project.latestBudget * 1_000_000 : null,
    overrunGBP:
      project.originalBudget != null && project.latestBudget != null
        ? (project.latestBudget - project.originalBudget) * 1_000_000
        : null,
    overrunPct:
      project.originalBudget && project.latestBudget
        ? Math.round(((project.latestBudget - project.originalBudget) / project.originalBudget) * 100)
        : null,
    originalDate: project.originalDate || null,
    latestDate: project.latestDate || null,
    delay: delay
      ? {
          delayYears: delay.delayYears ?? null,
          delayDays: delay.delayDays ?? null,
          revisedDeadlines: delay.revisedDeadlines ?? null,
          delayCauseDetail: delay.delayCauseDetail || null,
          originalCompletionDate: delay.originalCompletionDate || null,
          latestCompletionDate: delay.latestCompletionDate || null,
          actualCompletionDate: delay.actualCompletionDate || null,
        }
      : null,
    contractors: contractors
      ? (contractors.contractors || []).map((g) => ({
          groupName: g.groupName,
          groupAggregateValueGBP: g.groupAggregateValueGBP ?? null,
          groupValueNote: g.groupValueNote || null,
          memberCount: (g.members || []).length,
          members: (g.members || []).map((m) => ({
            name: m.name,
            role: m.role || null,
            scope: m.scope || null,
            contractValueGBP: m.contractValueGBP ?? null,
            contractValueNote: m.contractValueNote || null,
            sources: m.sources || [],
          })),
        }))
      : [],
    sourceQuality: sourceQuality
      ? {
          score: sourceQuality.score ?? null,
          gradeMix: sourceQuality.gradeMix || null,
          letterGrade: sourceQuality.letterGrade || null,
        }
      : null,
    primarySources: project.sources || [],
    href: `https://gracchus.ai/projects/${slugify(project.name)}`,
    lastUpdated: project.lastUpdated || null,
  };

  return jsonResponse(data, { rate });
}
