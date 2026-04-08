# Gracchus — Full UX/UI Review
## April 2026 · Senior Product & UX Assessment

---

## 1. Executive Summary

Gracchus has grown from a spending-waste tracker into something far more ambitious: a comprehensive "state of the nation" data platform covering 24 distinct views across 7 navigation categories. The editorial voice is sharp, the data work is genuinely impressive, and the generators are the most viral-ready feature on any UK public-interest data site I've seen.

But the platform has a structural problem that is now undermining everything else: **it has outgrown its navigation system.**

The current architecture was designed for a 6-page dashboard. It now powers a 24-page editorial data product. The result is that most of the strongest content is invisible to first-time visitors, the navigation requires pre-existing knowledge of what's available, and the homepage — which should be the engine of discovery — funnels users narrowly toward waste/overruns while burying everything from lobbying to train prices to MPs' outside income.

The three most urgent problems are:

1. **Navigation is a filter bar, not a discovery system.** The 7-item horizontal nav with nested sub-items works like a traditional dashboard switcher. But this product is closer to a media publication. It needs navigation that invites exploration — not navigation that assumes you already know what section you want.

2. **The homepage is a hero poster, not a front page.** The giant red "£X Over Budget" hero is visually stunning but functionally narrow. A user who cares about fuel prices, MPs' expenses, or foreign aid has to already know those sections exist and hunt through the nav to find them. The homepage needs to route people by *interest*, not by *data taxonomy*.

3. **24 views, zero search, no cross-linking.** There's no way to search. There are no "related" links between sections. There are no breadcrumb trails. Once you're inside a view, you're in a silo. The only way out is back through the nav bar. For a product this large, that's a serious discoverability failure.

Despite these structural issues, the raw materials are exceptional. The editorial framing is tight (not too partisan, not too dry). The generators are genuinely delightful. The data coverage is broad enough to satisfy journalists, activists, and curious citizens. The visual language — dark, typographic, red-accented — is distinctive and premium.

This review recommends a series of changes that preserve everything that works while fixing the structural deficit. The goal: make this feel like the BBC News of public-spending data — instantly navigable, personally relevant, and effortlessly shareable.

---

## 2. User Journey Audit

### Journey A: Casual Member of the Public

**Persona:** "Why are my taxes so high?" / "Why is everything so expensive?"

**Current journey:**
1. Lands on homepage. Sees giant red overrun number.
2. Reads "Over Budget" — understands this is about government waste.
3. Scrolls to "What Matters Right Now" grid — sees 6 cards.
4. Might click "Cost of Living" → lands on Prices & Inflation page.
5. Wants fuel prices specifically → has to scan the page to find that data, or go back and find "Bills, Fuel & Energy" in the sub-nav (which only appears after clicking "Cost of Living" in the top nav).

**Friction points:**
- The hero communicates one story (budget overruns) but the user's interest may be completely different. First impression: "this is about project waste" — not about taxes, train prices, or MPs' pay.
- The 6-card grid uses internal terminology ("Suppliers & Contracts", "League Tables") that a casual user won't map to their real question.
- Sub-navigation is invisible until you click a parent category. Users can't see the full menu at a glance.
- No search. If someone wants "train prices" they have no text-input way to find it.

**Recommendations:**
- Add a prominent search bar ("What do you want to know?") above the fold.
- Replace the 6-card grid with ~12 issue-based entry points using plain language: "Why is my energy bill so high?", "Where is money being wasted?", "What do MPs earn?", "How much do we spend on foreign aid?"
- These cards should feel like article headlines, not dashboard tiles.

---

### Journey B: Journalist

**Persona:** Needs story hooks, charts, shareable visuals, source attribution.

**Current journey:**
1. Arrives (probably via direct link or bookmark).
2. Knows the nav → goes straight to the section they need.
3. Finds good charts with source citations and shareable card functionality.
4. Can grab numbers, but struggles to quickly scan across sections for the "best" story.

**Friction points:**
- No "what's changed recently" or "biggest movers" view. Journalists want the freshest, most dramatic data points.
- Chart sharing is good but there's no "story pack" or "key findings this month" summary.
- Cross-referencing is hard. If a journalist is reading about a supplier, there's no link to that supplier's lobbying connections or political donations.

**Recommendations:**
- Add a "This Month" or "Latest Updates" module to the homepage showing the most recently refreshed data and biggest changes since last update.
- Add cross-links between related views (e.g., supplier page → "See political donations from this company" link).
- Consider an exportable "press pack" page with the top 20 most striking data points, pre-formatted for media use.

---

### Journey C: Analyst / Economics Graduate

**Persona:** Wants deep drill-down, raw data access, methodology transparency.

**Current journey:**
1. Navigates competently through the data-product-style nav.
2. Finds robust tables with sorting and filtering.
3. Some views (MPs, donations, lobbying) have excellent searchable tables with pagination.
4. Other views are chart-heavy with less table access.

**Friction points:**
- No data download/export option on any view. Analysts want CSV access.
- Methodology notes are brief. Some pages have good source attribution but no methodology discussion.
- Time range selectors (2Y / 5Y / 10Y / Max) are excellent but not available on all charts.
- Some views have dense filter bars (donations page has 5 filters) which is appropriate for this user but overwhelming for Journey A users.

**Recommendations:**
- Add a small "Download data" link on each table/chart (even if it's just a CSV of the displayed data).
- Consider a "Methodology" link in the footer or on each section that explains sourcing.
- This user is already well-served by the current design. Don't over-simplify the deep pages — just ensure they're reachable without requiring the casual user to wade through them.

---

### Journey D: Social Media Arrival

**Persona:** Clicked a shared card/image on Twitter, WhatsApp, or in a group chat.

**Current journey:**
1. Lands on `/share/[id]` page.
2. Sees the specific data point / generator card.
3. Wants more context → the share page should link back to the relevant section.

**Friction points:**
- After seeing the shared card, it's unclear how to explore further. The share page needs stronger "See more" routing.
- If someone screenshots and shares (not via the share URL), the landing experience is the homepage — which doesn't help them find the specific thing they saw.
- No watermark or URL visible on screenshot shares.

**Recommendations:**
- Every share card image should include the Gracchus URL as a subtle watermark.
- Share pages should include 3-4 "Related" cards beneath the shared content to encourage deeper browsing.
- Consider adding "See this in context →" link that goes to the relevant section.

---

### Journey E: Issue-Specific User

**Persona:** "I only care about foreign aid" / "I only care about NHS waste" / "I only care about train prices."

**Current journey:**
1. Lands on homepage.
2. Sees overrun hero. Doesn't care about that.
3. Scans the 6-card "What Matters Right Now" grid. Foreign aid isn't listed. Train prices aren't listed. NHS isn't listed.
4. Looks at the nav bar: "Cost of Living", "Tax & Spending", "Waste & Projects", "Accountability", "Economy", "League Tables".
5. Guesses: maybe foreign aid is under "Accountability"? Maybe "Tax & Spending"? Clicks "Accountability" → sees sub-nav → finds "Foreign Aid".
6. Success, but it took 3 steps and a guess.

**This is the critical failure of the current UX.** For the five most common issue-specific interests (foreign aid, MPs' pay, fuel prices, NHS spending, transport costs), the journey requires guessing which category they fall under. This should take zero guesses.

**Recommendations:**
- The homepage should include a comprehensive "topic grid" or "issue finder" that lists every major issue area in plain language, with no nesting.
- Alternatively: add a prominent search/filter bar that surfaces relevant pages by keyword.
- Issue-specific entry points should use questions ("How much do we spend on foreign aid?") rather than data-product labels ("Foreign Aid Tracker").

---

## 3. Navigation Recommendation

### Current System (Problems)

The current nav is a **7-item horizontal strip** with **hidden sub-items** that appear as a secondary row only when a parent is active:

```
Home | Cost of Living | Tax & Spending | Waste & Projects | Accountability | Economy | League Tables
                                                                [sub-items appear here when parent clicked]
```

Issues:
- **7 top-level items is too many for a horizontal nav.** On mobile, this overflows and becomes a horizontal scroll — users miss items to the right.
- **Sub-items are invisible until clicked.** Users must click a parent to discover what's inside. This means 18 of 24 pages are hidden behind a click.
- **Category names are taxonomic, not intuitive.** "Accountability" could mean anything. "Compare.structural" (a view ID that leaks into labelling) means nothing to a normal user.
- **"Cost of Living" and "Economy" overlap.** A user wondering about GDP doesn't know if it's under "Economy" or "Tax & Spending". A user wondering about energy prices doesn't know if it's "Cost of Living" or "Economy".
- **"League Tables" is tucked at the end.** It's actually one of the most engaging features but is treated as an afterthought.

### Proposed Navigation System

I recommend a **simplified 5-category system** with full visibility of sub-items via a mega-menu or expanded dropdown:

```
Home | Your Money | Government | Who Gets Paid | The Economy | Explore
```

**Category 1: Your Money**
Plain language. This is the stuff that hits people's wallets.
- Prices & Inflation
- Energy Bills
- Fuel & Transport Costs
- Tax & What You Pay
- Housing Costs

**Category 2: Government**
What the government does with it.
- Public Spending Overview
- Budget Overruns & Waste
- Planning Failures & Delays
- Defence Spending
- Foreign Aid
- Air Passenger Duty

**Category 3: Who Gets Paid**
Follow the money. This is where the accountability story lives.
- Suppliers & Contracts
- Consultancy Spend
- Political Donations
- MPs' Income & Expenses
- Lobbying Register
- Department League Tables

**Category 4: The Economy**
Big-picture UK performance.
- GDP & Output
- Production & Trade
- Innovation & R&D
- Markets & Listings
- UK vs. Other Countries

**Category 5: Explore**
Fun, interactive, cross-cutting. This is the virality engine.
- Generators (What Could This Fund?)
- Daily Cost Calculator
- Shareable Cards
- Search All Data

**Key changes:**
- Reduced from 7 to 5 categories (fits on mobile without scrolling).
- Names use plain language a 16-year-old would understand.
- Sub-items visible immediately on hover/click (mega-menu style), not hidden behind a click-then-reveal.
- "Explore" category surfaces the most viral/sticky features.
- Clear separation: Your wallet → Government's wallet → Who profits → Big picture → Fun stuff.

---

## 4. Homepage Recommendation

### Current Homepage (Problems)

The homepage currently has 4 sections in order:
1. **Giant hero:** "£Xbn Over Budget" with DailyCostGenerator
2. **"What Matters Right Now":** 6 entry-point cards
3. **"Why Projects Fail":** 3-card funnel (Blocked → Delayed → Over Budget)
4. **"State of the Country":** 4 KPI cards

This is essentially a **project-waste landing page** with some secondary routing. It works for the original product scope but fails for the current 24-view scope because:
- 18 of 24 views have no homepage representation.
- The hero anchors the entire product to one story (overruns).
- There's no search, no "trending", no personalization signal.
- Below-fold content is generic KPI cards that don't help with routing.

### Proposed Homepage Structure

**Above the fold:**

1. **Search bar** (prominent, central): "What do you want to know?" — with type-ahead suggestions like "fuel prices", "foreign aid", "MP expenses", "NHS spending". This alone would solve 50% of the discovery problem.

2. **Rotating headline stat** (replaces static hero): Instead of always showing overruns, rotate between 3-4 "most striking" stats:
   - "£Xbn over budget across Y projects"
   - "MPs declared £Xm in outside income last year"
   - "UK electricity costs 3× France's"
   - "£Xbn in political donations since 2001"
   Each rotates every 8-10 seconds with a manual advance. Each links to its section. This immediately communicates breadth.

3. **Issue Grid** (12 cards, 3×4 on desktop): Plain-language entry points:
   - "Why is everything so expensive?"     → Cost of Living
   - "Where is money being wasted?"        → Budget Overruns
   - "What do MPs earn?"                   → MP Accountability
   - "Who donates to political parties?"   → Political Donations
   - "How much do we spend on defence?"    → Defence
   - "Why are trains so expensive?"        → Transport Costs
   - "Who gets government contracts?"      → Suppliers
   - "How much lobbying happens?"          → Lobbying
   - "Is the UK economy growing?"          → GDP & Output
   - "How much foreign aid do we give?"    → Foreign Aid
   - "Which departments waste the most?"   → League Tables
   - "What could the money fund instead?"  → Generator

**Below the fold:**

4. **"Trending This Month"** — 3-4 data points that have changed most recently, with mini-sparklines and "See more →" links. Gives the product a feeling of being alive and updated.

5. **Generator Preview** — The HomeSpendGenerator, but positioned as an interactive module with a clear CTA: "See what wasted money could have funded →"

6. **"State of the Country"** — The 4 KPI cards (keep these — they're good).

7. **"Why Projects Fail" Funnel** — Move below the fold. Still good content but shouldn't dominate the landing experience.

---

## 5. Delight & Gamification Ideas

### What Currently Works

- **HomeSpendGenerator** — This is excellent. The slot-machine metaphor, the category-balanced randomization, the share modal. This is the single most viral-ready feature. It turns abstract numbers into emotional "what-ifs". Keep it, promote it harder.

- **DailyCostGenerator** — Good concept but feels more like an informational widget than a game. The "daily cost" framing is strong but it's positioned as a sidebar element, not a centrepiece.

- **Share card system** — Technically solid. The PNG generation at 1200×630 is exactly right for social cards. The encoding/decoding is clean.

### What Feels Undercooked

- **No "quiz" or "guess" mechanic.** The generators show you answers but never ask you to guess first. A "Can you guess?" mechanic would dramatically increase engagement and shareability. Example: "How much did HS2 go over budget? [slider] → Reveal → You were £Xbn off! → Share your score."

- **No comparison swiper.** The platform has extensive UK-vs-other-countries data but no swipeable card mechanic. Imagine: "UK vs France — swipe to compare" with electricity prices, tax rates, train fares, productivity. Each card is a share moment.

- **No "your tax breakdown" calculator.** This is the most obvious missing feature. Enter your salary → see exactly how your tax is split across departments → see what "your share" of the waste is. "You personally paid £47 toward HS2's overrun." This would be the single most shared feature on the platform.

### New Ideas (Premium, Editorial, Non-Gimmicky)

1. **"Your Tax, Visualised"** — Enter salary → see breakdown → see waste share → shareable card. This is the #1 missing feature. Every UK taxpayer would share this.

2. **"Guess the Overrun"** — Show a project name → user guesses original vs actual cost → reveal + shock factor → share score. Works as a standalone page or an embeddable widget.

3. **"Worse Than You Think" Cards** — A curated set of 20 facts designed specifically for sharing. Each has a striking visual, a one-sentence framing, and a share button. Example: "The UK government pays more in debt interest than it spends on schools, transport, and policing combined." Swipeable carousel.

4. **"MP Salary vs. You"** — Enter your salary → "Your MP earns X times your salary in outside income alone." Instantly shareable, personalised, provocative.

5. **"Track an Issue"** — Let users bookmark 2-3 issues they care about. When they return, show them updates on their issues first. Lightweight personalisation without requiring login. (Use localStorage.)

6. **Weekly "Number of the Week"** — A single, auto-generated or editorially chosen stat that changes weekly. Shown on the homepage with a countdown to next week's number. Creates a reason to return.

---

## 6. Simplification Recommendations

### Table & Data Density

Several pages feel overwhelming for non-analyst users:

- **Political Donations page** — 5 filter controls (government period, party, donor type, min value, search) above a dense table. The filters are good for analysts but intimidating for casual users. **Fix:** Add a "Quick View" toggle that shows just the top 20 donations in a simple list, with a "Show full table with filters" expandable section below.

- **MPs' Income & Expenses** — 650 rows with 5 sortable columns. The sort defaults work well (descending by outside income) but the page opens with a wall of data. **Fix:** Lead with 3 "insight cards" above the table: "Highest outside earner: X (£Y)", "Party with most outside income: X", "Average expenses per MP: £X". Then show the table.

- **Lobbying Directory** — 251 rows. The tabbed interface (Directory / Clients / Family Links / Meetings / Comparison) is good architecture but the Directory tab opens with a full table. **Fix:** Lead with "Key Facts" cards (251 registered, 1,174 clients, 41 MPs with family links) and then the table.

### General Principle

**Every page should follow: Insight → Chart → Table.**

Currently, many pages go: Chart → Table → Insight (buried at bottom). The strongest single data point should always be the first thing you read, not the last.

### Filter Simplification

For pages with multiple filters, add a "reset all" button and consider hiding advanced filters behind a "More filters" toggle. The default view should show only search + one primary filter (usually party or category).

---

## 7. Mobile & Social User Journey Review

### Mobile Navigation

The current horizontal nav strip with 7 items **does not work on mobile.** It becomes a horizontal scroll, which means:
- Users don't see items to the right (especially "Economy" and "League Tables").
- Sub-nav items are even less discoverable on small screens.
- There's no hamburger/drawer menu alternative.

**Recommendation:** On mobile, replace the horizontal nav with a **hamburger menu** that opens a full-screen overlay showing all categories and sub-items at once. This is standard for content-heavy mobile sites and would solve the discoverability problem instantly.

### Social Traffic Landing

When someone arrives from a shared link:
- If it's a `/share/[id]` link: they see the card. Good. But they need a clear "Explore Gracchus →" CTA to enter the full product.
- If it's the homepage: the hero-heavy design works on desktop but on mobile the giant number dominates the entire screen. The routing cards require scrolling. First-time mobile visitors may bounce before discovering the breadth of content.

**Recommendation:** On mobile homepage, reduce the hero to ~40% of viewport height and show the first row of issue cards immediately below without scrolling.

### WhatsApp/Group Chat Journey

These users typically see a screenshot or an OG-image preview. They click through, expect instant context, and decide within 5 seconds whether to stay or leave.

**Recommendation:** Every page should have a clear, readable headline sentence at the very top that answers "what am I looking at?" in plain English. Currently, some pages lead with breadcrumbs ("Accountability → Lobbying") and section headers — which assume context the user doesn't have.

---

## 8. Top 10 UX/UI Improvements by Priority

### 1. Add Search (Critical)
Add a global search bar in the header. Type-ahead with suggestions covering all 24 views plus key terms (fuel, trains, NHS, MPs, waste, aid). This is the single most impactful change for discoverability. Without it, 18 of 24 views are effectively hidden from users who don't know the taxonomy.

### 2. Redesign the Homepage as a Discovery Engine (Critical)
Replace the single-story hero with a rotating headline + 12-card issue grid using plain-language questions. Every major section should be reachable from the homepage in one click without navigating through category parents.

### 3. Add "Your Tax, Visualised" Generator (High Impact)
Salary input → personal tax breakdown → waste share → shareable card. This would likely become the #1 shared feature and the primary acquisition mechanism.

### 4. Simplify Navigation to 5 Categories with Mega-Menu (High Impact)
Reduce from 7 to 5 categories. Use plain-language names. Show all sub-items on hover/click without requiring a parent-page visit first. On mobile, use a full-screen drawer.

### 5. Add "Insight First" Pattern to Every Page (Medium-High)
Every data page should open with 2-3 key insight cards (biggest number, most surprising finding, key comparison) before the charts and tables. Pull the strongest fact to the top.

### 6. Add Cross-Links Between Related Sections (Medium-High)
After the supplier table: "See political donations from these companies →". After the MP table: "See lobbying connections for these MPs →". These connections are the product's unique value and they're currently invisible.

### 7. Build the "Guess the Overrun" Quiz (Medium)
Interactive guessing mechanic for project costs. Simple, shareable, educational. Drives engagement time and social sharing.

### 8. Add Mobile Hamburger Menu (Medium)
Replace horizontal scroll nav on mobile with a drawer/overlay menu showing full navigation tree. Current mobile nav is broken for discoverability.

### 9. Add "Trending This Month" Section to Homepage (Medium)
Show 3-4 recently updated data points with change indicators. Makes the product feel alive and gives returning visitors a reason to check back.

### 10. Add Download/Export on Data Tables (Lower)
CSV export link on tables. Small effort, high value for journalist and analyst users. Also positions the product as a credible data source rather than just a visualisation layer.

---

## Visual Consistency Notes

The visual system is mostly coherent — the dark theme, red accent, uppercase tracking, and monospace meta-text create a distinctive editorial feel. A few inconsistencies:

- **StatCard accent colours are inconsistent.** Some use `text-red-500`, some use `accent="red"`, some use `text-amber-500`. The accent prop maps to raw Tailwind classes in some places and colour names in others. Needs a single colour token system.

- **Section headers vary.** Some pages use the `SectionHeader` component with uppercase tracking. Others use inline `<h1>` tags with different styling. The lobbying view uses `font-serif` while most pages use sans-serif. Pick one heading system and enforce it everywhere.

- **Chart tooltips are consistent** (dark background, rounded corners, good). This is one of the most polished UI elements.

- **Table styling is consistent** across the newer views (MPs, donations, lobbying) but some older views may use slightly different border colours or row hover states. Worth a pass for consistency.

- **Generator components** (HomeSpendGenerator, DailyCostGenerator) feel visually distinct from the rest of the product. They're bordered boxes with specific padding that doesn't quite match the grid system used elsewhere. Consider integrating them into the ChartCard component wrapper for consistency.

---

## Answering the Central Question

> "If someone lands on the site and only cares about one issue (e.g. welfare, fuel prices, tax, foreign aid, NHS, transport, waste), how quickly can they find it?"

**Current answer: 2-4 clicks and at least one guess about which category their issue belongs to.**

For the 6 issues featured in the "What Matters Right Now" grid (cost of living, tax/debt, waste, suppliers, economy, league tables): 1 scroll + 1 click. Acceptable but not instant.

For everything else (foreign aid, MPs, lobbying, train prices, defence, energy, innovation, housing): 1 click on nav parent → scan sub-items → 1 click on sub-item. That's 2 clicks minimum, and it requires the user to correctly guess which parent category contains their issue. Many users will guess wrong on the first try.

**Target answer: 1 click from homepage, or 0 clicks via search.**

Achievable with the recommended search bar + expanded issue grid.

---

*Review completed April 2026. Prepared for the Gracchus product team.*
