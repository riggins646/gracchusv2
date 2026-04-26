/* =========================================================================
 *  mp-aggregation — match a Money Map PersonDetail subject to their entry
 *  in the current-parliament Register of Members' Financial Interests
 *  (the 650-record dataset already powering the Transparency → MP Pay view).
 *
 *  Used by MoneyMap.jsx PersonDetail to surface declared outside income,
 *  gifts, donations, paid-roles count, shareholdings count and family-member
 *  count next to the historical connection record. Peers and non-MP subjects
 *  silently miss — they're not on the Commons register.
 * ========================================================================= */
import mpRecordsData from "../data/mp-records.json";

const MPS = mpRecordsData?.mps || [];

/* Normalise a personal name for matching.
 *  - lowercase
 *  - strip common honorifics + post-noms (Sir, Dame, Lord, Lady, Baroness,
 *    Baron, the, Rt Hon, Mr, Mrs, Ms, Dr, KC, CBE, OBE, MBE)
 *  - drop middle initials ("J. " etc.)
 *  - strip non-alphanumerics, collapse whitespace */
function normalise(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\b(sir|dame|lord|lady|baroness|baron|the|rt hon|rt\.? hon\.?|mr|mrs|ms|dr|kc|cbe|obe|mbe)\b/g, " ")
    .replace(/\b[a-z]\.\s/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MP_BY_NORMAL_NAME = new Map();
for (const mp of MPS) {
  const k = normalise(mp.n);
  if (k) MP_BY_NORMAL_NAME.set(k, mp);
}

/* Match a PersonDetail subject to an MP record by name.
 *  - Tries exact normalised match first.
 *  - Falls back to last-name match with first-initial guard to handle
 *    canonical-name divergence ("Sir Geoffrey Cox KC" → "Geoffrey Cox").
 *  - Returns null for peers, former MPs not in the current parliament,
 *    and any other miss. */
export function matchMpRecord(personName) {
  const k = normalise(personName);
  if (!k) return null;
  const exact = MP_BY_NORMAL_NAME.get(k);
  if (exact) return exact;
  const tokens = k.split(" ");
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const firstInitial = tokens[0][0];
    for (const [mpKey, mp] of MP_BY_NORMAL_NAME.entries()) {
      const mpTokens = mpKey.split(" ");
      if (mpTokens.length >= 2 && mpTokens[mpTokens.length - 1] === last) {
        if (mpTokens[0][0] === firstInitial) return mp;
      }
    }
  }
  return null;
}
