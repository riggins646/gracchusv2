# Register of All-Party Parliamentary Groups — ingester

`scripts/ingest-appgs.mjs` parses the full Register of All-Party
Parliamentary Groups (APPGs) from `publications.parliament.uk`, snapshots
each edition, diffs against the previous one, and emits a triage report
flagging groups that look like industry-access vehicles.

## Why APPGs

APPGs are the single biggest unmapped vector of industry access to
parliamentarians. Each group has officers (MPs and peers), a secretariat
(often a public-affairs firm), and registrable benefits — frequently a
list of corporate sponsors who jointly fund the secretariat. Worked
example from the 20 October 2025 edition:

> **All-Party Parliamentary Group on Artificial Intelligence**
> - Secretariat: **Big Innovation Centre**
> - Benefits in kind, £90,001–£91,500 per year, paid by 19 firms
>   including BT Group, Capgemini, Cognizant, Deloitte, Ernst & Young,
>   Hewlett Packard Enterprise, Santander
> - 4 parliamentary officers: Allison Gardner (Lab), Lord Clement-Jones
>   (LD), Dawn Butler (Lab), Lord Ranger of Northwood (Con)

That single group is a 24-node, 24-edge cluster the moment you ingest it.
Money Map does not currently see any of this.

## Source

The official APPG API at `appg-api.parliament.uk` only exposes title,
purpose, category, and `memberId`+`role` of officers. It does **not**
expose the secretariat, registrable benefits, or sponsor list — which is
the data this ingester actually needs.

So the ingester scrapes the official HTML at:

```
https://publications.parliament.uk/pa/cm/cmallparty/{YYMMDD}/{slug}.htm
```

Each edition is dated `YYMMDD` (`251020` = 20 October 2025). The contents
page lists every group as `{slug}.htm`. New editions appear roughly every
six weeks.

## Usage

```bash
# Most recent edition (idempotent; skips editions already in index.json)
npm run ingest:appgs

# Specific edition
node scripts/ingest-appgs.mjs --edition 251020

# Backfill all editions on or after a date
npm run ingest:appgs:since -- 250101

# Dry-run (no writes)
npm run ingest:appgs:dry
```

A full run takes ~80 seconds (~600 groups × 130ms polite delay). Steady
state — one new edition every 6 weeks — is one of those runs every six
weeks.

## Outputs

```
src/data/appgs/snapshots/{YYMMDD}.json   # parsed snapshot of the edition
src/data/appgs/diffs/{YYMMDD}.md         # human-readable diff vs previous
src/data/appgs/triage/{YYMMDD}.json      # structured triage candidate list
src/data/appgs/index.json                # which editions have been ingested
```

The snapshot schema for one group:

```jsonc
{
  "id": "artificial-intelligence",
  "title": "All-Party Parliamentary Group on Artificial Intelligence",
  "purpose": "...",
  "category": "Subject Group",
  "url": "https://publications.parliament.uk/pa/cm/cmallparty/251020/artificial-intelligence.htm",
  "officers": [{ "role": "Chair & Registered Contact", "name": "Dr Allison Gardner", "party": "Labour" }, ...],
  "registeredContact": { "text": "...", "emails": ["..."] },
  "publicEnquiryPoint": { "text": "...", "emails": ["..."] },
  "secretariat": [{ "name": "Big Innovation Centre", "url": "http://...", "raw": "..." }],
  "groupWebsite": "https://...",
  "agm": { "lastIgmAgmDate": "2024-10-21", "incomeStatementApproved": "No", "reportingYear": "...", "nextReportingDeadline": "2026-02-21" },
  "benefits": [{
    "type": "Benefits In Kind",
    "source": "Big Innovation Centre",
    "description": "...",
    "sponsors": ["BT Group", "Capgemini", "Cognizant", "Deloitte", "Ernst & Young", ...],
    "valueBand": "90,001-91,500",
    "valueLowGBP": 90001,
    "valueHighGBP": 91500,
    "fromDate": "2024-10-21",
    "toDate": "2025-10-20",
    "receivedDate": "2024-10-21",
    "registeredDate": "2024-11-06"
  }]
}
```

## Triage rules

A group is flagged as a candidate when **any** of these match:

| Rule | Threshold |
|---|---|
| Secretariat is a known PR / public-affairs firm | from `KNOWN_LOBBYING_SECRETARIATS` list |
| Sponsor or secretariat name matches a tracked Gracchus supplier | from `TRACKED_KEYWORDS` list (Palantir, Serco, BAE, Deloitte, BT Group, etc.) |
| High-impact subject group with declared benefits | title contains `artificial intelligence`, `gambling`, `defence`, `tobacco`, `pharmaceutical`, `energy`, etc. AND benefits > £0 |
| Disclosed benefits ≥ £30,000/year | upper-band sum across all benefits |
| ≥ 5 distinct sponsors via the secretariat | industry-coalition pattern |
| Officer overlaps with curated `individual-connections.json` records | name normalisation strips honorifics; substring match |

Triage is advisory — it surfaces candidates for human review. Promotion
into the curated `individual-connections.json` still requires the same
primary-source verification used for the existing 33 records.

## Diff between editions

The diff catches:

- **Added groups** — newly registered APPGs (sometimes industry-incubated)
- **Removed groups** — disbanded or dropped at the AGM deadline
- **Officer changes** — MPs joining/leaving (party defections, ministerial appointments)
- **Secretariat changes** — particularly relevant when a group moves *to* a public-affairs firm
- **Sponsor list changes** — new corporate funders or dropped funders

Officer-change tracking is what catches stories like "an MP just joined
the AI APPG the same week they were appointed AI minister". Secretariat-change
tracking catches "this group quietly moved its secretariat from a charity
to a lobbying firm last quarter".

## Integration with Money Map

Each APPG snapshot adds three new node classes to the graph:

- **APPG** (one node per group)
- **Industry sponsor** (one node per sponsor name; later normalised to canonical Gracchus suppliers)
- **Secretariat firm** (one node per secretariat; many already exist as Gracchus suppliers)

…and three new edge classes:

- MP / peer **→ officer of →** APPG
- APPG **→ secretariat run by →** firm
- APPG **→ sponsored by →** industry sponsor

The triage candidates are intended to drive new Money Map quick-views:

- **Industry coalition view** — APPGs with ≥ 5 corporate sponsors
- **Lobbying-firm secretariat view** — APPGs run by a public-affairs firm
- **Subject-domain view** — AI / gambling / defence / pharma / fossil-fuel APPGs
- **MP-officer overlap view** — MPs who chair APPGs in policy domains they have ministerial / shadow authority over

## Scheduling

The register is published roughly every six weeks. A monthly cron is
sufficient — when the new edition isn't out yet, the script skips and
exits cleanly:

```cron
# 09:00 on the 15th of each month
0 9 15 * *  cd /path/to/uk-spending-tracker && npm run ingest:appgs >> ~/.gracchus-appgs.log 2>&1
```

For GitHub Actions, mirror the pattern in `scripts/REGISTER_INGESTER.md`.

## Tested

The parser was exercised offline against real HTML captured from the
20 October 2025 edition for both Armenia (no benefits, simple country
group) and Artificial Intelligence (Big Innovation Centre secretariat,
19 corporate sponsors, £90k+/year benefits). Both parsed cleanly:
officers, secretariat, AGM dates, benefits, sponsors, dates were
extracted correctly. The triage logic correctly flagged AI APPG on five
of the six rules (secretariat-is-lobbying-firm, multiple tracked
suppliers as sponsors, high-impact subject with declared benefits,
total benefits over £30k, ≥ 5 sponsors).

## Failure modes

- **Edition slug not found (404)** — the script logs and skips.
- **HTML schema change** — Parliament publishes XHTML-strict pages with
  a stable `<table class="basicTable">` structure. If the layout
  changes, `parseAppgPage` falls back gracefully (returns a partial
  record) rather than throwing.
- **Sponsor extraction edge cases** — the description-parsing
  heuristic handles "A, B and C", "A, B & C", and "Ernst & Young"-style
  ampersand-bearing firm names, but unusual phrasings may produce noisy
  sponsor lists. The raw `description` is preserved on every benefit
  record so a downstream re-parse is always possible.
- **Date-format drift** — handled by `parseUkDate` which accepts both
  `dd/mm/yyyy` and `yyyy-mm-dd`.
