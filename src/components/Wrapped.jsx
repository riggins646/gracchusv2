"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Share2, ChevronRight, ChevronLeft, X, Download, Copy, Check } from "lucide-react";
import projectsData from "../data/projects.json";
import civilServiceData from "../data/civil-service.json";
import { renderWrappedCard } from "../lib/wrapped-cards";

/* =========================================================
   GRACCHUS QUARTERLY WRAPPED — Q1 2026
   Spotify Wrapped–style slide-through of UK government
   performance data. 5-6 punchy slides with share cards.
   ========================================================= */

const QUARTER = "Q1";
const YEAR = "2026";
const QUARTER_LABEL = `${QUARTER} ${YEAR}`;
const UK_TAXPAYERS = 33_400_000; // Approx UK income tax payers

// ── Slide colour themes (Spotify-esque bold gradients) ──
const THEMES = [
  { bg: "from-red-950 via-black to-black", accent: "#FF4D4D", name: "red" },
  { bg: "from-amber-950 via-black to-black", accent: "#F59E0B", name: "amber" },
  { bg: "from-purple-950 via-black to-black", accent: "#A855F7", name: "purple" },
  { bg: "from-emerald-950 via-black to-black", accent: "#10B981", name: "emerald" },
  { bg: "from-blue-950 via-black to-black", accent: "#3B82F6", name: "blue" },
  { bg: "from-rose-950 via-black to-black", accent: "#FB7185", name: "rose" },
  { bg: "from-red-950 via-black to-black", accent: "#FF4D4D", name: "red" },
];

function fmt(m) {
  if (m >= 1000) return "\u00a3" + (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + "bn";
  return "\u00a3" + m.toLocaleString("en-GB") + "m";
}

function fmtFull(m) {
  if (m >= 1000) return "\u00a3" + (m * 1_000_000).toLocaleString("en-GB");
  return "\u00a3" + (m * 1_000_000).toLocaleString("en-GB");
}

// ── Data calculations ──────────────────────────────────
function useWrappedData() {
  return useMemo(() => {
    const projects = projectsData;

    // Active projects (In Progress) updated in Q1 2026
    const active = projects.filter(
      (p) => p.status === "In Progress"
    );
    const totalActiveSpend = active.reduce((s, p) => s + p.latestBudget, 0);
    const totalOverrun = active.reduce(
      (s, p) => s + Math.max(p.latestBudget - p.originalBudget, 0), 0
    );

    // Biggest overrun by percentage
    const overrunProjects = projects
      .filter((p) => p.status === "In Progress" && p.latestBudget > p.originalBudget && p.originalBudget > 0)
      .map((p) => ({
        ...p,
        overrunPct: ((p.latestBudget - p.originalBudget) / p.originalBudget) * 100,
        overrunAbs: p.latestBudget - p.originalBudget,
      }))
      .sort((a, b) => b.overrunPct - a.overrunPct);

    // Cancelled projects
    const cancelled = projects.filter((p) => p.status === "Cancelled");
    const totalCancelledWaste = cancelled.reduce((s, p) => s + p.latestBudget, 0);

    // Department rankings by waste (overruns + cancellation spend)
    const deptWaste = {};
    projects.forEach((p) => {
      const dept = p.department;
      if (!deptWaste[dept]) deptWaste[dept] = { dept, waste: 0, projects: 0, cancelled: 0 };
      if (p.status === "Cancelled") {
        deptWaste[dept].waste += p.latestBudget;
        deptWaste[dept].cancelled++;
      } else if (p.latestBudget > p.originalBudget) {
        deptWaste[dept].waste += (p.latestBudget - p.originalBudget);
      }
      deptWaste[dept].projects++;
    });
    const deptRanking = Object.values(deptWaste)
      .filter((d) => d.waste > 0)
      .sort((a, b) => b.waste - a.waste);

    // Contractor appearances on troubled projects
    const contractorCount = {};
    projects
      .filter((p) => p.status === "Cancelled" || p.latestBudget > p.originalBudget * 1.1)
      .forEach((p) => {
        (p.contractors || []).forEach((c) => {
          if (!contractorCount[c]) contractorCount[c] = { name: c, count: 0, projects: [] };
          contractorCount[c].count++;
          contractorCount[c].projects.push(p.name);
        });
      });
    const contractorRanking = Object.values(contractorCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Tax per person
    const wastePerTaxpayer = Math.round((totalOverrun * 1_000_000) / UK_TAXPAYERS);
    const cancelledPerTaxpayer = Math.round((totalCancelledWaste * 1_000_000) / UK_TAXPAYERS);

    // Civil service
    const csTotal = civilServiceData?.timeline?.[civilServiceData.timeline.length - 1];

    // Pothole equivalents of total waste (overruns + cancelled)
    const totalWaste = totalOverrun + totalCancelledWaste;
    const potholeEquiv = Math.round((totalWaste * 1e6) / 50);
    const nurseEquiv = Math.round((totalWaste * 1e6) / 35000);

    return {
      totalActiveSpend,
      totalOverrun,
      overrunProjects,
      cancelled,
      totalCancelledWaste,
      deptRanking,
      contractorRanking,
      wastePerTaxpayer,
      cancelledPerTaxpayer,
      totalWaste,
      potholeEquiv,
      nurseEquiv,
      csTotal,
      projectCount: projects.length,
      activeCount: active.length,
    };
  }, []);
}

// ── Build slides from data ─────────────────────────────
function useSlides(data) {
  return useMemo(() => {
    const top3Overrun = data.overrunProjects.slice(0, 3);
    const top3Dept = data.deptRanking.slice(0, 5);
    const top3Contractor = data.contractorRanking.slice(0, 3);

    return [
      // SLIDE 0: Intro / Total Spend
      {
        id: "intro",
        eyebrow: QUARTER_LABEL + " WRAPPED",
        headline: "Your government spent",
        bigNumber: fmt(data.totalActiveSpend),
        subline: "across " + data.activeCount + " active projects",
        detail: "That\u2019s " + fmtFull(data.totalActiveSpend) + " of public money currently in play.",
        footer: fmt(data.totalOverrun) + " over original budgets",
      },

      // SLIDE 1: Biggest Overrun
      {
        id: "overrun",
        eyebrow: "OVERRUN OF THE QUARTER",
        headline: top3Overrun[0]?.name || "",
        bigNumber: Math.round(top3Overrun[0]?.overrunPct || 0) + "%",
        bigNumberSuffix: "over budget",
        subline: top3Overrun[0]?.department || "",
        detail:
          fmt(top3Overrun[0]?.originalBudget || 0) + " budget \u2192 " +
          fmt(top3Overrun[0]?.latestBudget || 0) + " actual",
        list: top3Overrun.slice(1).map((p) => ({
          label: p.name,
          value: Math.round(p.overrunPct) + "% over",
        })),
        listTitle: "Runners up",
      },

      // SLIDE 2: Department Wall of Shame
      {
        id: "departments",
        eyebrow: "WALL OF SHAME",
        headline: "Worst departments",
        subline: "Ranked by total waste: overruns + cancellations",
        list: top3Dept.map((d, i) => ({
          label: (i + 1) + ". " + d.dept,
          value: fmt(d.waste),
          sub: d.cancelled > 0 ? d.cancelled + " cancelled" : d.projects + " projects",
        })),
      },

      // SLIDE 3: Cancellation Graveyard
      {
        id: "cancelled",
        eyebrow: "THE CANCELLATION GRAVEYARD",
        headline: fmt(data.totalCancelledWaste) + " wasted",
        subline: data.cancelled.length + " projects cancelled, nothing to show for it",
        detail: "That could have paid for " +
          data.nurseEquiv.toLocaleString("en-GB") + " nurses for a year, or " +
          data.potholeEquiv.toLocaleString("en-GB") + " pothole repairs.",
        list: data.cancelled
          .sort((a, b) => b.latestBudget - a.latestBudget)
          .slice(0, 4)
          .map((p) => ({ label: p.name, value: fmt(p.latestBudget) })),
        listTitle: "Biggest losses",
      },

      // SLIDE 4: Contractor Bingo
      {
        id: "contractors",
        eyebrow: "CONTRACTOR BINGO",
        headline: "Usual suspects",
        subline: "Companies appearing on the most troubled projects",
        list: top3Contractor.map((c, i) => ({
          label: (i + 1) + ". " + c.name,
          value: c.count + " projects",
          sub: c.projects.slice(0, 2).join(", "),
        })),
      },

      // SLIDE 5: Your Tax Receipt
      {
        id: "tax",
        eyebrow: "YOUR PERSONAL TAX RECEIPT",
        headline: "You paid",
        bigNumber: "\u00a3" + data.wastePerTaxpayer.toLocaleString("en-GB"),
        bigNumberSuffix: "towards overruns",
        subline: "Plus \u00a3" + data.cancelledPerTaxpayer.toLocaleString("en-GB") + " on cancelled projects",
        detail: "Every UK taxpayer contributed to " + fmt(data.totalWaste) + " of government waste this year.",
        footer: "Based on " + (UK_TAXPAYERS / 1_000_000).toFixed(1) + "m UK income tax payers",
      },
    ];
  }, [data]);
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
      <div className="bg-gray-950 border border-gray-800 max-w-lg w-full"
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
                <div key={i} className="flex items-baseline justify-between gap-4 border-b border-gray-800/40 pb-2">
                  <div className="text-sm sm:text-base text-gray-300 font-medium truncate flex-1 min-w-0">
                    {item.label}
                  </div>
                  <div className="text-sm sm:text-base font-bold whitespace-nowrap"
                    style={{ color: theme.accent }}>
                    {item.value}
                  </div>
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
