import { jsonResponse, errorResponse, rateLimit, corsPreflight } from "../_lib";
import individualConnections from "../../../../data/individual-connections.json";

export const dynamic = "force-static";
export const revalidate = 3600;

export function OPTIONS() { return corsPreflight(); }

export async function GET(req) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const connectionType = url.searchParams.get("type");
  const personId = url.searchParams.get("personId");

  let conns = individualConnections.connections || [];
  if (status) conns = conns.filter((c) => c.status === status);
  if (connectionType) conns = conns.filter((c) => c.connectionType === connectionType);
  if (personId) conns = conns.filter((c) => c.personId === personId);

  // Build a lookup from personId -> person summary so the API result is
  // self-contained for callers who don't want a second request.
  const personById = new Map(
    (individualConnections.people || []).map((p) => [p.id, {
      id: p.id,
      name: p.name,
      kind: p.kind || "person",
      party: p.party || null,
      headline: p.headline || null,
    }])
  );

  const data = conns.map((c) => ({
    id: c.id,
    person: personById.get(c.personId) || { id: c.personId },
    connectionType: c.connectionType,
    status: c.status,
    liveProceedings: !!c.liveProceedings,
    summary: c.summary || null,
    counterparty: c.counterparty || null,
    timeframe: c.timeframe || null,
    financial: c.financial || null,
    regulatoryFindings: c.regulatoryFindings || [],
    primarySources: (c.sources || []).filter((s) => s.tier === "primary"),
    allSources: c.sources || [],
    href: `https://gracchus.ai/api/v1/connections/${c.id}`,
  }));

  return jsonResponse(data, {
    rate,
    meta: {
      total: data.length,
      filters: { status, type: connectionType, personId },
      filtersAvailable: {
        status: ["closed_with_finding", "closed_approved", "live_proceedings", "public_record", "reported"],
        type: Object.keys(individualConnections.connectionTypes || {}),
      },
      editorialNotes: individualConnections.editorialNotes || null,
    },
  });
}
