"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Share2, ChevronRight, ChevronLeft, X, Download, Copy, Check } from "lucide-react";
import deptSpendingData from "../data/departmental-spending.json";
import publicFinancesData from "../data/public-finances.json";
import spendingData from "../data/spending.json";
import costOfLivingData from "../data/cost-of-living.json";
import moonlightingData from "../data/moonlighting-mps.json";
import mpInterestsData from "../data/mp-interests.json";
import donationsData from "../data/political-donations.json";
import projectsData from "../data/projects.json";
import { renderWrappedCard } from "../lib/wrapped-cards";

/* =========================================================
   GRACCHUS QUARTERLY WRAPPED — Q1 2026
   10-slide narrative arc: personal → outrage → receipt
   ========================================================= */

const QUARTER = "Q1";
const YEAR = "2026";
const QUARTER_LABEL = `${QUARTER} ${YEAR}`;
const UK_TAXPAYERS = 33_400_000;

// ── Slide colour themes (Spotify-esque bold gradients) ──
const THEMES = [
  { bg: "from-blue-950 via-black to-black", accent: "#3B82F6", name: "blue" },
  { bg: "from-amber-950 via-black to-black", accent: "#F59E0B", name: "amber" },
  { bg: "from-red-950 via-black to-black", accent: "#FF4D4D", name: "red" },
  { bg: "from-purple-950 via-black to-black", accent: "#A855F7", name: "purple" },
  { bg: "from-emerald-950 via-black to-black", accent: "#10B981", name: "emerald" },
  { bg: "from-rose-950 via-black to-black", accent: "#FB7185", name: "rose" },
  { bg: "from-red-950 via-black to-black", accent: "#FF4D4D", name: "red2" },
  { bg: "from-amber-950 via-black to-black", accent: "#F59E0B", name: "amber2" },
  { bg: "from-purple-950 via-black to-black", accent: "#A855F7", name: "purple2" },
  { bg: "from-emerald-950 via-black to-black", accent: "#10B981", name: "emerald2" },
];

function fmt(m) {
  if (m >= 1000) return "\u00a3" + (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + "bn";
  return "\u00a3" + m.toLocaleString("en-GB") + "m";
}

function fmtK(v) {
  if (v >= 1000000) return "\u00a3" + (v / 1000000).toFixed(1) + "m";
  if (v >= 1000) return "\u00a3" + (v / 1000).toFixed(0) + "k";
  return "\u00a3" + v.toLocaleString("en-GB");
}

// ── Data calculations ──────────────────────────────────
function useWrappedData() {
  return useMemo(() => {
    // ─── SLIDE 1: The Quarter's Bill ───
    const annualSpend = deptSpendingData.metadata.totalPolicySpending; // £1,164bn
    const quarterSpend = annualSpend / 4; // ~£291bn

    // ─── SLIDE 2: Cost of Living (Q1 specific) ───
    const cpiPct = costOfLivingData.headline.cpiPct;
    const petrol = costOfLivingData.headline.petrolPenceLitre;
    const diesel = costOfLivingData.headline.dieselPenceLitre;
    const energyCap = costOfLivingData.headline.energyCapGbp;
    const avgRentGbp = costOfLivingData.headline.avgRentGbp;
    const realWages = costOfLivingData.headline.realWageGrowthPct;

    // ─── SLIDE 3: Debt Interest ───
    const latestFinances = publicFinancesData.series[publicFinancesData.series.length - 1];
    const annualDebtInterest = latestFinances.debtInterestNet; // £84.8bn
    const quarterDebtInterest = annualDebtInterest / 4;
    const dailyDebtInterest = annualDebtInterest * 1000 / 365; // £m per day
    const debtPctGDP = latestFinances.debtInterestPctGDP;

    // ─── SLIDE 4: Benefits Bill ───
    const welfareBrkdn = spendingData.welfareBreakdown;
    const welfareTotal = welfareBrkdn.reduce((s, w) => s + (w.value || w.amount || 0), 0);
    const quarterWelfare = welfareTotal / 4;
    const topBenefits = [...welfareBrkdn].sort((a, b) => (b.value || b.amount || 0) - (a.value || a.amount || 0)).slice(0, 5);

    // ─── SLIDE 5: Where Tax Went (dept spending) ───
    const depts = [...deptSpendingData.departments].sort((a, b) => b.spend - a.spend).slice(0, 6);

    // ─── SLIDE 6: Moonlighting MPs (Q1 specific) ───
    const q1MPs = moonlightingData.q1_2026;

    // ─── SLIDE 7: Gifts & Hospitality (Q1 specific) ───
    const q1Gifts = mpInterestsData.q1_2026.giftsAndHospitality;

    // ─── SLIDE 8: Political Donations (Q1 specific) ───
    const q1Donations = donationsData.byYear.find(y => y.year === 2026);
    const q1PartyDonations = donationsData.partyYearSeries.find(y => y.year === 2026);

    // ─── SLIDE 9: Cancellation Graveyard ───
    const cancelled = projectsData.filter(p => p.status === "Cancelled");
    const totalCancelledWaste = cancelled.reduce((s, p) => s + p.latestBudget, 0);
    const topCancelled = [...cancelled].sort((a, b) => b.latestBudget - a.latestBudget).slice(0, 5);

    // ─── SLIDE 10: Personal receipt ───
    const perTaxpayer = Math.round((quarterSpend * 1000000000) / UK_TAXPAYERS);
    const perTaxpayerDebt = Math.round((quarterDebtInterest * 1000000000) / UK_TAXPAYERS);
    const perTaxpayerWelfare = Math.round((quarterWelfare * 1000000000) / UK_TAXPAYERS);
    const allDepts = deptSpendingData.departments;
    const perTaxpayerNHS = Math.round((allDepts.find(d => d.short === "DHSC")?.spend || 202) / 4 * 1000000000 / UK_TAXPAYERS);
    const perTaxpayerDefence = Math.round((allDepts.find(d => d.short === "MoD")?.spend || 39) / 4 * 1000000000 / UK_TAXPAYERS);
    const mpSalaryPerTaxpayer = Math.round((650 * 98599 / 4) / UK_TAXPAYERS * 100) / 100;

    return {
      quarterSpend, annualSpend,
      cpiPct, petrol, diesel, energyCap, avgRentGbp, realWages,
      annualDebtInterest, quarterDebtInterest, dailyDebtInterest, debtPctGDP,
      welfareTotal, quarterWelfare, topBenefits,
      depts,
      q1MPs,
      q1Gifts,
      q1Donations, q1PartyDonations,
      cancelled, totalCancelledWaste, topCancelled,
      perTaxpayer, perTaxpayerDebt, perTaxpayerWelfare, perTaxpayerNHS, perTaxpayerDefence, mpSalaryPerTaxpayer,
    };
  }, []);
}

// ── Build slides from data ─────────────────────────────
function useSlides(d) {
  return useMemo(() => [
    // SLIDE 0: The Quarter's Bill
    {
      id: "bill",
      eyebrow: "YOUR Q1 2026 WRAPPED",
      headline: "Your government\u2019s top genre this quarter was: spending money",
      bigNumber: "\u00a3" + d.quarterSpend.toFixed(0) + "bn",
      bigNumberSuffix: "in 90 days. That\u2019s \u00a3" + (d.quarterSpend * 1000 / 90).toFixed(0) + "m a day.",
      detail: "You were in the top 100% of taxpayers who funded this. Congratulations. Let\u2019s see where it went.",
      footer: "Source: HM Treasury PESA 2025",
    },

    // SLIDE 1: Cost of Living
    {
      id: "costOfLiving",
      eyebrow: "YOUR VIBE CHECK",
      headline: "Here\u2019s what just existing cost you in Q1",
      subline: "Inflation at " + d.cpiPct + "%. Your wages grew " + (d.realWages > 0 ? "" : "minus ") + Math.abs(d.realWages) + "% in real terms. " + (d.realWages > 0 ? "So technically you\u2019re winning. Barely." : "So you got poorer. Again."),
      list: [
        { label: "Petrol", value: d.petrol + "p/L" },
        { label: "Diesel", value: d.diesel + "p/L" },
        { label: "Energy cap", value: "\u00a3" + (d.energyCap || 0).toLocaleString() + "/yr" },
        { label: "Average rent", value: "\u00a3" + (d.avgRentGbp || 0).toLocaleString() + "/mo" },
        { label: "Real wage growth", value: (d.realWages > 0 ? "+" : "") + d.realWages + "%" },
      ],
      listTitle: "The price of being British",
      footer: "Source: ONS, DESNZ, Ofgem",
    },

    // SLIDE 2: Debt Interest
    {
      id: "debtInterest",
      eyebrow: "THE OPENING ACT",
      headline: "Before anyone got a single public service",
      bigNumber: "\u00a3" + d.quarterDebtInterest.toFixed(1) + "bn",
      bigNumberSuffix: "went straight to debt interest",
      subline: "\u00a3" + d.dailyDebtInterest.toFixed(0) + "m a day. Every day. Just paying the interest. Not the debt. The interest. That\u2019s " + d.debtPctGDP + "% of GDP gone before the lights are even on.",
      detail: "The full-year bill is \u00a3" + d.annualDebtInterest + "bn. More than we spend on defence. Sleep well.",
      footer: "Source: ONS Public Sector Finances, OBR",
    },

    // SLIDE 3: Benefits Bill
    {
      id: "welfare",
      eyebrow: "THE BIGGEST LINE ITEM",
      headline: "Your government\u2019s most-played track: welfare",
      bigNumber: "\u00a3" + d.quarterWelfare.toFixed(0) + "bn",
      bigNumberSuffix: "this quarter alone",
      subline: "\u00a3" + d.welfareTotal.toFixed(0) + "bn a year. The single largest thing your government spends money on. Here\u2019s the setlist:",
      list: d.topBenefits.map(b => ({
        label: b.name || b.category,
        value: "\u00a3" + ((b.value || b.amount || 0) / 4).toFixed(1) + "bn",
      })),
      listTitle: "Quarterly rate",
      footer: "Source: DWP Benefit Expenditure Tables 2025",
    },

    // SLIDE 4: Where Your Tax Went
    {
      id: "departments",
      eyebrow: "YOUR LISTENING HISTORY",
      headline: "Your personal tax went to these departments",
      subline: "Your share of Q1 spending, split across " + (UK_TAXPAYERS / 1000000).toFixed(1) + "m taxpayers. You funded all of this. You\u2019re welcome, civil service.",
      list: d.depts.map(dept => ({
        label: dept.name,
        value: "\u00a3" + Math.round(dept.spend / 4 * 1000000000 / UK_TAXPAYERS).toLocaleString(),
        sub: "\u00a3" + (dept.spend / 4).toFixed(1) + "bn dept total",
      })),
      footer: "Source: HM Treasury PESA 2025",
    },

    // SLIDE 5: Moonlighting MPs (Q1 specific)
    {
      id: "moonlighting",
      eyebrow: "SIDE HUSTLE SEASON",
      headline: "Your MPs earned " + fmtK(d.q1MPs.totalDeclaredQ1) + " on the side this quarter",
      bigNumber: d.q1MPs.totalHoursQ1.toLocaleString(),
      bigNumberSuffix: "hours on second jobs instead of representing you",
      subline: d.q1MPs.newDeclarations + " new declarations. Top earners voted " + d.q1MPs.avgAttendanceTopEarners + "% of the time. Average MP: " + d.q1MPs.avgAttendanceAllMPs + "%. Part-time job, full-time salary.",
      list: d.q1MPs.topQ1Earners.map((mp, i) => ({
        label: (i + 1) + ". " + mp.name,
        value: fmtK(mp.amount),
        sub: mp.source + " \u2022 voted " + mp.votingAttendance + "% of the time",
      })),
      listTitle: "The top earners. Your representatives.",
      footer: "Source: Parliament Register of Members' Financial Interests",
    },

    // SLIDE 6: Gifts & Hospitality (Q1 specific)
    {
      id: "gifts",
      eyebrow: "THE FREE STUFF",
      headline: d.q1Gifts.mpsReceiving + " of your MPs accepted freebies this quarter",
      bigNumber: fmtK(d.q1Gifts.totalValue),
      bigNumberSuffix: "in gifts, trips, and hospitality",
      subline: d.q1Gifts.totalItems + " items. Football boxes. Brit Awards tickets. Flights to Riyadh. Cufflinks from Trump. All declared. All legal. All paid for by someone who wants something.",
      list: d.q1Gifts.topItems.slice(0, 5).map(g => ({
        label: g.mp,
        value: fmtK(g.value),
        sub: g.item + " \u2014 from " + g.donor,
      })),
      listTitle: "Highlights from the register",
      footer: "Source: Parliament Register, GOV.UK Ministers' Gifts",
    },

    // SLIDE 7: Political Donations (Q1 specific)
    (() => {
      const ps = d.q1PartyDonations || {};
      const partyRows = [
        { name: "Labour", val: ps.Labour || 0 },
        { name: "Conservative", val: ps.Conservative || 0 },
        { name: "Reform UK", val: ps["Reform UK"] || 0 },
        { name: "Liberal Democrats", val: ps["Liberal Democrats"] || 0 },
        { name: "Green", val: ps.Green || 0 },
        { name: "SNP", val: ps.SNP || 0 },
        { name: "Other", val: ps.Other || 0 },
      ].filter(p => p.val > 0).sort((a, b) => b.val - a.val);

      return {
        id: "donations",
        eyebrow: "THE MONEY BEHIND THE CURTAIN",
        headline: "Someone\u2019s always paying",
        bigNumber: "\u00a3" + ((d.q1Donations?.total || 1197214) / 1000000).toFixed(1) + "m",
        bigNumberSuffix: "in political donations so far this quarter",
        subline: (d.q1Donations?.count || 62) + " donations reported. Q1 2025 saw \u00a312.95m \u2014 the rest of 2026\u2019s returns are still coming in. But we\u2019re watching.",
        list: partyRows.map(p => ({
          label: p.name,
          value: "\u00a3" + (p.val >= 1000000 ? (p.val / 1000000).toFixed(1) + "m" : (p.val / 1000).toFixed(0) + "k"),
        })),
        listTitle: "Reported so far",
        footer: "Source: Electoral Commission (data still being published)",
      };
    })(),

    // SLIDE 8: Cancellation Graveyard
    {
      id: "cancelled",
      eyebrow: "THE SKIP BUTTON",
      headline: "Projects your government started then gave up on",
      bigNumber: fmt(d.totalCancelledWaste),
      bigNumberSuffix: "spent on " + d.cancelled.length + " cancelled projects. Nothing to show for it.",
      subline: "That\u2019s " + Math.round(d.totalCancelledWaste * 1000000 / 35000).toLocaleString() + " nurses for a year. Or " + Math.round(d.totalCancelledWaste * 1000000 / 50).toLocaleString() + " pothole repairs. Instead: literally nothing.",
      list: d.topCancelled.map(p => ({
        label: p.name,
        value: fmt(p.latestBudget),
        sub: p.department,
      })),
      listTitle: "The biggest write-offs",
      footer: "Source: NAO, IPA Annual Reports",
    },

    // SLIDE 9: Your Personal Q1 Receipt
    {
      id: "receipt",
      eyebrow: "YOUR Q1 RECEIPT",
      headline: "Thanks for being a UK taxpayer this quarter",
      bigNumber: "\u00a3" + d.perTaxpayer.toLocaleString(),
      bigNumberSuffix: "was your personal contribution to the machine",
      list: [
        { label: "NHS & Social Care", value: "\u00a3" + d.perTaxpayerNHS.toLocaleString() },
        { label: "Welfare & Benefits", value: "\u00a3" + d.perTaxpayerWelfare.toLocaleString() },
        { label: "Debt Interest", value: "\u00a3" + d.perTaxpayerDebt.toLocaleString() },
        { label: "Defence", value: "\u00a3" + d.perTaxpayerDefence.toLocaleString() },
        { label: "Your share of all MPs' salaries", value: "\u00a3" + d.mpSalaryPerTaxpayer.toFixed(2) },
      ],
      listTitle: "Where your money went",
      detail: "Meanwhile, the top 5 side-hustling MPs earned " + fmtK(d.q1MPs.totalDeclaredQ1) + " on top of their salary \u2014 while voting less than half the time. See you next quarter.",
      footer: "Based on " + (UK_TAXPAYERS / 1000000).toFixed(1) + "m UK income taxpayers",
    },
  ], [d]);
}

// ── Share modal ────────────────────────────────────────
function ShareModal({ slide, theme, onClose }) {
  const [copied, setCopied] = useState(false);
  const imgSrc = useMemo(
    () => renderWrappedCard(slide, theme),
    [slide, theme]
  );

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = imgSrc;
    a.download = `gracchus-${QUARTER.toLowerCase()}-${YEAR}-${slide.id}.png`;
    a.click();
  }, [imgSrc, slide.id]);

  const handleCopy = useCallback(async () => {
    try {
      const res = await fetch(imgSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      handleDownload();
    }
  }, [imgSrc, handleDownload]);

  const handlePost = useCallback(() => {
    const text = slide.eyebrow + "\n\n" +
      (slide.headline || "") +
      (slide.bigNumber ? " " + slide.bigNumber : "") +
      (slide.bigNumberSuffix ? " " + slide.bigNumberSuffix : "") +
      (slide.subline ? "\n" + slide.subline : "") +
      "\n\nvia @GracchusHQ";
    window.open(
      "https://x.com/intent/post?text=" +
      encodeURIComponent(text) +
      "&url=" + encodeURIComponent(window.location.href),
      "_blank",
      "noopener,noreferrer"
    );
  }, [slide]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-gray-950 border border-gray-800 max-w-xl w-full"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="text-[12px] uppercase tracking-[0.25em] font-mono text-gray-500">
            Share this slide
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <img src={imgSrc} alt="Share card" className="w-full border border-gray-800/40 mb-4" />
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handlePost}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-wider font-mono text-white bg-white/5 hover:bg-white/10 transition-colors border border-gray-800">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Post
            </button>
            <button onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-wider font-mono text-white bg-white/5 hover:bg-white/10 transition-colors border border-gray-800">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-wider font-mono text-white bg-white/5 hover:bg-white/10 transition-colors border border-gray-800">
              <Download size={14} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single slide renderer ──────────────────────────────
function Slide({ slide, theme, onShare }) {
  return (
    <div className={
      "min-h-[70vh] sm:min-h-[80vh] flex flex-col justify-center " +
      "px-6 sm:px-10 md:px-16 py-12 sm:py-16 " +
      "bg-gradient-to-b " + theme.bg + " " +
      "relative overflow-hidden"
    }>
      {/* Decorative gradient orb */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: theme.accent }} />

      <div className="relative z-10 max-w-2xl">
        {/* Eyebrow */}
        <div className="text-[11px] sm:text-[13px] uppercase tracking-[0.3em] font-mono mb-4 sm:mb-6"
          style={{ color: theme.accent }}>
          {slide.eyebrow}
        </div>

        {/* Headline */}
        {slide.headline && (
          <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3 sm:mb-4 leading-tight">
            {slide.headline}
          </div>
        )}

        {/* Big number */}
        {slide.bigNumber && (
          <div className="mb-2">
            <span className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight"
              style={{ color: theme.accent }}>
              {slide.bigNumber}
            </span>
            {slide.bigNumberSuffix && (
              <div className="text-lg sm:text-2xl text-gray-400 font-medium mt-1">
                {slide.bigNumberSuffix}
              </div>
            )}
          </div>
        )}

        {/* Subline */}
        {slide.subline && (
          <div className="text-base sm:text-xl text-gray-400 mb-6 leading-relaxed">
            {slide.subline}
          </div>
        )}

        {/* Detail text */}
        {slide.detail && (
          <div className="text-sm sm:text-base text-gray-500 leading-relaxed mb-6 max-w-lg border-l-2 pl-4"
            style={{ borderColor: theme.accent + "40" }}>
            {slide.detail}
          </div>
        )}

        {/* List */}
        {slide.list && (
          <div className="mt-6">
            {slide.listTitle && (
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-3">
                {slide.listTitle}
              </div>
            )}
            <div className="space-y-3">
              {slide.list.map((item, i) => (
                <div key={i} className="border-b border-gray-800/40 pb-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm sm:text-base text-gray-300 font-medium truncate flex-1 min-w-0">
                      {item.label}
                    </div>
                    <div className="text-sm sm:text-base font-bold whitespace-nowrap"
                      style={{ color: theme.accent }}>
                      {item.value}
                    </div>
                  </div>
                  {item.sub && (
                    <div className="text-[11px] text-gray-600 mt-0.5 truncate">
                      {item.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {slide.footer && (
          <div className="mt-8 text-[11px] uppercase tracking-[0.15em] font-mono text-gray-700">
            {slide.footer}
          </div>
        )}
      </div>

      {/* Share button */}
      <button onClick={onShare}
        className={
          "absolute bottom-6 right-6 flex items-center gap-2 " +
          "px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] font-mono " +
          "text-gray-500 hover:text-white " +
          "border border-gray-800 hover:border-gray-600 " +
          "bg-black/50 backdrop-blur-sm transition-all"
        }>
        <Share2 size={12} />
        Share
      </button>
    </div>
  );
}

// ── Main Wrapped component ─────────────────────────────
export default function Wrapped({ onBack }) {
  const data = useWrappedData();
  const slides = useSlides(data);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [shareSlide, setShareSlide] = useState(null);
  const containerRef = useRef(null);

  const slide = slides[currentSlide];
  const theme = THEMES[currentSlide % THEMES.length];

  const goNext = useCallback(() => {
    setCurrentSlide((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentSlide((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "Escape" && shareSlide !== null) setShareSlide(null);
      if (e.key === "Escape" && shareSlide === null && onBack) onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, shareSlide, onBack]);

  // Touch swipe
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) goNext();
    if (diff < -50) goPrev();
    touchStartX.current = null;
  };

  return (
    <div ref={containerRef} className="relative bg-black min-h-screen"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <button onClick={onBack}
            className="text-[11px] uppercase tracking-[0.15em] font-mono text-gray-500 hover:text-white transition-colors">
            {"<"} Back
          </button>
          <div className="text-[11px] uppercase tracking-[0.25em] font-mono font-bold"
            style={{ color: theme.accent }}>
            Gracchus {QUARTER_LABEL} Wrapped
          </div>
          <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-gray-700">
            {currentSlide + 1}/{slides.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-900">
          <div className="h-full transition-all duration-300"
            style={{
              width: ((currentSlide + 1) / slides.length * 100) + "%",
              background: theme.accent,
            }} />
        </div>
      </div>

      {/* Slide content */}
      <div className="pt-12">
        <Slide
          slide={slide}
          theme={theme}
          onShare={() => setShareSlide(currentSlide)}
        />
      </div>

      {/* Navigation arrows (desktop) */}
      {currentSlide > 0 && (
        <button onClick={goPrev}
          className="hidden sm:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 items-center justify-center text-gray-600 hover:text-white border border-gray-800 hover:border-gray-600 bg-black/50 backdrop-blur-sm transition-all">
          <ChevronLeft size={20} />
        </button>
      )}
      {currentSlide < slides.length - 1 && (
        <button onClick={goNext}
          className="hidden sm:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 items-center justify-center text-gray-600 hover:text-white border border-gray-800 hover:border-gray-600 bg-black/50 backdrop-blur-sm transition-all">
          <ChevronRight size={20} />
        </button>
      )}

      {/* Mobile tap zones */}
      <div className="sm:hidden fixed inset-0 z-20 flex pointer-events-none">
        <div className="w-1/3 pointer-events-auto" onClick={goPrev} />
        <div className="w-1/3" />
        <div className="w-1/3 pointer-events-auto" onClick={goNext} />
      </div>

      {/* Bottom hint */}
      {currentSlide === 0 && (
        <div className="fixed bottom-6 left-0 right-0 text-center z-30 animate-pulse">
          <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-gray-700">
            Swipe or tap to continue {"\u2192"}
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareSlide !== null && (
        <ShareModal
          slide={slides[shareSlide]}
          theme={THEMES[shareSlide % THEMES.length]}
          onClose={() => setShareSlide(null)}
        />
      )}
    </div>
  );
}
