import TrendShareClient from "./TrendShareClient";

/**
 * Server component for /share/trend/[id].
 * Generates OG tags for social previews, then
 * renders a landing page with explainer content.
 */

function decodeId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = Buffer.from(b64, "base64")
      .toString("utf8");
    const payload = JSON.parse(json);
    if (!payload.t) return null;
    return payload;
  } catch {
    return null;
  }
}

const TREND_META = {
  approval: {
    title: "Planning approval now takes 3x longer",
    desc: "Average time to approve major UK projects has tripled since 2010. See the full trend data. | via @GracchusHQ",
    view: "projects.planning"
  },
  delays: {
    title: "UK projects: later and further over budget every decade",
    desc: "Average delays and cost overruns have worsened across every era of UK infrastructure. See the data. | via @GracchusHQ",
    view: "projects.delays"
  }
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = decodeId(id);

  if (!data || !TREND_META[data.t]) {
    return {
      title: "Infrastructure Trends | Gracchus",
      description:
        "UK infrastructure trend data, visualised. | via @GracchusHQ"
    };
  }

  const meta = TREND_META[data.t];
  const ogImageUrl = "/api/og-trend?id="
    + encodeURIComponent(id);

  return {
    title: meta.title + " | Gracchus",
    description: meta.desc,
    openGraph: {
      title: meta.title,
      description: meta.desc,
      type: "article",
      siteName: "Gracchus",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: meta.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.desc,
      images: [ogImageUrl]
    }
  };
}

export default async function TrendSharePage({ params }) {
  const { id } = await params;
  const data = decodeId(id);
  const trendType = data && TREND_META[data.t]
    ? data.t
    : null;

  return <TrendShareClient trendType={trendType} />;
}
