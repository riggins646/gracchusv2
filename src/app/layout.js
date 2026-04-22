import { Analytics } from '@vercel/analytics/next'
import { IBM_Plex_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

// Editorial serif for display (H1/H2) — gives the site the register of a
// think-tank or investigative outlet rather than a SaaS dashboard.
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-serif",
});

// Humanist sans for body — pairs with the serif, reads well at small sizes
// inside dense tables.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});

// Monospace for tabular £ figures and source-metadata chips so numbers line
// up column-wise.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${plexSerif.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
