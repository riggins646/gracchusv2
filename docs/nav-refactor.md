# Navigation Refactor Plan

## 1. OLD → NEW MAPPING

| OLD | NEW | REASON |
|-----|-----|--------|
| Overview | **Overview** | Stays as top-level landing page |
| Projects | **Projects** | Stays — core data product feature |
| Contractors | **Suppliers** | Renamed — "Suppliers" is more neutral and inclusive |
| Civil Service | **Government > Civil Service** | Grouped under Government parent |
| Spending | **Government > Public Spending** | Grouped under Government parent |
| Cronyism | **Suppliers > Procurement Scrutiny** | Renamed and relocated — see section 3 |
| Production | **Economy > Production vs Imports** | Grouped under Economy parent |
| Compare | **Compare** | Stays as top-level — cross-cutting |

## 2. DROPDOWN STRUCTURE

### Overview
- *(no sub-pages — single dashboard)*

### Projects
- All Projects *(default)*
- By Category
- Overruns & Delays
- Cancelled / Paused

### Suppliers
- Top Suppliers *(default)*
- By Department
- Procurement Scrutiny *(was "Cronyism")*

### Government
- Civil Service *(default)*
- Public Spending
- Departments

### Economy
- Production vs Imports *(default)*
- Industry Breakdown
- Trade Balance

### Compare
- *(no sub-pages — single dashboard)*

## 3. CRONYISM → PROCUREMENT SCRUTINY

**Neutral replacement name:** "Procurement Scrutiny"

**Where it lives:** Suppliers > Procurement Scrutiny

**How data is framed:**
- "Contracts flagged by NAO, courts, or parliamentary committees"
- "Competitive vs non-competitive award process"
- "Connection type" (donor, political associate, referral)
- Severity based on audit findings, not editorial judgement
- All entries cite official source (NAO, court, FOI, PAC)

**Alternative names considered:**
- "Procurement Risk" — too vague
- "Contract Scrutiny" — too narrow
- "Procurement Scrutiny" — accurate, neutral, scalable

## 4. URL STRUCTURE

```
/                           → Overview
/projects                   → All Projects (default)
/projects/category          → By Category
/projects/overruns          → Overruns & Delays
/projects/cancelled         → Cancelled / Paused
/suppliers                  → Top Suppliers (default)
/suppliers/departments      → By Department
/suppliers/scrutiny         → Procurement Scrutiny
/government                 → Civil Service (default)
/government/spending        → Public Spending
/government/departments     → Departments
/economy                    → Production vs Imports (default)
/economy/industries         → Industry Breakdown
/economy/trade              → Trade Balance
/compare                    → International Comparison
```

## 5. REACT IMPLEMENTATION PLAN

### Phase 1: Nav component refactor (current task)
- Replace flat `tabs` array with hierarchical `navItems` structure
- Each top-level item has `id`, `label`, `icon`, `children[]`
- Children have `id`, `label` — view state becomes `"suppliers.scrutiny"` etc.
- Tab bar becomes: top-level buttons + dropdown sub-nav strip below

### Phase 2: Route migration (future, when deploying to Next.js)
- Add Next.js App Router pages matching URL structure
- Keep `view` state for now (single-page mode)
- Legacy routes redirect: `/contractors` → `/suppliers`, `/cronyism` → `/suppliers/scrutiny`

### Phase 3: Component extraction (future)
- Extract each view section into its own component file
- Lazy-load heavy views (charts) with `React.lazy`

### Current implementation (Phase 1):
- `view` state uses dot notation: `"suppliers"`, `"suppliers.scrutiny"`, `"government.spending"`
- Top nav shows 6 items: Overview, Projects, Suppliers, Government, Economy, Compare
- Clicking a top-level item sets view to its default child
- Sub-nav strip appears below for items with children
- All existing view JSX blocks preserved — only `view === "x"` checks updated

## 6. DESIGN PRINCIPLES

- **Minimal:** 6 top-level items (down from 8)
- **Neutral:** No opinionated language in navigation
- **Separated:** Spending data (Projects/Suppliers) vs economic context (Economy)
- **Scalable:** Dropdown children can grow without touching top nav
- **Consistent:** Every section follows same pattern (header, charts, cards, sources)
