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

  // Parse origin once for the remaining host-based checks.
  let originHost = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // Malformed Origin — fall through to Forbidden below.
  }

  if (originHost) {
    // Same-origin bypass: if the Origin's host matches the request's own
    // Host header, this is a same-origin request by definition — CSRF is
    // about cross-origin forgery, not requests back to the same site. This
    // lets the app run under any custom domain (gracchus.com, a vanity
    // alias, a future rebrand) without a code change. An attacker who
    // tries to CSRF from evil.com still gets rejected because their Origin
    // host and our Host header disagree.
    const selfHost = request.headers.get("host");
    if (selfHost && originHost === selfHost) return null;

    // Any subdomain of gracchus.ai — staging, preview, alias — is ours.
    if (originHost === "gracchus.ai" || originHost.endsWith(".gracchus.ai")) {
      return null;
    }

    // SECURITY (audit fix B1, 2026-04-26): the previous blanket
    // `endsWith(".vercel.app")` allowed any Vercel-hosted origin in the
    // world to pass the CSRF check. An attacker hosting a free
    // `evil.vercel.app` page could embed an auto-submitting form. The
    // session-token gate then becomes the only line of defence — too
    // narrow a margin. Drop the blanket: rely instead on (a) the
    // canonical origins added in getAllowedOrigins(), and (b) the
    // VERCEL_URL / VERCEL_BRANCH_URL env vars Vercel injects per-project
    // (already collected in getAllowedOrigins above), so our own
    // previews still pass.
  }

  // Log the rejection in prod logs so a bad origin surfaces on Vercel
  // rather than being invisible to the user ("Forbidden" with no detail).
  console.warn("[origin-check] rejected origin:", origin, "host:", request.headers.get("host"));
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
