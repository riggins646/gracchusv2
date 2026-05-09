import fs from "node:fs";
import path from "node:path";
import { jsonResponse, errorResponse, rateLimit, corsPreflight } from "../../_lib";

// Note: we read at request time rather than `import` so the route still works
// before the first ingester run (graceful no-data state). Once
// `npm run ingest:register` has run at least once, the snapshot/triage files
// exist and this returns the latest edition. Files are written daily-ish, so
// the CDN cache (1 hour) is safe.

export const dynamic = "force-static";
export const revalidate = 3600;

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

export function OPTIONS() { return corsPreflight(); }

export async function GET(req) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  const root = path.join(process.cwd(), "src", "data", "register");
  const idx = readJson(path.join(root, "index.json"));
  if (!idx?.editions?.length) {
    return jsonResponse({
      latestEdition: null,
      message: "No editions ingested yet. Run `npm run ingest:register` to populate.",
    }, { rate, cacheSeconds: 60 });
  }
  const latest = idx.editions[0];
  const triage = readJson(path.join(root, "triage", `${latest.id}-${latest.publishedDate}.json`));

  return jsonResponse({
    latestEdition: {
      id: latest.id,
      publishedDate: latest.publishedDate,
      interests: latest.interests,
      addedSincePrevious: latest.addedSincePrevious ?? null,
      triageCandidatesCount: latest.triageCandidates ?? 0,
      ingestedAt: latest.ingestedAt,
      sourceUrl: `https://interests-api.parliament.uk/api/v1/Registers/${latest.id}`,
      humanUrl: `https://members.parliament.uk/members/commons/interests/publications`,
    },
    triageCandidates: (triage?.candidates || []).map((c) => ({
      memberName: c.memberName,
      memberParty: c.memberParty,
      memberConstituency: c.memberConstituency,
      category: c.category,
      summary: c.summary || null,
      registrationDate: c.registrationDate || null,
      publishedDate: c.publishedDate || null,
      rectified: !!c.rectified,
      reasons: c.reasons || [],
      interestId: c.interestId || null,
    })),
  }, { rate });
}
