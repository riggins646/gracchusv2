import { MPShareClient } from './MPShareClient';

function decodeBase64Url(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode payload:', error);
    return null;
  }
}

function formatMoneyShort(value) {
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1000) {
    return `£${(value / 1000).toFixed(0)}k`;
  }
  return `£${value}`;
}

export async function generateMetadata({ params }) {
  const { id } = params;
  const data = decodeBase64Url(id);

  if (!data) {
    return {
      title: 'MP Scorecard | Gracchus',
      description: 'View MP financial transparency data on Gracchus.',
    };
  }

  const { n: mpName, p: party, c: constituency, sc: score, oi: outsideIncome } = data;

  return {
    title: `${mpName} — MP Scorecard | Gracchus`,
    description: `${mpName} (${party}, ${constituency}) — Interests Index: ${score}/100. Outside income: ${formatMoneyShort(outsideIncome)}. See the full accountability data.`,
    openGraph: {
      title: `${mpName} — MP Scorecard | Gracchus`,
      description: `${mpName} (${party}, ${constituency}) — Interests Index: ${score}/100. Outside income: ${formatMoneyShort(outsideIncome)}. See the full accountability data.`,
      image: `/api/og-mp?id=${encodeURIComponent(id)}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${mpName} — MP Scorecard | Gracchus`,
      description: `${mpName} (${party}, ${constituency}) — Interests Index: ${score}/100. Outside income: ${formatMoneyShort(outsideIncome)}. See the full accountability data.`,
      image: `/api/og-mp?id=${encodeURIComponent(id)}`,
    },
  };
}

export default function MPSharePage({ params }) {
  const { id } = params;
  const decodedData = decodeBase64Url(id);

  if (!decodedData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        <h1>Invalid MP Data</h1>
        <p>The MP scorecard could not be loaded.</p>
      </div>
    );
  }

  return <MPShareClient data={decodedData} id={id} />;
}
