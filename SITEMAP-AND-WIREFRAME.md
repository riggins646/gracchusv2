# Gracchus — Proposed Sitemap & Homepage Wireframe
## Optimised for Intuitive User Journeys & Viral Discovery

---

## PART 1: PROPOSED SITEMAP

### Design Principles
- Every page reachable from homepage in 1 click (via issue grid)
- Every page reachable from nav in max 2 clicks (category → page)
- Plain-language naming throughout — no data jargon
- Navigation structured by *user intent*, not by *data taxonomy*

---

### Top-Level Navigation (5 items — fits on mobile without scrolling)

```
┌─────────────────────────────────────────────────────┐
│  Home  │  Your Money  │  Government  │  Power & Influence  │  The Economy  │
└─────────────────────────────────────────────────────┘
```

Plus: persistent Search icon (🔍) in header, always visible.

---

### Full Sitemap

```
HOME (/)
│
├── YOUR MONEY
│   ├── Prices & Inflation          (economy.costOfLiving)
│   ├── Energy Bills                (economy.energy)
│   ├── Fuel & Transport Costs      (compare.bills + compare.infrastructure)
│   ├── Tax & What You Pay          (government.taxdebt)
│   └── Housing & Cost of Living    (compare.structural — housing subset)
│
├── GOVERNMENT
│   ├── Where the Money Goes        (government — civil service/spending overview)
│   ├── Budget Overruns             (projects)
│   ├── Planning Failures           (projects.planning)
│   ├── Delivery Delays             (projects.delays)
│   ├── Defence Spending            (compare.defence)
│   ├── Foreign Aid                 (transparency.aid)
│   ├── Air Passenger Duty          (government.apd)
│   └── Department League Tables    (league.departments)
│
├── POWER & INFLUENCE
│   ├── Who Gets Government Contracts  (suppliers)
│   ├── Consultancy Spend              (suppliers.consultants + league.consultancy)
│   ├── Political Donations            (transparency.donations)
│   ├── MPs' Income & Expenses         (transparency.mp)
│   └── Lobbying Register              (transparency.lobbying)
│
├── THE ECONOMY
│   ├── GDP & Growth                (economy.output)
│   ├── Production & Trade          (economy.production)
│   ├── Innovation & R&D            (economy.innovation)
│   ├── Markets & Listings          (economy.markets)
│   └── UK vs Other Countries       (compare.structural)
│
├── EXPLORE (accessible via homepage, not primary nav)
│   ├── What Could This Fund?       (HomeSpendGenerator — full page)
│   ├── Daily Cost Calculator       (DailyCostGenerator — full page)
│   ├── Your Tax, Visualised        (NEW — salary → breakdown → share)
│   ├── Guess the Overrun           (NEW — quiz mechanic)
│   └── Search All Data             (NEW — global search results page)
│
└── UTILITIES
    ├── About & Methodology         (footer link)
    ├── Sources                     (footer link)
    └── Share page (/share/[id])    (social landing)
```

**Key changes from current:**
- "Cost of Living" + "Economy" overlap resolved → split into "Your Money" (personal) and "The Economy" (national)
- "Accountability" + "Suppliers" merged → "Power & Influence" (clearer, more compelling name)
- "League Tables" absorbed into parent categories (Department league → Government; Consultancy league → Power & Influence)
- "Explore" section surfaces generators and interactive tools as first-class citizens
- Every page has a single unambiguous home in the tree

---

### Mega-Menu Behaviour

On desktop hover or click, each nav category reveals a dropdown showing all sub-pages:

```
┌─────────────────────────────────────────────┐
│  YOUR MONEY                                 │
│                                             │
│  Prices & Inflation                         │
│  Energy Bills                               │
│  Fuel & Transport Costs                     │
│  Tax & What You Pay                         │
│  Housing & Cost of Living                   │
│                                             │
│  ─────────────────────────────              │
│  ★ UK electricity costs 3× France's         │
│    → See energy bills                       │
└─────────────────────────────────────────────┘
```

The bottom section shows one "hook stat" from that category — rotated/randomised — to create curiosity and encourage click-through. This turns navigation into a discovery moment.

On mobile: hamburger menu opens full-screen overlay with all categories expanded.

---

## PART 2: HOMEPAGE WIREFRAME

### The homepage must answer 3 questions in 3 seconds:
1. "What is this?" → A public audit of UK government spending and performance
2. "What can I find here?" → Every major public-interest issue, made simple
3. "Where do I start?" → Pick your issue, search, or explore a generator

---

### Desktop Wireframe (1400px max-width)

```
┌──────────────────────────────────────────────────────────────────┐
│ ● Gracchus                          Updated: 2026-03-31 │
├──────────────────────────────────────────────────────────────────┤
│ Home  │  Your Money  │  Government  │  Power & Influence  │  🔍 │
╞══════════════════════════════════════════════════════════════════╡
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         🔍  What do you want to know?                    │    │
│  │         [ Search: fuel prices, MPs, foreign aid...  ]    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ╔═══════════════════════════════════════════╗  ┌──────────────┐ │
│ ║  £42.8bn                                  ║  │  DAILY COST  │ │
│ ║  OVER BUDGET                              ║  │  HS2: £4.2M  │ │
│ ║  across 40 major UK projects              ║  │  per day     │ │
│ ║                                           ║  │              │ │
│ ║  ← prev    ● ● ● ○ ○    next →           ║  │  [Shuffle]   │ │
│ ║  (rotates: waste / MPs / energy / aid)    ║  │  [Share]     │ │
│ ╚═══════════════════════════════════════════╝  └──────────────┘ │
│                                                                  │
│  WHAT DO YOU CARE ABOUT?                                         │
│  ────────────────────────                                        │
│                                                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ Why is everything │ │ Where is money   │ │ What do MPs      │ │
│  │ so expensive?     │ │ being wasted?    │ │ really earn?     │ │
│  │                   │ │                  │ │                  │ │
│  │ 3.2% inflation    │ │ £42.8bn over     │ │ £4.7m outside    │ │
│  │ Petrol 142p/L     │ │ budget. 5        │ │ income declared. │ │
│  │                   │ │ cancelled.       │ │ 650 MPs tracked. │ │
│  │ → Prices & costs  │ │ → Budget waste   │ │ → MP tracker     │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ Who donates to    │ │ Why are trains   │ │ How much do we   │ │
│  │ political parties?│ │ so expensive?    │ │ spend on defence?│ │
│  │                   │ │                  │ │                  │ │
│  │ £816m since 2001  │ │ UK fares 2×      │ │ £54.2bn — 2.3%  │ │
│  │ 6,819 donations   │ │ Europe average   │ │ of GDP           │ │
│  │                   │ │                  │ │                  │ │
│  │ → Donations       │ │ → Transport      │ │ → Defence        │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ Who gets govt     │ │ How much         │ │ Is the UK        │ │
│  │ contracts?        │ │ lobbying happens? │ │ economy growing? │ │
│  │                   │ │                  │ │                  │ │
│  │ Top firms, sole   │ │ 251 registered.  │ │ £2.3tn GDP.      │ │
│  │ source deals      │ │ Covers <1%.      │ │ 38% behind US.   │ │
│  │                   │ │                  │ │                  │ │
│  │ → Suppliers       │ │ → Lobbying       │ │ → Economy        │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ How much foreign  │ │ Which depts      │ │ What could the   │ │
│  │ aid do we give?   │ │ waste the most?  │ │ money fund       │ │
│  │                   │ │                  │ │ instead?         │ │
│  │ £15.4bn in 2024.  │ │ Rankings by      │ │                  │ │
│  │ 0.58% of GNI.     │ │ overrun, delay,  │ │ [▶ TRY THE       │ │
│  │                   │ │ and spend.       │ │   GENERATOR]     │ │
│  │ → Foreign aid     │ │ → League tables  │ │ → Explore        │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  TRENDING THIS MONTH                                             │
│  ───────────────────                                             │
│  ┌────────────────────────────────┐ ┌──────────────────────────┐ │
│  │ ▲ Consultancy spend up 12%    │ │ ▼ Foreign aid fell to    │ │
│  │   in Q4 across 5 departments  │ │   0.52% — lowest since   │ │
│  │   → See consultancy data      │ │   2015 → See aid data    │ │
│  └────────────────────────────────┘ └──────────────────────────┘ │
│  ┌────────────────────────────────┐ ┌──────────────────────────┐ │
│  │ ● 35 new lobbying firms       │ │ ● HS2 latest estimate    │ │
│  │   registered in 2025 — record │ │   revised to £Xbn        │ │
│  │   → See lobbying register     │ │   → See budget overruns  │ │
│  └────────────────────────────────┘ └──────────────────────────┘ │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  WHAT COULD WASTED MONEY FUND INSTEAD?                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  £12.8bn wasted on cancelled projects                    │    │
│  │                                                          │    │
│  │  Could have funded:                                      │    │
│  │  ■ 365,714 nurses for a year                             │    │
│  │  ■ 128,000,000 pothole repairs                           │    │
│  │  ■ 64,000 council homes                                  │    │
│  │                                                          │    │
│  │  [Shuffle]  [Next Project]  [Share]                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  STATE OF THE COUNTRY                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Productiv.│ │Real Wages│ │Electricty│ │ Housing  │           │
│  │$56.50/hr │ │ +14%     │ │$0.35/kWh │ │ 113.7    │           │
│  │38% behind│ │over 23yr │ │highest   │ │price-to- │           │
│  │the US    │ │US: +38%  │ │in Europe │ │income    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  About · Sources · Methodology              Gracchus    │
└──────────────────────────────────────────────────────────────────┘
```

---

### Mobile Wireframe (375px)

```
┌───────────────────────┐
│ ● Gracchus  ☰ │
├───────────────────────┤
│                       │
│ 🔍 What do you want  │
│    to know?           │
│ [___________________] │
│                       │
│ ┌───────────────────┐ │
│ │  £42.8bn          │ │
│ │  OVER BUDGET      │ │
│ │  ← ● ● ● ○ ○ →   │ │
│ └───────────────────┘ │
│                       │
│ PICK YOUR ISSUE       │
│                       │
│ ┌───────────────────┐ │
│ │ Why is everything │ │
│ │ so expensive?     │ │
│ │ 3.2% inflation →  │ │
│ └───────────────────┘ │
│ ┌───────────────────┐ │
│ │ Where is money    │ │
│ │ being wasted?     │ │
│ │ £42.8bn waste →   │ │
│ └───────────────────┘ │
│ ┌───────────────────┐ │
│ │ What do MPs       │ │
│ │ really earn?      │ │
│ │ £4.7m outside →   │ │
│ └───────────────────┘ │
│ ┌───────────────────┐ │
│ │ Who donates to    │ │
│ │ parties?          │ │
│ │ £816m tracked →   │ │
│ └───────────────────┘ │
│        ...            │
│   (12 cards total,    │
│    single column)     │
│                       │
│ ───────────────────── │
│ TRENDING THIS MONTH   │
│ [horizontal scroll]   │
│                       │
│ ───────────────────── │
│ [GENERATOR]           │
│ What could wasted     │
│ money fund instead?   │
│ [Try it →]            │
│                       │
└───────────────────────┘

HAMBURGER MENU (☰) OPENS:
┌───────────────────────┐
│                    ✕  │
│                       │
│ 🔍 Search...          │
│                       │
│ YOUR MONEY            │
│   Prices & Inflation  │
│   Energy Bills        │
│   Fuel & Transport    │
│   Tax & What You Pay  │
│   Housing Costs       │
│                       │
│ GOVERNMENT            │
│   Where Money Goes    │
│   Budget Overruns     │
│   Planning Failures   │
│   Delivery Delays     │
│   Defence Spending    │
│   Foreign Aid         │
│   Department Rankings │
│                       │
│ POWER & INFLUENCE     │
│   Govt Contracts      │
│   Consultancy Spend   │
│   Political Donations │
│   MPs' Income         │
│   Lobbying Register   │
│                       │
│ THE ECONOMY           │
│   GDP & Growth        │
│   Production & Trade  │
│   Innovation & R&D    │
│   Markets             │
│   UK vs The World     │
│                       │
│ EXPLORE               │
│   Generators          │
│   Your Tax Visualised │
│   Guess the Overrun   │
│                       │
└───────────────────────┘
```

---

## PART 3: THE "UNDER 2 CLICKS" AUDIT

Here is every major user interest and how to reach it in the proposed system:

| User wants to know about... | Homepage card? | Nav path | Clicks from homepage |
|---|---|---|---|
| Prices / inflation | ✅ "Why is everything so expensive?" | Your Money → Prices | **1** |
| Energy bills | ✅ (in card description) | Your Money → Energy | **1** |
| Fuel / petrol prices | ✅ "Why are trains so expensive?" card covers transport+fuel | Your Money → Fuel | **1** |
| Train prices | ✅ Same card | Your Money → Fuel & Transport | **1** |
| Tax / what I pay | ✅ Visible in grid | Your Money → Tax | **1** |
| Budget waste / overruns | ✅ "Where is money being wasted?" | Government → Overruns | **1** |
| MPs' income / expenses | ✅ "What do MPs really earn?" | Power → MPs' Income | **1** |
| Political donations | ✅ "Who donates to parties?" | Power → Donations | **1** |
| Lobbying | ✅ "How much lobbying happens?" | Power → Lobbying | **1** |
| Foreign aid | ✅ "How much foreign aid do we give?" | Government → Foreign Aid | **1** |
| Defence spending | ✅ "How much do we spend on defence?" | Government → Defence | **1** |
| Government contracts | ✅ "Who gets govt contracts?" | Power → Contracts | **1** |
| GDP / economy | ✅ "Is the UK economy growing?" | Economy → GDP | **1** |
| Department rankings | ✅ "Which depts waste the most?" | Government → Rankings | **1** |
| Generator / fun tool | ✅ "What could the money fund?" | Explore → Generator | **1** |
| Planning failures | — (not in grid) | Government → Planning | **2** |
| Delivery delays | — (not in grid) | Government → Delays | **2** |
| Consultancy spend | — (merged into contracts card) | Power → Consultancy | **2** |
| Innovation / R&D | — | Economy → Innovation | **2** |
| Markets / LSE | — | Economy → Markets | **2** |
| Air Passenger Duty | — | Government → APD | **2** |
| Housing costs | — (mentioned in "everything expensive" card) | Your Money → Housing | **1-2** |
| UK vs other countries | — | Economy → UK vs World | **2** |

**Result: 15 of 24 views reachable in 1 click from homepage. All 24 reachable in max 2 clicks. Zero guessing required.**

Compare to current system: only 6 views directly visible from homepage; remaining 18 require category guessing + sub-nav discovery = 2-4 clicks with potential wrong turns.

---

## PART 4: SEARCH BEHAVIOUR

The search bar is the single most impactful UX addition. Proposed behaviour:

**Type-ahead suggestions (fuzzy match):**

```
User types: "train"
→ Fuel & Transport Costs
→ "UK train fares 2× European average"

User types: "MP"
→ MPs' Income & Expenses
→ "650 MPs tracked. £4.7m outside income."

User types: "aid"
→ Foreign Aid
→ "£15.4bn in 2024. Where it goes."

User types: "waste"
→ Budget Overruns
→ Planning Failures
→ "£42.8bn over budget across 40 projects"
```

Each suggestion shows: page name + one-line hook stat + click to navigate.

**Implementation:** A static keyword → view-id mapping (no backend needed). ~100 keywords covering all 24 views plus common synonyms (NHS → government spending, petrol → fuel & transport, council tax → tax, etc.).

---

*Sitemap and wireframe prepared April 2026.*
