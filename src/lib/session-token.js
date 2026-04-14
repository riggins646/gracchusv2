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

// CRON_SECRET is the signing key for session tokens.
// In development only, falls back to a random string.
// NEVER use ANTHROPIC_API_KEY as a signing secret — different rotation schedules.
const SECRET = (typeof process !== "undefined" ? process.env.CRON_SECRET : null)
  || (() => {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
      console.error("[session-token] CRITICAL: CRON_SECRET not set in production");
    }
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
  // Add cryptographic nonce to prevent timestamp prediction attacks
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const payload = `${timestamp}.${nonce}`;
  const signature = await sign(payload);
  return `${timestamp}.${nonce}.${signature}`;
}

export async function verifyToken(token) {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [timestampStr, nonce, providedSig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  if (!nonce || nonce.length !== 32) return false;

  // Check expiry
  if (Date.now() - timestamp > TOKEN_TTL) return false;

  // Check signature
  const payload = `${timestamp}.${nonce}`;
  const expectedSig = await sign(payload);
  return expectedSig === providedSig;
}
