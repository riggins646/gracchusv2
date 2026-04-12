import SharePageClient from "./SharePageClient";

/**
 * Server component wrapper for /share/[id].
 * Exports generateMetadata so OG tags are
 * rendered server-side for social crawlers.
 */

// ---- Minimal server-side decoder ----
function decodeId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = Buffer.from(b64, "base64")
      .toString("utf8");
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

function fmtAmt(m) {
  if (m >= 1000) {
    return "£" + (m / 1000).toFixed(1) + "bn";
  }
  return "£" + m.toLocaleString("en-GB") + "m";
}

// ---- Dynamic OG metadata ----
export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = decodeId(id);

  if (!data) {
    return {
      title: "Spending Audit | Gracchus",
      description:
        "Track UK government spending waste."
    };
  }

  const amt = fmtAmt(data.a);
  const title = amt + " wasted \u2014 "
    + (data.n || "UK Government");
  const desc = (data.n
    ? amt + " of taxpayer money wasted on "
      + data.n + ". See what it could have "
      + "paid for instead."
    : amt + " of taxpayer money wasted. "
      + "See what it could have paid for.")
    + " | via @GracchusHQ";

  const ogImageUrl = "/api/og?id="
    + encodeURIComponent(id);

  return {
    title: title + " | Gracchus",
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImageUrl]
    }
  };
}

// ---- Page render ----
export default async function SharePage({ params }) {
  const { id } = await params;
  return <SharePageClient id={id} />;
}
