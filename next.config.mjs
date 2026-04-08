/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // ── Security Headers ──────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Prevent clickjacking — only allow your own site to frame content
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // Stop browsers from MIME-sniffing (prevents content-type confusion attacks)
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Enable browser XSS filter as a fallback
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Control what information is sent in the Referer header
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Enforce HTTPS for 1 year (enable once you've confirmed HTTPS works)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Restrict what the browser is allowed to do
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Content Security Policy — tight policy for a data dashboard
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // API routes — add CORS restrictions
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://gracchus.ai",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
