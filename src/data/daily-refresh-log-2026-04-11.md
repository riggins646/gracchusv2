# Daily Data Refresh Log — 2026-04-11

## Summary

**No files updated.** All data sources are current or no new data matching existing methodology was found.

---

## 1. Civil Service (civil-service.json)

- **Status:** No update needed
- **Current data:** Annual data through 2025 (headcount 549,660, FTE 516,150 — March 2025)
- **Findings:** GOV.UK published Civil Service Statistics 2025 (released June 2025) covering data to March 2025, which is already in the file. ONS Public Sector Employment bulletin (March 2025) shows Q3/Q4 2025 quarterly figures (~554,000 headcount by September 2025), but the file tracks annual snapshots. Next annual update expected mid-2026 (Civil Service Statistics 2026).
- **Note:** Institute for Government / ICAEW analysis suggests civil service headcount may have peaked in late 2025 and could begin shrinking in 2026 due to efficiency programmes.

## 2. Energy (energy.json)

- **Status:** No update needed
- **Current data:** lastUpdated 2026-04
- **Findings:** DESNZ Energy Trends statistical release published 2 April 2026, covering Nov 2025–Jan 2026. Key headline: renewables provided 52.7% of electricity generation by major power producers; low-carbon share rose to 64.4%. The file was already updated for April 2026 in a previous refresh.

## 3. Innovation (innovation.json, gov-innovation.json)

- **Status:** No update needed
- **innovation.json current data:** lastUpdated 2026-03. VC investment UK shows 2024 as latest (GBP 9.0bn).
- **gov-innovation.json current data:** lastUpdated 2026-03.
- **Findings:**
  - BVCA "Venture Capital in the UK 2025" report (published May 2025) covers 2024 data — already captured in file (GBP 9bn, 12.5% rise).
  - OECD MSTI March 2026 edition released — but the file already has 2023 R&D data (UK GERD 2.64% GDP). No 2024 GERD figures available yet for UK.
  - No new BVCA report for 2025 investment data yet.

## 4. Transport (transport-compare.json)

- **Status:** No update needed
- **Current data:** References Transport & Environment European Rail Ranking 2024
- **Findings:** T&E published a "State of Transport 2025: Rail" page and the existing "Mind the gap!" rail operator ranking, but this appears to be the same 2024 dataset already referenced. No new 2025/2026 comparative fare ranking found. Next major T&E update likely later in 2026.

## 5. Structural Performance (structural-performance.json)

- **Status:** No update, but 2023 data may be available for manual extraction
- **Current data:** lastUpdated 2025-03. Productivity data extends to 2022 for all four countries (UK, France, Germany, USA).
- **Findings:**
  - OECD Compendium of Productivity Indicators 2025 (published June 2025) contains 2023 GDP per hour worked data.
  - Conference Board Total Economy Database (May/September 2025 updates) has 2023 data.
  - However, exact country-level figures in USD PPP matching the file's methodology could not be extracted from search results alone (requires access to OECD Data Explorer interactive tool).
  - **Action for manual follow-up:** Access OECD Data Explorer to get 2023 GDP/hour worked (USD, current PPP) for UK, France, Germany, USA and add to file.

## 6. MP Interests (mp-interests.json)

- **Status:** No update needed
- **Current data:** lastUpdated 2026-03
- **Findings:** The Register of Members' Financial Interests was last published 23 March 2026. The file's lastUpdated matches this. Register updates fortnightly when Parliament is sitting. The April update may appear in coming weeks but would require parsing the full register for aggregate changes. No structural update warranted today.

## 7. Compare Data (compare-data.json)

- **Status:** No update, but fuel prices have shifted significantly
- **Current data:** Fuel section sourceYear "March 2026"
- **Findings:**
  - EC Weekly Oil Bulletin (2 April 2026): EU average petrol EUR 1.871/L, diesel EUR 2.076/L.
  - Significant price increases since late February 2026 due to geopolitical events (US-Israel strike): petrol +14%, diesel +30% across the EU.
  - The file's March 2026 data may already partially reflect these increases. Country-specific breakdowns matching the file's format (local currency + USD PPP conversions) were not available from search results alone.
  - **Action for manual follow-up:** If precise country-level April 2026 fuel prices are needed, check EC Weekly Oil Bulletin country tables directly and update sourceYear to "April 2026".

---

## Sources Checked

- [Civil Service Statistics 2025 - GOV.UK](https://www.gov.uk/government/statistics/civil-service-statistics-2025)
- [Energy Trends April 2026 - GOV.UK](https://www.gov.uk/government/statistics/energy-trends-and-prices-statistical-release-2-april-2026)
- [BVCA Venture Capital in the UK 2025](https://www.bvca.co.uk/resource/venture-capital-in-the-uk-2025.html)
- [OECD MSTI March 2026](https://www.oecd.org/en/data/datasets/main-science-and-technology-indicators.html)
- [Transport & Environment Rail](https://www.transportenvironment.org/topics/rail)
- [OECD Compendium of Productivity Indicators 2025](https://www.oecd.org/en/publications/oecd-compendium-of-productivity-indicators-2025_b024d9e1-en.html)
- [Register of Members' Financial Interests](https://members.parliament.uk/members/commons/interests/publications)
- [EC Weekly Oil Bulletin](https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en)
