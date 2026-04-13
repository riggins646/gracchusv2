/**
 * POST /api/csp-report
 *
 * Receives Content Security Policy violation reports from browsers.
 * Logs them server-side so we can detect XSS attempts or policy issues.
 */

export async function POST(request) {
  try {
    const report = await request.json();
    // Log the violation — visible in Vercel function logs
    console.warn("[CSP Violation]", JSON.stringify(report, null, 2));
  } catch {
    // Malformed report — ignore
  }

  // Always return 204 so the browser doesn't retry
  return new Response(null, { status: 204 });
}
