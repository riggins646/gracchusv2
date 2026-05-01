# Register of Members' Financial Interests — ingester

`scripts/ingest-register.mjs` keeps Gracchus's MP-interests data current
against Parliament's official Register of Members' Financial Interests.

## What it does

For each fortnightly edition of the Register, the script:

1. Fetches the structured data from Parliament's official **Interests API**
   (`https://interests-api.parliament.uk/api/v1/Interests`).
2. Snapshots the edition to `src/data/register/snapshots/{registerId}-{YYYY-MM-DD}.json`.
3. Diffs the snapshot against the previous edition: added, removed,
   newly-rectified (= late) and field-level corrections.
4. Recomputes the aggregate fields in `src/data/mp-interests.json`
   (byParty totals, top earners for the current edition, headline counts).
5. Emits a markdown triage report at `src/data/register/diffs/{stem}.md`
   flagging entries worth promoting into `individual-connections.json`,
   plus a structured candidate list at `src/data/register/triage/{stem}.json`.
6. Updates `src/data/register/index.json` so subsequent runs only process new editions.

## Usage

```bash
# Most recent edition only (idempotent — skips editions already in index)
npm run ingest:register

# Specific register edition by ID (e.g. 798 = 27 Apr 2026)
node scripts/ingest-register.mjs --register 798

# Every edition published on or after a given month
npm run ingest:register:since -- 2026-03

# Dry run — fetches and parses but writes nothing
npm run ingest:register:dry
```

The first run will take a couple of minutes per edition (Parliament's API
caps page size at 20 records, so ~2k–3k interests means ~150 paginated
requests at a polite ~120ms each). Subsequent runs only fetch new editions,
so the steady-state cost is ~30–60 seconds every two weeks.

## Triage rules

The `triage()` function flags an entry as a candidate for the curated
`individual-connections.json` when **any** of the following apply:

| Rule | Threshold |
|---|---|
| Single gift / visit value | ≥ £500 |
| Single employment payment | ≥ £5,000 |
| Any new shareholding (Category 7) | always |
| Any new paid role (Category 1) | always |
| Family member employed via parliamentary expenses (Category 9) | always |
| Family member engaged in lobbying (Category 10) | always |
| Late registration | event date → registration date > 28 days |
| Tracked-keyword match | donor/employer mentions a tracked Gracchus supplier or sector (Palantir, Serco, BAE, Deloitte, betting & gaming, etc.) |
| API `rectified` flag | always (Parliament's own late-registration marker) |

Triage is **advisory only** — entries are flagged for human review, not
automatically promoted into the curated dataset. Promotion still requires
the same primary-source verification used for the existing 33 records
(see the audit notes in `individual-connections.json`).

## Data flow

```
Parliament Interests API
        │
        ▼
ingest-register.mjs ──┬──► src/data/register/snapshots/798-2026-04-27.json
                      ├──► src/data/register/diffs/798-2026-04-27.md
                      ├──► src/data/register/triage/798-2026-04-27.json
                      ├──► src/data/register/index.json
                      └──► src/data/mp-interests.json (aggregates refreshed)
```

The hand-curated portions of `mp-interests.json` (`q1_2026.giftsAndHospitality.topItems`,
`contextSentences`, `expenses`) are **preserved across runs** — the script
only overwrites the fields it actually computes (`metadata`, `byParty`,
`topEarners.currentEdition`, `aggregateStats`).

## Schema notes

Each snapshot record (`interests[i]`) has a stable `id` keyed on Parliament's
own interest ID, so the same declaration retains identity across editions and
the diff catches genuine changes (corrections, rectifications, removals) vs
new entries.

The Parliament API documents each entry's category number per the Code of
Conduct:

| Cat | Name |
|---|---|
| 1 | Employment and earnings |
| 2 | Donations and other support (received as MP) |
| 3 | Gifts, benefits and hospitality from UK sources |
| 4 | Visits outside the UK |
| 5 | Gifts and benefits from sources outside the UK |
| 6 | Land and property portfolio |
| 7 | Shareholdings: over 15% of issued share capital |
| 8 | Miscellaneous |
| 9 | Family members employed and paid from parliamentary expenses |
| 10 | Family members engaged in lobbying |

## Scheduling

The Register is published fortnightly when the House is sitting and roughly
monthly during recess. To run on a schedule:

### Cron (Linux/macOS)

```cron
# 09:00 every Monday — quick check for new editions; only does work if there is one
0 9 * * 1  cd /path/to/uk-spending-tracker && npm run ingest:register >> ~/.gracchus-register.log 2>&1
```

### GitHub Actions

```yaml
# .github/workflows/register-ingest.yml
name: Register ingest
on:
  schedule:
    - cron: "0 9 * * 1"   # Mondays 09:00 UTC
  workflow_dispatch:
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm run ingest:register
      - name: Open PR if anything changed
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "chore(register): ingest new edition"
          title: "Register: ingest new edition"
          body: "Automated ingest. See `src/data/register/diffs/` for the triage report."
          branch: register/auto-ingest
```

### Vercel cron

Vercel cron only invokes HTTP endpoints, so to use it you'd wrap the
ingester in an API route (`src/app/api/cron/register/route.js`) that
shells out to `node scripts/ingest-register.mjs` and returns the result.
For a private dashboard like Gracchus, GitHub Actions is the simpler fit.

## Failure modes

- **API rate-limit / 5xx** — the script retries with backoff up to 4 times.
- **API breaking change** — the schema is asserted via field names; if
  Parliament renames a field (e.g. "Payment received" → "Payment"),
  `pickPaymentValue()` and `pickGiftValue()` already accept several
  aliases. Update those constants if a new name appears.
- **Partial snapshot** — snapshots are written atomically per edition, so
  an interrupted run leaves either a complete snapshot or none.
- **Missed editions** — `--since YYYY-MM` will catch up any editions that
  weren't ingested previously, in chronological order so each diff has its
  predecessor on disk.
