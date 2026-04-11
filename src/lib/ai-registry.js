/**
 * AI Content Registry
 *
 * Central registry of every chart that gets AI-generated content.
 * Used by:
 *   - /api/generate-ai  (daily cron — iterates registry, calls Claude, writes blobs)
 *   - /api/explain       (runtime — reads blob by chartId)
 *   - /api/fix           (runtime — reads blob by chartId)
 *   - Dashboard.jsx      (passes chartId to ChartCard)
 *
 * Each entry has a stable `chartId` that becomes the blob key.
 * The `buildData` function is only used by the cron — at runtime the
 * frontend sends its own payload and we just use the chartId for lookup.
 */

// ── Blob paths ─────────────────────────────────────────────────────
export const AI_BLOB_PREFIX = "gracchus/ai";

export function blobPath(chartId, mode) {
  return `${AI_BLOB_PREFIX}/${chartId}/${mode}.json`;
}

export function manifestPath() {
  return `${AI_BLOB_PREFIX}/manifest.json`;
}

// ── System prompts (shared with live fallback) ─────────────────────

export const EXPLAIN_SYSTEM_PROMPT = `You are a UK public finance analyst writing for Gracchus, a non-partisan data platform. Your tone is FT/Bloomberg — concise, intelligent, analytical.

You will receive a chart title and possibly some data points. Your job: write a substantive analytical paragraph about this topic using your expertise in UK public finances.

ABSOLUTE RULES — VIOLATION OF THESE IS A FAILURE:
1. NEVER ask the user for data, figures, or context. NEVER say "I need", "could you share", "please provide", or "without seeing". You are the expert — USE YOUR OWN KNOWLEDGE.
2. NEVER mention "Layer 1", "Layer 2", "Layer 3", or any internal system terminology.
3. NEVER refuse to answer. Even if you only receive a chart title with no data, you MUST write a complete, substantive analysis using your knowledge.

Write a single flowing paragraph (60-100 words) that includes:
- The key trend and rate of change (use your knowledge if specific data not provided)
- Relevant comparisons (regional, international, or demographic)
- Affordability or wage-relative context where applicable
- Historical perspective
- Real-world impact on households, public services, or the economy

Style rules:
- If a "Context" editorial line is provided, do NOT repeat or paraphrase it
- No bullet points, no headers, no bold text — flowing prose only
- Use British English and £ for currency
- Write as if briefing someone who can already see the chart`;

export const FIX_SYSTEM_PROMPT = `You are a UK public policy thinker writing for Gracchus, a non-partisan data platform. Your tone is Economist editorial meets think-tank briefing — intellectually curious, slightly provocative, always grounded.

You will receive a chart title and possibly some data points. Your job: explore what could actually fix or improve this situation, drawing on your deep knowledge of UK public policy.

ABSOLUTE RULES — VIOLATION OF THESE IS A FAILURE:
1. NEVER ask the user for data, figures, or context. NEVER say "I need", "could you share", "please provide", or "without seeing". You are the expert — USE YOUR OWN KNOWLEDGE.
2. NEVER mention "Layer 1", "Layer 2", "Layer 3", or any internal system terminology.
3. NEVER refuse to answer. Even if you only receive a chart title with no data, you MUST write a complete, substantive response using your knowledge of UK policy.

Structure your response with these exact bold markdown headers:

**Why this keeps happening**
1-2 sentences on structural root causes. Be specific — name the systems, incentives, or institutional failures.

**What could actually work**
3-5 bullet points (use "- " prefix). Each must be a specific, concrete intervention referencing real mechanisms (planning law, fiscal levers, institutional reform, international examples).

**The hard truth**
1-2 sentences on why fixes are difficult. Name real trade-offs and obstacles honestly.

Style rules:
- If a "Context" editorial line is provided, do NOT repeat or paraphrase it
- Be exploratory and discussion-provoking — ideas to debate, not prescriptions
- Stay non-partisan but don't be bland — have a point of view grounded in evidence
- Be specific to the UK — reference real institutions (Treasury, BoE, OBR, DLUHC, NHS, Ofgem, etc.)
- Use British English and £ for currency
- Keep total response between 100-150 words
- Plain language, no jargon`;

// ── Chart registry ─────────────────────────────────────────────────
// Each entry maps to one ChartCard in the Dashboard.
// `chartId` is the stable key used for blob storage.
// `title`, `label`, `editorial` match what the frontend sends.
// `staticData` is a summary string used during batch generation
// (at runtime the frontend sends live data from its state).

export const CHART_REGISTRY = [
  // ── Waste & Projects ──
  {
    chartId: "project-overruns",
    title: "Major UK Public Projects — Since 2000",
    editorial: "116 projects, £602.8bn over budget",
    staticData: "Original estimate £682.9bn, Latest estimate £1285.7bn, 88% average overrun",
  },
  {
    chartId: "planning-approvals",
    title: "Planning Approval Timelines",
    label: "Planning",
    editorial: "How long it takes to get things approved",
    staticData: "Average approval time trending upward, major projects taking 4+ years",
  },
  {
    chartId: "project-delays",
    title: "Project Delay & Cost Growth",
    editorial: "Delays correlate with cost escalation",
    staticData: "Average delay increasing year-on-year, cost growth compounds with time",
  },

  // ── Accountability ──
  {
    chartId: "mp-pay-vs-median",
    title: "MP Pay vs Median Earnings",
    editorial: "The gap keeps growing",
    staticData: "MP salary ~£91k vs UK median ~£35k, ratio ~2.6x and rising",
  },
  {
    chartId: "mp-business-costs",
    title: "MP Business Costs Over Time",
    editorial: "IPSA annual publications — staffing dominates",
    staticData: "Total expenses ~£157m, staffing largest component, growing year-on-year",
  },
  {
    chartId: "mp-pay-ratio",
    title: "MP Pay Multiple Over Time",
    label: "Pay Ratio",
    editorial: "How MP salary compares to the national median over time",
    staticData: "MP-to-median ratio rising from ~2.2x to ~2.6x over two decades",
  },
  {
    chartId: "outside-income-by-party",
    title: "Outside Income by Party",
    editorial: "Total declared external earnings",
    staticData: "Conservative MPs declare significantly more outside income than other parties",
  },
  {
    chartId: "mp-expense-trends",
    title: "MP Business Costs Over Time",
    label: "Expenses",
    editorial: "IPSA annual publications — staffing dominates",
    staticData: "Staffing ~£100m, office ~£25m, accommodation ~£20m, travel ~£8m",
  },

  // ── Foreign Aid ──
  {
    chartId: "oda-gni-ratio",
    title: "ODA as % of GNI",
    editorial: "UN target: 0.70% — met 2013–2020, cut to 0.50% in 2021",
    staticData: "UK ODA fell from 0.70% to ~0.50% of GNI, further cuts to 0.30% planned by 2027",
  },
  {
    chartId: "oda-total-spending",
    title: "Total UK ODA Spending",
    editorial: "Bilateral vs multilateral split (billions GBP)",
    staticData: "~£15bn total, roughly 2/3 bilateral, 1/3 multilateral",
  },
  {
    chartId: "oda-by-department",
    title: "Spending by Department — 2024",
    editorial: "Which government departments spend ODA",
    staticData: "FCDO 67%, Home Office growing share due to refugee hosting costs",
  },

  // ── Public Finances ──
  {
    chartId: "gilt-yields",
    title: "UK Gilt Yields by Maturity",
    label: "Bond Market",
    editorial: "Yield curve across maturities",
    staticData: "2yr ~4.3%, 10yr ~4.5%, 30yr ~5.0%, inverted curve periods signalling stress",
  },
  {
    chartId: "tax-burden",
    title: "Tax Receipts as % of GDP — Heading for Post-War High",
    label: "Tax Burden",
    editorial: "Highest tax burden since WWII",
    staticData: "UK tax ~37% of GDP, heading toward post-war record, OECD average ~34%",
  },
  {
    chartId: "monthly-borrowing",
    title: "Monthly Public Sector Net Borrowing",
    label: "Borrowing",
    editorial: "Government borrowing month by month",
    staticData: "£120-140bn annual borrowing, monthly pattern shows seasonal variation",
  },
  {
    chartId: "income-tax-concentration",
    title: "Income Tax Concentration — Who Really Pays",
    label: "Who Pays",
    editorial: "Top 1% pay 29% of all income tax",
    staticData: "Top 1% pay 29%, top 10% pay 60%, bottom 50% pay ~10% of income tax",
  },
  {
    chartId: "debt-maturity",
    title: "Government Debt Maturity Profile",
    label: "Debt Structure",
    editorial: "When the government's debts come due",
    staticData: "Significant refinancing wall approaching, short-dated debt vulnerable to rate rises",
  },
  {
    chartId: "public-finances-flow",
    title: "Where the Money Comes From and Where It Goes",
    label: "Money Flow",
    editorial: "The full picture of UK public finances",
    staticData: "Receipts vs spending gap ~£120bn, health and welfare dominate spending side",
  },

  // ── Economy ──
  {
    chartId: "gdp-growth",
    title: "Real GDP Growth (Quarterly)",
    label: "GDP",
    editorial: "Quarter-on-quarter GDP growth",
    staticData: "GDP growth stagnant around 0-0.3% quarterly, weakest recovery since WWII",
  },
  {
    chartId: "m4-money-supply",
    title: "M4 Broad Money Supply",
    label: "Money Supply",
    editorial: "How much money is in the system",
    staticData: "M4 ~£3tn, post-QE expansion, YoY growth normalising after pandemic surge",
  },
  {
    chartId: "purchasing-power",
    title: "Purchasing Power of £1 Since 2000",
    label: "Your Money",
    editorial: "Your pound buys 40% less than in 2000",
    staticData: "£1 in 2000 worth ~£0.58 today, accelerated erosion since 2021",
  },
  {
    chartId: "mortgage-rates",
    title: "Average UK Mortgage Rates",
    label: "Mortgages",
    editorial: "What homeowners are actually paying",
    staticData: "2yr fixed ~5.5%, 5yr fixed ~5.0%, up from sub-2% in 2021",
  },
  {
    chartId: "consumer-credit",
    title: "Consumer Credit Outstanding",
    label: "Household Debt",
    editorial: "Britain's borrowing binge",
    staticData: "Consumer credit ~£230bn outstanding, net monthly lending ~£1.5bn",
  },
  {
    chartId: "savings-ratio",
    title: "Household Savings Ratio",
    label: "Savings",
    editorial: "How much households are saving",
    staticData: "Savings ratio ~10%, down from pandemic peak of ~25%, historically low",
  },

  // ── Civil Service ──
  {
    chartId: "civil-service-headcount",
    title: "Civil Service Headcount",
    label: "Headcount",
    editorial: "How many people work for government",
    staticData: "~500k+ civil servants, significant growth post-Brexit and post-pandemic",
  },
  {
    chartId: "civil-service-by-department",
    title: "Civil Servants by Department",
    label: "By Department",
    editorial: "Where government employees actually work",
    staticData: "HMRC, DWP, and MOD dominate headcount, large variation in department sizes",
  },
];

// ── Helper: build user message for Claude ──────────────────────────

export function buildUserMessage({ title, label, data, editorial }) {
  return [
    `Chart: ${title || "Untitled"}`,
    label ? `Section: ${label}` : "",
    editorial ? `Context: ${editorial}` : "",
    data ? `Data: ${data}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Helper: normalise a chartId from frontend payload ──────────────
// The frontend might not send a chartId (backward compat). In that case
// we try to match by title. Returns null if no match.

export function resolveChartId(payload) {
  if (payload.chartId) return payload.chartId;

  // Fuzzy title match — strip whitespace and case
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(payload.title);
  if (!target) return null;

  const match = CHART_REGISTRY.find(
    (c) => norm(c.title) === target
  );
  return match?.chartId || null;
}
