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
  if (score > 75) return '#ef4444'; // red
  if (score > 50) return '#f59e0b'; // amber
  return '#22c55e'; // green
}

function getScoreColorBg(score) {
  if (score > 75) return 'rgba(239, 68, 68, 0.1)'; // red
  if (score > 50) return 'rgba(245, 158, 11, 0.1)'; // amber
  return 'rgba(34, 197, 94, 0.1)'; // green
}

export function MPShareClient({ data, id }) {
  const [copied, setCopied] = useState(false);
  const { n: mpName, p: party, c: constituency, oi: outsideIncome, gi: gifts, dn: donations, sc: score } = data;

  // Additional fields with fallback to 0
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
    <div
      style={{
        backgroundColor: '#030303',
        color: '#ffffff',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Red accent bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: '#ef4444',
          zIndex: 100,
        }}
      />

      {/* Main container */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '60px 40px 40px',
        }}
      >
        {/* Hero Card */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #374151',
            borderRadius: '12px',
            padding: '40px',
            marginBottom: '40px',
          }}
        >
          {/* Header with GRACCHUS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                color: '#9ca3af',
                letterSpacing: '2px',
              }}
            >
              GRACCHUS
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                padding: '6px 12px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              MP Scorecard
            </div>
          </div>

          {/* MP Info */}
          <div style={{ marginBottom: '30px' }}>
            <h1
              style={{
                fontSize: '44px',
                fontWeight: 'bold',
                margin: '0 0 12px 0',
                lineHeight: '1.2',
              }}
            >
              {mpName}
            </h1>
            <p
              style={{
                fontSize: '18px',
                color: '#9ca3af',
                margin: 0,
              }}
            >
              {party} • {constituency}
            </p>
          </div>

          {/* Interests Index - Prominent */}
          <div
            style={{
              backgroundColor: scoreColorBg,
              border: `1px solid ${scoreColor}`,
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Interests Index Score
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: scoreColor,
                }}
              >
                {score}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  color: '#9ca3af',
                }}
              >
                / 100
              </div>
            </div>

            {/* Percentile bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#374151',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${score}%`,
                  height: '100%',
                  backgroundColor: scoreColor,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Score interpretation */}
            <p
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginTop: '12px',
                margin: '12px 0 0 0',
              }}
            >
              {score > 75
                ? 'High financial interests relative to peers'
                : score > 50
                  ? 'Moderate financial interests relative to peers'
                  : 'Lower financial interests relative to peers'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          {/* Outside Income */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Outside Income
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              {formatMoney(outsideIncome)}
            </div>
          </div>

          {/* Gifts & Hospitality */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Gifts & Hospitality
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              {formatMoney(gifts)}
            </div>
          </div>

          {/* Donations */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Donations
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              {formatMoney(donations)}
            </div>
          </div>

          {/* Properties */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Properties
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              {formatMoney(properties)}
            </div>
          </div>

          {/* Shareholdings */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Shareholdings
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              {formatMoney(shareholdings)}
            </div>
          </div>

          {/* Family Lobbying Links */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Family Lobbying Links
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              {familyLobbying}
            </div>
          </div>
        </div>

        {/* Why This Matters */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '32px',
            marginBottom: '40px',
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              margin: '0 0 16px 0',
            }}
          >
            Why This Matters
          </h2>
          <p
            style={{
              fontSize: '16px',
              color: '#d1d5db',
              lineHeight: '1.6',
              margin: 0,
            }}
          >
            Financial transparency is fundamental to democratic accountability. The Interests Index synthesizes publicly available data on outside income, gifts, donations, property holdings, shareholdings, and family lobbying links to provide a comprehensive view of potential financial interests that may influence an MP's parliamentary activities. Higher scores indicate greater financial complexity and potential conflicts of interest.
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              style={{
                flex: 1,
                padding: '12px 20px',
                backgroundColor: '#374151',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = '#4b5563')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = '#374151')}
            >
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>

            {/* Post to X Button */}
            <button
              onClick={handlePostToX}
              style={{
                flex: 1,
                padding: '12px 20px',
                backgroundColor: '#374151',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = '#4b5563')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = '#374151')}
            >
              Post to X
            </button>
          </div>

          {/* See All Link */}
          <Link
            href="/?view=transparency.scorecards"
            style={{
              padding: '12px 20px',
              backgroundColor: '#f59e0b',
              color: '#030303',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5a81f')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
          >
            See all MP scorecards →
          </Link>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '60px',
            paddingTop: '40px',
            borderTop: '1px solid #374151',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px',
          }}
        >
          <p style={{ margin: 0 }}>Data sourced from UK Parliament Register of Members' Financial Interests</p>
          <p style={{ margin: '8px 0 0 0' }}>
            Gracchus UK • <a href="https://gracchus.ai" style={{ color: '#f59e0b', textDecoration: 'none' }}>gracchus.ai</a>
          </p>
        </div>
      </div>
    </div>
  );
}
