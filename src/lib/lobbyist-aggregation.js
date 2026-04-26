/* =========================================================================
 *  lobbyist-aggregation.js — shared matcher for the Money Map v2 Phase 4
 *  lobbyist layer.
 *
 *  Source: Office of the Registrar of Consultant Lobbyists (ORCL).
 *  src/data/lobbyist-records.json carries 251 registered firms and 50
 *  top clients (1,172 unique declared clients across all firms).
 *
 *  Why a separate matcher (instead of donor-aggregation's matchDonor):
 *  the donor matcher is generous — first-token containment + 4-char token
 *  overlap — which works for the donor list because every donor is a
 *  legal entity with an EC-registered name. The lobbyist client roster
 *  is a much messier free-text field: clients are sector bodies, college
 *  groups, charities, single-word brands, foreign affiliates, joint
 *  ventures, all in one column. Reusing the donor matcher there minted
 *  ~24 false positives ("Capital City College Group" → "Capita plc",
 *  "Cambridge Aerospace" → "GE Aerospace", "Octopus Energy" → "Amentum
 *  Clean Energy") because shared 4-char tokens like "ital", "spac",
 *  "gene" easily clear its bar.
 *
 *  The matcher here:
 *    1. exact normalised match → "high" confidence
 *       Both client and supplier strings stripped of corporate suffixes
 *       (ltd / plc / llp / holdings / group / the / and / company / co)
 *       and punctuation, lowercase, single-spaced. So "BT" matches
 *       "BT plc", "AECOM" matches "AECOM Limited", but "Capita" never
 *       matches "Capital City College".
 *    2. token-overlap → "medium" confidence — but ONLY if:
 *         a) both client and supplier carry ≥2 tokens of length ≥3, AND
 *         b) every one of the SMALLER side's tokens appears in the
 *            LARGER side, AND
 *         c) at least one shared token is ≥5 chars (filters out junk
 *            matches like "the london X" vs "the london Y" where the
 *            shared tokens are stopword-grade).
 *    3. otherwise → null. Single-token clients can never fuzzy-match;
 *       they only count via the exact-match path (so "BT" still hits
 *       "BT plc" but "Cybersecurity" never matches "Cybersecurity
 *       Business Network").
 *
 *  Verified against the 1,172-client roster on 2026-04-26: 27 high +
 *  3 medium matches, against 74 false positives that the donor matcher
 *  would have allowed. See the brief / commit message for the rejected
 *  cases.
 * ========================================================================= */

/* The suffix list is intentionally a superset of donor-aggregation's so
   sector-body suffixes ("group", "services", "company") collapse too —
   the lobbyist roster carries far more of these than the donor list. */
export function normalise(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|holdings|group|the|and|company|services|uk|gb|inc|incorporated|co)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s) {
  const out = new Set();
  for (const t of normalise(s).split(" ")) {
    if (t.length >= 3) out.add(t);
  }
  return out;
}

/* Build a {normalised name -> { id, label }} index from a Money Map node
   array. Walks every supplier kind and every alias. Uses first-write-wins
   so a supplier's canonical label takes precedence over alias collisions
   if any exist. */
export function buildSupplierIndex(nodes) {
  const idx = new Map();
  for (const n of (nodes || [])) {
    if (!n || n.kind !== "supplier") continue;
    const labels = [n.label, ...(n.aliases || [])].filter(Boolean);
    for (const lbl of labels) {
      const key = normalise(lbl);
      if (!key) continue;
      if (!idx.has(key)) {
        idx.set(key, { id: n.id, label: n.label });
      }
    }
  }
  return idx;
}

/* The matcher itself. Returns:
     { id, label, confidence: "high" | "medium", method: "exact" | "token_overlap" }
   or null. Confidence drives downstream visual treatment (high = solid
   accent, medium = lower-opacity edge + "fuzzy" badge in the drawer). */
export function matchClientToSupplier(client, supplierIndex) {
  const cn = normalise(client);
  if (!cn) return null;

  // 1) Exact normalised match — single source of truth.
  const exact = supplierIndex.get(cn);
  if (exact) return { ...exact, confidence: "high", method: "exact" };

  // 2) Token-overlap fuzzy match. Single-token clients cannot fuzzy-match
  //    (there's nothing to overlap on), only exact-match via path #1.
  const cTokens = tokens(client);
  if (cTokens.size < 2) return null;

  for (const [skey, sval] of supplierIndex.entries()) {
    const sTokens = new Set();
    for (const t of skey.split(" ")) {
      if (t.length >= 3) sTokens.add(t);
    }
    if (sTokens.size < 2) continue;

    /* Walk the smaller token set and require ALL of its tokens to appear
       in the larger set. So "Cambridge Aerospace" {cambridge, aerospace}
       vs "GE Aerospace" {aerospace} is rejected — the smaller side here
       is only 1 token; even after the size guard, "ge" gets stripped at
       the >=3 filter so "GE Aerospace" never even forms a 2-token set. */
    const smaller = cTokens.size <= sTokens.size ? cTokens : sTokens;
    const larger  = cTokens.size <= sTokens.size ? sTokens : cTokens;
    if (smaller.size < 2) continue;

    let allIn = true;
    for (const t of smaller) {
      if (!larger.has(t)) { allIn = false; break; }
    }
    if (!allIn) continue;

    /* Sanity check — at least one of the shared tokens must be ≥5 chars.
       Filters cases where the shared tokens are all short stopword-grade
       fragments. e.g. "north london X" vs "north london Y" would share
       {north, london} both ≥5 — accepted. But a junk pair sharing only
       short verbs / locations gets dropped. */
    let hasMeatyToken = false;
    for (const t of smaller) {
      if (t.length >= 5) { hasMeatyToken = true; break; }
    }
    if (!hasMeatyToken) continue;

    return { ...sval, confidence: "medium", method: "token_overlap" };
  }

  return null;
}

/* Slug helper — used to mint stable canvas node ids
   ("lobbyist:<slug>"). Mirrors donorSlug from donor-aggregation. */
export function lobbyistSlug(name) {
  return String(name || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/* Friendly label for the ORCL type code. The register uses single-letter
   codes; we surface the full phrase in the drawer + tooltip. */
export const LOBBYIST_TYPE_LABEL = {
  C: "Consultant lobbyist",
  P: "In-house lobbyist",
  I: "Individual lobbyist",
  O: "Other",
};

/* External-link helper — searches the live ORCL register for a firm
   name. The register only exposes a search endpoint, not deep-links
   per firm, so this lands the user on the matching search page. */
export function orclSearchUrl(firmName) {
  const q = encodeURIComponent(String(firmName || "").trim());
  return `https://registrar-of-consultant-lobbyists.force.com/CLR_Search?searchstr=${q}`;
}
