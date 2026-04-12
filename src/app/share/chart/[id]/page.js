import ChartShareClient from "./ChartShareClient";

/**
 * Server component for /share/chart/[id].
 * Decodes the base64url chart payload and
 * generates OG tags for social previews
 * (WhatsApp, iMessage, Telegram, Twitter, etc.).
 */

function decodeId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = Buffer.from(b64, "base64")
      .toString("utf8");
    const payload = JSON.parse(json);
    if (!payload.h) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = decodeId(id);

  if (!data) {
    return {
      title: "Chart | Gracchus",
      description:
        "UK government spending data, visualised."
    };
  }

  const title = data.h;
  const desc = (data.s
    ? data.s
    : data.t
      ? data.t
      : "Explore UK government spending data.")
    + " | via @GracchusHQ";

  const ogImageUrl = "/api/og-chart?id="
    + encodeURIComponent(id);

  return {
    title: title + " | Gracchus",
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "article",
      siteName: "Gracchus",
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

export default async function ChartSharePage({ params }) {
  const { id } = await params;
  return <ChartShareClient id={id} />;
}
