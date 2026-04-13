import { ImageResponse } from 'next/og';

export const runtime = 'edge';

function decodeBase64Url(str) {
  try {
    // Replace base64url-specific characters
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Decode base64
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode payload:', error);
    return null;
  }
}

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response('Missing id parameter', { status: 400 });
    }

    const data = decodeBase64Url(id);

    if (!data) {
      return new Response('Invalid payload', { status: 400 });
    }

    const { n: mpName, p: party, c: constituency, oi: outsideIncome, gi: gifts, dn: donations, sc: score } = data;
    const scoreColor = getScoreColor(score);

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#030303',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            padding: '40px',
          }}
        >
          {/* Red accent bar at top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              backgroundColor: '#ef4444',
            }}
          />

          {/* Header: GRACCHUS */}
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
                fontSize: '24px',
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
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                padding: '8px 16px',
                borderRadius: '4px',
              }}
            >
              MP SCORECARD
            </div>
          </div>

          {/* MP Name - Large and bold */}
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '12px',
              lineHeight: '1.2',
            }}
          >
            {mpName}
          </div>

          {/* Party + Constituency */}
          <div
            style={{
              fontSize: '20px',
              color: '#9ca3af',
              marginBottom: '40px',
            }}
          >
            {party} • {constituency}
          </div>

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
              flex: 1,
              marginBottom: '30px',
            }}
          >
            {/* Outside Income */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
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
                Outside Income
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                }}
              >
                {formatMoney(outsideIncome)}
              </div>
            </div>

            {/* Gifts */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
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
                Gifts
              </div>
              <div
                style={{
                  fontSize: '28px',
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
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
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
                Donations
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                }}
              >
                {formatMoney(donations)}
              </div>
            </div>

            {/* Interests Index */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
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
                Interests Index
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: scoreColor,
                }}
              >
                {score}/100
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #374151',
              paddingTop: '20px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#9ca3af',
              }}
            >
              UK
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#9ca3af',
              }}
            >
              See all MP scorecards at gracchus.ai
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
