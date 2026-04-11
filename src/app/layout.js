import "./globals.css";

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://gracchus.ai"
  ),
  title: "Gracchus",
  description:
    "Non-partisan, source-backed audit of UK government performance. Spending, delivery, procurement, cost of living \u2014 tracked and verified.",
  icons: {
    icon: "/favicon.ico",
    apple: "/gracchus-icon.svg",
  },
  openGraph: {
    title:
      "Gracchus",
    description:
      "Overbudget. Delayed. Cancelled. A non-partisan, source-backed audit of UK government performance.",
    type: "website",
    siteName: "Gracchus",
    locale: "en_GB",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Gracchus \u2014 UK Government Performance Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Gracchus",
    description:
      "Overbudget. Delayed. Cancelled. Track UK government performance \u2014 source-backed and non-partisan.",
    images: ["/api/og"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
