/**
 * Share card utilities — encoding, decoding, and
 * lookup data for the /share/[id] route.
 *
 * The share ID is a base64url-encoded JSON payload:
 * { n: projectName, a: amountM, d: dept,
 *   t: type, i: [itemId1, itemId2, itemId3] }
 *
 * Deterministic: same inputs always produce the
 * same card.
 */

// ---- Equivalent spend items (shared with Dashboard)
export const EQUIV_SPEND_ITEMS = [
  {
    id: "nurses", name: "Nurses",
    category: "health",
    unitCost: 35000,
    unitLabel: "nurses for a year",
    notes: "NHS Band 5 starting salary"
  },
  {
    id: "gps", name: "GPs",
    category: "health",
    unitCost: 100000,
    unitLabel: "GPs for a year",
    notes: "Salaried GP average"
  },
  {
    id: "paramedics", name: "Paramedics",
    category: "health",
    unitCost: 38000,
    unitLabel: "paramedics for a year",
    notes: "NHS Band 6 typical"
  },
  {
    id: "gp-appointments",
    name: "GP Appointments",
    category: "health",
    unitCost: 42,
    unitLabel: "GP appointments",
    notes: "Average cost per consultation"
  },
  {
    id: "ambulances", name: "Ambulances",
    category: "health",
    unitCost: 250000,
    unitLabel: "new ambulances",
    notes: "Fully equipped emergency ambulance"
  },
  {
    id: "mri-scans", name: "MRI Scans",
    category: "health",
    unitCost: 200,
    unitLabel: "MRI scans",
    notes: "NHS reference cost"
  },
  {
    id: "cancer-treatments",
    name: "Cancer Treatments",
    category: "health",
    unitCost: 30000,
    unitLabel: "cancer treatment courses",
    notes: "Average per-patient treatment"
  },
  {
    id: "nhs-operations",
    name: "NHS Operations",
    category: "health",
    unitCost: 7000,
    unitLabel: "NHS operations",
    notes: "Average elective procedure"
  },
  {
    id: "cancer-research",
    name: "Cancer Research Grants",
    category: "health",
    unitCost: 150000,
    unitLabel: "cancer research grants",
    notes: "Typical CRUK project grant"
  },
  {
    id: "mental-health",
    name: "Mental Health Workers",
    category: "health",
    unitCost: 40000,
    unitLabel: "mental health workers for a year",
    notes: "NHS Band 6 mental health nurse"
  },
  {
    id: "midwives", name: "Midwives",
    category: "health",
    unitCost: 36000,
    unitLabel: "midwives for a year",
    notes: "NHS Band 5/6 midwifery"
  },
  {
    id: "potholes", name: "Pothole Repairs",
    category: "infrastructure",
    unitCost: 100,
    unitLabel: "pothole repairs",
    notes: "Average council pothole fix"
  },
  {
    id: "council-homes",
    name: "Council Homes",
    category: "infrastructure",
    unitCost: 200000,
    unitLabel: "new council homes",
    notes: "Average social housing build cost"
  },
  {
    id: "ev-chargers",
    name: "EV Charging Points",
    category: "infrastructure",
    unitCost: 40000,
    unitLabel: "public EV charging points",
    notes: "Rapid charger install cost"
  },
  {
    id: "childcare-hours",
    name: "Childcare Hours",
    category: "education",
    unitCost: 6,
    unitLabel: "funded childcare hours",
    notes: "Government early years rate/hr"
  },
  {
    id: "school-meals",
    name: "School Meals",
    category: "education",
    unitCost: 2.53,
    unitLabel: "free school meals",
    notes: "UIFSM funding rate per meal"
  },
  {
    id: "tuition",
    name: "Tuition Fees",
    category: "education",
    unitCost: 9250,
    unitLabel: "years of university tuition",
    notes: "Annual undergraduate fee cap"
  },
  {
    id: "full-degrees",
    name: "Full Degrees",
    category: "education",
    unitCost: 27750,
    unitLabel: "full university degrees",
    notes: "Three years at 9,250/yr"
  },
  {
    id: "teachers", name: "Teachers",
    category: "education",
    unitCost: 38000,
    unitLabel: "teachers for a year",
    notes: "Average teacher salary England"
  },
  {
    id: "classroom-upgrades",
    name: "Classroom Upgrades",
    category: "education",
    unitCost: 150000,
    unitLabel: "classroom refurbishments",
    notes: "School building improvement"
  },
  {
    id: "scholarships",
    name: "Scholarships",
    category: "education",
    unitCost: 12000,
    unitLabel: "student scholarships",
    notes: "Annual maintenance + fee support"
  },
  {
    id: "apprenticeships",
    name: "Apprenticeships",
    category: "education",
    unitCost: 7000,
    unitLabel: "funded apprenticeships",
    notes: "Average apprenticeship levy cost"
  }
];

// Lookup map for fast item resolution
const ITEM_MAP = Object.fromEntries(
  EQUIV_SPEND_ITEMS.map((it) => [it.id, it])
);

// ---- Encoding / decoding ----

/**
 * Encode a share payload into a URL-safe ID.
 * @param {object} payload
 *   n: project name, a: amountM, d: department,
 *   t: type (cancelled|wasted|total),
 *   i: [itemId1, itemId2, itemId3]
 * @returns {string} base64url-encoded ID
 */
export function encodeShareId(payload) {
  const json = JSON.stringify(payload);
  if (typeof window !== "undefined") {
    // Encode via UTF-8 percent-encoding first to handle non-Latin1 chars (e.g. em dashes)
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a share ID back to a payload.
 * @param {string} id base64url-encoded
 * @returns {object|null} decoded payload or null
 */
export function decodeShareId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    let json;
    if (typeof window !== "undefined") {
      // Decode UTF-8 percent-encoding to handle non-Latin1 chars
      json = decodeURIComponent(escape(atob(b64)));
    } else {
      json = Buffer.from(b64, "base64")
        .toString("utf8");
    }
    const payload = JSON.parse(json);
    // Chart share payloads use different fields (t, h, s) — only validate project payloads
    if (payload.type !== "chart" && (!payload.n || !payload.a
      || !payload.i || payload.i.length < 1)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Resolve item IDs to full spend equivalents.
 * @param {number} amountM - amount in millions
 * @param {string[]} itemIds - item IDs
 * @returns {Array} resolved items with counts
 */
export function resolveItems(amountM, itemIds) {
  const amount = amountM * 1000000;
  return itemIds
    .map((id) => ITEM_MAP[id])
    .filter(Boolean)
    .map((item) => ({
      item,
      count: amount / item.unitCost
    }));
}

/**
 * Format large numbers for display.
 * Matches fmtEquivNum in Dashboard.jsx.
 */
export function fmtEquivNum(n) {
  if (n >= 1000000000) {
    const b = n / 1000000000;
    return b >= 10
      ? Math.round(b) + " billion"
      : (Math.round(b * 10) / 10)
        + " billion";
  }
  if (n >= 1000000) {
    const m = n / 1000000;
    return m >= 10
      ? Math.round(m) + " million"
      : (Math.round(m * 10) / 10)
        + " million";
  }
  if (n >= 10000) {
    const r = Math.round(n / 100) * 100;
    return r.toLocaleString("en-GB");
  }
  if (n >= 1000) {
    const r = Math.round(n / 50) * 50;
    return r.toLocaleString("en-GB");
  }
  return Math.round(n)
    .toLocaleString("en-GB");
}

/**
 * Format amount in millions to display string.
 */
export function fmtAmt(m) {
  if (m >= 1000) {
    return "£" + (m / 1000).toFixed(1) + "bn";
  }
  return "£" + m.toLocaleString("en-GB") + "m";
}

/**
 * Build a context line from project data.
 * e.g. "Department for Transport · Cancelled"
 */
export function buildContextLine(data) {
  const parts = [];
  if (data.d && data.d !== "All departments") {
    parts.push(data.d);
  }
  if (data.t === "total") {
    parts.push("All departments");
  } else if (data.t === "cancelled") {
    parts.push("Cancelled");
  } else if (data.t === "wasted") {
    parts.push("Wasted spend");
  }
  return parts.join(" \u00B7 ");
}

// ---- Card style (single editorial) ----

// ---- Canvas helpers ----
function makeCanvas(W, H) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}
const SANS = "system-ui, -apple-system, " +
  "sans-serif";
const MONO = "ui-monospace, " +
  "'SF Mono', monospace";

function drawBg(ctx, W, H) {
  ctx.fillStyle = "#030303";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(
    W * 0.3, H * 0.3, H * 0.15,
    W * 0.5, H * 0.5, W * 0.9
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawTopStripe(ctx, W) {
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(0, 0, W, 4);
}

function drawIcon(ctx, x, y, size) {
  const s = size / 100;
  // Black background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x, y, size, size);
  // White G-shape
  ctx.fillStyle = "#f4f4f0";
  ctx.beginPath();
  ctx.moveTo(x + 90 * s, y + 10 * s);
  ctx.lineTo(x + 90 * s, y + 25 * s);
  ctx.lineTo(x + 25 * s, y + 25 * s);
  ctx.lineTo(x + 25 * s, y + 75 * s);
  ctx.lineTo(x + 75 * s, y + 75 * s);
  ctx.lineTo(x + 75 * s, y + 60 * s);
  ctx.lineTo(x + 50 * s, y + 60 * s);
  ctx.lineTo(x + 50 * s, y + 45 * s);
  ctx.lineTo(x + 90 * s, y + 45 * s);
  ctx.lineTo(x + 90 * s, y + 90 * s);
  ctx.lineTo(x + 10 * s, y + 90 * s);
  ctx.lineTo(x + 10 * s, y + 10 * s);
  ctx.closePath();
  ctx.fill();
  // Red diagonal slash
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = 12 * s;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x + 5 * s, y + 95 * s);
  ctx.lineTo(x + 95 * s, y + 5 * s);
  ctx.stroke();
}

function drawFooter(ctx, W, H, px) {
  const fy = H - 40;
  ctx.fillStyle = "#374151";
  ctx.font = "400 11px " + MONO;
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  ctx.fillText(
    "Source-backed estimates " +
    "\u00B7 Published UK data",
    px, fy + 4
  );
  ctx.fillStyle = "#6b7280";
  ctx.font = "700 11px " + MONO;
  ctx.letterSpacing = "1px";
  ctx.textAlign = "right";
  ctx.fillText(
    "GRACCHUS.AI", W - px, fy + 4
  );
  ctx.textAlign = "left";
}

function truncText(ctx, str, maxW) {
  let s = str;
  while (ctx.measureText(s).width > maxW
    && s.length > 10) {
    s = s.slice(0, -4) + "\u2026";
  }
  return s;
}

// ========================================
// EDITORIAL CARD RENDERER
// ========================================
// Left-aligned, high-impact editorial card.
// Faint left accent line, stacked headline,
// tight hierarchy, no decorative dividers.
function renderCard(data, resolved, W, H) {
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawBg(ctx, W, H);
  drawTopStripe(ctx, W);

  const px = 72;
  let y = 56;

  // Icon + Eyebrow
  drawIcon(ctx, px, y - 14, 18);
  ctx.fillStyle = "#4b5563";
  ctx.font = "600 12px " + MONO;
  ctx.letterSpacing = "4px";
  ctx.fillText(
    "GRACCHUS", px + 28, y
  );

  // Faint left accent line (subtle glow)
  y += 24;
  const accentH = 120;
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(px, y, 3, accentH);
  // Subtle glow behind accent line
  const glow = ctx.createLinearGradient(
    px, y, px + 60, y
  );
  glow.addColorStop(
    0, "rgba(239,68,68,0.08)"
  );
  glow.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(px, y, 60, accentH);

  // Line 1: amount — massive
  const amtStr = fmtAmt(data.a);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 92px " + SANS;
  ctx.letterSpacing = "-4px";
  ctx.fillText(amtStr, px + 20, y + 72);

  // Line 2: "WASTED." — tight below
  ctx.fillStyle = "#ef4444";
  ctx.font = "900 52px " + SANS;
  ctx.letterSpacing = "-1px";
  ctx.fillText("WASTED.", px + 20, y + 118);
  y += accentH + 16;

  // Project name — concise
  const nameStr = data.n || "";
  ctx.fillStyle = "#d1d5db";
  ctx.font = "700 20px " + SANS;
  ctx.letterSpacing = "0px";
  const dn = truncText(
    ctx, nameStr, W - px * 2 - 20
  );
  ctx.fillText(dn, px, y);

  // Department / context — tight
  const contextDept = buildContextLine(data);
  if (contextDept) {
    y += 20;
    ctx.fillStyle = "#4b5563";
    ctx.font = "500 12px " + MONO;
    ctx.letterSpacing = "1.5px";
    ctx.fillText(
      contextDept.toUpperCase(), px, y
    );
  }

  // Section label — no divider, just space
  y += 32;
  ctx.fillStyle = "#4b5563";
  ctx.font = "600 11px " + MONO;
  ctx.letterSpacing = "3px";
  ctx.fillText("EQUIVALENT TO:", px, y);
  y += 28;

  // Equivalents — tight vertical list
  resolved.forEach((r, idx) => {
    const numStr = fmtEquivNum(r.count);
    const label = r.item.unitLabel;

    // Number — high contrast
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 36px " + SANS;
    ctx.letterSpacing = "-1px";
    ctx.fillText(numStr, px, y + 16);

    // Label — reduced weight
    const numW = ctx.measureText(numStr).width;
    ctx.fillStyle = "#6b7280";
    ctx.font = "400 17px " + SANS;
    ctx.letterSpacing = "0px";
    ctx.fillText(
      label, px + numW + 14, y + 16
    );

    y += idx < 2 ? 42 : 0;
  });

  drawFooter(ctx, W, H, px);
  return canvas.toDataURL("image/png");
}

// ========================================
// PUBLIC API
// ========================================

/**
 * Render a share card to Canvas PNG.
 * @param {object} data - decoded payload
 * @param {Array} resolved - resolveItems()
 * @param {object} opts - { width, height }
 * @returns {string} PNG data URL
 */
export function renderCardToCanvas(
  data, resolved, opts = {}
) {
  const W = opts.width || 1200;
  const H = opts.height || 630;
  return renderCard(data, resolved, W, H);
}

/**
 * Render a trend share card (approval or delay).
 * type: "approval" | "delay"
 * timeline: array of data points
 * Returns PNG data URL.
 */
export function renderTrendCard(type, timeline) {
  const W = 1200;
  const H = 630;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawBg(ctx, W, H);

  // Accent stripe — amber for approvals, red for delays
  const accentColor = type === "approval"
    ? "#f59e0b" : "#ef4444";
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, W, 4);

  const px = 72;
  let y = 56;

  // Icon + Eyebrow
  drawIcon(ctx, px, y - 14, 18);
  ctx.fillStyle = "#4b5563";
  ctx.font = "600 12px " + MONO;
  ctx.letterSpacing = "4px";
  ctx.fillText(
    "GRACCHUS", px + 28, y
  );

  y += 32;

  if (type === "approval") {
    // Approval card
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const multiple = (
      last.avgMonths / first.avgMonths
    ).toFixed(1);

    // Left accent
    ctx.fillStyle = accentColor;
    ctx.fillRect(px, y, 3, 140);
    const glow = ctx.createLinearGradient(
      px, y, px + 80, y
    );
    glow.addColorStop(
      0, "rgba(245,158,11,0.08)"
    );
    glow.addColorStop(
      1, "rgba(245,158,11,0)"
    );
    ctx.fillStyle = glow;
    ctx.fillRect(px, y, 80, 140);

    // Headline number
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 96px " + SANS;
    ctx.letterSpacing = "-5px";
    ctx.fillText(
      multiple + "\u00D7", px + 20, y + 80
    );

    // "SLOWER." under the number
    ctx.fillStyle = accentColor;
    ctx.font = "900 52px " + SANS;
    ctx.letterSpacing = "-1px";
    ctx.fillText("SLOWER.", px + 20, y + 130);
    y += 160;

    // Subheadline
    ctx.fillStyle = "#d1d5db";
    ctx.font = "700 22px " + SANS;
    ctx.letterSpacing = "0px";
    ctx.fillText(
      "UK infrastructure approvals now take " +
      multiple + "\u00D7 longer than " +
      first.year + ".",
      px, y
    );
    y += 34;

    // Data line 1
    ctx.fillStyle = "#9ca3af";
    ctx.font = "500 17px " + SANS;
    ctx.fillText(
      first.year + ":  " + first.avgMonths +
      " months average to approve a major project",
      px, y
    );
    y += 28;

    // Data line 2
    ctx.fillStyle = "#9ca3af";
    ctx.font = "500 17px " + SANS;
    ctx.fillText(
      last.year + ":  " + last.avgMonths +
      " months \u2014 nearly " +
      Math.round(last.avgMonths / 12) +
      " years of waiting",
      px, y
    );
    y += 40;

    // Mini chart area
    const chartX = px;
    const chartY = y;
    const chartW = W - px * 2;
    const chartH = 100;
    const maxVal = Math.max(
      ...timeline.map(d => d.avgMonths)
    );

    // Chart background
    ctx.fillStyle = "rgba(245,158,11,0.04)";
    ctx.fillRect(
      chartX, chartY, chartW, chartH
    );
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      chartX, chartY, chartW, chartH
    );

    // Draw area
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartH);
    timeline.forEach((d, i) => {
      const x = chartX +
        (i / (timeline.length - 1)) * chartW;
      const yp = chartY + chartH -
        (d.avgMonths / (maxVal * 1.15)) *
        chartH;
      if (i === 0) ctx.lineTo(x, yp);
      else ctx.lineTo(x, yp);
    });
    ctx.lineTo(
      chartX + chartW, chartY + chartH
    );
    ctx.closePath();
    ctx.fillStyle = "rgba(245,158,11,0.12)";
    ctx.fill();

    // Draw line
    ctx.beginPath();
    timeline.forEach((d, i) => {
      const x = chartX +
        (i / (timeline.length - 1)) * chartW;
      const yp = chartY + chartH -
        (d.avgMonths / (maxVal * 1.15)) *
        chartH;
      if (i === 0) ctx.moveTo(x, yp);
      else ctx.lineTo(x, yp);
    });
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Dots at start and end
    [0, timeline.length - 1].forEach(i => {
      const d = timeline[i];
      const x = chartX +
        (i / (timeline.length - 1)) * chartW;
      const yp = chartY + chartH -
        (d.avgMonths / (maxVal * 1.15)) *
        chartH;
      ctx.beginPath();
      ctx.arc(x, yp, 5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      // Label
      ctx.fillStyle = "#9ca3af";
      ctx.font = "600 11px " + MONO;
      ctx.letterSpacing = "0px";
      ctx.textAlign = i === 0 ? "left" : "right";
      ctx.fillText(
        d.year + ": " + d.avgMonths + "mo",
        i === 0 ? x + 10 : x - 10,
        yp - 10
      );
    });
    ctx.textAlign = "left";

    // Kicker
    y = chartY + chartH + 24;
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 13px " + SANS;
    ctx.letterSpacing = "0px";
    ctx.fillText(
      "Average DCO approval duration, by year " +
      "of decision. Source: PINS.",
      px, y
    );

  } else {
    // Delay card
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const delayMultiple = (
      last.avgDelayYears / first.avgDelayYears
    ).toFixed(0);
    const costMultiple = (
      last.avgCostGrowthPct /
      first.avgCostGrowthPct
    ).toFixed(0);

    // Left accent
    ctx.fillStyle = accentColor;
    ctx.fillRect(px, y, 3, 140);
    const glow = ctx.createLinearGradient(
      px, y, px + 80, y
    );
    glow.addColorStop(
      0, "rgba(239,68,68,0.08)"
    );
    glow.addColorStop(
      1, "rgba(239,68,68,0)"
    );
    ctx.fillStyle = glow;
    ctx.fillRect(px, y, 80, 140);

    // Headline
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 84px " + SANS;
    ctx.letterSpacing = "-4px";
    ctx.fillText(
      delayMultiple + "\u00D7 LATER.",
      px + 20, y + 72
    );

    ctx.fillStyle = accentColor;
    ctx.font = "900 52px " + SANS;
    ctx.letterSpacing = "-1px";
    ctx.fillText(
      costMultiple + "\u00D7 OVER BUDGET.",
      px + 20, y + 128
    );
    y += 160;

    // Subheadline
    ctx.fillStyle = "#d1d5db";
    ctx.font = "700 22px " + SANS;
    ctx.letterSpacing = "0px";
    ctx.fillText(
      "UK government projects are getting " +
      "worse, not better.",
      px, y
    );
    y += 38;

    // Data comparisons
    ctx.fillStyle = "#9ca3af";
    ctx.font = "500 17px " + SANS;
    ctx.fillText(
      first.year + ":  Average project ran " +
      first.avgDelayYears +
      " years late, +" +
      first.avgCostGrowthPct + "% over budget",
      px, y
    );
    y += 28;
    ctx.fillText(
      last.year + ":  Average project runs " +
      last.avgDelayYears +
      " years late, +" +
      last.avgCostGrowthPct + "% over budget",
      px, y
    );
    y += 40;

    // Mini dual chart
    const chartX = px;
    const chartY = y;
    const chartW = W - px * 2;
    const chartH = 100;
    const maxDelay = Math.max(
      ...timeline.map(d => d.avgDelayYears)
    );
    const maxCost = Math.max(
      ...timeline.map(d => d.avgCostGrowthPct)
    );

    ctx.fillStyle = "rgba(239,68,68,0.04)";
    ctx.fillRect(
      chartX, chartY, chartW, chartH
    );
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      chartX, chartY, chartW, chartH
    );

    // Delay area fill
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartH);
    timeline.forEach((d, i) => {
      const x = chartX +
        (i / (timeline.length - 1)) * chartW;
      const yp = chartY + chartH -
        (d.avgDelayYears / (maxDelay * 1.15)) *
        chartH;
      ctx.lineTo(x, yp);
    });
    ctx.lineTo(
      chartX + chartW, chartY + chartH
    );
    ctx.closePath();
    ctx.fillStyle = "rgba(239,68,68,0.12)";
    ctx.fill();

    // Delay line
    ctx.beginPath();
    timeline.forEach((d, i) => {
      const x = chartX +
        (i / (timeline.length - 1)) * chartW;
      const yp = chartY + chartH -
        (d.avgDelayYears / (maxDelay * 1.15)) *
        chartH;
      if (i === 0) ctx.moveTo(x, yp);
      else ctx.lineTo(x, yp);
    });
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cost growth dashed line
    ctx.beginPath();
    ctx.setLineDash([8, 4]);
    timeline.forEach((d, i) => {
      const x = chartX +
        (i / (timeline.length - 1)) * chartW;
      const yp = chartY + chartH -
        (d.avgCostGrowthPct / (maxCost * 1.15))
        * chartH;
      if (i === 0) ctx.moveTo(x, yp);
      else ctx.lineTo(x, yp);
    });
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    y = chartY + chartH + 18;
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(px, y - 3, 14, 3);
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 11px " + MONO;
    ctx.letterSpacing = "0px";
    ctx.fillText(
      "Avg delay (years)", px + 20, y
    );

    ctx.fillStyle = "#f59e0b";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px + 170, y - 2);
    ctx.lineTo(px + 184, y - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#6b7280";
    ctx.fillText(
      "Cost growth %", px + 190, y
    );

    // Kicker
    y += 20;
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 13px " + SANS;
    ctx.fillText(
      "IPA-tracked major projects, biennial " +
      "sampling. Source: IPA / NAO.",
      px, y
    );
  }

  drawFooter(ctx, W, H, px);
  return canvas.toDataURL("image/png");
}

/**
 * Render a generic chart share card.
 * data: { headline, subline, title, accent,
 *         sparkline, context }
 * Returns PNG data URL.
 */
export function renderChartShareCard(data) {
  const W = 1200;
  const H = 630;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawBg(ctx, W, H);

  const accent = data.accent || "#ef4444";
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 4);

  const px = 72;
  let y = 48;

  // Icon + Eyebrow
  drawIcon(ctx, px, y - 14, 18);
  ctx.fillStyle = "#4b5563";
  ctx.font = "600 12px " + MONO;
  ctx.letterSpacing = "4px";
  ctx.fillText(
    "GRACCHUS", px + 28, y
  );
  y += 28;

  // Accent bar + glow
  var rgbR = parseInt(
    accent.slice(1, 3), 16
  );
  var rgbG = parseInt(
    accent.slice(3, 5), 16
  );
  var rgbB = parseInt(
    accent.slice(5, 7), 16
  );

  // Headline — large, bold
  const headline = data.headline || "";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 52px " + SANS;
  ctx.letterSpacing = "-2px";

  const hlWords = headline.split(" ");
  const maxW = W - px * 2 - 20;
  var hLine1 = "";
  var hLine2 = "";
  var onL2 = false;
  hlWords.forEach(function(w) {
    var test = onL2
      ? hLine2 + (hLine2 ? " " : "") + w
      : hLine1 + (hLine1 ? " " : "") + w;
    if (!onL2 &&
      ctx.measureText(test).width > maxW) {
      onL2 = true;
      hLine2 = w;
    } else if (onL2) {
      hLine2 += " " + w;
    } else {
      hLine1 = test;
    }
  });

  ctx.fillText(hLine1, px, y + 46);
  if (hLine2) {
    ctx.fillText(hLine2, px, y + 100);
  }
  y += hLine2 ? 142 : 88;

  // Subline
  if (data.subline) {
    ctx.fillStyle = accent;
    ctx.font = "900 28px " + SANS;
    ctx.letterSpacing = "-0.5px";
    ctx.fillText(
      data.subline.toUpperCase(), px, y
    );
    y += 38;
  } else {
    y += 12;
  }

  // Title label
  if (data.title) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 14px " + SANS;
    ctx.letterSpacing = "0px";
    ctx.fillText(data.title, px, y + 4);
    y += 18;
  }

  // ---- Large area chart ----
  // If a captured chart canvas was passed, draw it directly
  if (data.chartCanvas) {
    var chartX = px;
    var chartY = y + 14;
    var chartW = W - px * 2;
    var chartH = H - chartY - 64;
    if (chartH < 80) chartH = 80;
    // Maintain aspect ratio of captured chart
    var srcW = data.chartCanvas.width;
    var srcH = data.chartCanvas.height;
    var srcAspect = srcW / srcH;
    var dstAspect = chartW / chartH;
    var drawW = chartW;
    var drawH = chartH;
    if (srcAspect > dstAspect) {
      drawH = chartW / srcAspect;
    } else {
      drawW = chartH * srcAspect;
    }
    var drawX = chartX + (chartW - drawW) / 2;
    var drawY = chartY + (chartH - drawH) / 2;
    ctx.drawImage(data.chartCanvas, drawX, drawY, drawW, drawH);
  }
  var spark = data.sparkline;
  if (!data.chartCanvas && spark && spark.length > 1) {
    var chartX = px;
    var chartY = y + 14;
    var chartW = W - px * 2;
    var chartH = H - chartY - 64;
    if (chartH < 80) chartH = 80;

    var vals = spark.map(function(v) {
      return typeof v === "number" ? v : 0;
    });
    var mn = Math.min.apply(null, vals);
    var mx = Math.max.apply(null, vals);
    var range = mx - mn || 1;

    // Pad range slightly so line doesn't
    // touch edges
    var padFrac = 0.06;
    var padAmt = range * padFrac;
    mn = mn - padAmt;
    range = range + padAmt * 2;

    // Helper to get Y position
    function valY(v) {
      return chartY + chartH -
        ((v - mn) / range) * chartH;
    }

    // Faint grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (var gi = 0; gi <= 3; gi++) {
      var gy = chartY +
        (gi / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(chartX, gy);
      ctx.lineTo(chartX + chartW, gy);
      ctx.stroke();
    }

    // Area fill gradient
    ctx.beginPath();
    ctx.moveTo(chartX, valY(vals[0]));
    for (var si = 1; si < vals.length; si++) {
      ctx.lineTo(
        chartX +
          (si / (vals.length - 1)) * chartW,
        valY(vals[si])
      );
    }
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.lineTo(chartX, chartY + chartH);
    ctx.closePath();

    var aGrad = ctx.createLinearGradient(
      chartX, chartY, chartX, chartY + chartH
    );
    aGrad.addColorStop(
      0,
      "rgba(" + rgbR + "," + rgbG + "," +
      rgbB + ",0.25)"
    );
    aGrad.addColorStop(
      0.7,
      "rgba(" + rgbR + "," + rgbG + "," +
      rgbB + ",0.06)"
    );
    aGrad.addColorStop(
      1,
      "rgba(" + rgbR + "," + rgbG + "," +
      rgbB + ",0.01)"
    );
    ctx.fillStyle = aGrad;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    ctx.moveTo(chartX, valY(vals[0]));
    for (var li = 1; li < vals.length; li++) {
      ctx.lineTo(
        chartX +
          (li / (vals.length - 1)) * chartW,
        valY(vals[li])
      );
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Endpoint dots
    var dotR = 5;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(
      chartX, valY(vals[0]),
      dotR, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      chartX + chartW,
      valY(vals[vals.length - 1]),
      dotR, 0, Math.PI * 2
    );
    ctx.fill();

    // Endpoint value labels
    ctx.font = "600 13px " + MONO;
    ctx.letterSpacing = "0px";

    // Start label
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "left";
    ctx.fillText(
      formatSparkVal(vals[0]),
      chartX + 10,
      valY(vals[0]) - 10
    );

    // End label
    ctx.textAlign = "right";
    var endY = valY(vals[vals.length - 1]);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px " + MONO;
    ctx.fillText(
      formatSparkVal(vals[vals.length - 1]),
      chartX + chartW - 10,
      endY - 10
    );
    ctx.textAlign = "left";
  }

  drawFooter(ctx, W, H, px);
  return canvas.toDataURL("image/png");
}

function formatSparkVal(v) {
  if (Math.abs(v) >= 1000000000) {
    return (v / 1000000000).toFixed(1) + "B";
  }
  if (Math.abs(v) >= 1000000) {
    return (v / 1000000).toFixed(1) + "M";
  }
  if (Math.abs(v) >= 10000) {
    return (v / 1000).toFixed(0) + "k";
  }
  if (Math.abs(v) >= 1000) {
    return (v / 1000).toFixed(1) + "k";
  }
  if (v % 1 !== 0) {
    return v.toFixed(1);
  }
  return String(v);
}

// ========================================
// CANCELLED PROJECT — SOCIAL CARD
// ========================================
// Premium social-first shareable card.
// Bloomberg × FT × viral finance aesthetic.
// 1200×675 landscape (optimal for X/LinkedIn).
// True black background, no navy.
// Designed to stop the scroll.

// Generate an editorial hook line based on project data
function getEditorialHook(data) {
  var wastedM = data.wasted || 0;
  var name = data.name || "This project";
  var amtStr = wastedM >= 1000
    ? "\u00a3" + (wastedM / 1000).toFixed(0) + "bn"
    : "\u00a3" + wastedM.toLocaleString() + "m";
  var potholes = Math.round((wastedM * 1e6) / 100);
  var nurses = Math.round((wastedM * 1e6) / 35000);
  var overrun = data.overrun || 0;
  // Pick the most impactful hook
  if (wastedM >= 10000) {
    return amtStr + " of public money. Gone.";
  }
  if (overrun > 0 && overrun >= wastedM * 0.3) {
    var overStr = overrun >= 1000
      ? "\u00a3" + (overrun / 1000).toFixed(0) + "bn"
      : "\u00a3" + overrun + "m";
    return overStr + " over budget before they pulled the plug.";
  }
  if (nurses >= 100000) {
    return "That\u2019s " + nurses.toLocaleString() +
      " nurses for a year.";
  }
  if (potholes >= 10000000) {
    return "Enough to fix every pothole in Britain. Multiple times.";
  }
  return amtStr + " spent. Project cancelled. Nobody fired.";
}

// ========================================
// CANCELLED PROJECT — PREMIUM SOCIAL CARD
// ========================================
// Matches the chart share card design system:
// drawBg + red top stripe + icon/eyebrow +
// huge editorial headline + accent subline +
// data block + drawFooter.
// 1200×630 (same as chart cards).
export function renderCancelledProjectCard(data) {
  var W = 1200;
  var H = 580;
  var canvas = makeCanvas(W, H);
  var ctx = canvas.getContext("2d");

  // Premium background (same as chart cards)
  drawBg(ctx, W, H);

  // Red top stripe
  var accent = "#ef4444";
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 4);

  var px = 72;
  var y = 52;

  // Icon + GRACCHUS eyebrow
  drawIcon(ctx, px, y - 14, 20);
  ctx.fillStyle = "#4b5563";
  ctx.font = "600 13px " + MONO;
  ctx.letterSpacing = "4px";
  ctx.fillText("GRACCHUS", px + 30, y);
  y += 36;

  // === EDITORIAL HEADLINE ===
  var hookLine = getEditorialHook(data);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 58px " + SANS;
  ctx.letterSpacing = "-2px";

  var hlWords = hookLine.split(" ");
  var maxW = W - px * 2 - 20;
  var hLine1 = "";
  var hLine2 = "";
  var onL2 = false;
  hlWords.forEach(function(w) {
    var test = onL2
      ? hLine2 + (hLine2 ? " " : "") + w
      : hLine1 + (hLine1 ? " " : "") + w;
    if (!onL2 &&
      ctx.measureText(test).width > maxW) {
      onL2 = true;
      hLine2 = w;
    } else if (onL2) {
      hLine2 += " " + w;
    } else {
      hLine1 = test;
    }
  });

  ctx.fillText(hLine1, px, y + 50);
  if (hLine2) {
    ctx.fillText(hLine2, px, y + 112);
  }
  y += hLine2 ? 152 : 90;

  // === SUBLINE — project name + "CANCELLED" ===
  var subText = (data.name || "").toUpperCase() +
    " \u2014 CANCELLED";
  ctx.fillStyle = accent;
  ctx.font = "900 26px " + SANS;
  ctx.letterSpacing = "0.5px";
  subText = truncText(ctx, subText, W - px * 2);
  ctx.fillText(subText, px, y);
  y += 22;

  // Department
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 17px " + SANS;
  ctx.letterSpacing = "0px";
  ctx.fillText(data.department || "", px, y + 14);
  y += 46;

  // === DATA BLOCK ===
  ctx.fillStyle = "rgba(55,65,81,0.3)";
  ctx.fillRect(px, y, W - px * 2, 1);
  y += 36;

  // Main amount
  var wastedM = data.wasted || 0;
  var amtStr = wastedM >= 1000
    ? "\u00a3" + (wastedM / 1000).toFixed(0) + "bn"
    : "\u00a3" + wastedM.toLocaleString() + "m";

  // Label
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 14px " + MONO;
  ctx.letterSpacing = "3px";
  ctx.fillText("TOTAL SPEND", px, y);
  y += 12;

  // Big amount
  ctx.fillStyle = "#ef4444";
  ctx.font = "900 86px " + SANS;
  ctx.letterSpacing = "-3px";
  ctx.fillText(amtStr, px, y + 66);

  // Over budget on the right
  var overrun = data.overrun || 0;
  if (overrun > 0) {
    var overAmtStr = overrun >= 1000
      ? "+" + "\u00a3" +
        (overrun / 1000).toFixed(1) + "bn"
      : "+" + "\u00a3" +
        overrun.toLocaleString() + "m";
    ctx.textAlign = "right";
    ctx.fillStyle = "#6b7280";
    ctx.font = "600 14px " + MONO;
    ctx.letterSpacing = "3px";
    ctx.fillText("OVER BUDGET", W - px, y + 24);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 50px " + SANS;
    ctx.letterSpacing = "-1px";
    ctx.fillText(overAmtStr, W - px, y + 66);
    ctx.textAlign = "left";
  }
  y += 96;

  // === BOTTOM STATS ROW ===
  ctx.fillStyle = "rgba(55,65,81,0.3)";
  ctx.fillRect(px, y, W - px * 2, 1);
  y += 30;

  var colW = (W - px * 2) / 3;

  // Col 1: Original Budget
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 13px " + MONO;
  ctx.letterSpacing = "2px";
  ctx.fillText("ORIGINAL BUDGET", px, y);
  var origBudget = data.originalBudget || 0;
  var origStr = origBudget >= 1000
    ? "\u00a3" +
      (origBudget / 1000).toFixed(0) + "bn"
    : "\u00a3" +
      origBudget.toLocaleString() + "m";
  ctx.fillStyle = "#d1d5db";
  ctx.font = "700 32px " + SANS;
  ctx.letterSpacing = "0px";
  ctx.fillText(origStr, px, y + 38);

  // Col 2: Category
  var col2x = px + colW;
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 13px " + MONO;
  ctx.letterSpacing = "2px";
  ctx.fillText("CATEGORY", col2x, y);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "700 32px " + SANS;
  ctx.letterSpacing = "0px";
  ctx.fillText(
    data.category || "", col2x, y + 38
  );

  // Col 3: Pothole equivalent — label clarifies
  // the number is an equivalence, not literal repairs
  var col3x = px + colW * 2;
  var potholeUnit = 100;
  var potholesEquiv = Math.round(
    (wastedM * 1e6) / potholeUnit
  );
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 13px " + MONO;
  ctx.letterSpacing = "2px";
  ctx.fillText("COULD HAVE FIXED", col3x, y);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "700 32px " + SANS;
  ctx.letterSpacing = "0px";
  ctx.fillText(
    potholesEquiv.toLocaleString() + " potholes",
    col3x, y + 38
  );

  // Standard footer
  drawFooter(ctx, W, H, px);
  return canvas.toDataURL("image/png");
}

// ========================================
// SEWAGE FINES vs DIVIDENDS — SOCIAL CARD
// ========================================
// Visual comparison card showing the absurd
// ratio between fines and dividends.
// 1200×630, same design system.
export function renderSewageFinesCard() {
  var W = 1200;
  var H = 630;
  var canvas = makeCanvas(W, H);
  var ctx = canvas.getContext("2d");
  drawBg(ctx, W, H);

  // Red top stripe
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(0, 0, W, 4);

  var px = 72;
  var y = 48;

  // Icon + eyebrow
  drawIcon(ctx, px, y - 14, 18);
  ctx.fillStyle = "#4b5563";
  ctx.font = "600 12px " + MONO;
  ctx.letterSpacing = "4px";
  ctx.fillText("GRACCHUS", px + 28, y);
  y += 36;

  // Section label
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 13px " + SANS;
  ctx.letterSpacing = "2px";
  ctx.fillText("ACCOUNTABILITY \u203A SEWAGE", px, y);
  y += 38;

  // Headline
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 56px " + SANS;
  ctx.letterSpacing = "-2px";
  ctx.fillText("Fines vs Dividends", px, y);
  y += 24;

  // Subline
  ctx.fillStyle = "#ef4444";
  ctx.font = "800 22px " + SANS;
  ctx.letterSpacing = "-0.5px";
  ctx.fillText("WATER COMPANIES SINCE PRIVATISATION (1991)", px, y + 24);
  y += 68;

  // ---- Visual comparison ----
  var barY = y;
  var barAreaW = W - px * 2;
  var barH = 72;

  // £168M bar — proportional (168/78000 ≈ 0.2%)
  // But we need it visible, so give it minimum ~3% of width
  var finesFrac = 0.035;
  var finesW = Math.max(barAreaW * finesFrac, 60);
  var divW = barAreaW - finesW - 30;

  // Fines bar
  ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
  ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
  ctx.lineWidth = 2;
  roundRect(ctx, px, barY, finesW, barH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.font = "900 28px " + SANS;
  ctx.letterSpacing = "-1px";
  ctx.textAlign = "center";
  ctx.fillText("\u00a3168M", px + finesW / 2, barY + barH / 2 + 10);

  // Label
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 12px " + SANS;
  ctx.letterSpacing = "1px";
  ctx.fillText("FINES (2024)", px + finesW / 2, barY + barH + 20);
  ctx.textAlign = "left";

  // "vs" text
  ctx.fillStyle = "#4b5563";
  ctx.font = "700 20px " + SANS;
  ctx.letterSpacing = "0px";
  var vsX = px + finesW + 15;
  ctx.textAlign = "center";
  ctx.fillText("vs", vsX, barY + barH / 2 + 8);
  ctx.textAlign = "left";

  // Dividends bar
  var divX = px + finesW + 30;
  ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
  ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, divX, barY, divW, barH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#10b981";
  ctx.font = "900 36px " + SANS;
  ctx.letterSpacing = "-1px";
  ctx.textAlign = "center";
  ctx.fillText("\u00a378B", divX + divW / 2, barY + barH / 2 + 13);

  // Label
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 12px " + SANS;
  ctx.letterSpacing = "1px";
  ctx.fillText("DIVIDENDS SINCE 1991", divX + divW / 2, barY + barH + 20);
  ctx.textAlign = "left";

  y = barY + barH + 56;

  // ---- The punchline ----
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 48px " + SANS;
  ctx.letterSpacing = "-2px";
  ctx.fillText("Fines =", px, y);
  var finesEqW = ctx.measureText("Fines = ").width;
  ctx.fillStyle = "#ef4444";
  ctx.fillText("0.2%", px + finesEqW, y);
  var pctW = ctx.measureText("0.2% ").width;
  ctx.fillStyle = "#9ca3af";
  ctx.font = "500 28px " + SANS;
  ctx.letterSpacing = "0px";
  ctx.fillText("of dividends paid", px + finesEqW + pctW + 6, y - 2);
  y += 38;

  // Context line
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 18px " + SANS;
  ctx.letterSpacing = "0px";
  ctx.fillText("A 0.2% cost of doing business \u2014 not a deterrent", px, y);

  drawFooter(ctx, W, H, px);
  return canvas.toDataURL("image/png");
}

// Rounded rect helper for share cards
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
