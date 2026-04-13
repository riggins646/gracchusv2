import BirthYearShareClient from "./BirthYearShareClient";

/**
 * Server component for /share/birthyear/[id].
 * Decodes the base64url birth year payload and
 * generates OG tags for social previews.
 */

function decodeId(id) {
  try {
    const b64 = id
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = Buffer.from(b64, "base64")
      .toString("utf8");
    const payload = JSON.parse(json);
    if (payload.y === undefined) return null;
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
      title: "Birth Year Comparison | Gracchus",
      description:
        "Compare UK government performance across your lifetime"
    };
  }

  const year = data.y;
  const age = 2025 - year;
  const title = `Born in ${year} — ${age} years of UK change`;
  const desc = `Explore how the UK has changed since ${year}. Compare government performance across your lifetime. | via @GracchusHQ`;

  const ogImageUrl = "/api/og-birthyear?id="
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

export default async function BirthYearSharePage({ params }) {
  const { id } = await params;
  const data = decodeId(id);

  if (!data) {
    return <BirthYearShareClient year={null} />;
  }

  return <BirthYearShareClient year={data.y} />;
}
