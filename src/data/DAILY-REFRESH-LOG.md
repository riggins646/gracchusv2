# Daily Data Refresh Log — 2026-04-11 (Projects & Contracts)

## Summary: 1 correction applied (Babcock contract value). No new projects, contracts, planning decisions, or FCDO programmes found.

---

### 1. Major Projects (projects.json, daily-cost-projects.json, delays-delivery.json)
- **HS2**: Already up to date (£43.6bn spent, earthworks 70%, revised estimate expected summer 2026). New construction milestones (M6 viaduct section installed 11 Apr, Birmingham site plans unveiled 9 Apr) are progress updates, not budget/schedule changes.
- **Hinkley C**: Already up to date (£48bn nominal, Unit 1 first power 2030). Leadership change announced (Mark Hartley replacing Stuart Crooks as CEO from Jul 2026) — operational detail, not a cost/schedule change.
- **NAO reports**: DSIT Research Infrastructure report (Mar 2026) covers research facilities/supercomputers, not major infrastructure projects in the tracker. HM Treasury Planning for Economic Infrastructure report is older. No new NAO reports on HS2 or Hinkley C.
- **IPA/NISTA**: No new annual report found (IPA replaced by NISTA in Apr 2025; latest IPA report covers 2023-24).
- **Action**: None

### 2. Defence Contracts (contracts-raw.json, suppliers-summary.json)
- **Babcock SPTC (DEF-010)**: Corrected value from £1bn to £1.6bn and award date from 2025-01 to 2025-03, matching GOV.UK announcement. Updated description and source URL. Also updated suppliers-summary.json totalValue (£1,060m → £1,660m).
- **No new contracts found**: Leonardo NMH (£1bn), Palantir EA (£240m), and Defence Reform consultancy (£15.8m) already in file. No other major new MOD contract awards announced since last update.
- **Action**: Updated DEF-010 value, date, description, source in contracts-raw.json and suppliers-summary.json

### 3. Planning Decisions (planning-approvals.json)
- **NSIP regime changes**: Data centres formally brought into NSIP regime (Jan 2026 regulations), but this is a regulatory change, not a specific project decision.
- **No new NSIP planning decisions** found for major infrastructure projects.
- **Action**: None

### 4. FCDO Programmes (fcdo-programmes.json)
- **ODA allocations 2026-2029**: Multi-year allocations published (programme ODA falling from £9bn to £6.2bn). These are allocation changes to existing programmes, not new individual programmes >£50m.
- **Programme closures**: Gender-Responsive Social Protection closing 2025/26; BASIC extended to 2026/27. No significant new programmes announced.
- **Action**: None (file is 4,500+ programmes; no new >£50m programme identified)

---

## Files modified
| File | Change | Validated |
|---|---|---|
| contracts-raw.json | DEF-010 value £1bn→£1.6bn, date, description, source | JSON valid |
| suppliers-summary.json | Babcock totalValue £1,060m→£1,660m, notes updated | JSON valid |

## Next expected updates
| Dataset | Source | Expected |
|---|---|---|
| HS2 revised cost estimate | DfT / HS2 Ltd | Summer 2026 |
| Hinkley C progress | EDF half-year results | Jul 2026 |
| IPA/NISTA annual report | Cabinet Office | TBC (successor body) |
| NSIP decisions | Planning Inspectorate | Ongoing |
| FCDO programme data | DevTracker | Ongoing |
