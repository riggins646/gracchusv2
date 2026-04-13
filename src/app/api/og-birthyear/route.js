import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const getCurrentYear = () => {
  return 2025;
};

const decodePayload = (id) => {
  try {
    // Replace URL-safe base64 characters
    const base64 = id.replace(/-/g, '+').replace(/_/g, '/');
    // Decode from base64
    const buffer = Buffer.from(base64, 'base64');
    const json = JSON.parse(buffer.toString('utf-8'));
    return json;
  } catch (error) {
    console.error('Failed to decode payload:', error);
    return { y: 1990 };
  }
};

const calculateAge = (birthYear) => {
  const currentYear = getCurrentYear();
  return currentYear - birthYear;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    let birthYear = 1990;
    if (id) {
      const payload = decodePayload(id);
      birthYear = payload.y || 1990;
    }

    const age = calculateAge(birthYear);
    const currentYear = getCurrentYear();

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#030303',
            color: 'white',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background watermark "UK" */}
          <div
            style={{
              position: 'absolute',
              fontSize: '320px',
              fontWeight: 'bold',
              opacity: 0.04,
              top: '-80px',
              right: '-40px',
              color: 'white',
              letterSpacing: '20px',
            }}
          >
            UK
          </div>

          {/* Decorative accent line - top */}
          <svg
            width="1200"
            height="2"
            viewBox="0 0 1200 2"
            style={{
              position: 'absolute',
              top: '80px',
            }}
          >
            <line x1="0" y1="1" x2="1200" y2="1" stroke="#ef4444" strokeWidth="2" />
          </svg>

          {/* Main content container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '60px 80px',
              flex: 1,
              justifyContent: 'space-between',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '3px',
                  color: '#4b5563',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                }}
              >
                GRACCHUS
              </div>

              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  letterSpacing: '2px',
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  fontFamily: 'system-ui',
                }}
              >
                What Changed Since {birthYear}
              </div>
            </div>

            {/* Hero section - Birth year */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '72px',
                  fontWeight: '900',
                  lineHeight: '1',
                  color: 'white',
                }}
              >
                Born in {birthYear}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '400',
                  color: '#9ca3af',
                  lineHeight: '1.2',
                }}
              >
                {age} years of change in UK government
              </div>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                gap: '60px',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}
            >
              {/* Stat 1 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    color: '#ef4444',
                  }}
                >
                  8.5x
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                  }}
                >
                  House-to-income ratio
                </div>
              </div>

              {/* Stat 2 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    color: '#ef4444',
                  }}
                >
                  101%
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                  }}
                >
                  Debt-to-GDP
                </div>
              </div>

              {/* Stat 3 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    color: '#ef4444',
                  }}
                >
                  45%
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                  }}
                >
                  Energy self-sufficiency
                </div>
              </div>
            </div>

            {/* CTA Footer */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6b7280',
                fontFamily: 'monospace',
              }}
            >
              See your full comparison at gracchus.ai
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
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
