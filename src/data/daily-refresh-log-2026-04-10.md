# Daily Data Refresh — 10 April 2026

## Summary

3 files updated, 3 data points changed. No new contracts or planning decisions added.

---

## 1. Major Projects

### HS2 — Updated (projects.json)
- **Description enriched** with March 2026 6-monthly parliamentary report data:
  - £43.6bn spent to end of Feb 2026 (£46.2bn including scrapped Phase 2)
  - Earthworks 70% complete
  - Speed reduction under consideration (186mph cap vs original 224mph)
  - Revised cost estimate expected summer 2026
- **latestDate** changed from "2035+" to "Late 2030s" (consistent with DfT reporting)
- Sources updated to include the March 2026 parliamentary report
- Budget figure (£100bn) unchanged — revised baseline not yet published

### Hinkley Point C — Updated (projects.json)
- **latestBudget** updated from £46,000m to £48,000m (nominal 2026 prices, per EDF Feb 2026 update; £35bn in 2015 prices)
- **latestDate** updated from "2031+" to "2030 (Unit 1)" — EDF now targets 2030 for Unit 1 first power (delayed from 2029 best-case due to electromechanical issues)
- Description updated to reflect Feb 2026 EDF financial statement and €2.5bn impairment charge

### NAO Reports — Noted, no file changes
- NAO published "HM Treasury: Planning for Economic Infrastructure" (16 March 2026) identifying 5 key risks to value for money in the £310bn national infrastructure plan. Informational only; no project-level data changes required.
- NAO published "DSIT's Investment in Research Infrastructure" (13 March 2026). Not within scope of tracked projects.

---

## 2. Defence Contracts

### Palantir Enterprise Agreement — Corrected (contracts-raw.json, suppliers-summary.json)
- **Value corrected** from £48m to £240.6m (the widely reported contract value per multiple sources including PublicTechnology, The Register, and Hansard)
- Award date corrected to 2025-12-30 (signed 30 Dec, effective 1 Apr 2026)
- Marked as non-competitive (defence & security exemption)
- Description enriched: over 3x the previous £75.2m agreement; includes £1.5bn Palantir UK investment commitment
- **suppliers-summary.json**: Palantir total government contract value updated from £378m to £570.6m; marked as strategic supplier

### Other MOD contracts searched — No new additions
- "Defence Reform 2025" consultancy contract (£15.8m) found but too small for tracker threshold
- No other major new MOD contract awards identified

---

## 3. Planning Decisions

**No new NSIP decisions found.** Planning Inspectorate reforms (fast-track consenting, streamlined judicial review) are procedural changes from the Planning and Infrastructure Act — no individual project decisions to add.

---

## 4. FCDO Programmes

**No new programmes added.** FCDO is undergoing a structural "development reset" with geographic refocus (70% to FCAS, protected budgets for Ukraine/Sudan/Palestine/Lebanon at £495m). No individual new programme >£50m announced since last refresh.

---

## Files Modified
| File | Change |
|------|--------|
| projects.json | HS2 description/date, Hinkley C budget/date/description |
| contracts-raw.json | Palantir EA value corrected £48m → £240.6m |
| suppliers-summary.json | Palantir total value & strategic supplier flag |

## Files Unchanged
- daily-cost-projects.json (already up to date with Feb 2026 figures)
- delays-delivery.json
- planning-approvals.json
- fcdo-programmes.json
