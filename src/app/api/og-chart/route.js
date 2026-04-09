import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * OG image generator for chart share cards.
 * URL: /api/og-chart?id=<base64url-encoded-payload>
 *
 * Payload: { type: "chart", h: headline, s: subline, t: title }
 * Renders a 1200x630 card matching the Gracchus share card style.
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
  if (!data || !data.h) {
    return new Response("Invalid id", {
      status: 400
    });
  }

  const headline = truncate(data.h, 80);
  const subline = truncate(
    data.s || "", 100
  ).toUpperCase();
  const title = truncate(data.t || "", 60);

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
          position: "relative"
        }}
      >
        {/* Top red stripe */}
        <div
          style={{
            width: "100%",
            height: "4px",
            backgroundColor: "#ef4444",
            flexShrink: 0
          }}
        />

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
              marginBottom: "24px"
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

          {/* Headline */}
          <div
            style={{
              fontSize: "52px",
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-2px",
              lineHeight: 1.1,
              marginBottom: "16px",
              maxWidth: "1000px"
            }}
          >
            {headline}
          </div>

          {/* Subline */}
          {subline && (
            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#ef4444",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
                marginBottom: "16px"
              }}
            >
              {subline}
            </div>
          )}

          {/* Chart title */}
          {title && (
            <div
              style={{
                fontSize: "16px",
                fontWeight: 500,
                color: "#6b7280",
                marginBottom: "24px"
              }}
            >
              {title}
            </div>
          )}

          {/* Decorative chart area hint */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: "20px",
              opacity: 0.15
            }}
          >
            <svg
              width="1056"
              height="120"
              viewBox="0 0 1056 120"
            >
              <path
                d="M 0 100 Q 100 90 200 80 T 400 50 T 600 40 T 800 20 T 1056 10"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
              />
              <path
                d="M 0 100 Q 100 90 200 80 T 400 50 T 600 40 T 800 20 T 1056 10 L 1056 120 L 0 120 Z"
                fill="#ef4444"
                opacity="0.3"
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
            padding: "0 72px 28px 72px"
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 400,
              color: "#374151"
            }}
          >
            Source-backed estimates
            {" \u00B7 "}Published UK data
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#6b7280",
              letterSpacing: "1px",
              textTransform: "uppercase"
            }}
          >
            GRACCHUS.AI
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
