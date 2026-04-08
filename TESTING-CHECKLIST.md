# End-to-End Testing Checklist

Run `npm run dev` and work through each section.

---

## Homepage

- [ ] Typography looks right — labels readable, hierarchy clear, nothing too small
- [ ] KPI cards render with correct data and icons
- [ ] Chart cards display properly (labels, titles, axes)
- [ ] "Explore the Data" grid shows **6 tiles**: Projects, Suppliers, Government, Economy, Compare, League Tables
- [ ] League Tables tile shows Trophy icon and "65 contracts" stat
- [ ] Footer text is legible
- [ ] No hydration errors in browser console

## Alternative Spend Generator

- [ ] First card shows a **specific cancelled project** (NOT "Total Cancelled & Wasted Spend")
- [ ] Project name, department, and amount all visible
- [ ] Type label reads "Cancelled project" or "Wasted spend" (never "Total cancelled & wasted spend")
- [ ] "Shuffle" changes equivalents, keeps same project
- [ ] "Next Project" advances to next individual project
- [ ] Counter shows "1 of N cancelled projects" — no aggregate counted in N
- [ ] Equivalent numbers have **no `~` prefix** (e.g. "1.1 million" not "~1.1 million")
- [ ] "Share" button opens modal

## Share System

- [ ] Share modal opens with editorial mini preview (no style toggle)
- [ ] Mini preview: left-aligned layout, red accent line, "WASTED." (uppercase), "Equivalent to:" label
- [ ] Copy URL button works — copies to clipboard
- [ ] Download PNG button produces a 1200x630 image
- [ ] PNG card: left-aligned, faint red accent with glow, large amount, "WASTED.", project name, department, "EQUIVALENT TO:", 3 equivalents
- [ ] Open the copied share URL in a new tab — share page renders correctly
- [ ] Share page: card displays, Copy Link works, Download PNG works, "Explore the data" link works

## League Tables

- [ ] Clicking League Tables tile navigates to league landing
- [ ] Landing shows "Performance Rankings" header + 2 sub-table cards
- [ ] Department Performance card shows correct department count
- [ ] Consultancy Spend card shows correct department count + total spend
- [ ] **Department Performance sub-view**: sortable by 6 columns, searchable, summary strip, scoring methodology note, expandable rows with per-project detail, progress bars
- [ ] **Consultancy Spend sub-view**: sortable by 5 columns, filterable by firm/category/route, expandable department rows with contract detail
- [ ] Breadcrumb navigation back to league landing works

## Navigation (all 21 views)

- [ ] Overview (homepage)
- [ ] Projects
- [ ] Suppliers > Top Suppliers
- [ ] Suppliers > Consultants & Advisers
- [ ] Suppliers > Procurement Scrutiny
- [ ] Government > Government Spending
- [ ] Economy > Economic Output
- [ ] Economy > Cost of Living
- [ ] Economy > Production & Imports
- [ ] Compare > Infrastructure
- [ ] Compare > Bills
- [ ] Compare > Fuel
- [ ] Compare > Affordability
- [ ] Compare > Tax
- [ ] Compare > Structural Performance
- [ ] League Tables (landing)
- [ ] League Tables > Department Performance
- [ ] League Tables > Consultancy Spend
- [ ] Back buttons work throughout
- [ ] Sub-nav highlights active view

## Console / Errors

- [ ] No React hydration mismatch errors
- [ ] No uncaught exceptions
- [ ] No missing data warnings
