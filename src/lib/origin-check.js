/**
 * Shared origin-check helper for the CSRF guard on POST API routes.
 *
 * Allows:
 *   - The two canonical production origins (gracchus.ai, www.gracchus.ai)
 *   - Whatever NEXT_PUBLIC_SITE_URL is set to (lets ops flip the canonical domain without a code change)
 *   - The live Vercel deployment URL (VERCEL_URL), so preview builds work
 *   - Vercel branch/preview URLs (VERCEL_BRANCH_URL, NEXT_PUBLIC_VERCEL_URL)
 *   - localhost:3000 when NODE_ENV === "development"
 *
 * A *missing* origin header is allowed (same-origin server-rendered fetch, or
 * a client that strips Origin). A *present but unrecognised* origin is rejected.
 *
 * Usage inside a route handler:
 *   const forbidden = checkOrigin(request);
 *   if (forbidden) return forbidden;
 */

function withProtocol(host) {
  if (!host) return null;
  if (host.startsWith("http://") || host.startsWith("https://")) return host;
  return "https://" + host;
}

export function getAllowedOrigins() {
  const origins = new Set([
    "https://gracchus.ai",
    "https://www.gracchus.ai",
  ]);

  const extras = [
    process.env.NEXT_PUBLIC_SITE_URL,
    withProtocol(process.env.VERCEL_URL),
    withProtocol(process.env.VERCEL_BRANCH_URL),
    withProtocol(process.env.NEXT_PUBLIC_VERCEL_URL),
  ];
  for (const e of extras) {
    if (e) origins.add(e.replace(/\/$/, ""));
  }

  if (process.env.NODE_ENV === "development") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

/**
 * @param {Request} request
 * @returns {Response | null}  Response when blocked, otherwise null.
 */
export function checkOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null; // same-origin / no-CORS fetches don't set Origin

  const allowed = getAllowedOrigins();
  if (allowed.has(origin)) return null;

  // Also allow any *.vercel.app preview — these are project-scoped and harmless
  // for CSRF because no user's gracchus.ai session cookie is valid on them.
  try {
    const host = new URL(origin).host;
    if (host.endsWith(".vercel.app")) return null;
  } catch {
    // fall through to Forbidden
  }

  return Response.json({ error: "Forbidden" }, { status: 403 });
}
