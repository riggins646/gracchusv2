/**
 * Shared helpers for the v1 public read API.
 *
 * - jsonResponse: standardised JSON response with CORS, caching and meta envelope
 * - errorResponse: error response with the same envelope
 * - rateLimit: per-IP in-memory rate limit (60 requests / minute by default)
 *
 * Files prefixed with `_` are not treated as routes by the Next.js app router,
 * so this file is safe to colocate with the route handlers it serves.
 */

const DEFAULT_CACHE_SECONDS = 3600; // 1 hour CDN cache; data refreshes daily

/**
 * In-memory rate-limit buckets, keyed by IP. Resets per minute. Each
 * serverless instance maintains its own Map — fine for "be polite" enforcement;
 * for real abuse protection swap to Vercel KV / Upstash later.
 */
const buckets = new Map();

export function rateLimit(req, { limit = 60, windowMs = 60_000 } = {}) {
  // Standard headers Next.js gives us behind any reverse proxy.
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs, limit };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt, limit, retryAfterSeconds: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt, limit };
}

/**
 * Standard CORS + caching headers. Open allow-list because the dataset is
 * intentionally public (Open Government Licence equivalents on every primary
 * source).
 */
function baseHeaders({ cacheSeconds = DEFAULT_CACHE_SECONDS } = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=300`,
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * Build a successful JSON response with the standard envelope:
 * { data, meta: { ... } }
 */
export function jsonResponse(data, { meta = {}, cacheSeconds, status = 200, rate } = {}) {
  const body = {
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      apiVersion: "v1",
      license: "Open Government Licence v3.0 — see https://www.gracchus.ai/standards",
      attribution: "Cite as: Gracchus (gracchus.ai) — non-partisan, source-backed audit of UK government performance.",
      ...meta,
    },
  };
  const headers = baseHeaders({ cacheSeconds });
  if (rate) {
    headers["X-RateLimit-Limit"] = String(rate.limit);
    headers["X-RateLimit-Remaining"] = String(rate.remaining);
    headers["X-RateLimit-Reset"] = String(Math.ceil(rate.resetAt / 1000));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Build an error JSON response. status defaults to 400.
 */
export function errorResponse(code, message, { status = 400, rate } = {}) {
  const body = {
    error: { code, message },
    meta: { generatedAt: new Date().toISOString(), apiVersion: "v1" },
  };
  const headers = baseHeaders({ cacheSeconds: 0 });
  if (rate) {
    headers["X-RateLimit-Limit"] = String(rate.limit);
    headers["X-RateLimit-Remaining"] = String(rate.remaining);
    headers["X-RateLimit-Reset"] = String(Math.ceil(rate.resetAt / 1000));
    if (rate.retryAfterSeconds) headers["Retry-After"] = String(rate.retryAfterSeconds);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * OPTIONS handler for CORS preflight. Each route should re-export this.
 */
export function corsPreflight() {
  return new Response(null, { status: 204, headers: baseHeaders({ cacheSeconds: 86400 }) });
}

/**
 * Slug helper — match the same logic used by /projects/[slug] so a slug
 * resolved on the website resolves identically through the API.
 */
export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
