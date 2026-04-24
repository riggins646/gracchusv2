/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // Explicitly disable source maps in production builds
  productionBrowserSourceMaps: false,

  // ── Clean URL rewrites ───────────────────────────────────────────
  // Single-segment paths that don't match existing routes (about, api, share,
  // _next, static files) get rewritten to / so Dashboard can handle them.
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/:slug((?!api|about|share|_next|data|favicon|gracchus|robots).*)",
          destination: "/",
        },
      ],
    };
  },

  // ── Security Headers ──────────────────────────────────────────────
  async headers() {
    // Next.js dev mode (Fast Refresh, React Refresh runtime, HMR) requires
    // 'unsafe-eval' and a websocket connect-src. Production stays locked down.
    const isDev = process.env.NODE_ENV !== "production";
    const cspScriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    const cspConnectSrc = isDev
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self'";

    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Prevent clickjacking — only allow your own site to frame content
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Stop browsers from MIME-sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Control what information is sent in the Referer header
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Enforce HTTPS for 2 years
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Restrict what the browser is allowed to do
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Content Security Policy — tight policy for a data dashboard.
          // In dev we relax script-src/connect-src so Fast Refresh + HMR work.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              cspScriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              cspConnectSrc,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
          // Cross-origin isolation headers
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        // API routes — restrict CORS to your own domain
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://gracchus.ai",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
      {
        // Static data files — cache aggressively, prevent hotlinking
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
