import fs from "node:fs";
import path from "node:path";
import { jsonResponse, errorResponse, rateLimit, corsPreflight } from "../../_lib";

export const dynamic = "force-static";
export const revalidate = 3600;

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

export function OPTIONS() { return corsPreflight(); }

export async function GET(req) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  const root = path.join(process.cwd(), "src", "data", "appgs");
  const idx = readJson(path.join(root, "index.json"));
  if (!idx?.editions?.length) {
    return jsonResponse({
      latestEdition: null,
      message: "No editions ingested yet. Run `npm run ingest:appgs` to populate.",
    }, { rate, cacheSeconds: 60 });
  }
  const latest = idx.editions[0];
  const triage = readJson(path.join(root, "triage", `${latest.id}.json`));

  return jsonResponse({
    latestEdition: {
      id: latest.id,
      editionDate: latest.editionDate,
      groups: latest.groups,
      triageCandidatesCount: latest.triageCandidates ?? 0,
      ingestedAt: latest.ingestedAt,
      sourceUrl: `https://publications.parliament.uk/pa/cm/cmallparty/${latest.id}/contents.htm`,
    },
    triageCandidates: (triage?.candidates || []).map((c) => ({
      groupId: c.groupId,
      title: c.title,
      category: c.category,
      url: c.url,
      secretariat: c.secretariat || [],
      officers: c.officers || [],
      sponsors: c.sponsors || [],
      totalDeclaredBenefitUpperGBP: c.totalDeclaredBenefitUpperGBP || null,
      reasons: c.reasons || [],
    })),
  }, { rate });
}
