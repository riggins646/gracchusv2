"""
Resolve Companies House registration numbers for Gracchus tracked suppliers.

Three complementary passes — all write into the SAME sidecar at
src/data/supplier-companies-house.json:

  1. seed-from-donors (default first pass, no network needed)
       Walks src/data/donations-records.json and, for any donor record that
       carries a Companies House number AND whose normalised name matches a
       tracked supplier's normalised name (or alias) exactly, records that
       CH number against the supplier with confidence "high",
       method "donor-records-exact-name". (Electoral Commission data is
       primary-source — winners on conflict.)

  2. seed-from-projects (second pass, no network needed)
       Walks src/data/project-contractors.json and pulls CH numbers from
       contractor / member / jvMember entries where they're already tagged
       on the contractor record. Confidence "high",
       method "project-contractors-exact-name". Skipped for any supplier
       whose CH was already set by donor records.

  3. lookup-via-api  (optional third pass; needs COMPANIES_HOUSE_API_KEY)
       Hits the public CH search API for every still-uncached supplier in
       value-descending order, picks the best hit by token-Jaccard >= 0.5
       (skipping dissolved companies), and records it with confidence
       "high"/"medium" depending on score.

Resumable: both passes skip suppliers already in the cache.
Cache-aware: writes after each lookup so a Ctrl-C / timeout doesn't lose
progress. Defensive: only records a CH if confidence is acceptable;
ambiguous cases written to scripts/ch-lookup-review.md for manual review.

Usage:
  python3 scripts/match-supplier-ch-numbers.py                # both passes
  python3 scripts/match-supplier-ch-numbers.py --no-api       # seed only
  python3 scripts/match-supplier-ch-numbers.py --api-only     # API only
  python3 scripts/match-supplier-ch-numbers.py --batch-limit 50

Note: the public CH API requires a free auth key. Register at
https://developer.company-information.service.gov.uk/ and export
COMPANIES_HOUSE_API_KEY in your shell. Anonymous calls return HTTP 401.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUPPLIERS_FILE = ROOT / "src" / "data" / "money-map.json"
DONATIONS_FILE = ROOT / "src" / "data" / "donations-records.json"
PROJECTS_FILE = ROOT / "src" / "data" / "project-contractors.json"
OUTPUT_FILE = ROOT / "src" / "data" / "supplier-companies-house.json"
REVIEW_FILE = ROOT / "scripts" / "ch-lookup-review.md"

CH_SEARCH_URL = "https://api.company-information.service.gov.uk/search/companies"


# --------------------------------------------------------------------------
# Name normalisation — kept in lock-step with normaliseFirmName() in
# src/lib/donor-aggregation.js so cache keys and live matcher behave
# identically.
# --------------------------------------------------------------------------
def normalise_firm_name(s):
    if not s:
        return ""
    n = str(s).lower()
    n = re.sub(r"[\(\),\.&'\"]", " ", n)
    n = re.sub(
        r"\b(ltd|limited|plc|llp|group|holdings|holding|services|the|company|co|inc|uk|gb)\b",
        " ",
        n,
    )
    n = re.sub(r"\s+", " ", n).strip()
    return n


def tokens(s, min_len=3):
    return set(t for t in normalise_firm_name(s).split(" ") if len(t) >= min_len)


# --------------------------------------------------------------------------
# Cache I/O
# --------------------------------------------------------------------------
def load_cache():
    if not OUTPUT_FILE.exists():
        return {}
    raw = json.loads(OUTPUT_FILE.read_text())
    return raw.get("matches", {})


def write_cache(cache):
    OUTPUT_FILE.write_text(
        json.dumps(
            {
                "schemaVersion": "supplier-ch.v1",
                "updatedAt": time.strftime("%Y-%m-%d"),
                "source": "scripts/match-supplier-ch-numbers.py",
                "matches": cache,
            },
            indent=2,
        )
    )


# --------------------------------------------------------------------------
# Pass 1 — seed from donations-records.json (no network)
# --------------------------------------------------------------------------
def seed_from_donors(suppliers, cache):
    donations = json.loads(DONATIONS_FILE.read_text()).get("donations", [])

    sup_by_norm = {}
    for s in suppliers:
        for lbl in [s.get("label")] + list(s.get("aliases") or []):
            n = normalise_firm_name(lbl)
            if n:
                sup_by_norm.setdefault(n, []).append(s)

    donor_ch_by_norm = {}
    for r in donations:
        if r.get("s") not in ("Company", "Limited Liability Partnership"):
            continue
        if not r.get("c") or not r.get("d"):
            continue
        n = normalise_firm_name(r["d"])
        if not n:
            continue
        donor_ch_by_norm.setdefault(n, set()).add((r["c"].strip(), r["d"]))

    seeded = 0
    for n, suplist in sup_by_norm.items():
        if n not in donor_ch_by_norm:
            continue
        chs = donor_ch_by_norm[n]
        # Reject if donor records disagree on the CH number for this name.
        unique_chs = {ch for (ch, _) in chs}
        if len(unique_chs) != 1:
            continue
        ch = next(iter(unique_chs))
        donor_name = sorted(chs)[0][1]
        for sup in suplist:
            sid = sup["id"]
            if sid in cache:
                continue
            cache[sid] = {
                "status": "matched",
                "name": sup["label"],
                "company_number": ch,
                "title": donor_name,
                "confidence": "high",
                "score": 1.0,
                "method": "donor-records-exact-name",
            }
            seeded += 1
    return seeded


# --------------------------------------------------------------------------
# Pass 2 — seed from project-contractors.json (no network)
# --------------------------------------------------------------------------
def seed_from_projects(suppliers, cache, review_notes):
    data = json.loads(PROJECTS_FILE.read_text())

    # Walk every dict node — collect (name, CH) pairs from any node that
    # carries both a name field and a companiesHouseNumber.
    pairs = {}  # norm-name -> {CH: count}
    def walk(o):
        if isinstance(o, dict):
            ch = o.get("companiesHouseNumber") or o.get("contractingAuthorityCompaniesHouse")
            nm = o.get("name") or o.get("memberName") or o.get("label")
            if ch and nm:
                n = normalise_firm_name(nm)
                if n:
                    bucket = pairs.setdefault(n, {})
                    bucket[str(ch).strip()] = bucket.get(str(ch).strip(), 0) + 1
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)
    walk(data)

    seeded = 0
    for s in suppliers:
        sid = s["id"]
        if sid in cache:
            continue
        for lbl in [s.get("label")] + list(s.get("aliases") or []):
            n = normalise_firm_name(lbl)
            if not n or n not in pairs:
                continue
            chs = pairs[n]
            if len(chs) != 1:
                # Conflicting CH numbers for the same name in projects data;
                # don't seed but flag for review.
                review_notes.append(
                    f"- `{sid}` ({s['label']}) -> conflicting project-contractor CH values: {dict(chs)}"
                )
                break
            ch = next(iter(chs))
            cache[sid] = {
                "status": "matched",
                "name": s["label"],
                "company_number": ch,
                "title": lbl,
                "confidence": "high",
                "score": 1.0,
                "method": "project-contractors-exact-name",
            }
            seeded += 1
            break
    return seeded


# --------------------------------------------------------------------------
# Pass 3 — hit the public CH search API
# --------------------------------------------------------------------------
def search_ch(name, api_key, timeout=15):
    q = urllib.parse.quote(name)
    url = f"{CH_SEARCH_URL}?q={q}&items_per_page=10"
    headers = {"User-Agent": "Gracchus-CH-precompute/1.0"}
    if api_key:
        token = base64.b64encode(f"{api_key}:".encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read())
            return data.get("items", [])
    except Exception as e:
        return [{"_error": str(e)}]


def best_match(supplier_name, hits):
    if not hits or hits[0].get("_error"):
        return None
    sup_tokens = tokens(supplier_name)
    if not sup_tokens:
        return None
    best = None
    best_score = 0.0
    for h in hits:
        title = h.get("title", "")
        if not title:
            continue
        if h.get("company_status") == "dissolved":
            continue
        h_tokens = tokens(title)
        if not h_tokens:
            continue
        intersection = sup_tokens & h_tokens
        union = sup_tokens | h_tokens
        score = len(intersection) / len(union) if union else 0
        if score > best_score:
            best_score = score
            best = h
    if best and best_score >= 0.5:
        return {
            "company_number": best.get("company_number"),
            "title": best.get("title"),
            "confidence": "high" if best_score >= 0.85 else "medium",
            "score": round(best_score, 3),
            "method": "companies-house-api",
        }
    return None


def lookup_via_api(suppliers, cache, batch_limit, review_notes):
    api_key = os.environ.get("COMPANIES_HOUSE_API_KEY", "").strip()
    if not api_key:
        print("  (skipping API pass — set COMPANIES_HOUSE_API_KEY to enable)")
        return 0

    suppliers = sorted(suppliers, key=lambda s: -(s.get("value") or 0))
    queries = 0
    for sup in suppliers:
        sid = sup.get("id")
        if not sid or sid in cache:
            continue
        if queries >= batch_limit:
            print(f"  Hit batch limit ({batch_limit}). Re-run to continue.")
            break

        name = sup.get("label", "")
        hits = search_ch(name, api_key)
        queries += 1
        time.sleep(0.6)  # ~100/min, well under the 600/5min limit

        if not hits or hits[0].get("_error"):
            cache[sid] = {
                "status": "error",
                "name": name,
                "error": hits[0].get("_error", "no hits") if hits else "no hits",
            }
        else:
            match = best_match(name, hits)
            if match:
                cache[sid] = {"status": "matched", "name": name, **match}
                if match["confidence"] == "medium":
                    review_notes.append(
                        f"- `{sid}` ({name}) -> CH {match['company_number']} ({match['title']}) score={match['score']} **MEDIUM**"
                    )
            else:
                cache[sid] = {
                    "status": "no_match",
                    "name": name,
                    "top_hits": [
                        {"company_number": h.get("company_number"), "title": h.get("title")}
                        for h in hits[:3]
                    ],
                }
                review_notes.append(
                    f"- `{sid}` ({name}) -> NO MATCH. Top: {hits[0].get('title') if hits else '-'}"
                )

        write_cache(cache)
        if queries % 10 == 0:
            print(f"    {queries} queries done; {len(cache)} cached total")

    return queries


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-api", action="store_true", help="skip the live API pass")
    ap.add_argument("--api-only", action="store_true", help="skip the donor-records seed")
    ap.add_argument("--batch-limit", type=int, default=100)
    args = ap.parse_args()

    money_map = json.loads(SUPPLIERS_FILE.read_text())
    suppliers = [n for n in money_map.get("nodes", []) if n.get("kind") == "supplier"]
    print(f"Suppliers in money-map.json: {len(suppliers)}")

    cache = load_cache()
    print(f"Cache entries on entry: {len(cache)}")

    review_notes = []

    # Pass 1 — seed from donor records (Electoral Commission — primary source)
    if not args.api_only:
        seeded = seed_from_donors(suppliers, cache)
        print(f"Pass 1 (donor-records seed): {seeded} suppliers seeded")
        write_cache(cache)

        # Pass 2 — seed from project-contractors.json
        seeded2 = seed_from_projects(suppliers, cache, review_notes)
        print(f"Pass 2 (project-contractors seed): {seeded2} suppliers seeded")
        write_cache(cache)

    # Pass 3 — live API
    if not args.no_api:
        queries = lookup_via_api(suppliers, cache, args.batch_limit, review_notes)
        print(f"Pass 3 (CH API): {queries} queries made")

    if review_notes:
        REVIEW_FILE.write_text(
            "# CH lookup review\n\n"
            "Medium-confidence matches and no-match cases — manual review needed.\n"
            "Either correct the entry directly in `src/data/supplier-companies-house.json`,\n"
            "or refine the CH search query.\n\n"
            + "\n".join(review_notes)
        )

    matched = sum(1 for v in cache.values() if v["status"] == "matched")
    no_match = sum(1 for v in cache.values() if v["status"] == "no_match")
    error = sum(1 for v in cache.values() if v["status"] == "error")
    print(
        f"\nFinal: matched={matched} no_match={no_match} error={error} cached_total={len(cache)}"
    )


if __name__ == "__main__":
    main()
