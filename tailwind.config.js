/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Editorial serif for display headings (H1/H2). Loaded via
        // next/font/google in src/app/layout.js and exposed as the
        // --font-plex-serif CSS variable.
        serif: ["var(--font-plex-serif)", "Georgia", "serif"],
        // Sans stack stays as system default but is addressable
        // explicitly if a component wants to override the serif.
        sans: [
          "var(--font-plex-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Existing monospace stack, kept for tabular and metadata use.
        mono: [
          "var(--font-plex-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Severity scale — meaningful gradient from "cancelled /
        // written-off" (strongest alarm) to "in planning / pre-spend"
        // (neutral). Use these instead of generic red-500 so that
        // on-budget and in-planning projects aren't screaming at the
        // reader. Tones are tuned for the site's near-black dark
        // theme — use the `/20` opacity modifier for backgrounds.
        severity: {
          cancelled:   "#f87171", // red-400    — project abandoned / written off
          overrunning: "#fb923c", // orange-400 — actively bleeding (>50% overrun)
          slipping:    "#fbbf24", // amber-400  — schedule slip or scope cut
          onbudget:    "#34d399", // emerald-400 — on-budget / favourably closed
          planning:    "#94a3b8", // slate-400  — pre-commitment, no spend yet
        },
        // Editorial ember — the FT/Bloomberg-register primary accent.
        // Use for CTAs, hover underlines, brand rules, eyebrow accents,
        // and any surface that should read as "identity" rather than
        // "alarm". Critical alarm (negative £, overrun delta) continues
        // to use the existing `red-*` Tailwind palette — the two
        // registers are intentional.
        ember: {
          50:  "#fdf4f0",
          100: "#fae5d9",
          200: "#f3c3a9",
          300: "#e79870",
          400: "#d66d42",
          500: "#c74a3a", // primary ember — use for accents, rules
          600: "#b8432a", // ember-on-dark CTA base (darker, calmer)
          700: "#98321f",
          800: "#7a2818",
          900: "#611f13",
          950: "#3a120b",
        },
      },
    },
  },
  plugins: [],
};
