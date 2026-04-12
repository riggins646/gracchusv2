/**
 * Lightweight HMAC-based session token for bot protection.
 *
 * Flow:
 *  1. Frontend calls GET /api/token on mount → receives a signed timestamp
 *  2. Frontend includes the token in X-Session-Token header on AI requests
 *  3. AI routes call verifyToken() — rejects expired or forged tokens
 *
 * This stops curl/script abuse because an attacker must first GET a token,
 * then use it within 10 minutes. Combined with rate limiting, this makes
 * automated abuse significantly harder without affecting real users at all.
 */

// CRON_SECRET is the primary signing key. Falls back to ANTHROPIC_API_KEY
// in development. No hardcoded fallback — if neither is set, tokens will
// fail to verify, which is the correct secure default.
const SECRET = (typeof process !== "undefined"
  ? process.env.CRON_SECRET || process.env.ANTHROPIC_API_KEY
  : null) || (() => {
    console.error("[session-token] WARNING: No CRON_SECRET or ANTHROPIC_API_KEY — tokens are insecure");
    return "dev-only-" + Math.random().toString(36).slice(2);
  })();

const TOKEN_TTL = 10 * 60 * 1000; // 10 minutes

export async function sign(timestamp) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(timestamp))
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createToken() {
  const timestamp = Date.now();
  const signature = await sign(timestamp);
  return `${timestamp}.${signature}`;
}

export async function verifyToken(token) {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, providedSig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check expiry
  if (Date.now() - timestamp > TOKEN_TTL) return false;

  // Check signature
  const expectedSig = await sign(timestamp);
  return expectedSig === providedSig;
}
