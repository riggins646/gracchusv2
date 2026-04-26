"""
Standalone Python re-implementation of buildOverlapMatcher() from
src/lib/donor-aggregation.js — used to count donor↔supplier overlaps
before / after a CH-sidecar update.

Mirrors the JS three-pass logic:
  1. CH-number match (companiesHouse)         — high confidence
  2. exact normalised-name match (name)       — high confidence
  3. token-overlap (>=2 shared tokens >=4ch)  — medium confidence
  4. first-token containment (single-word
     supplier names of length >= 6)           — medium confidence

CH index sources, in priority order:
  - sidecar at src/data/supplier-companies-house.json (status="matched")
  - inline supplier fields companiesHouse / chNumber / companyRegistration

Usage:
  python3 scripts/verify-overlaps.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MONEY_MAP = ROOT / "src" / "data" / "money-map.json"
DONATIONS = ROOT / "src" / "data" / "donations-records.json"
SIDECAR = ROOT / "src" / "data" / "supplier-companies-house.json"


def normalise_firm_name(s):
    if not s:
        return ""
    n = str(s).lower()
    n = re.sub(r"[\(\),\.&'\"]", " ", n)
    n = re.sub(r"\b(ltd|limited|plc|llp|group|holdings|holding|services|the|company|co|inc|uk|gb)\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def aggregate_company_donors():
    data = json.loads(DONATIONS.read_text())
    records = data.get("donations", [])
    agg = {}
    for r in records:
        if r.get("s") not in ("Company", "Limited Liability Partnership"):
            continue
        donor = (r.get("d") or "").strip()
        if not donor:
            continue
        key = re.sub(r"[^a-z0-9]", "", donor.lower())
        if not key:
            continue
        e = agg.get(key)
        if not e:
            e = {
                "name": donor,
                "donorStatus": r.get("s"),
                "total": 0.0,
                "companyReg": r.get("c") or "",
            }
            agg[key] = e
        e["total"] += r.get("v") or 0
        if not e["companyReg"] and r.get("c"):
            e["companyReg"] = r.get("c")
        if len(donor) > len(e["name"]):
            e["name"] = donor
    out = []
    for e in agg.values():
        if not e["total"]:
            continue
        out.append({
            "key": re.sub(r"-+$", "", re.sub(r"^-+", "", re.sub(r"[^a-z0-9]+", "-", e["name"].lower())))[:64],
            "name": e["name"],
            "totalGBP": e["total"],
            "donorStatus": e["donorStatus"],
            "companyReg": e["companyReg"],
            "_normName": normalise_firm_name(e["name"]),
        })
    out.sort(key=lambda x: -x["totalGBP"])
    return out


def build_matcher(suppliers, ch_index):
    by_ch = {}
    by_name = {}
    name_entries = []
    single_token_by_label = {}
    for s in suppliers:
        if not s or s.get("kind") != "supplier":
            continue
        ch = ch_index.get(s["id"]) or s.get("companiesHouse") or s.get("chNumber") or s.get("companyRegistration")
        if ch:
            by_ch.setdefault(str(ch).strip(), s)
        labels = [s.get("label")] + list(s.get("aliases") or [])
        for lbl in labels:
            if not lbl:
                continue
            n = normalise_firm_name(lbl)
            if n:
                by_name.setdefault(n, s)
                name_entries.append((n, s))
        label_n = normalise_firm_name(s.get("label") or "")
        if label_n and " " not in label_n and len(label_n) >= 6:
            single_token_by_label.setdefault(label_n, s)

    def match(donor):
        if not donor:
            return None
        if donor["donorStatus"] not in ("Company", "Limited Liability Partnership"):
            return None
        if donor.get("companyReg"):
            hit = by_ch.get(str(donor["companyReg"]).strip())
            if hit:
                # Sanity guard — see donor-aggregation.js for rationale.
                dn = donor.get("_normName") or normalise_firm_name(donor["name"])
                dtoks = [t for t in dn.split() if len(t) >= 3]
                dset = set(dtoks)
                supplier_variants = [hit.get("label")] + list(hit.get("aliases") or [])
                supplier_variants = [v for v in supplier_variants if v]
                ok = False
                for variant in supplier_variants:
                    sn = normalise_firm_name(variant)
                    stoks = [t for t in sn.split() if len(t) >= 3]
                    if any(t in dset for t in stoks):
                        ok = True; break
                    found = False
                    for dt in dtoks:
                        for st in stoks:
                            if len(dt) >= 6 and dt[:6] in st: found = True; break
                            if len(st) >= 6 and st[:6] in dt: found = True; break
                        if found: break
                    if found: ok = True; break
                if ok:
                    return {"supplierId": hit["id"], "supplierLabel": hit["label"], "matchedBy": "companiesHouse", "confidence": "high"}
        n = donor.get("_normName") or normalise_firm_name(donor["name"])
        if not n:
            return None
        if n in by_name:
            hit = by_name[n]
            return {"supplierId": hit["id"], "supplierLabel": hit["label"], "matchedBy": "name", "confidence": "high"}
        if len(n) >= 6:
            donor_tokens = [t for t in n.split() if len(t) >= 4]
            if len(donor_tokens) >= 2:
                dset = set(donor_tokens)
                for skey, sval in name_entries:
                    if len(skey) < 6:
                        continue
                    supplier_tokens = [t for t in skey.split() if len(t) >= 4]
                    shared = sum(1 for t in supplier_tokens if t in dset)
                    if shared >= 2:
                        return {"supplierId": sval["id"], "supplierLabel": sval["label"], "matchedBy": "token-overlap", "confidence": "medium"}
            first_token = donor_tokens[0] if donor_tokens else n.split()[0]
            if first_token and len(first_token) >= 6:
                hit = single_token_by_label.get(first_token)
                if hit:
                    return {"supplierId": hit["id"], "supplierLabel": hit["label"], "matchedBy": "first-token", "confidence": "medium"}
        return None

    return match


def load_ch_index():
    if not SIDECAR.exists():
        return {}
    raw = json.loads(SIDECAR.read_text())
    matches = raw.get("matches", {})
    return {sid: m["company_number"] for sid, m in matches.items() if m.get("status") == "matched" and m.get("company_number")}


def report(label, suppliers, donors, ch_index):
    matcher = build_matcher(suppliers, ch_index)
    overlaps = []
    for d in donors:
        m = matcher(d)
        if m and m.get("supplierId"):
            overlaps.append({"donor": d["name"], "key": d["key"], "total": d["totalGBP"], **m})
    overlaps.sort(key=lambda x: -x["total"])
    print(f"\n=== {label} ===")
    print(f"overlap count: {len(overlaps)}")
    by_method = {}
    for o in overlaps:
        by_method[o["matchedBy"]] = by_method.get(o["matchedBy"], 0) + 1
    print(f"by method: {by_method}")
    for o in overlaps:
        print(f"  - {o['donor']:<55s} -> {o['supplierId']:<50s} ({o['matchedBy']}, {o['confidence']}, £{o['total']:,.0f})")
    return overlaps


def main():
    money = json.loads(MONEY_MAP.read_text())
    suppliers = [n for n in money.get("nodes", []) if n.get("kind") == "supplier"]
    donors = aggregate_company_donors()
    print(f"suppliers={len(suppliers)} company-donors={len(donors)}")

    before = report("BEFORE (no sidecar — name-only)", suppliers, donors, {})
    ch_index = load_ch_index()
    print(f"\nsidecar CH entries: {len(ch_index)}")
    after = report("AFTER (with sidecar — CH-first)", suppliers, donors, ch_index)

    before_keys = {(o["key"], o["supplierId"]) for o in before}
    after_keys = {(o["key"], o["supplierId"]) for o in after}
    new = after_keys - before_keys
    lost = before_keys - after_keys
    print(f"\n+ NEW overlaps surfaced: {len(new)}")
    for k, sid in sorted(new):
        rec = next(o for o in after if o["key"] == k and o["supplierId"] == sid)
        print(f"  + {rec['donor']} -> {sid} ({rec['matchedBy']})")
    if lost:
        print(f"\n- LOST overlaps (CH disagreed with name): {len(lost)}")
        for k, sid in sorted(lost):
            rec = next(o for o in before if o["key"] == k and o["supplierId"] == sid)
            print(f"  - {rec['donor']} -> {sid} ({rec['matchedBy']})")


if __name__ == "__main__":
    main()
