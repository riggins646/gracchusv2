# Daily Refresh Log — 2026-04-14 (Research & Structural)

## Scope
Focused refresh: Civil Service, Energy, Innovation, Transport, Structural Performance, MP Interests, Compare Data.

## 1. Civil Service (civil-service.json)

**Current state:** 2025 data (headcount 549,660, FTE 516,150).

**Searches performed:**
- "ONS civil service statistics 2025 2026 latest UK"

**Findings:**
- GOV.UK "Civil Service Statistics: 2025" (data as at 31 March 2025) confirms 549,660 headcount and 516,150 FTE — matches file exactly.
- ONS Public Sector Employment bulletin (19 March 2026) shows 555,000 civil servants in December 2025 — this is a quarterly PSE figure, not the annual Civil Service Statistics release the file tracks.
- Institute for Government Whitehall Monitor 2026 published — already listed in file sources.
- Next annual Civil Service Statistics release: July 2026.

**Result: No update needed.**

## 2. Energy (energy.json)

**Current state:** lastUpdated 2026-04, annual data through 2025.

**Searches performed:**
- "DESNZ Energy Trends quarterly latest 2026 UK publication"

**Findings:**
- Energy Trends statistical release published 2 April 2026, covering Q4 2025 (Nov 2025 – Jan 2026).
- Key quarterly data: renewables 52.7% of electricity generation by major power producers; gas 34.8%; nuclear record low 11.7%. Primary consumption fell 3.4%.
- File already has 2025 annual data (renewables 51.7%, gas 34.3%, nuclear 13.1%). The quarterly Q4 figures are more granular but the file tracks annual data.
- Next Energy Trends: 30 April 2026.

**Result: No update needed.** File uses annual granularity; Q4 2025 quarterly data does not replace the 2025 annual figures already captured.

## 3. Innovation (innovation.json, gov-innovation.json)

**Current state:** Both lastUpdated 2026-03.

**Searches performed:**
- "BVCA venture capital report 2025 UK latest publication"
- "OECD MSTI main science technology indicators latest 2026"

**Findings:**
- BVCA "Venture Capital in the UK 2025" (published May 2025): £9bn invested in 2024, 12.5% rise on 2023, 378,000 jobs supported. Already captured in file.
- OECD MSTI March 2026 release published — already captured (file lastUpdated 2026-03). Next MSTI: September 2026.
- No new BVCA 2026 report yet (typically published mid-year).

**Result: No update needed.**

## 4. Transport (transport-compare.json)

**Current state:** File tracks cross-country transport infrastructure comparisons.

**Searches performed:**
- "Transport Environment European rail comparison 2026 report"

**Findings:**
- T&E published first-ever rail ranking report (service quality comparison) — Trenitalia, SBB, RegioJet top-ranked; Eurostar ranked last. This covers service quality/pricing, not infrastructure metrics tracked in the file.
- EEA "Sustainability of Europe's Mobility Systems 2025" published Feb/March 2026 — focuses on emissions and modal share, not the infrastructure cost/investment comparisons in the file.
- Eurostat: 443bn passenger-km in 2024 (+5.8% on 2023) — interesting but not directly relevant to file structure.

**Result: No update needed.** No new annual infrastructure comparison report found matching the file's scope.

## 5. Structural Performance (structural-performance.json)

**Current state:** lastUpdated 2025-03, productivity data through 2022.

**Searches performed:**
- "ONS international productivity comparison latest 2025 2026 UK"
- "OECD GDP per hour worked 2023 current prices PPP USD UK France Germany USA"
- "OECD compendium productivity indicators 2025"

**Findings:**
- OECD Compendium of Productivity Indicators 2025 published (June 2025) — contains 2023 data for GDP per hour worked.
- US 2023 value approximately $97.7/hour (up from $91.5 in 2022 in file).
- OECD average approximately $70/hour in 2023.
- UK ranked 4th in G7, approximately 20% below US.
- However: could not obtain verified exact 2023 figures for UK, France, and Germany from search results alone. The OECD data portal and Conference Board TED require direct database access which is blocked by network allowlist.
- ONS ICP Final Estimates last published for 2021 — no newer ONS ICP final release found.
- File notes: "2022 is the latest year with full comparable data across all four countries."

**Result: No update made.** 2023 OECD data exists but exact country-level figures could not be verified through available search tools. Recommend manual verification from OECD.Stat data explorer for next update.

## 6. MP Interests (mp-interests.json)

**Current state:** lastUpdated 2026-03.

**Searches performed:**
- "register of members financial interests latest update 2026 UK parliament"

**Findings:**
- Latest published Register: 23 March 2026. Previous: 9 March 2026, 23 February 2026.
- Register updates fortnightly when House is sitting.
- Parliament was in recess for Easter (late March–mid April). Next update expected when House returns.
- File already reflects March 2026 data.

**Result: No update needed.**

## 7. Compare Data (compare-data.json)

**Current state:** Fuel data sourceYear "March 2026". UK petrol £1.53/litre, diesel £1.77/litre.

**Searches performed:**
- "European fuel prices comparison latest 2026 petrol diesel"

**Findings:**
- EC Weekly Oil Bulletin 2 April 2026: EU average petrol €1.871/litre, diesel €2.076/litre.
- Significant price surge since late February 2026 (petrol +14%, diesel +30%) attributed to geopolitical events.
- Netherlands most expensive (petrol €2.363, diesel €2.585). Malta cheapest (petrol €1.34).
- File's March 2026 data predates the late-February/early-April price surge. However, the data is only ~2 weeks old and the April figures are volatile/transitional.

**Result: No update made.** March 2026 data is recent. April figures reflect ongoing geopolitical volatility — recommend waiting for stabilisation or next monthly average before updating to avoid capturing a transient spike.

## Summary

All 7 data areas reviewed. No updates applied today. Key notes for future runs:

- **Structural Performance**: 2023 OECD productivity data available but needs manual verification of exact figures. Priority for next update.
- **Energy**: Next quarterly Energy Trends due 30 April 2026.
- **Civil Service**: Next annual release July 2026.
- **Compare Data (fuel)**: Monitor for price stabilisation post-geopolitical events before updating.
- **Innovation**: Watch for BVCA 2026 report (typically mid-year) and OECD MSTI September 2026.
