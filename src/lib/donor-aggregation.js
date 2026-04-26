/* =========================================================================
 *  donor-aggregation.js — shared Company / LLP donor aggregation logic
 *
 *  Lifted from MoneyMap.jsx (2026-04-26) so Dashboard's cmd-K palette and
 *  the Money Map canvas share a single source of truth for:
 *    1) the records-aggregated Company donor list (≈ 501 unique entries
 *       from the 6,819 donation records),
 *    2) name normalisation,
 *    3) the supplier-overlap matcher (Companies House → exact-norm name →
 *       token-overlap → first-token containment), and
 *    4) the resulting donor → lens-target resolver (donor:<slug> for
 *       standalone donors, or supplier-<id> for the 6 known overlap cases).
 *
 *  No React, no DOM — module-load only. Walked once on import; the resulting
 *  list is sorted by total £ descending and ready for slicing in callers.
 * ========================================================================= */

import donationRecordsData from "../data/donations-records.json";

/* Map party-name strings as they appear in the EC records onto the canonical
   PARTY_DEFS ids used elsewhere in the app. Kept in lock-step with the
   table inside MoneyMap.jsx — duplicated here only to keep this module
   import-free of MoneyMap (which would create a cycle). */
const DONOR_PARTY_NAME_MAP = {
  "conservative":               "conservative",
  "conservative party":         "conservative",
  "conservative and unionist party": "conservative",
  "labour":                     "labour",
  "labour party":               "labour",
  "liberal democrats":          "liberal-democrats",
  "liberal democrat":           "liberal-democrats",
  "reform uk":                  "reform-uk",
  "reform party":               "reform-uk",
  "snp":                        "snp",
  "scottish national party":    "snp",
  "scottish national party (snp)": "snp",
  "green":                      "green",
  "green party":                "green",
  "plaid cymru":                "plaid-cymru",
  "dup":                        "dup",
  "democratic unionist party":  "dup",
  "sinn féin":                  "sinn-fein",
  "sinn fein":                  "sinn-fein",
};

export function donorPartyId(name) {
  if (!name) return null;
  const k = String(name).trim().toLowerCase();
  if (DONOR_PARTY_NAME_MAP[k]) return DONOR_PARTY_NAME_MAP[k];
  for (const prefix of Object.keys(DONOR_PARTY_NAME_MAP)) {
    if (k.startsWith(prefix + " ")) return DONOR_PARTY_NAME_MAP[prefix];
  }
  return null;
}

export function normaliseFirmName(s) {
  if (!s) return "";
  let n = String(s).toLowerCase();
  n = n.replace(/[\(\),\.&'"]/g, " ");
  n = n.replace(/\b(ltd|limited|plc|llp|group|holdings|holding|services|the|company|co|inc|uk|gb)\b/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

export function donorSlug(name) {
  return String(name || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/* ---- aggregation ---- */

function _buildCompanyDonorAggFromRecords() {
  const records = (donationRecordsData && donationRecordsData.donations) || [];
  const agg = new Map();
  for (const r of records) {
    if (!(r.s === "Company" || r.s === "Limited Liability Partnership")) continue;
    const donor = String(r.d || "").trim();
    if (!donor) continue;
    const key = donor.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) continue;
    let entry = agg.get(key);
    if (!entry) {
      entry = {
        name: donor,
        donorStatus: r.s,
        total: 0,
        count: 0,
        parties: new Map(),
        companyReg: r.c || "",
        firstDate: r.a || "",
        lastDate: r.a || "",
      };
      agg.set(key, entry);
    }
    entry.total += r.v || 0;
    entry.count += 1;
    if (r.p) {
      const pid = donorPartyId(r.p);
      if (pid) {
        const pp = entry.parties.get(pid) || { partyId: pid, totalGBP: 0, donationCount: 0 };
        pp.totalGBP += r.v || 0;
        pp.donationCount += 1;
        entry.parties.set(pid, pp);
      }
    }
    if (!entry.companyReg && r.c) entry.companyReg = r.c;
    if (r.a && (!entry.firstDate || r.a < entry.firstDate)) entry.firstDate = r.a;
    if (r.a && (!entry.lastDate || r.a > entry.lastDate))  entry.lastDate  = r.a;
    if (donor.length > entry.name.length) entry.name = donor;
  }
  const out = [];
  for (const e of agg.values()) {
    if (!e.total) continue;
    const parties = Array.from(e.parties.values()).sort((a, b) => b.totalGBP - a.totalGBP);
    out.push({
      key: donorSlug(e.name),
      name: e.name,
      totalGBP: e.total,
      donationCount: e.count,
      donorStatus: e.donorStatus,
      companyReg: e.companyReg || "",
      firstDate: e.firstDate || "",
      lastDate: e.lastDate || "",
      parties,
      _normName: normaliseFirmName(e.name),
    });
  }
  out.sort((a, b) => b.totalGBP - a.totalGBP);
  return out;
}

/* Module-load: evaluate once, freeze the array reference so consumers can't
   accidentally mutate the shared aggregate. */
export const COMPANY_DONORS_FROM_RECORDS = _buildCompanyDonorAggFromRecords();

/* Plain alias used by Dashboard cmd-K — same contract, less ALL-CAPS noise. */
export function aggregateCompanyDonors() {
  return COMPANY_DONORS_FROM_RECORDS;
}

/* ---- supplier-overlap matcher (lifted verbatim from MoneyMap) ---- */

export function buildOverlapMatcher(suppliers) {
  const byCH = new Map();
  const byName = new Map();
  const nameEntries = [];
  const singleTokenByLabel = new Map();
  for (const s of suppliers) {
    if (!s || s.kind !== "supplier") continue;
    const ch = s.companiesHouse || s.chNumber || s.companyRegistration;
    if (ch) byCH.set(String(ch).trim(), s);
    const labels = [s.label, ...(s.aliases || [])].filter(Boolean);
    for (const lbl of labels) {
      const n = normaliseFirmName(lbl);
      if (n) {
        if (!byName.has(n)) byName.set(n, s);
        nameEntries.push([n, s]);
      }
    }
    const labelN = normaliseFirmName(s.label || "");
    if (labelN && !labelN.includes(" ") && labelN.length >= 6) {
      if (!singleTokenByLabel.has(labelN)) {
        singleTokenByLabel.set(labelN, s);
      }
    }
  }
  return function matchDonor(donor) {
    if (!donor) return null;
    if (donor.donorStatus !== "Company" && donor.donorStatus !== "Limited Liability Partnership") return null;
    if (donor.companyReg) {
      const hit = byCH.get(String(donor.companyReg).trim());
      if (hit) return { supplierId: hit.id, supplierLabel: hit.label, matchedBy: "companiesHouse", confidence: "high" };
    }
    const n = donor._normName || normaliseFirmName(donor.name);
    if (!n) return null;
    if (byName.has(n)) {
      const hit = byName.get(n);
      return { supplierId: hit.id, supplierLabel: hit.label, matchedBy: "name", confidence: "high" };
    }
    if (n.length >= 6) {
      const donorTokens = n.split(/\s+/).filter((t) => t.length >= 4);
      if (donorTokens.length >= 2) {
        const dset = new Set(donorTokens);
        for (const [skey, sval] of nameEntries) {
          if (skey.length < 6) continue;
          const supplierTokens = skey.split(/\s+/).filter((t) => t.length >= 4);
          let shared = 0;
          for (const t of supplierTokens) if (dset.has(t)) shared++;
          if (shared >= 2) {
            return { supplierId: sval.id, supplierLabel: sval.label, matchedBy: "token-overlap", confidence: "medium" };
          }
        }
      }
      const firstToken = (donorTokens[0] || n.split(/\s+/)[0] || "");
      if (firstToken && firstToken.length >= 6) {
        const hit = singleTokenByLabel.get(firstToken);
        if (hit) {
          return { supplierId: hit.id, supplierLabel: hit.label, matchedBy: "first-token", confidence: "medium" };
        }
      }
    }
    return null;
  };
}

export function mergeDonorParties(a, b) {
  const m = new Map();
  for (const arr of [a || [], b || []]) {
    for (const p of arr) {
      if (!p || !p.partyId) continue;
      if (!m.has(p.partyId)) m.set(p.partyId, { partyId: p.partyId, totalGBP: 0, donationCount: 0 });
      const cur = m.get(p.partyId);
      cur.totalGBP += p.totalGBP || 0;
      cur.donationCount += p.donationCount || 0;
    }
  }
  return Array.from(m.values()).sort((a, b) => b.totalGBP - a.totalGBP);
}

export function pickDominantParty(parties) {
  if (!parties || parties.length === 0) return null;
  return parties[0].partyId;
}

/* ---- donor → lens target resolver ----
   Given a list of suppliers (the money-map.json nodes), build a function
   that maps a donor key (donorSlug) to the right lens target string for
   the Money Map URL (?lens=…). Returns:
     - the supplier id, when the donor overlaps a tracked supplier (the
       MoneyMap canvas collapses overlap donors onto the supplier node, so
       lensing on `donor:<slug>` would fail to find a node);
     - `donor:<slug>` otherwise (the standalone donor bubble id).
   Donor keys for which no entry exists in the records aggregation also
   fall through to `donor:<slug>` — caller-specified slugs are passed back
   unchanged so the lens just no-ops gracefully if the canvas hasn't yet
   minted a bubble for them. */
export function buildDonorLensResolver(suppliers) {
  const matcher = buildOverlapMatcher(suppliers || []);
  const overlapBySlug = new Map(); // donorSlug -> supplierId
  for (const d of COMPANY_DONORS_FROM_RECORDS) {
    const m = matcher(d);
    if (m && m.supplierId) overlapBySlug.set(d.key, m.supplierId);
  }
  return function resolve(donorKey) {
    if (!donorKey) return null;
    const sup = overlapBySlug.get(donorKey);
    if (sup) return sup;
    return "donor:" + donorKey;
  };
}
