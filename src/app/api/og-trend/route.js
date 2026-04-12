import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * OG image generator for trend share cards.
 * URL: /api/og-trend?id=<base64url-encoded-payload>
 *
 * Payload: { type: "trend", t: "approval" | "delays" }
 * Renders a 1200x630 card with the trend headline.
 */

function decodeId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const TREND_DATA = {
  approval: {
    headline: "Planning approval now takes 3x longer",
    subline: "Average time to approve major projects has tripled since 2010",
    accent: "#f59e0b",
    label: "Planning Approvals"
  },
  delays: {
    headline: "Projects delivered later and further over budget",
    subline: "Average delays and cost overruns have worsened every decade",
    accent: "#ef4444",
    label: "Delivery Delays"
  }
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing id", {
      status: 400
    });
  }

  const data = decodeId(id);
  if (!data || !data.t) {
    return new Response("Invalid id", {
      status: 400
    });
  }

  const trend = TREND_DATA[data.t] || TREND_DATA.delays;

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
        {/* Top accent stripe */}
        <div
          style={{
            width: "100%",
            height: "5px",
            backgroundColor: trend.accent,
            flexShrink: 0
          }}
        />

        {/* Background texture */}
        <div
          style={{
            position: "absolute",
            right: "-30px",
            bottom: "20px",
            fontSize: "280px",
            fontWeight: 900,
            color: trend.accent,
            opacity: 0.03,
            lineHeight: 1,
            letterSpacing: "-8px"
          }}
        >
          UK
        </div>

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "48px 72px 0 72px",
            flex: 1
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
              marginBottom: "32px"
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 100 100"
              style={{ flexShrink: 0 }}
            >
              <rect
                width="100" height="100"
                fill="#0a0a0a"
              />
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

          {/* Label */}
          <div
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "#6b7280",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "16px"
            }}
          >
            UK Infrastructure {"\u00B7"} {trend.label}
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              marginBottom: "20px"
            }}
          >
            <div
              style={{
                width: "4px",
                backgroundColor: trend.accent,
                marginRight: "20px",
                borderRadius: "2px",
                flexShrink: 0
              }}
            />
            <div
              style={{
                fontSize: "56px",
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-2px",
                lineHeight: 1.08,
                maxWidth: "950px"
              }}
            >
              {trend.headline}
            </div>
          </div>

          {/* Subline */}
          <div
            style={{
              fontSize: "22px",
              fontWeight: 500,
              color: "#9ca3af",
              lineHeight: 1.3,
              marginBottom: "24px",
              paddingLeft: "24px"
            }}
          >
            {trend.subline}
          </div>

          {/* Decorative trend line */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: "16px",
              opacity: 0.2
            }}
          >
            <svg
              width="1056"
              height="100"
              viewBox="0 0 1056 100"
            >
              <path
                d={data.t === "approval"
                  ? "M 0 90 Q 150 85 300 70 T 600 40 T 900 15 T 1056 5"
                  : "M 0 80 Q 100 75 200 65 T 400 50 T 600 30 T 800 12 T 1056 5"
                }
                fill="none"
                stroke={trend.accent}
                strokeWidth="2.5"
              />
              <path
                d={data.t === "approval"
                  ? "M 0 90 Q 150 85 300 70 T 600 40 T 900 15 T 1056 5 L 1056 100 L 0 100 Z"
                  : "M 0 80 Q 100 75 200 65 T 400 50 T 600 30 T 800 12 T 1056 5 L 1056 100 L 0 100 Z"
                }
                fill={trend.accent}
                opacity="0.25"
              />
            </svg>
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
            Explore the data at gracchus.ai
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
