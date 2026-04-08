# Gracchus

A neutral, source-backed dashboard tracking UK government project spending, overruns, delays, and contractor exposure.

**Live demo:** (deploy to Vercel to get your URL)

## What it tracks

- **32 major infrastructure projects** with budget vs actual, delays, and status
- **Contractor exposure** across government projects
- **Civil service headcount** by department, grade, and region (2010-2025)
- **Welfare spending** breakdown and trends
- **International comparisons** (UK vs France vs Germany)

## Quick start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Vercel auto-detects Next.js - click Deploy
4. Your site is live at `your-project.vercel.app`

Alternatively, deploy from CLI:
```bash
npm i -g vercel
vercel
```

## Project structure

```
gracchus/
  src/
    app/             # Next.js app router pages
    components/      # React components (Dashboard.jsx)
    data/            # JSON data files (the source of truth)
      projects.json        # Infrastructure project data
      civil-service.json   # Civil service headcount & pay
      spending.json        # Welfare & departmental spending
      international.json   # UK vs France vs Germany
  scripts/
    ingest-contracts.mjs      # Contracts Finder API ingestion
    ingest-civil-service.mjs  # Civil service CSV parser
  public/            # Static assets
```

## Data sources

| Dataset | Source | Update frequency |
|---------|--------|-----------------|
| Major projects | NAO, GOV.UK, Parliamentary committees | Quarterly |
| Contracts | Contracts Finder API | On-demand |
| Civil service | Cabinet Office statistics | Annually |
| Welfare spending | DWP, OBR, HM Treasury | Annually |
| International | OECD, Eurostat, IMF | Annually |

## Data ingestion

### Contracts Finder API

```bash
# Fetch all awarded contracts (default: since 2020)
npm run ingest

# Filter by supplier
node scripts/ingest-contracts.mjs --supplier "BAE Systems"

# Filter by department
node scripts/ingest-contracts.mjs --department "Ministry of Defence"

# Filter by minimum value
node scripts/ingest-contracts.mjs --min-value 1000000
```

### Civil service statistics

```bash
# Download CSV from gov.uk, then:
node scripts/ingest-civil-service.mjs --csv=path/to/download.csv
```

## Adding new projects

Edit `src/data/projects.json` and add a new entry:

```json
{
  "id": 33,
  "name": "Project Name",
  "department": "Department",
  "category": "Transport",
  "subcategory": "Rail",
  "originalBudget": 1000,
  "latestBudget": 1500,
  "originalDate": "2025",
  "latestDate": "2028",
  "status": "In Progress",
  "contractors": ["Firm A", "Firm B"],
  "description": "Brief description of the project.",
  "sources": ["https://source-url.gov.uk"],
  "lastUpdated": "2026-03-26"
}
```

Budget values are in millions (GBP). Status must be one of:
`Completed`, `In Progress`, `In Development`, `In Planning`, `Cancelled`, `Compensation Ongoing`

## Methodology

- All budget figures are sourced from official government publications, NAO reports, or Parliamentary committee reports
- "Original budget" = earliest published estimate at project approval
- "Latest budget" = most recent published estimate or final cost
- Overrun = latest budget minus original budget
- International comparisons use OECD-compatible definitions
- Contractor data shows project involvement, not direct payment amounts

## Philosophy

- Neutral and non-partisan
- Source-backed (every figure links to a source)
- Let the data speak for itself
- Show planned vs actual, promised vs delivered

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS
- Recharts (charts)
- Lucide React (icons)
- Node.js scripts for data ingestion

## Contributing

PRs welcome. To add a project:
1. Research the project using official sources (NAO, GOV.UK, Parliamentary reports)
2. Add to `src/data/projects.json` with all required fields
3. Include source URLs
4. Submit PR with a brief note on sources used

## License

MIT
