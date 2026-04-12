import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * OG image generator for waste/equivalence share cards.
 * URL: /api/og?id=<base64url-encoded-payload>
 *
 * Decodes the share ID (same format as /share/[id])
 * and renders a 1200x630 editorial card image.
 */

// ---- Equivalent spend items (subset for server) ----
const EQUIV_ITEMS = {
  nurses: {
    unitCost: 35000,
    unitLabel: "nurses for a year"
  },
  gps: {
    unitCost: 100000,
    unitLabel: "GPs for a year"
  },
  paramedics: {
    unitCost: 38000,
    unitLabel: "paramedics for a year"
  },
  "gp-appointments": {
    unitCost: 42,
    unitLabel: "GP appointments"
  },
  ambulances: {
    unitCost: 250000,
    unitLabel: "new ambulances"
  },
  "mri-scans": {
    unitCost: 200,
    unitLabel: "MRI scans"
  },
  "cancer-treatments": {
    unitCost: 30000,
    unitLabel: "cancer treatment courses"
  },
  "nhs-operations": {
    unitCost: 7000,
    unitLabel: "NHS operations"
  },
  "cancer-research": {
    unitCost: 150000,
    unitLabel: "cancer research grants"
  },
  "mental-health": {
    unitCost: 40000,
    unitLabel: "mental health workers for a year"
  },
  midwives: {
    unitCost: 36000,
    unitLabel: "midwives for a year"
  },
  potholes: {
    unitCost: 100,
    unitLabel: "pothole repairs"
  },
  "council-homes": {
    unitCost: 200000,
    unitLabel: "new council homes"
  },
  "ev-chargers": {
    unitCost: 40000,
    unitLabel: "public EV charging points"
  },
  "childcare-hours": {
    unitCost: 6,
    unitLabel: "funded childcare hours"
  },
  "school-meals": {
    unitCost: 2.53,
    unitLabel: "free school meals"
  },
  tuition: {
    unitCost: 9250,
    unitLabel: "years of university tuition"
  },
  "full-degrees": {
    unitCost: 27750,
    unitLabel: "full university degrees"
  },
  teachers: {
    unitCost: 38000,
    unitLabel: "teachers for a year"
  },
  "classroom-upgrades": {
    unitCost: 150000,
    unitLabel: "classroom refurbishments"
  },
  scholarships: {
    unitCost: 12000,
    unitLabel: "student scholarships"
  },
  apprenticeships: {
    unitCost: 7000,
    unitLabel: "funded apprenticeships"
  }
};

function decodeId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = atob(b64);
    const payload = JSON.parse(json);
    if (
      !payload.n || !payload.a ||
      !payload.i || payload.i.length < 1
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function fmtEquivNum(n) {
  if (n >= 1000000000) {
    const b = n / 1000000000;
    return b >= 10
      ? Math.round(b) + " billion"
      : (Math.round(b * 10) / 10) + " billion";
  }
  if (n >= 1000000) {
    const m = n / 1000000;
    return m >= 10
      ? Math.round(m) + " million"
      : (Math.round(m * 10) / 10) + " million";
  }
  if (n >= 10000) {
    const r = Math.round(n / 100) * 100;
    return r.toLocaleString("en-GB");
  }
  if (n >= 1000) {
    const r = Math.round(n / 50) * 50;
    return r.toLocaleString("en-GB");
  }
  return Math.round(n).toLocaleString("en-GB");
}

function fmtAmt(m) {
  if (m >= 1000) {
    return "\u00A3" + (m / 1000).toFixed(1) + "bn";
  }
  return "\u00A3" + m.toLocaleString("en-GB") + "m";
}

function buildContext(data) {
  const parts = [];
  if (data.d && data.d !== "All departments") {
    parts.push(data.d);
  }
  if (data.t === "cancelled") {
    parts.push("Cancelled");
  } else if (data.t === "wasted") {
    parts.push("Wasted spend");
  }
  return parts.join(" \u00B7 ");
}

function resolveItems(amountM, itemIds) {
  const amount = amountM * 1000000;
  return itemIds
    .map((id) => {
      const item = EQUIV_ITEMS[id];
      if (!item) return null;
      return {
        count: amount / item.unitCost,
        unitLabel: item.unitLabel
      };
    })
    .filter(Boolean);
}

function truncate(str, maxLen) {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", {
      status: 400
    });
  }

  const data = decodeId(id);
  if (!data) {
    return new Response("Invalid id", {
      status: 400
    });
  }

  const resolved = resolveItems(
    data.a, data.i
  ).slice(0, 3);
  const amtStr = fmtAmt(data.a);
  const ctxLine = buildContext(data);
  const projectName = truncate(
    data.n || "", 60
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#030303",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Top red stripe */}
        <div
          style={{
            width: "100%",
            height: "5px",
            backgroundColor: "#ef4444",
            flexShrink: 0
          }}
        />

        {/* Background texture — faded WASTED watermark */}
        <div
          style={{
            position: "absolute",
            right: "-20px",
            bottom: "40px",
            fontSize: "200px",
            fontWeight: 900,
            color: "#ef4444",
            opacity: 0.03,
            lineHeight: 1,
            letterSpacing: "-6px"
          }}
        >
          WASTED
        </div>

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "44px 72px 0 72px",
            flex: 1
          }}
        >
          {/* Eyebrow with icon */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
              marginBottom: "24px"
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 100 100"
              style={{ flexShrink: 0 }}
            >
              <rect width="100" height="100" fill="#0a0a0a" />
              <path
                d="M 90 10 L 90 25 L 25 25 L 25 75 L 75 75 L 75 60 L 50 60 L 50 45 L 90 45 L 90 90 L 10 90 L 10 10 Z"
                fill="#f4f4f0"
              />
              <path
                d="M 5 95 L 95 5"
                stroke="#ff3333"
                strokeWidth="12"
              />
            </svg>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#4b5563",
                letterSpacing: "4px",
                textTransform: "uppercase"
              }}
            >
              GRACCHUS
            </div>
          </div>

          {/* Amount + WASTED block with accent bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              marginBottom: "14px"
            }}
          >
            {/* Red accent line */}
            <div
              style={{
                width: "4px",
                backgroundColor: "#ef4444",
                marginRight: "20px",
                borderRadius: "2px",
                flexShrink: 0
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div
                style={{
                  fontSize: "92px",
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-4px",
                  lineHeight: 1
                }}
              >
                {amtStr}
              </div>
              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 900,
                  color: "#ef4444",
                  letterSpacing: "-1px",
                  lineHeight: 1,
                  marginTop: "2px"
                }}
              >
                WASTED.
              </div>
            </div>
          </div>

          {/* Project name */}
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#d1d5db",
              marginBottom: ctxLine ? "4px" : "20px"
            }}
          >
            {projectName}
          </div>

          {/* Context line */}
          {ctxLine && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#4b5563",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginBottom: "20px"
              }}
            >
              {ctxLine}
            </div>
          )}

          {/* Equivalent to label */}
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#4b5563",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "16px"
            }}
          >
            EQUIVALENT TO:
          </div>

          {/* Equivalents */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {resolved.map((r, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: "14px"
                }}
              >
                <span
                  style={{
                    fontSize: "36px",
                    fontWeight: 900,
                    color: "#ffffff",
                    letterSpacing: "-1px",
                    lineHeight: 1
                  }}
                >
                  {fmtEquivNum(r.count)}
                </span>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 400,
                    color: "#6b7280",
                    lineHeight: 1
                  }}
                >
                  {r.unitLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 72px 24px 72px"
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#4b5563"
            }}
          >
            See the full audit at gracchus.ai
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "16px"
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 400,
                color: "#374151"
              }}
            >
              Source-backed {"\u00B7"} Published UK data
            </div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#6b7280",
                letterSpacing: "1.5px",
                textTransform: "uppercase"
              }}
            >
              GRACCHUS.AI
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
