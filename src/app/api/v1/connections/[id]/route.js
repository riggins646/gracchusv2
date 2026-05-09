import { jsonResponse, errorResponse, rateLimit, corsPreflight } from "../../_lib";
import individualConnections from "../../../../../data/individual-connections.json";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  return (individualConnections.connections || []).map((c) => ({ id: c.id }));
}

export function OPTIONS() { return corsPreflight(); }

export async function GET(req, { params }) {
  const rate = rateLimit(req);
  if (!rate.ok) return errorResponse("rate_limited", "Too many requests.", { status: 429, rate });

  const conn = (individualConnections.connections || []).find((c) => c.id === params.id);
  if (!conn) return errorResponse("not_found", `No connection at id "${params.id}"`, { status: 404, rate });

  const person = (individualConnections.people || []).find((p) => p.id === conn.personId);

  return jsonResponse({
    id: conn.id,
    connectionType: conn.connectionType,
    status: conn.status,
    liveProceedings: !!conn.liveProceedings,
    summary: conn.summary || null,
    detail: conn.detail || null,
    person: person
      ? {
          id: person.id,
          name: person.name,
          kind: person.kind || "person",
          party: person.party || null,
          headline: person.headline || null,
          rolesHeld: person.rolesHeld || [],
          externalLinks: person.externalLinks || [],
        }
      : { id: conn.personId },
    counterparty: conn.counterparty || null,
    timeframe: conn.timeframe || null,
    financial: conn.financial || null,
    regulatoryFindings: conn.regulatoryFindings || [],
    sources: conn.sources || [],
  }, { rate });
}
