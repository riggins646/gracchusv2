/**
 * GET /api/token
 *
 * Issues a short-lived session token for AI endpoint requests.
 * The frontend fetches this on mount and includes it in headers.
 *
 * Rate limited: 10 requests per minute per IP.
 */

export const runtime = "edge";

import { createToken } from "@/lib/session-token";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request) {
  // ── Rate limiting: 10 per minute per IP ─────────────────────
  const ip = getClientIp(request);
  const rl = rateLimit(`token:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const token = await createToken();

  return Response.json(
    { token },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
