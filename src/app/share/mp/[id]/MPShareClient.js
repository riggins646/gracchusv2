'use client';

import { useState } from 'react';
import Link from 'next/link';

function formatMoney(value) {
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1000) {
    return `£${(value / 1000).toFixed(0)}k`;
  }
  return `£${value}`;
}

function getScoreColor(score) {
  if (score > 75) return '#ef4444';
  if (score > 50) return '#f59e0b';
  return '#22c55e';
}

function getScoreColorBg(score) {
  if (score > 75) return 'rgba(239, 68, 68, 0.1)';
  if (score > 50) return 'rgba(245, 158, 11, 0.1)';
  return 'rgba(34, 197, 94, 0.1)';
}

export function MPShareClient({ data, id }) {
  const [copied, setCopied] = useState(false);
  const { n: mpName, p: party, c: constituency, oi: outsideIncome, gi: gifts, dn: donations, sc: score } = data;

  const properties = data.pr || 0;
  const shareholdings = data.sh || 0;
  const familyLobbying = data.fl || 0;

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePostToX = () => {
    const text = `${mpName} (${party})\nInterests Index: ${score}/100\nOutside income: ${formatMoney(outsideIncome)} | Gifts: ${formatMoney(gifts)} | Donations: ${formatMoney(donations)}\n\nvia @GracchusHQ`;
    const encodedText = encodeURIComponent(text);
    const xUrl = `https://x.com/intent/tweet?text=${encodedText}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
  };

  const scoreColor = getScoreColor(score);
  const scoreColorBg = getScoreColorBg(score);

  return (
    <div className="bg-[#030303] text-white min-h-screen font-sans">
      {/* Red accent bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-red-500 z-[100]" />

      {/* Main container */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-10 pt-12 sm:pt-16 pb-10">

        {/* Hero Card */}
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-5 sm:p-8 md:p-10 mb-8 sm:mb-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6 sm:mb-8">
            <div className="text-lg sm:text-xl font-bold font-mono text-gray-400 tracking-wider">
              GRACCHUS
            </div>
            <div className="text-[13px] font-semibold text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded uppercase tracking-wide self-start">
              MP Scorecard
            </div>
          </div>

          {/* MP Info */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight mb-2 sm:mb-3">
              {mpName}
            </h1>
            <p className="text-base sm:text-lg text-gray-400">
              {party} • {constituency}
            </p>
          </div>

          {/* Interests Index */}
          <div className="rounded-lg p-5 sm:p-6 mb-6 sm:mb-8" style={{ backgroundColor: scoreColorBg, border: `1px solid ${scoreColor}` }}>
            <div className="text-[13px] text-gray-400 mb-2 uppercase tracking-wide">
              Interests Index Score
            </div>
            <div className="flex items-baseline gap-3 mb-4">
              <div className="text-4xl sm:text-5xl font-bold" style={{ color: scoreColor }}>
                {score}
              </div>
              <div className="text-lg text-gray-400">/ 100</div>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
              <div className="h-full rounded transition-all duration-300" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
            </div>
            <p className="text-[13px] text-gray-400 mt-3">
              {score > 75
                ? 'High financial interests relative to peers'
                : score > 50
                  ? 'Moderate financial interests relative to peers'
                  : 'Lower financial interests relative to peers'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8 sm:mb-10">
          {[
            { label: 'Outside Income', value: formatMoney(outsideIncome) },
            { label: 'Gifts & Hospitality', value: formatMoney(gifts) },
            { label: 'Donations', value: formatMoney(donations) },
            { label: 'Properties', value: formatMoney(properties) },
            { label: 'Shareholdings', value: formatMoney(shareholdings) },
            { label: 'Family Lobbying Links', value: familyLobbying },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-5 sm:p-6">
              <div className="text-[13px] text-gray-400 mb-3 uppercase tracking-wide">
                {stat.label}
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Why This Matters */}
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-5 sm:p-8 mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Why This Matters</h2>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
            Financial transparency is fundamental to democratic accountability. The Interests Index synthesizes publicly available data on outside income, gifts, donations, property holdings, shareholdings, and family lobbying links to provide a comprehensive view of potential financial interests that may influence an MP{"'"}s parliamentary activities. Higher scores indicate greater financial complexity and potential conflicts of interest.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-3 flex-1">
            <button
              onClick={handleCopyLink}
              className="flex-1 min-h-[44px] px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-semibold transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
            <button
              onClick={handlePostToX}
              className="flex-1 min-h-[44px] px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-semibold transition-colors"
            >
              Post to X
            </button>
          </div>
          <Link
            href="/?view=transparency.scorecards"
            className="min-h-[44px] px-5 py-3 bg-amber-500 hover:bg-amber-400 text-[#030303] rounded-md text-sm font-semibold transition-colors text-center inline-flex items-center justify-center"
          >
            See all MP scorecards →
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-gray-700 text-center text-gray-400 text-sm">
          <p>Data sourced from UK Parliament Register of Members{"'"} Financial Interests</p>
          <p className="mt-2">
            Gracchus UK • <a href="https://gracchus.ai" className="text-amber-500 hover:text-amber-400 no-underline">gracchus.ai</a>
          </p>
        </div>
      </div>
    </div>
  );
}
