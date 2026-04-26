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
//
// In development, the fallback MUST be deterministic. Next.js compiles
// each API route into its own server module — /api/token runs on the
// edge runtime and /api/explain + /api/fix run on the node runtime,
// which are two distinct isolates. A random-per-module fallback meant
// the token route and the verify route each generated a *different*
// secret on startup, so every local AI request 401'd "Unauthorized".
// A fixed dev string is safe because it's never used in production:
// SECURITY (audit fix C1, 2026-04-26): we now THROW at module load if
// CRON_SECRET is missing in production, rather than just logging an
// error and silently using the dev string (which is in the source repo,
// so an attacker could forge tokens against any deploy that mis-set the
// env var). Fail closed.
// NEVER use ANTHROPIC_API_KEY as a signing secret — different rotation schedules.
const SECRET = (typeof process !== "undefined" ? process.env.CRON_SECRET : null)
  || (() => {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
      // Fail closed. Surfaces the misconfig immediately instead of
      // silently accepting forged tokens signed with the public dev string.
      throw new Error(
        "[session-token] CRITICAL: CRON_SECRET not set in production. " +
        "Refusing to fall back to dev secret — set the env var in Vercel."
      );
    }
    return "dev-only-shared-secret-do-not-use-in-production";
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

  // Check signature.
  // SECURITY (audit fix C2, 2026-04-26): use a constant-time comparison
  // rather than ===. Practically the timing leak over a Vercel edge call
  // is below the noise floor, but it's a one-line fix and removes a
  // theoretical oracle.
  const payload = `${timestamp}.${nonce}`;
  const expectedSig = await sign(payload);
  return constantTimeEqual(expectedSig, providedSig);
}

/**
 * Constant-time string comparison. Both inputs are HMAC-SHA256 hex strings
 * (length 64). We compare byte-by-byte and OR the diffs into an accumulator
 * so the loop always runs the same number of iterations regardless of where
 * the first mismatch sits. Length mismatch returns false but still walks the
 * full length of `a` to keep timing uniform.
 */
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  // OR length difference into the result so unequal-length inputs reject
  // without a short-circuit early return.
  let diff = a.length ^ b.length;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    diff |= a.charCodeAt(i) ^ (i < b.length ? b.charCodeAt(i) : 0);
  }
  return diff === 0;
}
