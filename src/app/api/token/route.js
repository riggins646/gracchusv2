/**
 * GET /api/token
 *
 * Issues a short-lived session token for AI endpoint requests.
 * The frontend fetches this on mount and includes it in headers.
 */

export const runtime = "edge";

import { createToken } from "@/lib/session-token";

export async function GET() {
  const token = await createToken();

  return Response.json(
    { token },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
