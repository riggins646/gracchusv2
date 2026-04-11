/**
 * In-memory rate limiter for Edge Runtime (no external dependencies).
 *
 * Uses a sliding-window counter per IP. State lives in module scope so it
 * persists across requests within the same isolate, but resets on cold start.
 * This is intentional — it gives you meaningful protection against burst
 * attacks with zero infrastructure, while Vercel's edge isolate model
 * limits the total memory footprint.
 *
 * For harder guarantees, swap this out for @upstash/ratelimit + Redis.
 */

const store = new Map(); // key → { count, resetAt }

const CLEANUP_INTERVAL = 60_000; // purge expired entries every 60s
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check whether a key (usually an IP) has exceeded its limit.
 *
 * @param {string} key         — identifier (IP address)
 * @param {number} maxRequests — allowed requests in the window
 * @param {number} windowMs    — window length in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(key, maxRequests = 5, windowMs = 60_000) {
  cleanup();
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Extract a usable IP from an Edge request.
 * Vercel populates x-forwarded-for; fall back to x-real-ip.
 */
export function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
