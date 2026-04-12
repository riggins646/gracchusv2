"use client";

import {
  useState, useMemo, useEffect,
  useRef, useCallback
} from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, ComposedChart,
  Treemap, ReferenceLine
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, AlertTriangle, Clock, Building2,
  ExternalLink, BarChart3, Users, Landmark, ArrowUpDown,
  Globe, Briefcase, PoundSterling, MapPin, ShieldAlert,
  Factory, ChevronDown, ChevronRight, ChevronLeft,
  RefreshCw, Activity, Trophy, Share2, Download, Copy, X,
  Scale, Hash, Home, Eye, Gift, Filter, Sparkles, Menu
} from "lucide-react";

// Module-level session token — shared between Dashboard (writes) and ChartCard (reads)
let _sessionToken = null;

import projectsData from "../data/projects.json";
import civilServiceData from "../data/civil-service.json";
import spendingData from "../data/spending.json";
import internationalData from "../data/international.json";
import contractsRaw from "../data/contracts-raw.json";
import suppliersSummary from "../data/suppliers-summary.json";
import cronyData from "../data/crony-contracts.json";
import prodImportsData from "../data/production-imports.json";
import econOutputData from "../data/economic-output.json";
import costOfLivingData from "../data/cost-of-living.json";
import consultancyRaw from "../data/consultancy-contracts.json";
import compareData from "../data/compare-data.json";
import structuralData from "../data/structural-performance.json";
import taxReceiptsData from "../data/tax-receipts.json";
import publicFinancesData from "../data/public-finances.json";
import energyData from "../data/energy.json";
import innovationData from "../data/innovation.json";
import govInnovationData from "../data/gov-innovation.json";
import defenceData from "../data/defence.json";
import lseMarketsData from "../data/lse-markets.json";
import apdData from "../data/apd.json";
import transportCompareData from "../data/transport-compare.json";
import dailyCostData from "../data/daily-cost-projects.json";
import planningData from "../data/planning-approvals.json";
import delaysData from "../data/delays-delivery.json";
import donationsData from "../data/political-donations.json";
import foreignAidData from "../data/foreign-aid.json";
import fcdoProgrammes from "../data/fcdo-programmes.json";
import mpInterestsData from "../data/mp-interests.json";
import lobbyingData from "../data/lobbying.json";
import publicFinancesFlowData from "../data/public-finances-flow.json";
import deptSpendingData from "../data/departmental-spending.json";
import spendingTreeData from "../data/spending-tree.json";
import giltYieldsData from "../data/gilt-yields.json";
import moneySupplyData from "../data/money-supply.json";
import mpPayVsCountryData from "../data/mp-pay-vs-country.json";
import { encodeShareId, buildContextLine, shareFmtAmt, renderCardToCanvas, renderTrendCard, renderChartShareCard, renderCancelledProjectCard } from "../lib/share-utils";
import { sortRows, searchRows, processTableData, fmtMillions, fmtCompact, fmtCurrency, fmtPct, getUniqueValues, SORT_PRESETS } from "../lib/table-utils";

const projects = projectsData;
const civilServiceTimeline = civilServiceData.timeline;
const departmentHeadcounts = civilServiceData.departments;
const payGrades = civilServiceData.payGrades;
const regionalData = civilServiceData.regional;
const welfareTimeline = spendingData.welfareTimeline;
const welfareBreakdown = spendingData.welfareBreakdown;
const deptSpending = spendingData.departmental;
const countryProfiles = internationalData.countries;
const spendByFunction = internationalData.spendByFunction;

const radarData = spendByFunction.map(d => ({
  subject: d.fn,
  UK: d.UK,
  France: d.France,
  Germany: d.Germany
}));

// HELPERS
// ============================================================================
const fmt = (m) => {
  if (m >= 1000) return "£" + (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + "bn";
  return "£" + m + "m";
};

const getOverrun = (p) => p.latestBudget - p.originalBudget;
const getOverrunPct = (p) => (
  p.originalBudget > 0
    ? (p.latestBudget - p.originalBudget) / p.originalBudget * 100
    : 0
);

const statusColors = {
  "Completed": {
    bg: "bg-emerald-900/30", text: "text-emerald-400", dot: "bg-emerald-400"
  },
  "In Progress": {
    bg: "bg-amber-900/30", text: "text-amber-400", dot: "bg-amber-400"
  },
  "In Development": {
    bg: "bg-blue-900/30", text: "text-blue-400", dot: "bg-blue-400"
  },
  "In Planning": {
    bg: "bg-blue-900/30", text: "text-blue-300", dot: "bg-blue-300"
  },
  "Cancelled": {
    bg: "bg-red-900/30", text: "text-red-400", dot: "bg-red-400"
  },
  "Compensation Ongoing": {
    bg: "bg-red-900/30", text: "text-red-400", dot: "bg-red-400"
  }
};

const categoryColors = {
  Transport: "#3b82f6",
  Defence: "#ef4444",
  IT: "#a855f7",
  Energy: "#f59e0b",
  Culture: "#ec4899",
  Buildings: "#6366f1",
  Infrastructure: "#14b8a6",
  Health: "#10b981",
  Housing: "#06b6d4"
};

const flagEmoji = { GB: "\uD83C\uDDEC\uD83C\uDDE7", FR: "\uD83C\uDDEB\uD83C\uDDF7", DE: "\uD83C\uDDE9\uD83C\uDDEA" };

// ============================================================================
// TIME-RANGE UTILITIES
// ============================================================================
const RANGE_OPTIONS = [
  { id: "2y", label: "2 Y", years: 2 },
  { id: "5y", label: "5 Y", years: 5 },
  { id: "10y", label: "10 Y", years: 10 },
  { id: "max", label: "Max", years: 999 }
];
const DEFAULT_RANGE = "5y";
const CURRENT_YEAR = 2026;

/**
 * Extract a numeric year from various date-key formats:
 *  "2024"        -> 2024
 *  2024          -> 2024
 *  "2024-25"     -> 2024  (fiscal year)
 *  "Jan 2024"    -> 2024  (month label)
 *  "Q1 2024"     -> 2024  (quarter label)
 *  "Q3 2024"     -> 2024
 */
function extractYear(key) {
  if (typeof key === "number") return key;
  const s = String(key);
  // fiscal year "2024-25"
  const fy = s.match(/^(\d{4})-\d{2}$/);
  if (fy) return parseInt(fy[1], 10);
  // "Q1 2024" or "Jan 2024"
  const qm = s.match(/(\d{4})\s*$/);
  if (qm) return parseInt(qm[1], 10);
  // plain year
  const py = s.match(/^(\d{4})$/);
  if (py) return parseInt(py[1], 10);
  return null;
}

/**
 * Filter a time-series array by range ID.
 * dateKey = the property name holding the date value.
 * rangeId = "2y" | "5y" | "10y" | "max"
 */
function filterByRange(data, dateKey, rangeId) {
  if (!data || !data.length) return data;
  const opt = RANGE_OPTIONS.find(
    (r) => r.id === rangeId
  );
  if (!opt || opt.years >= 999) return data;
  const cutoff = CURRENT_YEAR - opt.years;
  return data.filter((d) => {
    const y = extractYear(d[dateKey]);
    return y !== null && y >= cutoff;
  });
}

/**
 * Get min/max year from a dataset.
 */
function getDataBounds(data, dateKey) {
  if (!data || !data.length) {
    return { min: null, max: null };
  }
  let minY = Infinity;
  let maxY = -Infinity;
  data.forEach((d) => {
    const y = extractYear(d[dateKey]);
    if (y !== null) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });
  return {
    min: minY === Infinity ? null : minY,
    max: maxY === -Infinity ? null : maxY
  };
}

/**
 * Format a range string for display, e.g. "2000-2025"
 */
function fmtRange(data, dateKey) {
  const b = getDataBounds(data, dateKey);
  if (!b.min || !b.max) return "";
  if (b.min === b.max) return String(b.min);
  return b.min + "\u2013" + b.max;
}

// REUSABLE COMPONENTS
// ============================================================================
function StatusBadge({ status }) {
  const c = statusColors[status] || {
    bg: "bg-gray-800", text: "text-gray-400", dot: "bg-gray-400"
  };
  return (
    <span className={
      "inline-flex items-center gap-1.5 px-2.5 py-1 " +
      "rounded-full text-xs font-medium " +
      c.bg + " " + c.text
    }>
      <span className={"w-1.5 h-1.5 rounded-full " + c.dot} />
      {status}
    </span>
  );
}

const ACCENT_MAP = {
  red: "text-red-500",
  amber: "text-amber-400",
  blue: "text-blue-400",
  green: "text-green-500",
  cyan: "text-cyan-400",
  orange: "text-orange-400",
  emerald: "text-emerald-400",
};

function resolveAccent(accent) {
  if (!accent) return "text-white";
  if (accent.startsWith("text-")) return accent;
  return ACCENT_MAP[accent] || "text-white";
}

/* =========================================================
   WASTE SPOTLIGHT — rotating cancelled/overrun project
   ========================================================= */
function WasteSpotlight({ projects, onExplore, fmt }) {
  const spotlightProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p.status === "Cancelled" || (p.latestBudget - p.originalBudget) > 500)
      .sort((a, b) => b.latestBudget - a.latestBudget)
      .slice(0, 10);
  }, [projects]);

  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const current = spotlightProjects[spotlightIdx] || spotlightProjects[0];

  if (!current) return null;

  const overrun = current.latestBudget - current.originalBudget;
  const potholesEquiv = Math.round(overrun * 1e6 / 50);
  const nursesEquiv = Math.round(overrun * 1e6 / 35000);

  return (
    <div className="border-t border-gray-800/50 py-10">
      <div className={
        "text-[13px] uppercase tracking-[0.3em] " +
        "font-medium text-gray-600 mb-1"
      }>
        Waste Spotlight
      </div>
      <div className="text-[16px] text-gray-500 mb-6 leading-relaxed">
        Cancelled and over-budget projects — the money that disappeared
      </div>

      <div className="border border-gray-800/60 bg-gray-950/40">
        <div className={
          "px-5 py-3 border-b border-gray-800/60 " +
          "flex items-center justify-between"
        }>
          <div className={
            "text-[12px] uppercase tracking-[0.25em] " +
            "font-mono font-bold " +
            (current.status === "Cancelled" ? "text-red-500" : "text-amber-500")
          }>
            {current.status === "Cancelled" ? "Cancelled Project" : "Major Overrun"}
          </div>
          <div className={
            "text-[11px] uppercase tracking-[0.15em] " +
            "font-mono text-gray-700"
          }>
            {spotlightIdx + 1}/{spotlightProjects.length}
          </div>
        </div>
        <div className="px-5 py-6">
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
            {current.name}
          </div>
          <div className={
            "text-[11px] uppercase tracking-[0.15em] " +
            "text-gray-600 font-mono mb-4"
          }>
            {current.department}
          </div>
          <div className="flex flex-wrap gap-6 mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-700 font-mono mb-1">
                Money Spent
              </div>
              <div className="text-3xl font-black text-red-500">
                {fmt(current.latestBudget)}
              </div>
            </div>
            {overrun > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-gray-700 font-mono mb-1">
                  Over Budget
                </div>
                <div className="text-3xl font-black text-amber-500">
                  +{fmt(overrun)}
                </div>
              </div>
            )}
          </div>
          <div className="text-[14px] text-gray-500 leading-relaxed mb-4 border-l-2 border-gray-800 pl-3">
            That is equivalent to{" "}
            <span className="text-gray-300 font-semibold">
              {nursesEquiv.toLocaleString("en-GB")} nurses
            </span>{" "}
            for a year or{" "}
            <span className="text-gray-300 font-semibold">
              {potholesEquiv.toLocaleString("en-GB")} pothole repairs
            </span>.
          </div>
        </div>
        <div className="border-t border-gray-800/60 flex">
          <button
            onClick={() => setSpotlightIdx((i) => (i - 1 + spotlightProjects.length) % spotlightProjects.length)}
            className={
              "flex-1 px-4 py-3 text-[11px] uppercase " +
              "tracking-[0.15em] font-mono text-gray-600 " +
              "hover:text-white hover:bg-white/[0.03] " +
              "transition-colors border-r border-gray-800/60"
            }
          >
            {"<"} Prev
          </button>
          <button
            onClick={() => setSpotlightIdx((i) => (i + 1) % spotlightProjects.length)}
            className={
              "flex-1 px-4 py-3 text-[11px] uppercase " +
              "tracking-[0.15em] font-mono text-gray-600 " +
              "hover:text-white hover:bg-white/[0.03] " +
              "transition-colors border-r border-gray-800/60"
            }
          >
            Next {">"}
          </button>
          <button
            onClick={() => {
              const text =
                (current.status === "Cancelled" ? "CANCELLED: " : "OVER BUDGET: ") +
                current.name + " (" + current.department + ")" +
                "\n" + fmt(current.latestBudget) + " spent" +
                (overrun > 0 ? " — +" + fmt(overrun) + " over budget" : "") +
                "\n\nThat's " + nursesEquiv.toLocaleString("en-GB") + " nurses or " +
                potholesEquiv.toLocaleString("en-GB") + " pothole repairs" +
                "\n\nvia @GracchusHQ";
              window.open(
                "https://x.com/intent/post?text=" +
                encodeURIComponent(text) +
                "&url=" +
                encodeURIComponent(window.location.origin),
                "_blank",
                "noopener,noreferrer"
              );
            }}
            className={
              "flex-1 px-4 py-3 text-[11px] uppercase " +
              "tracking-[0.15em] font-mono text-gray-600 " +
              "hover:text-white hover:bg-white/[0.03] " +
              "transition-colors border-r border-gray-800/60 " +
              "flex items-center justify-center gap-1.5"
            }
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post
          </button>
          <button
            onClick={onExplore}
            className={
              "flex-1 px-4 py-3 text-[11px] uppercase " +
              "tracking-[0.15em] font-mono text-red-500 " +
              "hover:text-red-400 hover:bg-white/[0.03] " +
              "transition-colors"
            }
          >
            See All Projects {"\u2192"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LIVE BORROWING COUNTER — ticks in real time
   ========================================================= */
function BorrowingCounter({ annualBorrowingBn }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const dailyBorrowingGbp = (annualBorrowingBn * 1e9) / 365;
  const perMs = dailyBorrowingGbp / 86_400_000;

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 50);
    return () => clearInterval(id);
  }, []);

  const borrowed = Math.floor(elapsed * perMs);
  const debtInterestPerMs = ((annualBorrowingBn * 0.55) * 1e9) / 365 / 86_400_000;
  const interestPaid = Math.floor(elapsed * debtInterestPerMs);

  return (
    <div className={
      "border-t border-b border-gray-800/50 " +
      "py-5 my-2"
    }>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
        <div className="text-center">
          <div className={
            "text-[10px] uppercase tracking-[0.25em] " +
            "text-gray-600 font-mono mb-1.5"
          }>
            Borrowed Since You Opened This Page
          </div>
          <div className={
            "text-3xl sm:text-4xl font-black text-red-500 " +
            "tabular-nums tracking-tight"
          }>
            £{borrowed.toLocaleString("en-GB")}
          </div>
        </div>
        <div className="hidden sm:block w-px h-10 bg-gray-800/60" />
        <div className="text-center">
          <div className={
            "text-[10px] uppercase tracking-[0.25em] " +
            "text-gray-600 font-mono mb-1.5"
          }>
            Interest Paid On Debt
          </div>
          <div className={
            "text-3xl sm:text-4xl font-black text-amber-500 " +
            "tabular-nums tracking-tight"
          }>
            £{interestPaid.toLocaleString("en-GB")}
          </div>
        </div>
        <div className="hidden sm:block w-px h-10 bg-gray-800/60" />
        <div className="text-center">
          <div className={
            "text-[10px] uppercase tracking-[0.25em] " +
            "text-gray-600 font-mono mb-1.5"
          }>
            Borrowing Per Day
          </div>
          <div className={
            "text-xl sm:text-2xl font-black text-gray-300 " +
            "tabular-nums tracking-tight"
          }>
            £{Math.round(dailyBorrowingGbp / 1e6).toLocaleString("en-GB")}m
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-4">
        <button
          onClick={() => {
            const text =
              "The UK borrows £" +
              Math.round(dailyBorrowingGbp / 1e6).toLocaleString("en-GB") +
              "m EVERY DAY." +
              "\n\n55% of that goes straight to debt interest." +
              "\n\nSee it tick up in real time \u2193" +
              "\n\nvia @GracchusHQ";
            window.open(
              "https://x.com/intent/post?text=" +
              encodeURIComponent(text) +
              "&url=" +
              encodeURIComponent(window.location.origin),
              "_blank",
              "noopener,noreferrer"
            );
          }}
          className={
            "inline-flex items-center gap-1.5 " +
            "text-[10px] font-mono uppercase tracking-[0.15em] " +
            "text-gray-600 hover:text-white " +
            "border border-gray-800 hover:border-gray-600 " +
            "rounded-full px-3 py-1.5 " +
            "transition-all"
          }
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post This
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   LIVE TICKER STRIP — key indicators, colour-coded
   ========================================================= */
function LiveTickerStrip({ data }) {
  const statusColor = {
    good: "text-emerald-400",
    bad: "text-red-400",
    neutral: "text-gray-300"
  };
  return (
    <div className={
      "border-b border-gray-800/50 py-4 mb-2 " +
      "overflow-x-auto scrollbar-hide"
    }>
      <div className={
        "flex items-center justify-between " +
        "gap-6 min-w-max px-1"
      }>
        {data.map((item, i) => (
          <div key={i} className="text-center flex-1 min-w-[100px]">
            <div className={
              "text-[9px] uppercase tracking-[0.2em] " +
              "text-gray-700 font-mono mb-1"
            }>
              {item.label}
            </div>
            <div className={
              "text-[15px] sm:text-[17px] font-black " +
              "tabular-nums " +
              (statusColor[item.status] || "text-gray-300")
            }>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={
      "border-l-2 border-gray-800 pl-3 sm:pl-5 py-2 sm:py-3 " +
      "hover:border-gray-600 transition-colors"
    }>
      <div className="flex items-center gap-2 mb-1">
        <Icon
          size={12}
          className="text-gray-600"
        />
        <span className={
          "text-gray-500 text-[10px] " +
          "uppercase tracking-[0.15em] font-medium"
        }>
          {label}
        </span>
      </div>
      <div className={
        "text-xl sm:text-2xl font-bold tracking-tight " +
        resolveAccent(accent)
      }>
        {value}
      </div>
      {sub && (
        <div className="text-gray-600 text-xs mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, title, accent }) {
  return (
    <div className="mb-6">
      {label && (
        <div className={
          "text-[10px] uppercase tracking-[0.2em] " +
          "font-medium mb-2 " +
          (accent || "text-gray-500")
        }>
          {label}
        </div>
      )}
      <h2 className={
        "text-xl sm:text-2xl md:text-3xl font-black " +
        "uppercase tracking-tight"
      }>
        {title}
      </h2>
    </div>
  );
}

function ChartPair({ children }) {
  return (
    <div className={
      "grid grid-cols-1 md:grid-cols-2 " +
      "gap-3 sm:gap-4"
    }>
      {children}
    </div>
  );
}

function ChartCard({
  title, label, children, subtitle,
  info, editorial, shareHeadline,
  shareSubline, accentColor,
  onShare, shareData, explainData,
  chartId
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [drawer, setDrawer] = useState(null); // null | "explain" | "fix"
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [aiExplain, setAiExplain] = useState(null);
  const [aiFix, setAiFix] = useState(null);
  const infoRef = useRef(null);
  const chartRef = useRef(null);

  const buildPayload = () => ({
    title: title || "",
    label: label || "",
    data: explainData
      ? (typeof explainData === "string" ? explainData : JSON.stringify(explainData))
      : [title, subtitle, shareHeadline, shareSubline].filter(Boolean).join(" \u2014 "),
    editorial: editorial || subtitle || "",
    chartId: chartId || "",
  });

  const openDrawer = (mode) => {
    setDrawer(mode);
    requestAnimationFrame(() => setDrawerVisible(true));
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => setDrawer(null), 300);
  };

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Premium loading: even for cached responses, show the loading state
  // briefly (300–700ms) so it always feels like AI is working.
  const premiumDelay = () => new Promise(r => setTimeout(r, 300 + Math.random() * 400));

  const handleExplain = async () => {
    if (drawer === "explain") { closeDrawer(); return; }
    openDrawer("explain");
    if (aiExplain) return;
    setAiExplain("loading");
    try {
      const fetchStart = Date.now();
      const headers = { "Content-Type": "application/json" };
      if (_sessionToken) headers["X-Session-Token"] = _sessionToken;
      const res = await fetch("/api/explain", {
        method: "POST",
        headers,
        body: JSON.stringify(buildPayload())
      });
      if (res.status === 429) {
        setAiExplain({ error: "Too many requests — please wait a minute and try again" });
        return;
      }
      const body = await res.json();
      const result = body.error ? { error: body.error } : { text: body.explanation };
      // If response was instant (cache hit), wait so it still feels premium
      const elapsed = Date.now() - fetchStart;
      if (elapsed < 300) await premiumDelay();
      setAiExplain(result);
    } catch (e) {
      setAiExplain({ error: "Could not reach AI service" });
    }
  };

  const handleFix = async () => {
    if (drawer === "fix") { closeDrawer(); return; }
    openDrawer("fix");
    if (aiFix) return;
    setAiFix("loading");
    try {
      const fetchStart = Date.now();
      const headers = { "Content-Type": "application/json" };
      if (_sessionToken) headers["X-Session-Token"] = _sessionToken;
      const res = await fetch("/api/fix", {
        method: "POST",
        headers,
        body: JSON.stringify(buildPayload())
      });
      if (res.status === 429) {
        setAiFix({ error: "Too many requests — please wait a minute and try again" });
        return;
      }
      const body = await res.json();
      const result = body.error ? { error: body.error } : { text: body.fix };
      const elapsed = Date.now() - fetchStart;
      if (elapsed < 300) await premiumDelay();
      setAiFix(result);
    } catch (e) {
      setAiFix({ error: "Could not reach AI service" });
    }
  };

  const renderInlineBold = (str) => {
    const parts = str.split(/(\*\*.+?\*\*)/g);
    return parts.map((part, i) => {
      const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) {
        return <strong key={i} className="text-white font-semibold">{boldMatch[1]}</strong>;
      }
      return part;
    });
  };

  const renderFixContent = (text) => {
    const sections = [];
    const lines = text.split("\n");
    let currentSection = null;
    lines.forEach((line) => {
      const headerMatch = line.match(/^\*\*(.+?)\*\*$/);
      if (headerMatch) {
        currentSection = { title: headerMatch[1], bullets: [], body: [] };
        sections.push(currentSection);
      } else if (currentSection) {
        const bulletMatch = line.match(/^[-\u2022\u25B8]\s*(.+)/);
        if (bulletMatch) {
          currentSection.bullets.push(bulletMatch[1]);
        } else if (line.trim()) {
          currentSection.body.push(line.trim());
        }
      } else if (line.trim()) {
        sections.push({ title: null, bullets: [], body: [line.trim()] });
      }
    });

    return sections.map((sec, i) => (
      <div key={i} className={i > 0 ? "mt-6" : ""}>
        {sec.title && (
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-400/80 mb-2">
            {sec.title}
          </h4>
        )}
        {sec.body.length > 0 && (
          <p className="text-[15px] leading-[1.7] text-gray-300 mb-2">
            {renderInlineBold(sec.body.join(" "))}
          </p>
        )}
        {sec.bullets.length > 0 && (
          <div className="space-y-2.5 mt-2">
            {sec.bullets.map((b, j) => (
              <div key={j} className="flex gap-3 items-start rounded-lg bg-gray-800/30 border border-gray-800/50 px-3.5 py-3">
                <span className="text-amber-500/70 text-[14px] leading-none mt-0.5 shrink-0">{"\u25B8"}</span>
                <span className="text-[15px] leading-[1.65] text-gray-300">{renderInlineBold(b)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  const isExplain = drawer === "explain";
  const isFix = drawer === "fix";
  const accent = isExplain ? "purple" : "amber";
  const aiData = isExplain ? aiExplain : aiFix;

  return (
    <div className={
      "py-1 border border-gray-800/40 " +
      "bg-gray-950/20 px-2 sm:px-4 pb-3 sm:pb-4 pt-2 sm:pt-3"
    }>
      <div className={
        "flex items-start justify-between " +
        "mb-2"
      }>
        <div className="flex-1 min-w-0">
          {label && (
            <div className={
              "text-[10px] uppercase " +
              "tracking-[0.2em] " +
              "font-medium text-gray-600 mb-0.5"
            }>
              {label}
            </div>
          )}
          {title && (
            <h3 className={
              "text-[14px] font-bold " +
              "text-gray-300 " +
              "leading-tight"
            }>
              {title}
            </h3>
          )}
        </div>
        <div className={
          "flex items-center gap-1 sm:gap-1.5 " +
          "shrink-0 ml-1 sm:ml-2 mt-0.5 flex-wrap"
        }>
          <button
            onClick={handleExplain}
            className={
              "flex items-center gap-1 px-2 py-1 rounded " +
              "text-[10px] font-mono uppercase tracking-wide " +
              "border transition-all " +
              (drawer === "explain"
                ? "border-purple-500/50 text-purple-400 bg-purple-500/10"
                : "border-gray-700 text-gray-500 hover:text-purple-400 hover:border-purple-500/40")
            }
            aria-label="AI explanation"
          >
            <Sparkles size={11} />
            <span>Explain</span>
          </button>
          <button
            onClick={handleFix}
            className={
              "flex items-center gap-1 px-2 py-1 rounded " +
              "text-[10px] font-mono uppercase tracking-wide " +
              "border transition-all " +
              (drawer === "fix"
                ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                : "border-gray-700 text-gray-500 hover:text-amber-400 hover:border-amber-500/40")
            }
            aria-label="AI fix suggestions"
          >
            <Sparkles size={11} />
            <span className="hidden md:inline">What{"\u2019"}s the fix?</span>
            <span className="hidden sm:inline md:hidden">The fix?</span>
            <span className="sm:hidden">Fix?</span>
          </button>
          {info && (
            <div
              className="relative"
              ref={infoRef}
            >
              <button
                onMouseEnter={() =>
                  setShowInfo(true)
                }
                onMouseLeave={() =>
                  setShowInfo(false)
                }
                onClick={() =>
                  setShowInfo(!showInfo)
                }
                className={
                  "w-5 h-5 rounded-full " +
                  "border border-gray-700 " +
                  "flex items-center " +
                  "justify-center " +
                  "text-[10px] font-bold " +
                  "text-gray-600 " +
                  "hover:text-gray-400 " +
                  "hover:border-gray-500 " +
                  "transition-colors"
                }
                aria-label="Chart info"
              >
                i
              </button>
              {showInfo && (
                <div className={
                  "absolute right-0 top-7 " +
                  "z-40 w-64 " +
                  "bg-gray-950 border " +
                  "border-gray-700 " +
                  "shadow-xl px-3 py-2.5"
                }>
                  <div className={
                    "text-[11px] text-gray-400 " +
                    "leading-relaxed"
                  }>
                    {info}
                  </div>
                </div>
              )}
            </div>
          )}
          {shareHeadline && (
            <button
              onClick={async () => {
                if (!onShare) return;
                let chartCanvas = null;
                try {
                  const svgEl = chartRef.current?.querySelector("svg");
                  if (svgEl) {
                    const clone = svgEl.cloneNode(true);
                    const w = svgEl.clientWidth || svgEl.getBoundingClientRect().width;
                    const h = svgEl.clientHeight || svgEl.getBoundingClientRect().height;
                    clone.setAttribute("width", w);
                    clone.setAttribute("height", h);
                    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                    // Inline computed styles on text elements so fonts render in isolated SVG
                    const origTexts = svgEl.querySelectorAll("text, tspan");
                    const cloneTexts = clone.querySelectorAll("text, tspan");
                    origTexts.forEach((orig, i) => {
                      if (cloneTexts[i]) {
                        const cs = window.getComputedStyle(orig);
                        cloneTexts[i].style.fontFamily = cs.fontFamily;
                        cloneTexts[i].style.fontSize = cs.fontSize;
                        cloneTexts[i].style.fontWeight = cs.fontWeight;
                        cloneTexts[i].style.fill = cs.fill || orig.getAttribute("fill") || "#666";
                      }
                    });
                    const svgStr = new XMLSerializer().serializeToString(clone);
                    const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
                    const img = await new Promise((resolve, reject) => {
                      const i = new Image();
                      i.onload = () => resolve(i);
                      i.onerror = reject;
                      i.src = svgDataUrl;
                    });
                    const c = document.createElement("canvas");
                    const scale = 2;
                    c.width = w * scale;
                    c.height = h * scale;
                    const cx = c.getContext("2d");
                    cx.scale(scale, scale);
                    cx.drawImage(img, 0, 0, w, h);
                    chartCanvas = c;
                  }
                } catch (e) {
                  console.warn("Chart capture failed:", e);
                }
                onShare({
                  title,
                  headline: shareHeadline,
                  subline: shareSubline || "",
                  accent: accentColor || "#ef4444",
                  sparkline: shareData || [],
                  chartCanvas
                });
              }}
              className={
                "flex items-center gap-1 px-2 py-1 rounded " +
                "text-[10px] font-mono uppercase tracking-wide " +
                "border border-gray-700 text-gray-500 " +
                "hover:text-gray-300 hover:border-gray-500 " +
                "transition-all"
              }
              aria-label="Share chart"
            >
              <Share2 size={11} />
              <span>Share</span>
            </button>
          )}
        </div>
      </div>
      {editorial && (
        <div className={
          "text-[13px] text-gray-400 " +
          "leading-snug mb-3 " +
          "border-l-2 border-gray-700/60 " +
          "pl-3 italic"
        }>
          {editorial}
        </div>
      )}
      <div ref={chartRef}>{children}</div>

      {/* Slide-over drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              backgroundColor: drawerVisible ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)",
              backdropFilter: drawerVisible ? "blur(4px)" : "none"
            }}
          />
          {/* Panel */}
          <div
            className={
              "absolute top-0 right-0 h-full " +
              "w-full sm:w-[75vw] md:w-[480px] lg:w-[500px] " +
              "bg-[#0d0d14] border-l-2 border-gray-700/50 " +
              "shadow-[-8px_0_30px_rgba(0,0,0,0.7)] " +
              "flex flex-col " +
              "transition-transform duration-300 ease-out"
            }
            style={{
              transform: drawerVisible ? "translateX(0)" : "translateX(100%)"
            }}
          >
            {/* Header */}
            <div className={
              "shrink-0 px-6 pt-5 pb-4 " +
              "border-b border-gray-800/60"
            }>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className={isExplain ? "text-purple-400" : "text-amber-400"} />
                    <span className={
                      "text-[10px] font-mono uppercase tracking-[0.2em] " +
                      (isExplain ? "text-purple-400/70" : "text-amber-400/70")
                    }>
                      {isExplain ? "Analysis" : "Gracchus AI"}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold text-white leading-snug">
                    {title || "Chart Insight"}
                  </h3>
                  {label && (
                    <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide">
                      {label}
                    </div>
                  )}
                </div>
                <button
                  onClick={closeDrawer}
                  className={
                    "w-8 h-8 rounded-lg flex items-center justify-center " +
                    "text-gray-500 hover:text-white " +
                    "hover:bg-gray-800 transition-all ml-3 mt-0.5"
                  }
                  aria-label="Close panel"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Tab switcher */}
              <div className="flex gap-1 mt-4">
                <button
                  onClick={() => { if (drawer !== "explain") handleExplain(); }}
                  className={
                    "px-3 py-1.5 rounded text-[11px] font-medium transition-all " +
                    (isExplain
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                      : "text-gray-500 hover:text-gray-300 border border-transparent")
                  }
                >
                  Explain
                </button>
                <button
                  onClick={() => { if (drawer !== "fix") handleFix(); }}
                  className={
                    "px-3 py-1.5 rounded text-[11px] font-medium transition-all " +
                    (isFix
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "text-gray-500 hover:text-gray-300 border border-transparent")
                  }
                >
                  What{"\u2019"}s the fix?
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {aiData === "loading" && (
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <div className="gracchus-loading-text flex flex-col items-center gap-5 text-center px-6">
                    {/* Spinner */}
                    <div className="relative">
                      <div className={
                        "w-10 h-10 rounded-full border-[2.5px] border-t-transparent gracchus-spinner " +
                        (isExplain ? "border-purple-400/60" : "border-amber-400/60")
                      } />
                      <div className={
                        "absolute inset-0 w-10 h-10 rounded-full gracchus-glow " +
                        (isExplain ? "bg-purple-500/10" : "bg-amber-500/10")
                      } />
                    </div>
                    {/* Microcopy */}
                    <p className={
                      "text-[18px] leading-relaxed font-light tracking-wide gracchus-shimmer-text " +
                      (isExplain ? "purple" : "")
                    }>
                      {isExplain ? "Finding the story behind the chart" : "Trying to fix what Whitehall couldn\u2019t"}
                    </p>
                    {/* Pulsing ellipsis */}
                    <div className="flex gap-1 -mt-3">
                      <span className={"gracchus-loading-dot text-[18px] " + (isExplain ? "text-purple-400" : "text-amber-400")}>{"."}</span>
                      <span className={"gracchus-loading-dot text-[18px] " + (isExplain ? "text-purple-400" : "text-amber-400")}>{"."}</span>
                      <span className={"gracchus-loading-dot text-[18px] " + (isExplain ? "text-purple-400" : "text-amber-400")}>{"."}</span>
                    </div>
                  </div>
                </div>
              )}
              {aiData && aiData !== "loading" && aiData.error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                  <p className="text-[14px] text-red-400">{aiData.error}</p>
                </div>
              )}
              {aiData && aiData !== "loading" && aiData.text && isExplain && (
                <div>
                  <p className="text-[15px] leading-[1.75] text-gray-300">
                    {aiData.text}
                  </p>
                </div>
              )}
              {aiData && aiData !== "loading" && aiData.text && isFix && (
                <div>
                  {renderFixContent(aiData.text)}
                </div>
              )}
            </div>

            {/* Footer */}
            {isFix && aiData && aiData !== "loading" && aiData.text && (
              <div className={
                "shrink-0 px-6 py-3 border-t border-gray-800/40"
              }>
                <p className="text-[11px] text-gray-600 italic">
                  AI-generated ideas for discussion and engagement, not policy recommendations.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, renderFn }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={
      "bg-gray-950 border border-gray-800 " +
      "rounded p-3 shadow-2xl text-sm"
    }>
      {renderFn(payload[0].payload, payload)}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-800/60 my-6 sm:my-10" />;
}

// ============================================================================
// STANDARDISED TABLE SYSTEM
// ============================================================================

function QuickViewBar({ presets, active, onSelect }) {
  if (!presets || presets.length === 0) return null;
  return (
    <div className={
      "flex flex-wrap items-center gap-1.5 py-3"
    }>
      <div className={
        "text-[9px] text-gray-600 font-mono " +
        "uppercase tracking-[0.15em] mr-1"
      }>
        Screen:
      </div>
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className={
            "text-[10px] font-mono uppercase " +
            "tracking-[0.08em] px-2.5 py-1.5 " +
            "border transition-colors " +
            (active === p.id
              ? "border-gray-600 text-white " +
                "bg-white/[0.04]"
              : "border-gray-800 text-gray-600 " +
                "hover:text-gray-400 " +
                "hover:border-gray-700")
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/**
 * SortPillGroup — sort column pills (existing pattern,
 * now standardised).
 * Props:
 *   options: [{ id, label }]
 *   sortBy: string
 *   sortDir: "asc" | "desc"
 *   onSort: (id) => void
 */
function SortPillGroup({
  options, sortBy, sortDir, onSort
}) {
  return (
    <div className={
      "flex flex-wrap items-center gap-1.5"
    }>
      <div className={
        "text-[9px] text-gray-600 font-mono " +
        "uppercase tracking-[0.15em]"
      }>
        Sort:
      </div>
      {options.map((s) => (
        <button
          key={s.id}
          onClick={() => onSort(s.id)}
          className={
            "text-[10px] font-mono uppercase " +
            "tracking-[0.1em] px-2.5 py-1.5 " +
            "border transition-colors " +
            (sortBy === s.id
              ? "border-gray-600 text-white " +
                "bg-white/[0.03]"
              : "border-gray-800 text-gray-600 " +
                "hover:text-gray-400 " +
                "hover:border-gray-700")
          }
        >
          {s.label}
          {sortBy === s.id && (
            <span className="ml-1">
              {sortDir === "desc"
                ? "\u2193" : "\u2191"}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * FilterBar — standardised filter/search/sort area.
 * Props:
 *   search: { value, onChange, placeholder }
 *   filters: [{ value, onChange, options:
 *     [{ value, label }], label }]
 *   sortPills: { options, sortBy, sortDir, onSort }
 *   onClear: () => void (if any filter active)
 *   hasActiveFilters: boolean
 *   children: extra controls (e.g. view-mode toggle)
 */
function FilterBar({
  search, filters, sortPills, onClear,
  hasActiveFilters, children
}) {
  return (
    <div className={
      "border-b border-gray-800/40 pb-4 mb-4 " +
      "space-y-3"
    }>
      <div className={
        "flex flex-wrap items-center gap-3"
      }>
        {search && (
          <div className={
            "relative flex-1 min-w-0 sm:min-w-[200px] max-w-full sm:max-w-xs"
          }>
            <Search
              size={13}
              className={
                "absolute left-3 top-1/2 " +
                "-translate-y-1/2 text-gray-600"
              }
            />
            <input
              value={search.value}
              onChange={(e) =>
                search.onChange(e.target.value)
              }
              maxLength={100}
              placeholder={
                search.placeholder || "Search..."
              }
              className={
                "w-full bg-transparent border " +
                "border-gray-800 text-sm " +
                "text-gray-300 pl-9 pr-3 py-2 " +
                "placeholder:text-gray-700 " +
                "focus:outline-none " +
                "focus:border-gray-600 font-mono"
              }
            />
          </div>
        )}
        {filters && filters.map((f, i) => (
          <select
            key={i}
            value={f.value}
            onChange={(e) =>
              f.onChange(e.target.value)
            }
            className={
              "bg-black border border-gray-800 " +
              "text-gray-400 text-xs px-2 " +
              "py-2 font-mono focus:outline-none " +
              "focus:border-gray-600 " +
              "min-w-0 max-w-full"
            }
          >
            {f.options.map((o) => (
              <option
                key={typeof o === "string"
                  ? o : o.value}
                value={typeof o === "string"
                  ? o : o.value}
              >
                {typeof o === "string"
                  ? o : o.label}
              </option>
            ))}
          </select>
        ))}
        {hasActiveFilters && onClear && (
          <button
            onClick={onClear}
            className={
              "text-[10px] uppercase " +
              "tracking-[0.1em] text-gray-600 " +
              "hover:text-gray-400 px-2 py-1"
            }
          >
            Clear filters
          </button>
        )}
        {children}
      </div>
      {sortPills && (
        <SortPillGroup
          options={sortPills.options}
          sortBy={sortPills.sortBy}
          sortDir={sortPills.sortDir}
          onSort={sortPills.onSort}
        />
      )}
    </div>
  );
}

/**
 * SummaryStrip — dynamic totals bar above table.
 * Props:
 *   metrics: [{ label, value, red? }]
 *   cols: number (grid cols, default 5)
 */
function SummaryStrip({ metrics, cols }) {
  const gridCls = cols === 4
    ? "grid-cols-2 md:grid-cols-4"
    : cols === 3
      ? "grid-cols-3"
      : "grid-cols-2 md:grid-cols-5";
  return (
    <div className={
      "border-t border-b border-gray-800/50 " +
      "py-5 grid " + gridCls + " gap-4"
    }>
      {metrics.map((m) => (
        <div
          key={m.label}
          className={
            "border-l-2 pl-3 " +
            (m.red
              ? "border-red-500/50"
              : "border-gray-700")
          }
        >
          <div className={
            "text-[9px] uppercase " +
            "tracking-[0.15em] text-gray-600 " +
            "font-mono"
          }>
            {m.label}
          </div>
          <div className={
            "text-xl font-black mt-0.5 " +
            (m.red
              ? "text-red-500"
              : "text-white")
          }>
            {m.value}
          </div>
          {m.sub && (
            <div className={
              "text-[10px] text-gray-600 mt-0.5"
            }>
              {m.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * TableHeader — standardised column header row.
 * Props:
 *   columns: [{ key, label, span, align?,
 *     sortable? }]
 *   sortBy, sortDir: current sort state
 *   onSort: (key) => void
 */
function TableHeader({
  columns, sortBy, sortDir, onSort
}) {
  return (
    <div className={
      "min-w-[640px] grid grid-cols-12 gap-2 " +
      "px-4 py-3 border-b border-gray-800/40 " +
      "text-[9px] uppercase tracking-[0.15em] " +
      "text-gray-600 font-mono"
    }>
      {columns.map((col) => (
        <div
          key={col.key}
          className={
            "col-span-" + (col.span || 1) +
            (col.align === "right"
              ? " text-right" : "") +
            (col.sortable
              ? " cursor-pointer " +
                "hover:text-gray-400"
              : "")
          }
          onClick={
            col.sortable && onSort
              ? () => onSort(col.key)
              : undefined
          }
        >
          {col.label}
          {col.sortable && sortBy === col.key && (
            <span className="ml-1">
              {sortDir === "desc"
                ? "\u25BC" : "\u25B2"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * TotalsFooter — standardised totals row.
 * Props:
 *   cells: [{ span, content, align?, bold?,
 *     className? }]
 */
function TotalsFooter({ cells }) {
  if (!cells || cells.length === 0) return null;
  return (
    <div className={
      "min-w-[640px] grid grid-cols-12 gap-2 " +
      "px-4 py-2.5 text-xs font-mono " +
      "border-t border-gray-700/60 " +
      "bg-white/[0.02]"
    }>
      {cells.map((c, i) => (
        <div
          key={i}
          className={
            "col-span-" + (c.span || 1) +
            (c.align === "right"
              ? " text-right" : "") +
            (c.bold
              ? " font-bold text-white"
              : " text-gray-500") +
            (c.className ? " " + c.className : "")
          }
        >
          {c.content}
        </div>
      ))}
    </div>
  );
}

/**
 * DataTableShell — full table wrapper combining
 * header, scrollable body, totals footer.
 * Props:
 *   columns: for TableHeader
 *   sortBy, sortDir, onSort
 *   totals: cells for TotalsFooter
 *   emptyMessage: string
 *   count: number of rows (to show empty state)
 *   csvExport: { filename, headers, rows } for CSV download
 *   children: table rows
 */
function exportCSV({ filename, headers, rows }) {
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const csv = [headers.map(escape).join(",")]
    .concat(rows.map((r) => r.map(escape).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (filename || "export") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function DataTableShell({
  columns, sortBy, sortDir, onSort,
  totals, emptyMessage, count, children,
  csvExport
}) {
  return (
    <div className={
      "border-t border-gray-800/60 " +
      "overflow-x-auto relative"
    }>
      {csvExport && count > 0 && (
        <div className="flex justify-end px-3 py-2">
          <button
            onClick={() => exportCSV(csvExport)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      )}
      <TableHeader
        columns={columns}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
      />
      <div>
        {children}
        {count === 0 && (
          <div className={
            "text-center py-12 text-gray-700 " +
            "text-xs font-mono"
          }>
            {emptyMessage ||
              "No data matches your filters"}
          </div>
        )}
      </div>
      {count > 0 && (
        <TotalsFooter cells={totals} />
      )}
    </div>
  );
}

/**
 * MethodologyNote — standard methodology panel.
 * Props: title, children (note content)
 */
function MethodologyNote({ title, children }) {
  return (
    <div className={
      "border-l-2 border-gray-800 pl-4 py-2 mb-6"
    }>
      {title && (
        <div className={
          "text-[9px] uppercase " +
          "tracking-[0.2em] text-gray-600 " +
          "font-mono mb-1"
        }>
          {title}
        </div>
      )}
      <div className={
        "text-[11px] text-gray-500 leading-relaxed"
      }>
        {children}
      </div>
    </div>
  );
}

/**
 * SourcesFooter — standard sources strip.
 * Props: children (source text)
 */
function SourcesFooter({ children }) {
  return (
    <div className={
      "border-t border-gray-800/40 pt-6 pb-2 " +
      "text-gray-600 text-xs leading-relaxed"
    }>
      <div>
        <strong className="text-gray-500">
          Sources:
        </strong>{" "}
        {children}
      </div>
    </div>
  );
}

/**
 * PageHeader — standard page heading with breadcrumb,
 * title, and description.
 * Props: breadcrumb?, breadcrumbAction?, title,
 *        description?
 */
function PageHeader({
  eyebrow, breadcrumb, breadcrumbAction,
  title, description, dataAsOf
}) {
  return (
    <div className="py-6 mb-4">
      {breadcrumb && (
        <button
          onClick={breadcrumbAction}
          className={
            "text-[10px] uppercase " +
            "tracking-[0.2em] font-medium " +
            "text-gray-600 mb-2 flex " +
            "items-center gap-1 " +
            "hover:text-gray-400 " +
            "transition-colors"
          }
        >
          {breadcrumb}
        </button>
      )}
      {!breadcrumb && eyebrow && (
        <div className={
          "text-[10px] uppercase " +
          "tracking-[0.2em] font-medium " +
          "text-gray-600 mb-2"
        }>
          {eyebrow}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className={
          "text-2xl md:text-3xl font-black " +
          "uppercase tracking-tight"
        }>
          {title}
        </h2>
        {dataAsOf && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-gray-800/60 text-gray-500 border border-gray-800/40">
            <RefreshCw size={9} /> Data as of {dataAsOf}
          </span>
        )}
      </div>
      {description && (
        <p className={
          "text-gray-500 text-sm mt-2"
        }>
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * CompareTable — standardised data table for international
 * comparison views. Consistent styling across all compare
 * sections (infrastructure, bills, fuel, transport, defence).
 * Props:
 *   headers: string[]
 *   data: object[]
 *   renderRow: (item, index) => React element
 *   highlightCountry: string (e.g. "UK" to highlight)
 */
function CompareTable({ headers, data, renderRow, highlightCountry }) {
  return (
    <div className="overflow-x-auto border-t border-gray-800/40">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-800">
            {headers.map((h) => (
              <th
                key={h}
                className={
                  "px-3 py-3 text-[9px] uppercase " +
                  "tracking-[0.15em] text-gray-600 " +
                  "font-mono font-medium"
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => renderRow(item, i))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Page-level time-range segmented control.
 * Props: range, setRange
 */
function TimeRangeControl({ range, setRange }) {
  return (
    <div className={
      "flex items-center gap-1 " +
      "border border-gray-800/60 " +
      "rounded p-0.5 w-fit"
    }>
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setRange(opt.id)}
          className={
            "px-3 py-1 text-[10px] " +
            "uppercase tracking-[0.12em] " +
            "font-semibold transition-colors " +
            "rounded-sm " +
            (range === opt.id
              ? "bg-gray-800 text-white"
              : "text-gray-600 " +
                "hover:text-gray-400")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Chart metadata label block.
 * Shows metric, geography, unit, date range, source.
 * Props: metric, geo, unit, data, dateKey, source,
 *        freq ("annual"|"quarterly"|"monthly"),
 *        fullData (optional, for "available" range)
 */
function ChartMeta({
  metric, geo, unit, data, dateKey,
  source, freq, fullData
}) {
  const displayed = fmtRange(data, dateKey);
  const full = fullData
    ? fmtRange(fullData, dateKey)
    : null;
  const freqLabel = freq === "quarterly"
    ? "quarterly"
    : freq === "monthly"
      ? "monthly"
      : "annual";
  return (
    <div className={
      "flex flex-wrap items-baseline gap-x-3 " +
      "gap-y-0.5 text-[10px] text-gray-600 " +
      "uppercase tracking-[0.1em] mb-3"
    }>
      {metric && (
        <span className="text-gray-400 font-medium">
          {metric}
        </span>
      )}
      {geo && <span>{geo}</span>}
      {unit && <span>{unit}</span>}
      {freq && <span>{freqLabel}</span>}
      {displayed && (
        <span>{displayed}</span>
      )}
      {full && full !== displayed && (
        <span className="text-gray-700">
          (available: {full})
        </span>
      )}
      {source && (
        <span className="text-gray-700">
          {source}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// EQUIVALENT SPEND — dataset, generator, component
// ============================================================================
const EQUIV_SPEND_ITEMS = [
  {
    id: "nurses", name: "Nurses",
    category: "health",
    unitCost: 35000,
    unitLabel: "nurses for a year",
    weight: 10,
    notes: "NHS Band 5 starting salary"
  },
  {
    id: "gps", name: "GPs",
    category: "health",
    unitCost: 100000,
    unitLabel: "GPs for a year",
    weight: 8,
    notes: "Salaried GP average"
  },
  {
    id: "paramedics", name: "Paramedics",
    category: "health",
    unitCost: 38000,
    unitLabel: "paramedics for a year",
    weight: 6,
    notes: "NHS Band 6 typical"
  },
  {
    id: "gp-appointments",
    name: "GP Appointments",
    category: "health",
    unitCost: 42,
    unitLabel: "GP appointments",
    weight: 7,
    notes: "Average cost per consultation"
  },
  {
    id: "ambulances", name: "Ambulances",
    category: "health",
    unitCost: 250000,
    unitLabel: "new ambulances",
    weight: 5,
    notes: "Fully equipped emergency ambulance"
  },
  {
    id: "mri-scans", name: "MRI Scans",
    category: "health",
    unitCost: 200,
    unitLabel: "MRI scans",
    weight: 6,
    notes: "NHS reference cost"
  },
  {
    id: "cancer-treatments",
    name: "Cancer Treatments",
    category: "health",
    unitCost: 30000,
    unitLabel: "cancer treatment courses",
    weight: 7,
    notes: "Average per-patient treatment"
  },
  {
    id: "nhs-operations",
    name: "NHS Operations",
    category: "health",
    unitCost: 7000,
    unitLabel: "NHS operations",
    weight: 5,
    notes: "Average elective procedure"
  },
  {
    id: "cancer-research",
    name: "Cancer Research Grants",
    category: "health",
    unitCost: 150000,
    unitLabel: "cancer research grants",
    weight: 5,
    notes: "Typical CRUK project grant"
  },
  {
    id: "mental-health",
    name: "Mental Health Workers",
    category: "health",
    unitCost: 40000,
    unitLabel: "mental health workers for a year",
    weight: 5,
    notes: "NHS Band 6 mental health nurse"
  },
  {
    id: "midwives", name: "Midwives",
    category: "health",
    unitCost: 36000,
    unitLabel: "midwives for a year",
    weight: 5,
    notes: "NHS Band 5/6 midwifery"
  },
  {
    id: "potholes", name: "Pothole Repairs",
    category: "infrastructure",
    unitCost: 100,
    unitLabel: "pothole repairs",
    weight: 10,
    notes: "Average council pothole fix"
  },
  {
    id: "council-homes",
    name: "Council Homes",
    category: "infrastructure",
    unitCost: 200000,
    unitLabel: "new council homes",
    weight: 7,
    notes: "Average social housing build cost"
  },
  {
    id: "ev-chargers",
    name: "EV Charging Points",
    category: "infrastructure",
    unitCost: 40000,
    unitLabel: "public EV charging points",
    weight: 5,
    notes: "Rapid charger install cost"
  },
  {
    id: "childcare-hours",
    name: "Childcare Hours",
    category: "education",
    unitCost: 6,
    unitLabel: "funded childcare hours",
    weight: 6,
    notes: "Government early years rate/hr"
  },
  {
    id: "school-meals",
    name: "School Meals",
    category: "education",
    unitCost: 2.53,
    unitLabel: "free school meals",
    weight: 6,
    notes: "UIFSM funding rate per meal"
  },
  {
    id: "tuition",
    name: "Tuition Fees",
    category: "education",
    unitCost: 9250,
    unitLabel: "years of university tuition",
    weight: 9,
    notes: "Annual undergraduate fee cap"
  },
  {
    id: "full-degrees",
    name: "Full Degrees",
    category: "education",
    unitCost: 27750,
    unitLabel: "full university degrees",
    weight: 6,
    notes: "Three years at 9,250/yr"
  },
  {
    id: "teachers", name: "Teachers",
    category: "education",
    unitCost: 38000,
    unitLabel: "teachers for a year",
    weight: 8,
    notes: "Average teacher salary England"
  },
  {
    id: "classroom-upgrades",
    name: "Classroom Upgrades",
    category: "education",
    unitCost: 150000,
    unitLabel: "classroom refurbishments",
    weight: 4,
    notes: "School building improvement"
  },
  {
    id: "scholarships",
    name: "Scholarships",
    category: "education",
    unitCost: 12000,
    unitLabel: "student scholarships",
    weight: 5,
    notes: "Annual maintenance + fee support"
  },
  {
    id: "apprenticeships",
    name: "Apprenticeships",
    category: "education",
    unitCost: 7000,
    unitLabel: "funded apprenticeships",
    weight: 6,
    notes: "Average apprenticeship levy cost"
  }
];

// Cancelled / wasted project sources — real data
const SPEND_SOURCES = (() => {
  const cancelled = projects.filter(
    (p) => p.status === "Cancelled"
      || p.status === "Compensation Ongoing"
  );
  const items = cancelled
    .filter((p) => p.latestBudget > 0)
    .sort((a, b) => b.latestBudget - a.latestBudget)
    .map((p) => ({
      id: p.name.toLowerCase().replace(
        /[^a-z0-9]+/g, "-"
      ),
      name: p.name,
      amountM: p.latestBudget,
      type: p.status === "Cancelled"
        ? "cancelled" : "wasted",
      dept: p.department
    }));
  return items;
})();

function fmtEquivNum(n) {
  if (n >= 1000000000) {
    const b = n / 1000000000;
    return b >= 10
      ? Math.round(b) + " billion"
      : (Math.round(b * 10) / 10)
        + " billion";
  }
  if (n >= 1000000) {
    const m = n / 1000000;
    return m >= 10
      ? Math.round(m) + " million"
      : (Math.round(m * 10) / 10)
        + " million";
  }
  if (n >= 10000) {
    const r = Math.round(n / 100) * 100;
    return r.toLocaleString("en-GB");
  }
  if (n >= 1000) {
    const r = Math.round(n / 50) * 50;
    return r.toLocaleString("en-GB");
  }
  return Math.round(n)
    .toLocaleString("en-GB");
}

// History-aware trio generator
function generateFreshTrio(
  amountM, recentItems, recentTrios
) {
  const amount = amountM * 1000000;
  const pool = EQUIV_SPEND_ITEMS.filter((it) => {
    const count = amount / it.unitCost;
    return count >= 3 && count <= 5000000000;
  });
  if (pool.length < 3) {
    return pool.slice(0, 3).map((it) => ({
      item: it,
      count: amount / it.unitCost
    }));
  }
  // Score each item: base weight, penalise
  // recently seen items
  function scorePool(exclude) {
    return pool
      .filter((it) => !exclude.has(it.id))
      .map((it) => {
        let score = it.weight;
        // Penalise items seen in last 10
        if (recentItems
          && recentItems.includes(it.id)) {
          const idx = recentItems.indexOf(it.id);
          // More recent = stronger penalty
          score *= 0.2 + (idx * 0.08);
        }
        // Add randomness
        score *= (0.5 + Math.random());
        return { it, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  const maxAttempts = 40;
  for (let att = 0; att < maxAttempts; att++) {
    const picks = [];
    const used = new Set();
    // Pick 3 from scored pool, one at a time
    for (let slot = 0; slot < 3; slot++) {
      const scored = scorePool(used);
      if (scored.length === 0) break;
      // Soft category balancing: prefer items
      // from categories not yet represented
      const usedCats = new Set(
        picks.map((p) => p.category)
      );
      const fresh = scored.filter(
        (s) => !usedCats.has(s.it.category)
      );
      const pick = (fresh.length > 0 && att < 30)
        ? fresh[0].it : scored[0].it;
      used.add(pick.id);
      picks.push(pick);
    }
    if (picks.length < 3) continue;
    // Check trio freshness vs recent trios
    const ids = picks.map((p) => p.id).sort();
    const trioKey = ids.join(",");
    const isRepeat = recentTrios
      && recentTrios.includes(trioKey);
    if (isRepeat && att < 30) continue;
    // Check at least 2/3 differ from most recent
    if (recentTrios && recentTrios.length > 0) {
      const lastIds = recentTrios[
        recentTrios.length - 1
      ].split(",");
      const overlap = ids.filter(
        (id) => lastIds.includes(id)
      ).length;
      if (overlap > 1 && att < 25) continue;
    }
    return picks.map((it) => ({
      item: it,
      count: amount / it.unitCost
    }));
  }
  // Fallback
  const shuffled = [...pool].sort(
    () => Math.random() - 0.5
  );
  return shuffled.slice(0, 3).map((it) => ({
    item: it,
    count: amount / it.unitCost
  }));
}

// Simple seed-based generator for project detail
function generateEquivSpend(amountM, seed) {
  const amount = amountM * 1000000;
  const active = EQUIV_SPEND_ITEMS.filter((it) => {
    const count = amount / it.unitCost;
    return count >= 3 && count <= 5000000000;
  });
  function pick(arr, sd) {
    if (arr.length === 0) return null;
    const totalW = arr.reduce(
      (s, it) => s + it.weight, 0
    );
    let r = ((sd * 9301 + 49297) % 233280)
      / 233280;
    let cum = 0;
    for (const it of arr) {
      cum += it.weight / totalW;
      if (r <= cum) return it;
    }
    return arr[arr.length - 1];
  }
  const results = [];
  const used = new Set();
  for (let i = 0; i < 3; i++) {
    const remaining = active.filter(
      (it) => !used.has(it.id)
    );
    const item = pick(remaining, seed + i * 13);
    if (item) {
      used.add(item.id);
      results.push({
        item,
        count: amount / item.unitCost,
        display: ("~"
          + fmtEquivNum(amount / item.unitCost)
          + " " + item.unitLabel
        ).replace("~~", "~")
      });
    }
  }
  return results;
}

// ============================================================================
// LEAGUE TABLES — department normalisation, aggregation, scoring
// ============================================================================
const DEPT_NAME_MAP = {
  "Department for Energy Security and Net Zero":
    "Dept for Energy Security & Net Zero",
  "Department for Energy":
    "Dept for Energy Security & Net Zero",
  "Dept for Energy Security and Net Zero":
    "Dept for Energy Security & Net Zero",
  "Department of Health":
    "Department of Health & Social Care",
  "Dept of Health and Social Care":
    "Department of Health & Social Care",
  "Department of Health and Social Care":
    "Department of Health & Social Care",
  "Department for Health":
    "Department of Health & Social Care",
  "Dept for Levelling Up":
    "Dept for Levelling Up, Housing & Communities",
  "Dept for Environment":
    "Dept for Environment, Food & Rural Affairs"
};

function normaliseDept(name) {
  return DEPT_NAME_MAP[name] || name;
}

function buildDeptLeague(projList) {
  const map = {};
  projList.forEach((p) => {
    const dept = normaliseDept(p.department);
    if (!map[dept]) {
      map[dept] = {
        dept,
        projects: [],
        totalOrig: 0,
        totalLatest: 0,
        cancelled: 0,
        cancelledSpend: 0,
        overBudgetCount: 0
      };
    }
    const d = map[dept];
    d.projects.push(p);
    d.totalOrig += p.originalBudget;
    d.totalLatest += p.latestBudget;
    const ov = p.latestBudget - p.originalBudget;
    if (ov > 0) d.overBudgetCount++;
    if (p.status === "Cancelled"
      || p.status === "Compensation Ongoing") {
      d.cancelled++;
      d.cancelledSpend += p.latestBudget;
    }
  });
  return Object.values(map).map((d) => {
    const overrun = d.totalLatest - d.totalOrig;
    const overrunPct = d.totalOrig > 0
      ? (overrun / d.totalOrig) * 100 : 0;
    const pctOverBudget = d.projects.length > 0
      ? (d.overBudgetCount / d.projects.length)
        * 100
      : 0;
    const pctCancelled = d.projects.length > 0
      ? (d.cancelled / d.projects.length) * 100
      : 0;
    const avgOverrun = d.projects.length > 0
      ? overrun / d.projects.length : 0;
    // Performance score (0-100, higher = worse)
    // Weighted formula:
    //   40% overrun %
    //   30% % projects over budget
    //   20% % projects cancelled
    //   10% avg overrun magnitude (log-scaled)
    const s1 = Math.min(overrunPct / 5, 100);
    const s2 = pctOverBudget;
    const s3 = pctCancelled;
    const logAvg = avgOverrun > 0
      ? Math.min(
        Math.log10(avgOverrun) / Math.log10(50000)
          * 100, 100
      ) : 0;
    const score = Math.round(
      s1 * 0.4 + s2 * 0.3 + s3 * 0.2
      + logAvg * 0.1
    );
    // Worst 3 projects by overrun
    const worstProjects = [...d.projects]
      .sort((a, b) =>
        (b.latestBudget - b.originalBudget)
        - (a.latestBudget - a.originalBudget)
      )
      .slice(0, 3);
    return {
      dept: d.dept,
      projectCount: d.projects.length,
      totalOrig: d.totalOrig,
      totalLatest: d.totalLatest,
      totalOverrun: overrun,
      overrunPct,
      cancelledCount: d.cancelled,
      cancelledSpend: d.cancelledSpend,
      overBudgetCount: d.overBudgetCount,
      pctOverBudget,
      pctCancelled,
      avgOverrun,
      score: Math.min(score, 100),
      worstProjects
    };
  });
}

// ============================================================================
// CONSULTANCY LEAGUE DATA STRUCTURES
// ============================================================================
const FIRM_NORM_MAP = {
  "Deloitte": {
    display: "Deloitte",
    parent: "Deloitte Touche Tohmatsu",
    type: "Big Four"
  },
  "PwC": {
    display: "PwC",
    parent: "PricewaterhouseCoopers Intl",
    type: "Big Four"
  },
  "KPMG": {
    display: "KPMG",
    parent: "KPMG International",
    type: "Big Four"
  },
  "EY": {
    display: "EY",
    parent: "Ernst & Young Global",
    type: "Big Four"
  },
  "Accenture": {
    display: "Accenture",
    parent: "Accenture plc",
    type: "Systems Integrator"
  },
  "Capgemini": {
    display: "Capgemini",
    parent: "Capgemini SE",
    type: "Systems Integrator"
  },
  "Fujitsu": {
    display: "Fujitsu",
    parent: "Fujitsu Ltd",
    type: "Systems Integrator"
  },
  "PA Consulting": {
    display: "PA Consulting",
    parent: "PA Consulting Group",
    type: "Strategy"
  },
  "McKinsey": {
    display: "McKinsey",
    parent: "McKinsey & Company",
    type: "Strategy"
  },
  "BCG": {
    display: "BCG",
    parent: "Boston Consulting Group",
    type: "Strategy"
  },
  "Bain": {
    display: "Bain",
    parent: "Bain & Company",
    type: "Strategy"
  },
  "Serco": {
    display: "Serco",
    parent: "Serco Group plc",
    type: "Outsourcer"
  },
  "Palantir": {
    display: "Palantir",
    parent: "Palantir Technologies",
    type: "Data/AI"
  },
  "Arcadis": {
    display: "Arcadis",
    parent: "Arcadis NV",
    type: "Engineering"
  },
  "Arup": {
    display: "Arup",
    parent: "Arup Group",
    type: "Engineering"
  },
  "AECOM": {
    display: "AECOM",
    parent: "AECOM Technology Corp",
    type: "Engineering"
  },
  "WSP": {
    display: "WSP",
    parent: "WSP Global",
    type: "Engineering"
  },
  "Mott MacDonald": {
    display: "Mott MacDonald",
    parent: "Mott MacDonald Group",
    type: "Engineering"
  },
  "Jacobs": {
    display: "Jacobs",
    parent: "Jacobs Solutions",
    type: "Engineering"
  }
};

const DEPT_HC_MAP = {
  "Department of Health and Social Care": "DHSC",
  "Department for Transport": "DfT",
  "Cabinet Office": "Cabinet Office",
  "Ministry of Defence": "MoD",
  "HM Revenue & Customs": "HMRC",
  "Department for Environment, Food and Rural Affairs": "Defra",
  "Home Office": "Home Office",
  "Department for Work and Pensions": "DWP",
  "HM Treasury": "Cabinet Office",
  "Department for Culture, Media and Sport": "DCMS",
  "Department for International Development": "FCDO",
  "Ministry of Justice": "MoJ",
  "Department for Education": "DfE",
  "Department for Levelling Up": "Cabinet Office",
  "Department for Energy Security and Net Zero": "DESNZ",
  "Department for Business and Trade": "DBT",
  "Multiple Departments": null
};

// Build consultancy league by department
function buildConsultancyLeague(
  contracts, headcounts, firmFilter, catFilter, routeFilter
) {
  // Apply filters
  let filtered = contracts;
  if (firmFilter) {
    filtered = filtered.filter((c) =>
      (c.normalizedCompanyName || "")
        .toLowerCase()
        .includes(firmFilter.toLowerCase())
    );
  }
  if (catFilter) {
    filtered = filtered.filter(
      (c) => c.contractCategory === catFilter
    );
  }
  if (routeFilter) {
    filtered = filtered.filter(
      (c) => c.procurementRoute === routeFilter
    );
  }

  // Build headcount lookup
  const hcLookup = {};
  headcounts.forEach((h) => {
    hcLookup[h.dept] = h.headcount;
  });

  // Aggregate by department
  const deptMap = {};
  filtered.forEach((c) => {
    const dept = c.department;
    if (!deptMap[dept]) {
      deptMap[dept] = {
        contracts: [],
        totalSpend: 0,
        firms: new Set()
      };
    }
    deptMap[dept].contracts.push(c);
    deptMap[dept].totalSpend += c.contractValue || 0;
    deptMap[dept].firms.add(
      c.normalizedCompanyName || c.companyName
    );
  });

  // Build rows
  return Object.entries(deptMap).map(([dept, d]) => {
    const n = d.contracts.length;
    const avgSize = n > 0 ? d.totalSpend / n : 0;
    const firmCount = d.firms.size;

    // Headcount
    const hcKey = DEPT_HC_MAP[dept];
    const headcount = hcKey ? (hcLookup[hcKey] || null) : null;
    const spendPerEmployee =
      headcount ? d.totalSpend / headcount : null;

    // Top firms
    const firmSpend = {};
    d.contracts.forEach((c) => {
      const fn = c.normalizedCompanyName || c.companyName;
      firmSpend[fn] = (firmSpend[fn] || 0) +
        (c.contractValue || 0);
    });
    const topFirms = Object.entries(firmSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, spend]) => ({ name, spend }));

    // Concentration: % going to top 3
    const top3Spend = topFirms
      .slice(0, 3)
      .reduce((s, f) => s + f.spend, 0);
    const concentration = d.totalSpend > 0
      ? (top3Spend / d.totalSpend) * 100
      : 0;

    // Dependency score (0-100, higher = more dependent)
    // 35% concentration + 25% spend per employee +
    // 25% avg contract size + 15% contract count
    const s1 = Math.min(concentration, 100) / 100;
    const s2 = spendPerEmployee
      ? Math.min(spendPerEmployee / 50000, 1)
      : 0;
    const s3 = Math.min(avgSize / 200000000, 1);
    const s4 = Math.min(n / 15, 1);
    const depScore = Math.round(
      (s1 * 0.35 + s2 * 0.25 + s3 * 0.25 +
        s4 * 0.15) * 100
    );

    // Categories breakdown
    const catBreakdown = {};
    d.contracts.forEach((c) => {
      catBreakdown[c.contractCategory] =
        (catBreakdown[c.contractCategory] || 0) +
        (c.contractValue || 0);
    });

    // Routes breakdown
    const routeBreakdown = {};
    d.contracts.forEach((c) => {
      routeBreakdown[c.procurementRoute] =
        (routeBreakdown[c.procurementRoute] || 0) + 1;
    });

    return {
      dept,
      n,
      totalSpend: d.totalSpend,
      avgSize,
      firmCount,
      headcount,
      spendPerEmployee,
      topFirms,
      concentration,
      depScore,
      catBreakdown,
      routeBreakdown,
      contracts: d.contracts.sort(
        (a, b) => (b.contractValue || 0) -
          (a.contractValue || 0)
      )
    };
  });
}

// Build firm-level view
function buildFirmLeague(
  contracts, firmFilter, catFilter, routeFilter
) {
  let filtered = contracts;
  if (firmFilter) {
    filtered = filtered.filter((c) =>
      (c.normalizedCompanyName || "")
        .toLowerCase()
        .includes(firmFilter.toLowerCase())
    );
  }
  if (catFilter) {
    filtered = filtered.filter(
      (c) => c.contractCategory === catFilter
    );
  }
  if (routeFilter) {
    filtered = filtered.filter(
      (c) => c.procurementRoute === routeFilter
    );
  }

  const firmMap = {};
  filtered.forEach((c) => {
    const fn = c.normalizedCompanyName || c.companyName;
    if (!firmMap[fn]) {
      firmMap[fn] = {
        contracts: [],
        totalSpend: 0,
        depts: new Set()
      };
    }
    firmMap[fn].contracts.push(c);
    firmMap[fn].totalSpend += c.contractValue || 0;
    firmMap[fn].depts.add(c.department);
  });

  return Object.entries(firmMap).map(([firm, d]) => {
    const meta = FIRM_NORM_MAP[firm] || {
      display: firm,
      parent: firm,
      type: "Other"
    };
    const avgSize = d.contracts.length > 0
      ? d.totalSpend / d.contracts.length
      : 0;
    const topContracts = d.contracts
      .sort((a, b) => (b.contractValue || 0) -
        (a.contractValue || 0))
      .slice(0, 5);
    return {
      firm,
      display: meta.display,
      parent: meta.parent,
      type: meta.type,
      n: d.contracts.length,
      totalSpend: d.totalSpend,
      avgSize,
      deptCount: d.depts.size,
      depts: [...d.depts],
      topContracts,
      contracts: d.contracts
    };
  });
}

function EquivalentSpendBlock({ amountM, status }) {
  const [seed, setSeed] = useState(
    () => Math.floor(Math.random() * 10000)
  );
  const show = amountM > 0
    || (status === "Cancelled" && amountM !== 0);
  if (!show) return null;
  const items = generateEquivSpend(
    Math.abs(amountM), seed
  );
  if (items.length === 0) return null;
  const label = status === "Cancelled"
    ? "Cancelled spend equivalent"
    : "Overrun equivalent";
  return (
    <div className={
      "px-6 py-4 border-t border-gray-800/40"
    }>
      <div className={
        "flex items-center justify-between mb-2.5"
      }>
        <div className={
          "text-[9px] uppercase tracking-[0.2em] " +
          "text-gray-700 font-mono"
        }>
          {label}
        </div>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className={
            "text-gray-700 hover:text-gray-400 " +
            "transition-colors"
          }
          title="Shuffle equivalents"
        >
          <RefreshCw size={11} />
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((r) => (
          <div
            key={r.item.id}
            className={
              "text-gray-400 text-[12px] font-mono"
            }
          >
            <span className="text-gray-600 mr-1.5">
              {"\u2022"}
            </span>
            {r.display}
          </div>
        ))}
      </div>
      <div className={
        "text-[9px] text-gray-800 font-mono " +
        "mt-2.5 tracking-[0.1em]"
      }>
        Estimates based on typical UK public
        spending costs. For illustration.
      </div>
    </div>
  );
}

// ============================================================================
// HOME SPEND GENERATOR — animated slot-reel display
// with project rotation + history-aware selection
// ============================================================================
function SpendReel({ result, isSpinning, delay }) {
  const [phase, setPhase] = useState("idle");
  const [cycleText, setCycleText] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isSpinning) {
      setPhase("idle");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    setPhase("spinning");
    let idx = Math.floor(
      Math.random() * EQUIV_SPEND_ITEMS.length
    );
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % EQUIV_SPEND_ITEMS.length;
      setCycleText(
        EQUIV_SPEND_ITEMS[idx].unitLabel
      );
    }, 60);
    const stopTimer = setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPhase("landed");
      const settle = setTimeout(
        () => setPhase("idle"), 400
      );
      return () => clearTimeout(settle);
    }, delay);
    return () => {
      clearTimeout(stopTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSpinning, delay]);

  const showFinal = phase === "idle"
    || phase === "landed";

  return (
    <div className={
      "border-b border-gray-800/40 " +
      "py-5 md:py-6 overflow-hidden"
    }>
      <div className={
        "flex items-baseline gap-3 md:gap-4 " +
        "min-h-[2.5rem] transition-all " +
        "duration-300"
      }>
        {showFinal && result ? (
          <>
            <div
              className={
                "text-2xl md:text-3xl font-black " +
                "text-white font-mono " +
                "tracking-tight transition-all " +
                "duration-300"
              }
              style={phase === "landed" ? {
                animation:
                  "reelLand 0.3s ease-out"
              } : {}}
            >
              {fmtEquivNum(result.count)}
            </div>
            <div className={
              "text-sm md:text-base text-gray-400 " +
              "transition-opacity duration-300 " +
              (phase === "landed"
                ? "opacity-100" : "opacity-80")
            }>
              {result.item.unitLabel}
            </div>
          </>
        ) : (
          <div
            className={
              "text-sm md:text-base " +
              "text-gray-600 font-mono " +
              "overflow-hidden whitespace-nowrap"
            }
            style={{
              animation:
                "reelCycle 0.12s steps(1) infinite"
            }}
          >
            {cycleText || " "}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeSpendGenerator() {
  // Source rotation state
  const [srcIdx, setSrcIdx] = useState(0);
  const source = SPEND_SOURCES[srcIdx];
  const absAmt = source.amountM;

  // History buffers
  const recentItemsRef = useRef([]);
  const recentTriosRef = useRef([]);

  // Results state — start null to avoid
  // SSR/client hydration mismatch from Math.random
  const [results, setResults] = useState(null);
  const [isSpinning, setIsSpinning] = useState(
    false
  );

  const [showShareModal, setShowShareModal] =
    useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] =
    useState(false);

  // Generate initial results client-side only
  useEffect(() => {
    if (results === null) {
      const r = generateFreshTrio(absAmt, [], []);
      const ids = r.map((x) => x.item.id);
      recentItemsRef.current = [...ids];
      recentTriosRef.current = [
        [...ids].sort().join(",")
      ];
      setResults(r);
    }
  }, []);

  // Refresh results when source changes
  const doGenerate = useCallback((amt) => {
    const r = generateFreshTrio(
      amt,
      recentItemsRef.current,
      recentTriosRef.current
    );
    const ids = r.map((x) => x.item.id);
    // Update history: keep last 10 items,
    // last 5 trios
    recentItemsRef.current = [
      ...recentItemsRef.current, ...ids
    ].slice(-10);
    recentTriosRef.current = [
      ...recentTriosRef.current,
      [...ids].sort().join(",")
    ].slice(-5);
    return r;
  }, []);

  const handleShuffle = useCallback(() => {
    if (isSpinning) return;
    setIsSpinning(true);
    const newResults = doGenerate(absAmt);
    setTimeout(() => {
      setResults(newResults);
      setIsSpinning(false);
    }, 1500);
  }, [isSpinning, absAmt, doGenerate]);

  const handleNextProject = useCallback(() => {
    if (isSpinning) return;
    setIsSpinning(true);
    const nextIdx = (srcIdx + 1)
      % SPEND_SOURCES.length;
    const nextAmt = SPEND_SOURCES[nextIdx].amountM;
    const newResults = doGenerate(nextAmt);
    setTimeout(() => {
      setSrcIdx(nextIdx);
      setResults(newResults);
      setIsSpinning(false);
    }, 1500);
  }, [isSpinning, srcIdx, doGenerate]);

  const handleShare = useCallback(() => {
    if (!results || isSpinning) return;
    const payload = {
      n: source.name,
      a: absAmt,
      d: source.dept,
      t: source.type,
      i: results.map((r) => r.item.id)
    };
    const id = encodeShareId(payload);
    const url = window.location.origin
      + "/share/" + id;
    setShareUrl(url);
    setShowShareModal(true);
    setShareCopied(false);
  }, [results, isSpinning, source, absAmt]);

  const handleShareCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setShareCopied(true);
        setTimeout(
          () => setShareCopied(false), 2000
        );
      });
  }, [shareUrl]);

  const handleShareDownload = useCallback(() => {
    if (!results) return;
    const payload = {
      n: source.name,
      a: absAmt,
      d: source.dept,
      t: source.type,
      i: results.map((r) => r.item.id)
    };
    const resolved = results.map((r) => ({
      item: r.item,
      count: r.count
    }));
    const dataUrl = renderCardToCanvas(
      payload, resolved
    );
    const link = document.createElement("a");
    link.download = "gracchus-"
      + (source.name || "card")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 30)
      + ".png";
    link.href = dataUrl;
    link.click();
  }, [results, source, absAmt]);

  const fmtAmt = (m) => {
    if (m >= 1000) {
      return "£" + (m / 1000).toFixed(1)
        + "bn";
    }
    return "£" + m.toLocaleString("en-GB")
      + "m";
  };

  const typeLabel = source.type === "cancelled"
    ? "Cancelled project"
    : "Wasted spend";

  return (
    <div className="max-w-2xl mx-auto">
      <style>{
        "@keyframes reelLand {" +
        "0% { transform: translateY(12px);" +
        " opacity: 0; }" +
        "60% { transform: translateY(-2px);" +
        " opacity: 1; }" +
        "100% { transform: translateY(0);" +
        " opacity: 1; }" +
        "}" +
        "@keyframes reelCycle {" +
        "0% { opacity: 0.4; }" +
        "50% { opacity: 0.7; }" +
        "100% { opacity: 0.4; }" +
        "}"
      }</style>

      {/* Source context */}
      <div className="text-center mb-8">
        <div className={
          "text-[10px] uppercase " +
          "tracking-[0.25em] text-gray-600 " +
          "font-mono mb-2"
        }>
          {typeLabel}
        </div>
        <div className={
          "text-[15px] text-gray-400 mb-1 " +
          "font-medium"
        }>
          {source.name}
        </div>
        <div className={
          "text-3xl sm:text-5xl md:text-6xl lg:text-7xl " +
          "font-black text-red-500 " +
          "tracking-tighter leading-none"
        }>
          {fmtAmt(absAmt)}
        </div>
        <div className={
          "text-[11px] text-gray-600 mt-2 " +
          "font-mono tracking-wide"
        }>
          {source.dept}
        </div>
      </div>

      {/* Reel frame */}
      <div className={
        "border border-gray-800/60 " +
        "bg-gray-950/50"
      }>
        <div className={
          "px-5 md:px-8 py-3 " +
          "border-b border-gray-800/40 " +
          "flex items-center justify-between"
        }>
          <div className={
            "text-[9px] uppercase " +
            "tracking-[0.25em] text-gray-600 " +
            "font-mono"
          }>
            Could have funded
          </div>
          <div className={
            "w-2 h-2 rounded-full " +
            (isSpinning
              ? "bg-red-500 animate-pulse"
              : "bg-gray-700")
          } />
        </div>
        <div className="px-5 md:px-8">
          {[0, 1, 2].map((i) => (
            <SpendReel
              key={i}
              result={
                isSpinning || !results
                  ? null : results[i]
              }
              isSpinning={isSpinning}
              delay={600 + i * 400}
            />
          ))}
        </div>
        <div className={
          "px-5 md:px-8 py-3 " +
          "border-t border-gray-800/40"
        }>
          <div className={
            "text-[9px] text-gray-700 " +
            "font-mono tracking-[0.1em]"
          }>
            Estimates based on published UK
            public spending costs.
            Sources: NHS, DfE, local authority
            rates.
          </div>
        </div>
      </div>

      {/* Dual controls */}
      <div className={
        "flex justify-center gap-3 mt-6 " +
        "flex-wrap"
      }>
        <button
          onClick={handleShuffle}
          disabled={isSpinning}
          className={
            "text-xs font-mono uppercase " +
            "tracking-[0.15em] px-5 py-2.5 " +
            "border transition-all duration-200 " +
            "flex items-center gap-2 " +
            (isSpinning
              ? "border-gray-800 text-gray-700 " +
                "cursor-not-allowed"
              : "border-gray-700 text-gray-400 " +
                "hover:text-white " +
                "hover:border-gray-500 " +
                "hover:bg-white/[0.02]")
          }
        >
          <RefreshCw
            size={11}
            className={
              isSpinning ? "animate-spin" : ""
            }
          />
          Shuffle
        </button>
        <button
          onClick={handleNextProject}
          disabled={isSpinning}
          className={
            "text-xs font-mono uppercase " +
            "tracking-[0.15em] px-5 py-2.5 " +
            "border transition-all duration-200 " +
            "flex items-center gap-2 " +
            (isSpinning
              ? "border-gray-800 text-gray-700 " +
                "cursor-not-allowed"
              : "border-gray-700 text-gray-400 " +
                "hover:text-white " +
                "hover:border-gray-500 " +
                "hover:bg-white/[0.02]")
          }
        >
          Next Project
          <ChevronRight size={12} />
        </button>
        <button
          onClick={handleShare}
          disabled={isSpinning || !results}
          className={
            "text-xs font-mono uppercase " +
            "tracking-[0.15em] px-5 py-2.5 " +
            "border transition-all " +
            "duration-200 " +
            "flex items-center gap-2 " +
            (isSpinning || !results
              ? "border-gray-800 " +
                "text-gray-700 " +
                "cursor-not-allowed"
              : "border-gray-700 " +
                "text-gray-400 " +
                "hover:text-white " +
                "hover:border-gray-500 " +
                "hover:bg-white/[0.02]")
          }
        >
          <Share2 size={12} />
          Share
        </button>
      </div>

      {/* Project counter */}
      <div className={
        "text-center mt-3 text-[9px] " +
        "text-gray-700 font-mono " +
        "tracking-[0.1em]"
      }>
        {srcIdx + 1} of {SPEND_SOURCES.length}
        {" "}cancelled projects
      </div>

      {showShareModal && (
        <div
          className={
            "fixed inset-0 z-50 " +
            "flex items-center " +
            "justify-center px-4"
          }
          onClick={() =>
            setShowShareModal(false)
          }
        >
          <div className={
            "absolute inset-0 bg-black/80"
          } />
          <div
            className={
              "relative w-full " +
              "max-w-[560px] " +
              "bg-[#0a0a0a] border " +
              "border-gray-800/60 " +
              "overflow-hidden"
            }
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="h-0.5 bg-red-500" />
            <div className={
              "px-6 pt-5 pb-4 flex " +
              "items-center justify-between " +
              "border-b border-gray-800/40"
            }>
              <div className={
                "text-[11px] uppercase " +
                "tracking-[0.2em] " +
                "text-gray-500 font-mono"
              }>
                Share This Card
              </div>
              <button
                onClick={() =>
                  setShowShareModal(false)
                }
                className={
                  "text-gray-600 " +
                  "hover:text-gray-400 " +
                  "transition-colors"
                }
              >
                <X size={16} />
              </button>
            </div>
            <div className={
              "px-6 py-6 space-y-4"
            }>
              <div className={
                "bg-[#030303] border " +
                "border-gray-800/40 " +
                "overflow-hidden"
              }>
                <div className={
                  "h-0.5 bg-red-500"
                } />
                <div className="px-5 py-4">
                  <div className={
                    "text-[8px] uppercase " +
                    "tracking-[0.25em] " +
                    "text-gray-700 " +
                    "font-mono mb-3"
                  }>
                    GRACCHUS
                  </div>
                  <div className={
                    "relative pl-3 mb-3"
                  }>
                    <div className={
                      "absolute left-0 " +
                      "top-0 w-[2px] " +
                      "h-full bg-red-500"
                    } />
                    <div className={
                      "text-2xl " +
                      "font-black " +
                      "text-white " +
                      "tracking-tighter " +
                      "leading-none"
                    }>
                      {fmtAmt(absAmt)}
                    </div>
                    <div className={
                      "text-lg " +
                      "font-black " +
                      "text-red-500 " +
                      "tracking-tight " +
                      "mt-0.5"
                    }>
                      WASTED.
                    </div>
                  </div>
                  <div className={
                    "text-xs font-bold " +
                    "text-gray-300"
                  }>
                    {source.name}
                  </div>
                  <div className={
                    "text-[9px] " +
                    "text-gray-600 " +
                    "font-mono uppercase " +
                    "tracking-wide mt-0.5"
                  }>
                    {source.dept}
                  </div>
                  <div className={
                    "mt-3 mb-2"
                  }>
                    <div className={
                      "text-[8px] " +
                      "uppercase " +
                      "tracking-[0.2em] " +
                      "text-gray-700 " +
                      "font-mono"
                    }>
                      Equivalent to:
                    </div>
                  </div>
                  {results &&
                    results.map(
                    (r) => (
                      <div
                        key={r.item.id}
                        className={
                          "flex " +
                          "items-baseline " +
                          "gap-2 mb-1"
                        }
                      >
                        <span className={
                          "text-sm " +
                          "font-black " +
                          "text-white " +
                          "tracking-tight"
                        }>
                          {fmtEquivNum(
                            r.count
                          )}
                        </span>
                        <span className={
                          "text-[11px] " +
                          "text-gray-600"
                        }>
                          {r.item
                            .unitLabel}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
              <div className={
                "flex items-center gap-2 " +
                "bg-black border " +
                "border-gray-800/60 " +
                "rounded px-3 py-2"
              }>
                <input
                  readOnly
                  value={shareUrl}
                  className={
                    "flex-1 bg-transparent " +
                    "text-xs font-mono " +
                    "text-gray-400 " +
                    "outline-none " +
                    "truncate"
                  }
                />
                <button
                  onClick={handleShareCopy}
                  className={
                    "text-[10px] uppercase " +
                    "font-mono " +
                    "tracking-[0.1em] " +
                    "px-3 py-1 border " +
                    "border-gray-700 " +
                    "text-gray-400 " +
                    "hover:text-white " +
                    "hover:border-gray-500 " +
                    "transition-all " +
                    "whitespace-nowrap"
                  }
                >
                  {shareCopied
                    ? "\u2713 Copied"
                    : "Copy"}
                </button>
              </div>
              <button
                onClick={handleShareDownload}
                className={
                  "w-full text-xs " +
                  "font-mono uppercase " +
                  "tracking-[0.12em] " +
                  "px-5 py-2.5 " +
                  "border border-gray-700 " +
                  "text-gray-400 " +
                  "hover:text-white " +
                  "hover:border-gray-500 " +
                  "hover:bg-white/[0.02] " +
                  "transition-all " +
                  "flex items-center " +
                  "justify-center gap-2"
                }
              >
                <Download size={12} />
                Download as PNG
                (1200{"×"}630)
              </button>
              <button
                onClick={() => {
                  const text =
                    fmtAmt(absAmt) + " WASTED on " + source.name +
                    " (" + source.dept + ")" +
                    (results ? "\n\nEquivalent to: " +
                      results.map((r) => fmtEquivNum(r.count) + " " + r.item.unitLabel).join(", ")
                    : "") +
                    "\n\nvia @GracchusHQ";
                  window.open(
                    "https://x.com/intent/post?text=" +
                    encodeURIComponent(text) +
                    "&url=" +
                    encodeURIComponent(shareUrl),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                className={
                  "w-full text-xs " +
                  "font-mono uppercase " +
                  "tracking-[0.12em] " +
                  "px-5 py-2.5 " +
                  "bg-white/[0.06] " +
                  "border border-gray-700 " +
                  "text-gray-300 " +
                  "hover:bg-white/[0.12] " +
                  "hover:text-white " +
                  "hover:border-gray-500 " +
                  "transition-all " +
                  "flex items-center " +
                  "justify-center gap-2"
                }
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Post to X
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DailyCostGenerator() {
  const dcProjects = dailyCostData.projects;
  const potholeUnit = dailyCostData.potholeUnitCost;
  const [projIdx, setProjIdx] = useState(0);
  const [showShareModal, setShowShareModal] =
    useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] =
    useState(false);

  const proj = dcProjects[projIdx];

  const handleNext = useCallback(() => {
    setProjIdx(
      (i) => (i + 1) % dcProjects.length
    );
  }, [dcProjects.length]);

  const handleShuffle = useCallback(() => {
    setProjIdx((prev) => {
      let next = prev;
      while (next === prev &&
        dcProjects.length > 1) {
        next = Math.floor(
          Math.random() * dcProjects.length
        );
      }
      return next;
    });
  }, [dcProjects.length]);

  const handleShare = useCallback(() => {
    const id = "project-daily/"
      + proj.projectId;
    const url = window.location.origin
      + "/share/" + id;
    setShareUrl(url);
    setShowShareModal(true);
    setShareCopied(false);
  }, [proj]);

  const handleShareCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setShareCopied(true);
        setTimeout(
          () => setShareCopied(false), 2000
        );
      });
  }, [shareUrl]);

  const fmtDailyCost = (m) => {
    return "£" + m.toFixed(2) + "m";
  };

  const fmtTotal = (m) => {
    if (m >= 1000) {
      return "£" + (m / 1000).toFixed(0)
        + "bn";
    }
    return "£" + m.toLocaleString("en-GB")
      + "m";
  };

  const fmtPotholes = (n) => {
    return n.toLocaleString("en-GB");
  };

  const completionYear = proj.completionDate
    ? proj.completionDate.split("-")[0]
    : "TBD";

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className={
        "border border-gray-800/60 " +
        "bg-gray-950/50"
      }>
        <div className={
          "px-5 py-3 " +
          "border-b border-gray-800/40 " +
          "flex items-center justify-between"
        }>
          <div className={
            "text-[12px] uppercase " +
            "tracking-[0.25em] text-gray-600 " +
            "font-mono"
          }>
            Ongoing Project
          </div>
          <div className={
            "text-[11px] font-mono " +
            "text-gray-700 tracking-wide"
          }>
            {projIdx + 1}/{dcProjects.length}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className={
            "text-[16px] text-gray-300 " +
            "font-semibold leading-tight"
          }>
            {proj.projectName}
          </div>
          <div className={
            "text-[12px] text-gray-600 " +
            "font-mono uppercase " +
            "tracking-wide mt-1"
          }>
            {proj.department}
          </div>

          <div className="mt-5">
            <div className={
              "text-[12px] uppercase " +
              "tracking-[0.2em] text-gray-600 " +
              "font-mono mb-1"
            }>
              Average daily cost
            </div>
            <div className={
              "text-3xl sm:text-4xl " +
              "font-black text-red-500 " +
              "tracking-tighter leading-none"
            }>
              {fmtDailyCost(
                proj.averageDailyCostM
              )}
            </div>
            <div className={
              "text-[13px] text-gray-500 " +
              "font-mono mt-1"
            }>
              per day
            </div>
          </div>

          <div className={
            "mt-4 pt-4 " +
            "border-t border-gray-800/30"
          }>
            <div className={
              "flex items-baseline gap-2"
            }>
              <span className={
                "text-lg font-black " +
                "text-white tracking-tight"
              }>
                {fmtPotholes(
                  proj.potholeEquivalentPerDay
                )}
              </span>
              <span className={
                "text-[13px] text-gray-600"
              }>
                pothole repairs / day
              </span>
            </div>
          </div>

          <div className={
            "mt-4 pt-4 " +
            "border-t border-gray-800/30 " +
            "grid grid-cols-2 gap-x-4 gap-y-2"
          }>
            <div>
              <div className={
                "text-[11px] uppercase " +
                "tracking-[0.15em] " +
                "text-gray-700 font-mono"
              }>
                Total estimate
              </div>
              <div className={
                "text-[15px] text-gray-400 " +
                "font-semibold"
              }>
                {fmtTotal(
                  proj.totalEstimatedCostM
                )}
              </div>
            </div>
            <div>
              <div className={
                "text-[11px] uppercase " +
                "tracking-[0.15em] " +
                "text-gray-700 font-mono"
              }>
                Est. completion
              </div>
              <div className={
                "text-[15px] text-gray-400 " +
                "font-semibold"
              }>
                {completionYear}
              </div>
            </div>
          </div>
        </div>

        <div className={
          "px-5 py-3 " +
          "border-t border-gray-800/40"
        }>
          <div className={
            "text-[11px] text-gray-700 " +
            "font-mono tracking-[0.05em] " +
            "leading-relaxed"
          }>
            Average implied daily cost over
            full project lifetime. Not literal
            daily cash expenditure.
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={
        "flex justify-center gap-3 mt-4 " +
        "flex-wrap"
      }>
        <button
          onClick={handleShuffle}
          className={
            "text-[12px] font-mono uppercase " +
            "tracking-[0.12em] px-4 py-2 " +
            "border transition-all " +
            "duration-200 " +
            "flex items-center gap-2 " +
            "border-gray-700 text-gray-400 " +
            "hover:text-white " +
            "hover:border-gray-500 " +
            "hover:bg-white/[0.02]"
          }
        >
          <RefreshCw size={13} />
          Shuffle
        </button>
        <button
          onClick={handleNext}
          className={
            "text-[12px] font-mono uppercase " +
            "tracking-[0.12em] px-4 py-2 " +
            "border transition-all " +
            "duration-200 " +
            "flex items-center gap-2 " +
            "border-gray-700 text-gray-400 " +
            "hover:text-white " +
            "hover:border-gray-500 " +
            "hover:bg-white/[0.02]"
          }
        >
          Next
          <ChevronRight size={13} />
        </button>
        <button
          onClick={handleShare}
          className={
            "text-[12px] font-mono uppercase " +
            "tracking-[0.12em] px-4 py-2 " +
            "border transition-all " +
            "duration-200 " +
            "flex items-center gap-2 " +
            "border-gray-700 text-gray-400 " +
            "hover:text-white " +
            "hover:border-gray-500 " +
            "hover:bg-white/[0.02]"
          }
        >
          <Share2 size={13} />
          Share
        </button>
      </div>

      {/* ---- Share Modal ---- */}
      {showShareModal && (
        <div
          className={
            "fixed inset-0 z-50 " +
            "flex items-center " +
            "justify-center px-4"
          }
          onClick={() =>
            setShowShareModal(false)
          }
        >
          <div className={
            "absolute inset-0 bg-black/80"
          } />
          <div
            className={
              "relative w-full " +
              "max-w-[480px] " +
              "bg-[#0a0a0a] border " +
              "border-gray-800/60 " +
              "overflow-hidden"
            }
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="h-0.5 bg-red-500" />
            <div className={
              "px-6 pt-5 pb-4 flex " +
              "items-center justify-between " +
              "border-b border-gray-800/40"
            }>
              <div className={
                "text-[11px] uppercase " +
                "tracking-[0.2em] " +
                "text-gray-500 font-mono"
              }>
                Share This Card
              </div>
              <button
                onClick={() =>
                  setShowShareModal(false)
                }
                className={
                  "text-gray-600 " +
                  "hover:text-gray-400 " +
                  "transition-colors"
                }
              >
                <X size={16} />
              </button>
            </div>
            <div className={
              "px-6 py-6 space-y-4"
            }>
              {/* Card preview */}
              <div className={
                "bg-[#030303] border " +
                "border-gray-800/40 " +
                "overflow-hidden"
              }>
                <div className={
                  "h-0.5 bg-red-500"
                } />
                <div className="px-5 py-4">
                  <div className={
                    "text-[8px] uppercase " +
                    "tracking-[0.25em] " +
                    "text-gray-700 " +
                    "font-mono mb-3"
                  }>
                    GRACCHUS
                  </div>
                  <div className={
                    "text-xs font-bold " +
                    "text-gray-300"
                  }>
                    {proj.projectName}
                  </div>
                  <div className={
                    "text-[9px] " +
                    "text-gray-600 " +
                    "font-mono uppercase " +
                    "tracking-wide mt-0.5"
                  }>
                    {proj.department}
                  </div>
                  <div className={
                    "relative pl-3 mt-3 mb-2"
                  }>
                    <div className={
                      "absolute left-0 " +
                      "top-0 w-[2px] " +
                      "h-full bg-red-500"
                    } />
                    <div className={
                      "text-xl " +
                      "font-black " +
                      "text-red-500 " +
                      "tracking-tighter " +
                      "leading-none"
                    }>
                      {fmtDailyCost(
                        proj.averageDailyCostM
                      )}
                      /day
                    </div>
                    <div className={
                      "text-[10px] " +
                      "text-gray-500 mt-1"
                    }>
                      = {fmtPotholes(
                        proj
                          .potholeEquivalentPerDay
                      )} pothole repairs
                      every day
                    </div>
                  </div>
                  <div className={
                    "text-[9px] " +
                    "text-gray-700 " +
                    "font-mono mt-2"
                  }>
                    Total: {fmtTotal(
                      proj.totalEstimatedCostM
                    )} | Est. {completionYear}
                  </div>
                </div>
              </div>

              {/* URL + copy */}
              <div className={
                "flex items-center gap-2 " +
                "bg-black border " +
                "border-gray-800/60 " +
                "rounded px-3 py-2"
              }>
                <input
                  readOnly
                  value={shareUrl}
                  className={
                    "flex-1 bg-transparent " +
                    "text-xs font-mono " +
                    "text-gray-400 " +
                    "outline-none " +
                    "truncate"
                  }
                />
                <button
                  onClick={handleShareCopy}
                  className={
                    "text-[10px] uppercase " +
                    "font-mono " +
                    "tracking-[0.1em] " +
                    "px-3 py-1 border " +
                    "border-gray-700 " +
                    "text-gray-400 " +
                    "hover:text-white " +
                    "hover:border-gray-500 " +
                    "transition-all " +
                    "whitespace-nowrap"
                  }
                >
                  {shareCopied
                    ? "\u2713 Copied"
                    : "Copy"}
                </button>
              </div>
              <button
                onClick={() => {
                  const text =
                    fmtDailyCost(proj.averageDailyCostM) + "/day on " +
                    proj.projectName +
                    " = " + fmtPotholes(proj.potholeEquivalentPerDay) +
                    " pothole repairs every day" +
                    "\n\nvia @GracchusHQ";
                  window.open(
                    "https://x.com/intent/post?text=" +
                    encodeURIComponent(text) +
                    "&url=" +
                    encodeURIComponent(shareUrl),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                className={
                  "w-full text-xs " +
                  "font-mono uppercase " +
                  "tracking-[0.12em] " +
                  "px-5 py-2.5 " +
                  "bg-white/[0.06] " +
                  "border border-gray-700 " +
                  "text-gray-300 " +
                  "hover:bg-white/[0.12] " +
                  "hover:text-white " +
                  "hover:border-gray-500 " +
                  "transition-all " +
                  "flex items-center " +
                  "justify-center gap-2"
                }
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Post to X
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectDetail({ project, onClose, onNavigate }) {
  const p = project;
  const ov = getOverrun(p);
  const op = getOverrunPct(p);
  const neg = ov < 0;
  const severe = !neg && op > 100;
  const warn = !neg && op > 30 && op <= 100;
  const ovColor = neg
    ? "text-emerald-500"
    : severe ? "text-red-500" : warn ? "text-amber-500" : "text-gray-400";
  const ovSign = neg ? "" : "+";
  const budgetDelta = p.latestBudget - p.originalBudget;
  const dateMoved = p.originalDate !== p.latestDate;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className={
          "relative w-full max-w-[520px] h-full bg-black " +
          "border-l border-gray-800/60 overflow-y-auto"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* — HEADER — */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800/40">
          <div className="flex items-start justify-between mb-4">
            <div className={
              "text-[9px] uppercase tracking-[0.25em] " +
              "font-mono text-gray-600"
            }>
              Project Dossier
            </div>
            <button
              onClick={onClose}
              className={
                "text-gray-700 hover:text-white text-xs " +
                "font-mono tracking-widest uppercase"
              }
            >
              [esc]
            </button>
          </div>
          <h2 className={
            "text-xl font-black uppercase tracking-tight " +
            "text-white leading-tight"
          }>
            {p.name}
          </h2>
          <div className="text-gray-600 text-[11px] font-mono mt-1.5">
            {p.department}
          </div>
        </div>

        {/* — OVERRUN HERO — */}
        <div className={
          "px-6 py-5 " +
          (severe ? "bg-red-500/[0.06]" : "")
        }>
          <div className="flex items-baseline gap-3">
            <span className={
              "text-3xl font-black font-mono tabular-nums " + ovColor
            }>
              {ovSign}{fmt(Math.abs(ov))}
            </span>
            <span className={
              "text-sm font-mono tabular-nums " + ovColor
            }>
              {ovSign}{op.toFixed(1)}%
            </span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-gray-700 font-mono mt-1">
            {neg ? "Under budget" : "Budget overrun"}
          </div>
        </div>

        {/* — EQUIVALENT SPEND — */}
        <EquivalentSpendBlock
          amountM={ov}
          status={p.status}
        />

        {/* — METRICS GRID — */}
        <div className="px-6 py-4 border-t border-gray-800/40">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-700 font-mono mb-1"
              }>
                Original Budget
              </div>
              <div className={
                "text-gray-500 text-sm font-mono " +
                "line-through decoration-gray-800"
              }>
                {fmt(p.originalBudget)}
              </div>
            </div>
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-700 font-mono mb-1"
              }>
                Latest Budget
              </div>
              <div className="text-white text-sm font-mono font-bold">
                {fmt(p.latestBudget)}
              </div>
            </div>
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-700 font-mono mb-1"
              }>
                Original Completion
              </div>
              <div className={
                "text-sm font-mono " +
                (dateMoved
                  ? "text-gray-500 line-through decoration-gray-800"
                  : "text-gray-300")
              }>
                {p.originalDate}
              </div>
            </div>
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-700 font-mono mb-1"
              }>
                Latest Completion
              </div>
              <div className="text-white text-sm font-mono font-bold">
                {p.latestDate}
              </div>
            </div>
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-700 font-mono mb-1"
              }>
                Status
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-700 font-mono mb-1"
              }>
                Category
              </div>
              <div className="text-gray-400 text-sm font-mono">
                {p.category}
                {p.subcategory ? " / " + p.subcategory : ""}
              </div>
            </div>
          </div>
        </div>

        {/* — VARIANCE NOTE — */}
        {(budgetDelta !== 0 || dateMoved) && (
          <div className={
            "mx-6 px-4 py-3 border-l-2 " +
            (severe ? "border-red-500/60" : "border-gray-800")
          }>
            <div className={
              "text-[9px] uppercase tracking-[0.2em] " +
              "text-gray-700 font-mono mb-1.5"
            }>
              Variance Note
            </div>
            <div className="text-gray-400 text-[12px] font-mono leading-relaxed">
              {budgetDelta !== 0 && (
                <span>
                  Budget revised {fmt(p.originalBudget)}
                  {" \u2192 "}{fmt(p.latestBudget)}
                  {" ("}
                  <span className={ovColor}>
                    {ovSign}{fmt(Math.abs(ov))}
                  </span>
                  {"). "}
                </span>
              )}
              {dateMoved && (
                <span>
                  Timeline moved {p.originalDate}
                  {" \u2192 "}{p.latestDate}.
                </span>
              )}
            </div>
          </div>
        )}

        {/* — CRONY / PROCUREMENT LINK — */}
        {p.cronyLinked && (
          <div className={
            "mx-6 mt-4 px-4 py-3 " +
            "border border-amber-500/20 " +
            "bg-amber-500/[0.04] rounded-sm"
          }>
            <div className={
              "flex items-center gap-2 mb-1.5"
            }>
              <ShieldAlert
                size={12}
                className="text-amber-500/70"
              />
              <div className={
                "text-[9px] uppercase " +
                "tracking-[0.2em] " +
                "text-amber-500/70 font-mono"
              }>
                Procurement Scrutiny
              </div>
            </div>
            <div className={
              "text-gray-400 text-[12px] " +
              "font-mono leading-relaxed mb-2"
            }>
              {p.cronyNote}
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate(
                  "suppliers"
                )}
                className={
                  "text-[10px] font-mono " +
                  "uppercase tracking-[0.15em] " +
                  "text-amber-500/60 " +
                  "hover:text-amber-400 " +
                  "transition-colors flex " +
                  "items-center gap-1"
                }
              >
                View in Procurement Scrutiny
                {" \u2192"}
              </button>
            )}
          </div>
        )}

        {/* — BRIEFING — */}
        <div className="px-6 py-4 border-t border-gray-800/40">
          <div className={
            "text-[9px] uppercase tracking-[0.2em] " +
            "text-gray-700 font-mono mb-2"
          }>
            Briefing
          </div>
          <p className="text-gray-400 text-[12px] font-mono leading-relaxed">
            {p.description}
          </p>
        </div>

        {/* — CONTRACTORS — */}
        {p.contractors && p.contractors.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800/40">
            <div className={
              "text-[9px] uppercase tracking-[0.2em] " +
              "text-gray-700 font-mono mb-2"
            }>
              Key Contractors
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {p.contractors.map((c) => (
                <span
                  key={c}
                  className="text-gray-400 text-[11px] font-mono"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* — SOURCES — */}
        {p.sources && p.sources.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800/40">
            <div className={
              "text-[9px] uppercase tracking-[0.2em] " +
              "text-gray-700 font-mono mb-2"
            }>
              Sources
            </div>
            {p.sources.map((s, i) => (
              <a
                key={i}
                href={s}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  "flex items-center gap-1.5 " +
                  "text-gray-600 text-[11px] font-mono " +
                  "hover:text-gray-300 mb-1"
                }
              >
                <ExternalLink size={10} />
                {s.split("/")[2]}
              </a>
            ))}
          </div>
        )}

        {/* — FOOTER RULE — */}
        <div className="px-6 py-4 border-t border-gray-800/40">
          <div className={
            "text-[9px] text-gray-800 font-mono tracking-[0.15em]"
          }>
            ID {p.id} &middot; Last updated {p.lastUpdated || "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  const [view, setView] = useState("overview");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("overrun");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedProject, setSelectedProject] = useState(null);
  const [sourceProject, setSourceProject] =
    useState(null);
  const [subscribeStatus, setSubscribeStatus] = useState(null);

  const [projQuickView, setProjQuickView] = useState(null);
  const [cancelledIdx, setCancelledIdx] = useState(0);
  // Auto-cycle cancelled projects every 6 seconds when on projects view
  useEffect(() => {
    if (view !== "projects") return;
    const cancelledCount = projects.filter(p => p.status === "Cancelled").length;
    if (cancelledCount <= 1) return;
    const timer = setInterval(() => setCancelledIdx(i => (i + 1) % cancelledCount), 6000);
    return () => clearInterval(timer);
  }, [view]);
  const [supQuickView, setSupQuickView] = useState(null);
  const [conQuickView, setConQuickView] = useState(null);
  const [leagueQuickView, setLeagueQuickView] = useState(null);

  // Foreign Aid view state
  const [aidYear, setAidYear] = useState("2024");
  const [aidShowAllRecipients, setAidShowAllRecipients] = useState(false);
  const [aidShowAllSectors, setAidShowAllSectors] = useState(false);
  const [aidProgSearch, setAidProgSearch] = useState("");
  const [aidProgSort, setAidProgSort] = useState("b");
  const [aidProgSortDir, setAidProgSortDir] = useState("desc");
  const [aidProgPage, setAidProgPage] = useState(0);
  const [aidProgSector, setAidProgSector] = useState("All");
  const [conLeagueQuickView, setConLeagueQuickView] = useState(null);

  // Planning & Delays funnel state
  const [planQuickView, setPlanQuickView] =
    useState(null);
  const [planSortBy, setPlanSortBy] =
    useState("daysInApproval");
  const [planSortDir, setPlanSortDir] =
    useState("desc");
  const [planSearch, setPlanSearch] = useState("");
  const [delayQuickView, setDelayQuickView] =
    useState(null);
  const [delaySortBy, setDelaySortBy] =
    useState("delayDays");
  const [delaySortDir, setDelaySortDir] =
    useState("desc");
  const [delaySearch, setDelaySearch] =
    useState("");
  const [planExpanded, setPlanExpanded] =
    useState(null);
  const [delayExpanded, setDelayExpanded] =
    useState(null);
  const [showTrendShare, setShowTrendShare] =
    useState(null);
  const [trendShareCopied, setTrendShareCopied] =
    useState(false);
  const [cronyExpanded, setCronyExpanded] =
    useState(null);
  const [cronyHover, setCronyHover] =
    useState(null);

  // ── Session token for AI endpoints (bot protection) ──
  // Writes to module-level _sessionToken so ChartCard can read it
  useEffect(() => {
    fetch("/api/token")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.token) _sessionToken = d.token; })
      .catch(() => {});
    // Refresh token every 8 minutes (tokens expire after 10)
    const interval = setInterval(() => {
      fetch("/api/token")
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.token) _sessionToken = d.token; })
        .catch(() => {});
    }, 8 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Refresh metadata (fetched from /api/metadata) ──
  const [refreshMeta, setRefreshMeta] = useState({
    lastUpdatedDate: new Date().toISOString().slice(0, 10),
    lastVerifiedMonth: (() => {
      const d = new Date();
      return d.toLocaleString("en-GB", { month: "long" }) + " " + d.getFullYear();
    })(),
  });

  useEffect(() => {
    fetch("/api/metadata")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((m) => {
        if (m.lastUpdatedDate) setRefreshMeta(m);
      })
      .catch((err) => {
        console.warn("[metadata] Could not fetch refresh metadata:", err);
        // Keep the fallback — the UI still works
      });
  }, []);

  // Political Donations view state
  const [donGovFilter, setDonGovFilter] = useState(null);
  const [donPartyFilter, setDonPartyFilter] = useState("All");
  const [donDonorTypeFilter, setDonDonorTypeFilter] = useState("All");
  const [donMinValue, setDonMinValue] = useState("");
  const [donSearchQuery, setDonSearchQuery] = useState("");
  const [donSortCol, setDonSortCol] = useState("value");
  const [donSortDir, setDonSortDir] = useState("desc");
  const [donPage, setDonPage] = useState(0);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [donationRecords, setDonationRecords] = useState([]);
  const [donRecordsLoading, setDonRecordsLoading] = useState(true);

  useEffect(() => {
    fetch("/data/donations-records.json")
      .then(r => r.json())
      .then(data => {
        const decoded = (data.donations || []).map(rec => ({
          ecRef: rec.r, entity: rec.e, party: rec.p, donor: rec.d,
          value: rec.v, accepted: rec.a, donationType: rec.t,
          donorStatus: rec.s, companyReg: rec.c, nature: rec.n || "",
          received: rec.rv, reported: rec.rp, doneeType: rec.dt || "",
          govPeriod: rec.g,
        }));
        setDonationRecords(decoded);
        setDonRecordsLoading(false);
      })
      .catch(() => setDonRecordsLoading(false));
  }, []);

  // MP Accountability Tracker view state
  const [mpPartyFilter, setMpPartyFilter] = useState("All");
  const [mpSearchQuery, setMpSearchQuery] = useState("");
  const [mpSortCol, setMpSortCol] = useState("oi");
  const [mpSortDir, setMpSortDir] = useState("desc");
  const [mpPage, setMpPage] = useState(0);
  const [mpSelectedMP, setMpSelectedMP] = useState(null);
  const [mpRecords, setMpRecords] = useState([]);
  const [mpRecordsLoading, setMpRecordsLoading] = useState(true);
  const [mpDetailTab, setMpDetailTab] = useState("overview");

  useEffect(() => {
    fetch("/data/mp-records.json")
      .then(r => r.json())
      .then(data => {
        setMpRecords(data.mps || []);
        setMpRecordsLoading(false);
      })
      .catch(() => setMpRecordsLoading(false));
  }, []);

  // Lobbying view state
  const [lobSearchQuery, setLobSearchQuery] = useState("");
  const [lobSortCol, setLobSortCol] = useState("cl");
  const [lobSortDir, setLobSortDir] = useState("desc");
  const [lobPage, setLobPage] = useState(0);
  const [lobTab, setLobTab] = useState("directory");
  const [lobRecords, setLobRecords] = useState({ lobbyists: [], topClients: [] });
  const [lobRecordsLoading, setLobRecordsLoading] = useState(true);
  const [lobSelectedFirm, setLobSelectedFirm] = useState(null);

  useEffect(() => {
    fetch("/data/lobbyist-records.json")
      .then(r => r.json())
      .then(data => {
        setLobRecords(data);
        setLobRecordsLoading(false);
      })
      .catch(() => setLobRecordsLoading(false));
  }, []);

  const [chartShare, setChartShare] = useState(null);
  const [chartShareCopied, setChartShareCopied] = useState(false);

  const handleChartShare = useCallback(
    (data) => {
      setChartShare(data);
      setChartShareCopied(false);
    }, []
  );

  // Consultancy page state (suppliers tab)
  const [supConSearch, setSupConSearch] = useState("");
  const [conCompany, setConCompany] = useState("All");
  const [conDept, setConDept] = useState("All");
  const [conCategory, setConCategory] = useState("All");
  const [conLinked, setConLinked] = useState("All");
  const [supConSortBy, setSupConSortBy] = useState("value");
  const [supConSortDir, setSupConSortDir] = useState("desc");

  // Page-level time-range state (one per page section)
  const [govRange, setGovRange] = useState(DEFAULT_RANGE);
  const [govSpendDrill, setGovSpendDrill] = useState(null);
  const [econRange, setEconRange] = useState(DEFAULT_RANGE);
  const [colRange, setColRange] = useState(DEFAULT_RANGE);
  const [prodRange, setProdRange] = useState(DEFAULT_RANGE);
  const [taxDebtRange, setTaxDebtRange] = useState("5y");
  const [flowYear, setFlowYear] = useState("2025-26");
  const [energyRange, setEnergyRange] = useState("10y");
  const [innovRange, setInnovRange] = useState("5y");
  const [defenceRange, setDefenceRange] = useState("5y");
  const [mpPayRange, setMpPayRange] = useState("max");
  const [taxCalcSalary, setTaxCalcSalary] = useState(35000);
  const [flowTaxSalary, setFlowTaxSalary] = useState(55000);

  // League Tables state
  const [leagueSortBy, setLeagueSortBy] = useState(
    "score"
  );
  const [leagueSortDir, setLeagueSortDir] = useState(
    "desc"
  );
  const [leagueSearch, setLeagueSearch] = useState(
    ""
  );
  const [leagueExpanded, setLeagueExpanded] = useState(
    null
  );

  // Consultancy league state
  const [conSortBy, setConSortBy] = useState("depScore");
  const [conSortDir, setConSortDir] = useState("desc");
  const [conSearch, setConSearch] = useState("");
  const [conExpanded, setConExpanded] = useState(null);
  const [conFirmFilter, setConFirmFilter] = useState("");
  const [conCatFilter, setConCatFilter] = useState("");
  const [conRouteFilter, setConRouteFilter] = useState("");
  const [conViewMode, setConViewMode] = useState("department");

  // Redirect removed/merged hubs to their default child views
  useEffect(() => {
    if (view === "economy") setView("economy.output");
    if (view === "league") setView("league.departments");
    if (view === "league.consultancy") setView("suppliers.consultants");
    if (view === "compare") setView("economy.costOfLiving");
    if (view === "costOfLiving") setView("economy.costOfLiving");
    if (view === "taxSpending") setView("government.flow");
    if (view === "wasteProjects") setView("projects");
    if (view === "accountability") setView("transparency.donations");
    if (view === "compare.innovation") setView("economy.innovation");
    if (view === "compare.transport") setView("compare.infrastructure");
    if (view === "compare.fuel") setView("compare.bills");
    if (view === "government.spending") setView("government");
    if (view === "suppliers.scrutiny") setView("suppliers");
    if (view === "compare.affordability") setView("overview");
    if (view === "compare.tax") setView("overview");
  }, [view]);

  // Scroll to top and close mobile nav whenever the view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setMobileNavOpen(false);
  }, [view]);

  const categories = ["All", ...new Set(projects.map((p) => p.category))];
  const statuses = [
    "All", "Completed", "In Progress", "Cancelled", "In Development", "In Planning"
  ];

  // ---- Consultancy: filter options ----
  const conCompanies = useMemo(() => {
    const s = new Set(consultancyRaw.map((c) => c.normalizedCompanyName));
    return ["All", ...[...s].sort()];
  }, []);
  const conDepts = useMemo(() => {
    const s = new Set(consultancyRaw.map((c) => c.department));
    return ["All", ...[...s].sort()];
  }, []);
  const conCategories = useMemo(() => {
    const s = new Set(consultancyRaw.map((c) => c.contractCategory));
    return ["All", ...[...s].sort()];
  }, []);

  // ---- Consultancy: filtered data ----
  const conFiltered = useMemo(() => {
    const s = supConSearch.toLowerCase();
    let f = consultancyRaw.filter((c) => {
      const ms = !supConSearch ||
        c.companyName.toLowerCase().includes(s) ||
        c.normalizedCompanyName.toLowerCase().includes(s) ||
        c.contractTitle.toLowerCase().includes(s) ||
        c.department.toLowerCase().includes(s);
      const mc = conCompany === "All" ||
        c.normalizedCompanyName === conCompany;
      const md = conDept === "All" || c.department === conDept;
      const mk = conCategory === "All" ||
        c.contractCategory === conCategory;
      const ml = conLinked === "All" ||
        (conLinked === "Linked" && c.linkedProjectId) ||
        (conLinked === "Standalone" && !c.linkedProjectId);
      return ms && mc && md && mk && ml;
    });
    f.sort((a, b) => {
      if (supConSortBy === "value") {
        return supConSortDir === "desc"
          ? b.contractValue - a.contractValue
          : a.contractValue - b.contractValue;
      }
      if (supConSortBy === "date") {
        return supConSortDir === "desc"
          ? (b.awardDate || "").localeCompare(a.awardDate || "")
          : (a.awardDate || "").localeCompare(b.awardDate || "");
      }
      if (supConSortBy === "company") {
        const cmp = a.normalizedCompanyName.localeCompare(
          b.normalizedCompanyName
        );
        return supConSortDir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
    return f;
  }, [supConSearch, conCompany, conDept, conCategory,
      conLinked, supConSortBy, supConSortDir]);

  // ---- Consultancy: totals ----
  const conTotalValue = conFiltered.reduce(
    (s, c) => s + c.contractValue, 0
  );
  const conLinkedCount = conFiltered.filter(
    (c) => c.linkedProjectId
  ).length;

  // ---- Consultancy: company rollups ----
  const conCompanyRollups = useMemo(() => {
    const map = {};
    conFiltered.forEach((c) => {
      const k = c.normalizedCompanyName;
      if (!map[k]) {
        map[k] = {
          name: k, contracts: 0, totalValue: 0,
          departments: new Set(), projects: new Set(),
          firstDate: c.awardDate, latestDate: c.awardDate
        };
      }
      map[k].contracts++;
      map[k].totalValue += c.contractValue;
      map[k].departments.add(c.department);
      if (c.linkedProjectName) {
        map[k].projects.add(c.linkedProjectName);
      }
      if (c.awardDate < map[k].firstDate) {
        map[k].firstDate = c.awardDate;
      }
      if (c.awardDate > map[k].latestDate) {
        map[k].latestDate = c.awardDate;
      }
    });
    return Object.values(map)
      .map((r) => ({
        ...r,
        departments: r.departments.size,
        projects: r.projects.size
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [conFiltered]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    let f = projects.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(s) ||
        p.department.toLowerCase().includes(s) ||
        p.contractors.some((c) => c.toLowerCase().includes(s));
      const matchCat = categoryFilter === "All" || p.category === categoryFilter;
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
    f.sort((a, b) => {
      let va, vb;
      if (sortBy === "overrun") {
        va = getOverrun(a);
        vb = getOverrun(b);
      } else if (sortBy === "budget") {
        va = a.latestBudget;
        vb = b.latestBudget;
      } else {
        va = a.name;
        vb = b.name;
      }
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return f;
  }, [search, categoryFilter, statusFilter, sortBy, sortDir]);

  // Stats
  const totalOriginal = projects.reduce((s, p) => s + p.originalBudget, 0);
  const totalLatest = projects.reduce((s, p) => s + p.latestBudget, 0);
  const totalOverrun = totalLatest - totalOriginal;
  const cancelledWaste = projects
    .filter((p) => p.status === "Cancelled" || p.status === "Compensation Ongoing")
    .reduce((s, p) => s + p.latestBudget, 0);
  const avgOverrunPct = projects.reduce(
    (s, p) => s + getOverrunPct(p), 0
  ) / projects.length;

  // Chart data
  const overrunChart = useMemo(() => {
    return [...projects]
      .filter((p) => getOverrun(p) > 0)
      .sort((a, b) => getOverrun(b) - getOverrun(a))
      .slice(0, 12)
      .map((p) => ({
        name: p.name.length > 22 ? p.name.slice(0, 20) + "..." : p.name,
        overrun: getOverrun(p),
        total: p.latestBudget,
        color: categoryColors[p.category] || "#6b7280"
      }));
  }, []);

  const overrunPctChart = useMemo(() => {
    return [...projects]
      .filter((p) => getOverrunPct(p) > 0)
      .sort((a, b) => getOverrunPct(b) - getOverrunPct(a))
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        shortName: p.name.length > 28 ? p.name.slice(0, 26) + "\u2026" : p.name,
        pct: Math.round(getOverrunPct(p)),
        budget: p.originalBudget,
        latest: p.latestBudget,
        overrun: p.latestBudget - p.originalBudget,
        color: categoryColors[p.category] || "#6b7280",
        category: p.category
      }));
  }, []);

  const categoryData = useMemo(() => {
    const m = {};
    projects.forEach((p) => {
      if (!m[p.category]) {
        m[p.category] = { name: p.category, total: 0, overrun: 0, count: 0 };
      }
      m[p.category].total += p.latestBudget;
      m[p.category].overrun += Math.max(0, getOverrun(p));
      m[p.category].count++;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, []);

  const scatterData = useMemo(() => {
    return projects
      .filter((p) => getOverrun(p) !== 0)
      .map((p) => ({
        name: p.name,
        x: p.originalBudget,
        y: getOverrunPct(p),
        z: p.latestBudget,
        fill: categoryColors[p.category] || "#6b7280"
      }));
  }, []);

  const contractorData = useMemo(() => {
    const m = {};
    projects.forEach((p) => {
      p.contractors.forEach((c) => {
        if (c === "Multiple contractors" || c === "TBD") return;
        if (!m[c]) {
          m[c] = {
            name: c, totalValue: 0, projects: [],
            overruns: 0, projectCount: 0
          };
        }
        m[c].totalValue += p.latestBudget;
        m[c].projects.push(p.name);
        m[c].overruns += Math.max(0, getOverrun(p));
        m[c].projectCount++;
      });
    });
    return Object.values(m).sort((a, b) => b.totalValue - a.totalValue);
  }, []);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

// ---- Quick-view presets ----
  // Each set targets the sharpest questions
  // for that dataset.

  const PROJECT_PRESETS = [
    {
      id: "biggest-overruns",
      label: "Biggest Overruns",
      sortBy: "overrun", sortDir: "desc"
    },
    {
      id: "worst-overrun-pct",
      label: "Worst Overrun %",
      sortBy: "overrunPct", sortDir: "desc"
    },
    {
      id: "most-wasted",
      label: "Most Wasted",
      sortBy: "wasted", sortDir: "desc"
    },
    {
      id: "still-bleeding",
      label: "Still Bleeding",
      sortBy: "overrun", sortDir: "desc",
      filterStatus: "In Progress"
    },
    {
      id: "cancelled",
      label: "Cancelled",
      sortBy: "budget", sortDir: "desc",
      filterStatus: "Cancelled"
    }
  ];

  const SUPPLIER_PRESETS = [
    {
      id: "biggest-awards",
      label: "Biggest Awards",
      sortBy: "value", sortDir: "desc"
    },
    {
      id: "most-recent",
      label: "Most Recent",
      sortBy: "date", sortDir: "desc"
    },
    {
      id: "no-oversight",
      label: "No Project Link",
      sortBy: "value", sortDir: "desc",
      filterLinked: "Standalone"
    },
    {
      id: "project-linked",
      label: "Project-Linked",
      sortBy: "value", sortDir: "desc",
      filterLinked: "Linked"
    }
  ];

  const PLANNING_PRESETS = [
    {
      id: "longest-approval",
      label: "Longest Approval",
      sortBy: "daysInApproval", sortDir: "desc"
    },
    {
      id: "most-extensions",
      label: "Most Extensions",
      sortBy: "deadlineExtensions", sortDir: "desc"
    },
    {
      id: "still-pending",
      label: "Still Pending",
      sortBy: "daysInApproval", sortDir: "desc",
      filterStatus: "pending"
    },
    {
      id: "refused",
      label: "Refused / Blocked",
      sortBy: "daysInApproval", sortDir: "desc",
      filterStatus: "refused"
    }
  ];

  const DELAY_PRESETS = [
    {
      id: "most-delayed",
      label: "Most Delayed",
      sortBy: "delayDays", sortDir: "desc"
    },
    {
      id: "worst-slip-pct",
      label: "Biggest Slip %",
      sortBy: "delayPct", sortDir: "desc"
    },
    {
      id: "most-revisions",
      label: "Most Revisions",
      sortBy: "revisedDeadlines", sortDir: "desc"
    },
    {
      id: "highest-cost-per-day",
      label: "Cost Per Delay Day",
      sortBy: "extraCostPerDelayDayM",
      sortDir: "desc"
    }
  ];

  const LEAGUE_DEPT_PRESETS = [
    {
      id: "worst-offenders",
      label: "Worst Offenders",
      sortBy: "score", sortDir: "desc"
    },
    {
      id: "biggest-overruns",
      label: "Biggest Overruns",
      sortBy: "overrun", sortDir: "desc"
    },
    {
      id: "most-wasted",
      label: "Most Wasted",
      sortBy: "wasted", sortDir: "desc"
    },
    {
      id: "most-projects-over",
      label: "Most Projects Over",
      sortBy: "pctOver", sortDir: "desc"
    }
  ];

  const LEAGUE_CON_PRESETS = [
    {
      id: "most-dependent",
      label: "Most Dependent",
      sortBy: "depScore", sortDir: "desc"
    },
    {
      id: "highest-spend",
      label: "Highest Spend",
      sortBy: "spend", sortDir: "desc"
    },
    {
      id: "spend-per-head",
      label: "Spend / Head",
      sortBy: "spendEmp", sortDir: "desc"
    },
    {
      id: "most-concentrated",
      label: "Few Firms Dominate",
      sortBy: "concentration", sortDir: "desc"
    }
  ];

  // Quick-view handlers
  const handleProjectQuickView = (preset) => {
    if (projQuickView === preset.id) {
      setProjQuickView(null);
      return;
    }
    setProjQuickView(preset.id);
    setSortBy(preset.sortBy);
    setSortDir(preset.sortDir || "desc");
    if (preset.filterStatus) {
      setStatusFilter(preset.filterStatus);
    } else {
      setStatusFilter("All");
    }
  };

  const handleSupplierQuickView = (preset) => {
    if (supQuickView === preset.id) {
      setSupQuickView(null);
      return;
    }
    setSupQuickView(preset.id);
    setSupConSortBy(preset.sortBy);
    setSupConSortDir(preset.sortDir || "desc");
    if (preset.filterLinked) {
      setConLinked(preset.filterLinked);
    } else {
      setConLinked("All");
    }
  };

  const handleLeagueDeptQuickView = (preset) => {
    if (leagueQuickView === preset.id) {
      setLeagueQuickView(null);
      return;
    }
    setLeagueQuickView(preset.id);
    setLeagueSortBy(preset.sortBy);
    setLeagueSortDir(preset.sortDir || "desc");
  };

  const handleLeagueConQuickView = (preset) => {
    if (conLeagueQuickView === preset.id) {
      setConLeagueQuickView(null);
      return;
    }
    setConLeagueQuickView(preset.id);
    setConSortBy(preset.sortBy);
    setConSortDir(preset.sortDir || "desc");
  };
  const handlePlanQuickView = (preset) => {
    if (planQuickView === preset.id) {
      setPlanQuickView(null);
      return;
    }
    setPlanQuickView(preset.id);
    setPlanSortBy(preset.sortBy);
    setPlanSortDir(preset.sortDir || "desc");
  };

  const handleDelayQuickView = (preset) => {
    if (delayQuickView === preset.id) {
      setDelayQuickView(null);
      return;
    }
    setDelayQuickView(preset.id);
    setDelaySortBy(preset.sortBy);
    setDelaySortDir(preset.sortDir || "desc");
  };

  const togglePlanSort = (col) => {
    if (planSortBy === col) {
      setPlanSortDir(
        planSortDir === "desc" ? "asc" : "desc"
      );
    } else {
      setPlanSortBy(col);
      setPlanSortDir("desc");
    }
  };

  const toggleDelaySort = (col) => {
    if (delaySortBy === col) {
      setDelaySortDir(
        delaySortDir === "desc" ? "asc" : "desc"
      );
    } else {
      setDelaySortBy(col);
      setDelaySortDir("desc");
    }
  };

  const navItems = [
    {
      id: "overview",
      label: "Home",
      icon: BarChart3
    },
    {
      id: "costOfLiving",
      label: "Cost of Living",
      icon: PoundSterling,
      children: [
        { id: "economy.costOfLiving", label: "Prices & Inflation" },
        { id: "economy.energy", label: "Energy" },
        { id: "compare.bills", label: "Bills, Fuel & Energy" },
        { id: "compare.infrastructure", label: "Transport & Infrastructure" },
      ]
    },
    {
      id: "taxSpending",
      label: "Tax & Spending",
      icon: Briefcase,
      children: [
        { id: "government.flow", label: "Where Your Money Goes" },
        { id: "government.taxdebt", label: "Tax & Public Finances" },
        { id: "government", label: "Civil Service & Spending" },
        { id: "compare.defence", label: "Defence" },
        { id: "government.apd", label: "Air Passenger Duty" }
      ]
    },
    {
      id: "wasteProjects",
      label: "Waste & Projects",
      icon: AlertTriangle,
      children: [
        { id: "projects", label: "Budget Overruns" },
        { id: "projects.planning", label: "Planning Failures" },
        { id: "projects.delays", label: "Delivery Delays" },
        { id: "suppliers", label: "Suppliers & Contracts" },
        { id: "suppliers.consultants", label: "Consultancy Spend" },
        { id: "league.departments", label: "Department Rankings" }
      ]
    },
    {
      id: "accountability",
      label: "Accountability",
      icon: Scale,
      children: [
        { id: "transparency.donations", label: "Political Donations" },
        { id: "transparency.mppay", label: "MPs' Pay vs the Country" },
        { id: "transparency.mp", label: "MPs' Income & Expenses" },
        { id: "transparency.lobbying", label: "Lobbying" },
        { id: "transparency.aid", label: "Foreign Aid" }
      ]
    },
    {
      id: "economy",
      label: "Economy",
      icon: Factory,
      children: [
        { id: "economy.output", label: "GDP & Output" },
        { id: "economy.production", label: "Production & Trade" },
        { id: "economy.innovation", label: "Innovation & R&D" },
        { id: "economy.markets", label: "Markets" },
        { id: "compare.structural", label: "Structural Performance" }
      ]
    }
  ];

  const activeParent = navItems.find(
    (n) =>
      view === n.id ||
      (n.children &&
        n.children.some(
          (c) => c.id === view
        ))
  );

  const activeChildren =
    activeParent && activeParent.children
      ? activeParent.children
      : null;

  // Tooltip renderers
  const ttOverrun = (d) => (
    <>
      <p className="text-white font-medium">{d.name}</p>
      <p className="text-red-400 text-xs">Overrun: {fmt(d.overrun)}</p>
      <p className="text-gray-400 text-xs">Total: {fmt(d.total)}</p>
    </>
  );

  const ttPct = (d) => (
    <>
      <p className="text-white font-medium text-sm">{d.name}</p>
      <p className="text-amber-400 text-xs font-bold">+{d.pct}% over budget</p>
      {d.budget != null && (
        <p className="text-gray-400 text-xs">{fmt(d.budget)} {"\u2192"} {fmt(d.latest)} (+{fmt(d.overrun)})</p>
      )}
    </>
  );

  const ttCategory = (d) => (
    <>
      <p className="text-white font-medium">{d.name}</p>
      <p className="text-gray-300 text-xs">Total: {fmt(d.total)}</p>
      <p className="text-red-400 text-xs">Overrun: {fmt(d.overrun)}</p>
      <p className="text-gray-400 text-xs">{d.count} projects</p>
    </>
  );

  const ttScatter = (d) => (
    <>
      <p className="text-white font-medium">{d.name}</p>
      <p className="text-gray-400 text-xs">Original: {fmt(d.x)}</p>
      <p className="text-red-400 text-xs">
        Overrun: {d.y > 0 ? "+" : ""}{d.y.toFixed(0)}%
      </p>
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER — minimal editorial bar */}
      <header className={
        "border-b border-gray-800/50 " +
        "bg-black sticky top-0 z-40"
      }>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          {/* Top bar: brand + meta — stacks to two rows on mobile */}
          <div className={
            "flex flex-col md:flex-row md:items-center md:justify-between " +
            "py-3 md:py-3 gap-2 md:gap-0"
          }>
            <div className="flex items-center gap-2.5">
              <img
                src="/gracchus-icon.svg"
                alt="Gracchus"
                className="w-4 h-4 md:w-5 md:h-5"
              />
              <span className={
                "text-[10px] md:text-[11px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-400"
              }>
                GRACCHUS
              </span>
              <a
                href="https://x.com/GracchusHQ"
                target="_blank"
                rel="noopener noreferrer"
                className={
                  "ml-2 inline-flex items-center gap-1.5 " +
                  "text-gray-600 hover:text-white transition-colors " +
                  "border border-gray-800 hover:border-gray-600 " +
                  "rounded-full px-2.5 py-1"
                }
                title="Follow @GracchusHQ on X"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-[9px] uppercase tracking-[0.1em] font-medium hidden sm:inline">
                  Follow
                </span>
              </a>
            </div>
            <div className={
              "flex items-center gap-4 md:gap-6 " +
              "text-[9px] md:text-[10px] uppercase " +
              "tracking-[0.15em] text-gray-600"
            }>
              <span>
                Last updated: {refreshMeta.lastUpdatedDate}
              </span>
              <span>Source: Public Records</span>
            </div>
          </div>
          {/* Nav strip — desktop */}
          <nav className={
            "hidden md:flex items-center gap-1 " +
            "border-t border-gray-800/40 " +
            "-mx-6 px-6 overflow-x-auto"
          }>
            {navItems.map((n) => {
              const isActive =
                view === n.id ||
                (n.children &&
                  n.children.some(
                    (c) => c.id === view
                  ));
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    setView(n.id);
                    setOpenDropdown(null);
                  }}
                  className={
                    "px-4 py-2.5 text-xs " +
                    "uppercase tracking-[0.12em] " +
                    "font-medium transition-colors " +
                    "border-b-2 -mb-px " +
                    (isActive
                      ? "border-red-500 text-white"
                      : "border-transparent " +
                        "text-gray-500 " +
                        "hover:text-gray-300")
                  }
                >
                  {n.label}
                </button>
              );
            })}
          </nav>
          {/* Mobile hamburger button */}
          <div className="md:hidden border-t border-gray-800/40 -mx-6 px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
              <span className="text-xs uppercase tracking-[0.12em] font-medium">
                {activeParent ? activeParent.label : "Menu"}
              </span>
            </button>
          </div>
          {/* Mobile nav drawer */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-gray-800/40 -mx-6 px-6 py-3 bg-gray-950/95 backdrop-blur-sm max-h-[70vh] overflow-y-auto">
              {navItems.map((n) => {
                const isActive =
                  view === n.id ||
                  (n.children && n.children.some((c) => c.id === view));
                return (
                  <div key={n.id}>
                    <button
                      onClick={() => {
                        setView(n.id);
                        if (!n.children) setMobileNavOpen(false);
                      }}
                      className={
                        "w-full text-left px-3 py-3 text-xs uppercase tracking-[0.12em] font-medium transition-colors " +
                        (isActive ? "text-white bg-gray-800/50" : "text-gray-500 hover:text-gray-300")
                      }
                    >
                      {n.label}
                    </button>
                    {isActive && n.children && (
                      <div className="pl-6 pb-1">
                        {n.children.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setView(c.id);
                              setMobileNavOpen(false);
                            }}
                            className={
                              "w-full text-left px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] font-medium transition-colors " +
                              (view === c.id ? "text-white" : "text-gray-600 hover:text-gray-400")
                            }
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Sub-nav strip — desktop only */}
          {activeChildren &&
            activeChildren.length > 1 && (
            <div className={
              "hidden md:flex border-t border-gray-800/30 " +
              "gap-0.5 py-1.5"
            }>
              {activeChildren.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    setView(c.id)
                  }
                  className={
                    "px-3 py-1 text-[11px] " +
                    "uppercase tracking-[0.1em] " +
                    "font-medium transition-colors " +
                    (view === c.id
                      ? "text-white " +
                        "bg-gray-800/50"
                      : "text-gray-600 " +
                        "hover:text-gray-400")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-2 sm:px-6 py-4 sm:py-8">

        {/* ============ OVERVIEW ============ */}
        {view === "overview" && (
          <div>
            {/* ========= HERO ========= */}
            <div className="pt-8 md:pt-12 pb-6 md:pb-8">
              <div className={
                "text-[12px] uppercase tracking-[0.25em] " +
                "font-medium text-red-500 mb-4 " +
                "flex items-center gap-2"
              }>
                <AlertTriangle size={13} />
                Critical Inefficiency Detected
              </div>
              <div className={
                "flex flex-col lg:flex-row " +
                "lg:items-center lg:justify-between gap-8"
              }>
                {/* LEFT — Main overrun headline */}
                <div className="flex-1 min-w-0">
                  <div className={
                    "text-[12px] uppercase tracking-[0.2em] " +
                    "text-gray-600 font-medium mb-3"
                  }>
                    Major UK Public Projects {"·"} Since 2000
                  </div>
                  <div className={
                    "text-4xl sm:text-6xl md:text-8xl " +
                    "lg:text-[120px] " +
                    "font-black text-red-500 " +
                    "leading-[0.85] tracking-tighter"
                  }>
                    {fmt(totalOverrun)}
                  </div>
                  <div className={
                    "text-3xl md:text-4xl font-black " +
                    "uppercase tracking-tight mt-2"
                  }>
                    Over Budget.
                  </div>
                  <div className={
                    "text-gray-500 text-[14px] sm:text-[17px] mt-3 sm:mt-4 " +
                    "leading-relaxed border-l-2 " +
                    "border-gray-800 pl-3 sm:pl-4"
                  }>
                    <span>
                      Across {projects.length} major UK
                      projects.
                    </span>
                    <br />
                    <span>
                      Original estimate:{" "}
                      <span className="text-gray-300 font-semibold">
                        {fmt(totalOriginal)}
                      </span>
                      . Latest estimate:{" "}
                      <span className="text-gray-300 font-semibold">
                        {fmt(totalLatest)}
                      </span>
                      .
                    </span>
                  </div>
                </div>

                {/* RIGHT — Editorial story rail: Red Flags */}
                <div className={
                  "w-full lg:w-[400px] xl:w-[440px] shrink-0 mt-4 lg:mt-0"
                }>
                  <div className={
                    "border border-gray-800/60 bg-gray-950/40"
                  }>
                    <div className={
                      "px-5 py-3 border-b border-gray-800/60 " +
                      "flex items-center justify-between"
                    }>
                      <div className={
                        "text-[13px] uppercase tracking-[0.25em] " +
                        "font-mono text-red-500 font-bold"
                      }>
                        Red Flags
                      </div>
                      <div className={
                        "text-[11px] uppercase tracking-[0.15em] " +
                        "font-mono text-gray-700"
                      }>
                        Editorially curated
                      </div>
                    </div>
                    {[
                      {
                        headline: "£" + welfareTimeline.slice(-2)[0].total + "bn on welfare — more than health, defence and education combined",
                        tag: "Welfare",
                        view: "government",
                        accent: "text-red-500"
                      },
                      {
                        headline: "20% of UK foreign aid never leaves the country — spent hosting refugees here",
                        tag: "Foreign Aid",
                        view: "transparency.aid",
                        accent: "text-amber-500"
                      },
                      {
                        headline: "Productivity growth: " + econOutputData.headline.productivityYoYPct + "%. GDP up just " + econOutputData.headline.gdpGrowthQoQ + "% last quarter",
                        tag: "Stagnation",
                        view: "economy.output",
                        accent: "text-red-400"
                      },
                      {
                        headline: planningData.gridConnectionQueue.projectsInQueue.toLocaleString("en-GB") + " energy projects stuck in a " + Math.floor(planningData.gridConnectionQueue.averageWaitMonths / 12) + "+ year grid queue — net zero is physically impossible",
                        tag: "Energy",
                        view: "projects.planning",
                        accent: "text-amber-500"
                      },
                      {
                        headline: "Government borrows £" + Math.round((publicFinancesFlowData.annual.find(y => y.year === "2024-25")?.netBorrowing || 153) * 1000 / 365) + "m every single day",
                        tag: "Public Debt",
                        view: "government.flow",
                        accent: "text-red-500"
                      }
                    ].map((story, i) => (
                      <button
                        key={i}
                        onClick={() => setView(story.view)}
                        className={
                          "w-full text-left px-5 py-2.5 " +
                          "border-b border-gray-800/40 last:border-b-0 " +
                          "hover:bg-white/[0.03] " +
                          "transition-colors group"
                        }
                      >
                        <div className={
                          "flex items-start gap-3"
                        }>
                          <div className={
                            "text-[18px] font-black text-gray-800 " +
                            "leading-none mt-0.5 font-mono shrink-0 " +
                            "w-5 text-right"
                          }>
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={
                              "text-[11px] uppercase tracking-[0.2em] " +
                              "font-mono mb-1 " + story.accent
                            }>
                              {story.tag}
                            </div>
                            <div className={
                              "text-[13px] sm:text-[15px] font-bold text-gray-300 " +
                              "leading-snug " +
                              "group-hover:text-white transition-colors"
                            }>
                              {story.headline}
                            </div>
                          </div>
                          <ChevronRight
                            size={12}
                            className={
                              "text-gray-800 mt-1 shrink-0 " +
                              "group-hover:text-gray-500 transition-colors"
                            }
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ========= LIVE BORROWING COUNTER ========= */}
            <BorrowingCounter
              annualBorrowingBn={
                publicFinancesFlowData.annual.find(
                  (y) => y.year === "2024-25"
                )?.netBorrowing || 153
              }
            />

            {/* ========= LIVE TICKER STRIP ========= */}
            <LiveTickerStrip
              data={[
                {
                  label: "CPI Inflation",
                  value: costOfLivingData.headline.cpiPct + "%",
                  status: parseFloat(costOfLivingData.headline.cpiPct) > 2 ? "bad" : "good"
                },
                {
                  label: "Real Wages",
                  value: (costOfLivingData.headline.realWageGrowthPct > 0 ? "+" : "") + costOfLivingData.headline.realWageGrowthPct + "%",
                  status: costOfLivingData.headline.realWageGrowthPct >= 0 ? "good" : "bad"
                },
                {
                  label: "NHS Waiting",
                  value: econOutputData.headline.nhsWaiting || "7.31M",
                  status: "bad"
                },
                {
                  label: "Unemployment",
                  value: econOutputData.headline.unemploymentPct + "%",
                  status: parseFloat(econOutputData.headline.unemploymentPct) > 4.5 ? "bad" : "neutral"
                },
                {
                  label: "Debt Interest",
                  value: "£" + (publicFinancesData.series ? publicFinancesData.series.slice(-1)[0].debtInterestNet : "87") + "bn/yr",
                  status: "bad"
                },
                {
                  label: "Petrol",
                  value: costOfLivingData.headline.petrolPenceLitre + "p/L",
                  status: parseFloat(costOfLivingData.headline.petrolPenceLitre) > 145 ? "bad" : "neutral"
                }
              ]}
            />

            {/* ========= ISSUE AREAS — PRIMARY ENTRY POINTS ========= */}
            <div className={
              "border-t border-gray-800/50 pt-10 pb-6"
            }>
              <div className={
                "text-[13px] uppercase tracking-[0.3em] " +
                "font-medium text-gray-600 mb-6"
              }>
                What Matters Right Now
              </div>
              <div className={
                "grid grid-cols-1 sm:grid-cols-2 " +
                "lg:grid-cols-3 gap-0 border " +
                "border-gray-800/60"
              }>
                {[
                  {
                    id: "economy.costOfLiving",
                    eyebrow: "Cost of Living",
                    title: costOfLivingData.headline.cpiPct + "% inflation",
                    desc: "Petrol " + costOfLivingData.headline.petrolPenceLitre + "p/L. Diesel " + costOfLivingData.headline.dieselPenceLitre + "p/L. Prices still elevated after the 2022\u201323 shock.",
                    accent: "text-red-500",
                    border: "border-red-500/40"
                  },
                  {
                    id: "government.taxdebt",
                    eyebrow: "Tax & Public Debt",
                    title: "£" + (publicFinancesData.series ? publicFinancesData.series.slice(-1)[0].debtInterestNet : "87") + "bn interest",
                    desc: "The UK pays more in debt interest than it spends on defence. Tax receipts can't keep up.",
                    accent: "text-red-500",
                    border: "border-red-500/40"
                  },
                  {
                    id: "projects",
                    eyebrow: "Waste & Overruns",
                    title: fmt(totalOverrun) + " over budget",
                    desc: projects.filter(p => p.status === "Cancelled").length + " projects cancelled. " + fmt(cancelledWaste) + " written off entirely.",
                    accent: "text-red-500",
                    border: "border-red-500/40"
                  },
                  {
                    id: "suppliers",
                    eyebrow: "Suppliers & Contracts",
                    title: suppliersSummary.length + " firms tracked",
                    desc: "Who gets paid, how much, and whether the work was competitively tendered.",
                    accent: "text-amber-500",
                    border: "border-amber-500/30"
                  },
                  {
                    id: "economy.output",
                    eyebrow: "Economy",
                    title: "£" + econOutputData.headline.gdpBnGbp + "bn GDP",
                    desc: "Growth near zero. Productivity 38% behind the US. Real wages barely recovered.",
                    accent: "text-amber-500",
                    border: "border-amber-500/30"
                  },
                  {
                    id: "league.departments",
                    eyebrow: "Department Rankings",
                    title: "MoD: 19 of 27 projects over budget",
                    desc: "\u00A3132.5bn in defence cost overruns. Which departments deliver \u2014 and which don\u2019t.",
                    accent: "text-red-400",
                    border: "border-red-500/30"
                  }
                ].map((tile) => (
                  <button
                    key={tile.id}
                    onClick={() => setView(tile.id)}
                    className={
                      "text-left px-5 py-6 border-b " +
                      "border-r border-gray-800/60 " +
                      "hover:bg-white/[0.02] " +
                      "transition-colors group"
                    }
                  >
                    <div className={
                      "text-[12px] uppercase tracking-[0.2em] " +
                      "font-mono mb-2 " + tile.accent
                    }>
                      {tile.eyebrow}
                    </div>
                    <div className={
                      "border-l-2 " + tile.border + " pl-3"
                    }>
                      <div className={
                        "text-xl font-black text-white " +
                        "tracking-tight"
                      }>
                        {tile.title}
                      </div>
                      <div className={
                        "text-[14px] text-gray-500 mt-1 " +
                        "leading-relaxed"
                      }>
                        {tile.desc}
                      </div>
                    </div>
                    <div className={
                      "text-[11px] uppercase tracking-[0.15em] " +
                      "text-gray-700 mt-4 font-mono " +
                      "group-hover:text-gray-500 transition-colors"
                    }>
                      Explore {tile.eyebrow.toLowerCase()} {"\u2192"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ========= STATE OF THE COUNTRY ========= */}
            <div className="py-10 border-t border-gray-800/50">
              <div className={
                "text-[13px] uppercase tracking-[0.3em] " +
                "font-medium text-gray-600 mb-1"
              }>
                State of the Country
              </div>
              <div className={
                "text-[16px] text-gray-500 mb-8 leading-relaxed"
              }>
                Key indicators of UK performance
              </div>
              <div className={
                "grid grid-cols-1 sm:grid-cols-2 " +
                "lg:grid-cols-4 gap-0 border-t border-gray-800/60"
              }>
                {[
                  {
                    title: "Productivity",
                    stat: "$56.50/hr",
                    desc: "38% behind the US. Stagnant since 2008.",
                    link: "compare.structural",
                    accent: "border-red-500/50"
                  },
                  {
                    title: "Real Wages",
                    stat: "+14%",
                    desc: "Growth over 23 years. US grew 38%.",
                    link: "compare.structural",
                    accent: "border-red-500/50"
                  },
                  {
                    title: "Electricity",
                    stat: "$0.35/kWh",
                    desc: "Among the highest in Europe.",
                    link: "compare.bills",
                    accent: "border-amber-500/50"
                  },
                  {
                    title: "Housing",
                    stat: "113.7",
                    desc: "Price-to-income. 57% less affordable since 2000.",
                    link: "compare.structural",
                    accent: "border-red-500/50"
                  }
                ].map((tile) => (
                  <button
                    key={tile.title}
                    onClick={() => setView(tile.link)}
                    className={
                      "text-left px-5 py-6 border-b " +
                      "border-r border-gray-800/60 " +
                      "hover:bg-white/[0.02] transition-colors group"
                    }
                  >
                    <div className={
                      "text-[12px] uppercase tracking-[0.2em] " +
                      "text-gray-600 font-mono mb-2"
                    }>
                      {tile.title}
                    </div>
                    <div className={
                      "border-l-2 " + tile.accent + " pl-3"
                    }>
                      <div className="text-2xl font-black text-white tracking-tight">
                        {tile.stat}
                      </div>
                      <div className="text-[14px] text-gray-500 mt-1 leading-relaxed">
                        {tile.desc}
                      </div>
                    </div>
                    <div className={
                      "text-[11px] uppercase tracking-[0.15em] " +
                      "text-gray-700 mt-4 font-mono " +
                      "group-hover:text-gray-500 transition-colors"
                    }>
                      View data {"\u2192"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ========= WASTE SPOTLIGHT ========= */}
            <WasteSpotlight
              projects={projects}
              onExplore={() => setView("projects")}
              fmt={fmt}
            />

            {/* ========= EMAIL CAPTURE & SOCIAL CTA ========= */}
            <div className="border-t border-gray-800/50 py-10">
              <div className="max-w-xl mx-auto text-center">
                <div className={
                  "text-[12px] uppercase tracking-[0.3em] " +
                  "text-red-500 font-mono mb-3"
                }>
                  Stay Informed
                </div>
                <div className="text-2xl font-black text-white mb-2 tracking-tight">
                  The Gracchus Weekly Briefing
                </div>
                <div className="text-[14px] text-gray-500 mb-6 leading-relaxed">
                  The most important UK data, every Monday morning.
                  Red Flags, waste alerts, and the numbers that matter.
                </div>
                {subscribeStatus === "done" ? (
                  <div className="text-emerald-400 text-[14px] font-mono py-3">
                    You're in. First briefing lands Monday.
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const email = e.target.elements.email?.value;
                      if (!email) return;
                      setSubscribeStatus("loading");
                      try {
                        const res = await fetch("/api/subscribe", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setSubscribeStatus("done");
                        } else {
                          setSubscribeStatus(data.error || "Something went wrong");
                        }
                      } catch {
                        setSubscribeStatus("Network error — try again");
                      }
                    }}
                    className="flex gap-2 max-w-md mx-auto"
                  >
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="your@email.com"
                      className={
                        "flex-1 bg-gray-950 border border-gray-800 " +
                        "px-4 py-2.5 text-[14px] text-gray-300 " +
                        "placeholder:text-gray-700 " +
                        "focus:border-red-500/50 focus:outline-none " +
                        "transition-colors"
                      }
                    />
                    <button
                      type="submit"
                      disabled={subscribeStatus === "loading"}
                      className={
                        "px-5 py-2.5 bg-red-600 hover:bg-red-500 " +
                        "text-white text-[12px] font-bold uppercase " +
                        "tracking-[0.15em] transition-colors shrink-0 " +
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      }
                    >
                      {subscribeStatus === "loading" ? "..." : "Subscribe"}
                    </button>
                  </form>
                )}
                {subscribeStatus && subscribeStatus !== "done" && subscribeStatus !== "loading" && (
                  <div className="text-red-400 text-[12px] font-mono mt-2">
                    {subscribeStatus}
                  </div>
                )}
                <div className="mt-6 flex items-center justify-center gap-4">
                  <a
                    href="https://x.com/GracchusHQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      "inline-flex items-center gap-2 " +
                      "text-[11px] uppercase tracking-[0.15em] " +
                      "text-gray-600 font-mono " +
                      "hover:text-white transition-colors " +
                      "border border-gray-800 px-4 py-2 " +
                      "hover:border-gray-600"
                    }
                  >
                    <X size={12} />
                    Follow on X
                  </a>
                </div>
              </div>
            </div>

            {/* ========= FOOTER ========= */}
            <div className={
              "border-t border-gray-800/40 pt-6 pb-2 " +
              "text-gray-600 text-[14px] leading-relaxed"
            }>
              <div>
                <strong className="text-gray-500">
                  Sources:
                </strong>{" "}
                NAO Major Projects reports;
                IPA Annual Report;
                Public Accounts Committee;
                Contracts Finder;
                ONS; OECD; World Bank; HMRC; DWP; DESNZ.
              </div>
              <div className="mt-2 text-gray-700">
                Non-partisan. Source-backed. No editorial
                position is taken on policy decisions.
              </div>
            </div>
          </div>
        )}
        {view === "projects" && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Waste & Projects"
              title="Project Tracker"
              dataAsOf="Mar 2025"
              description={
                projects.length +
                " major UK government projects. " +
                "Total budget: " + fmt(totalLatest) + "."
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <ChartCard
                chartId="project-overruns"
                label="Relative Cost"
                title="Biggest Overruns by Percentage"
                explainData={overrunPctChart.map(d => `${d.name}: ${d.pct}% over budget`).join("; ")}
                onShare={handleChartShare}
                shareHeadline="Billions over budget"
                shareSubline="The UK's worst project overruns — exposed"
              >
                <div className="flex gap-0">
                  {/* Project names column */}
                  <div className="flex flex-col justify-center shrink-0 pr-2" style={{ paddingTop: 5, paddingBottom: 28 }}>
                    {overrunPctChart.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-end group relative"
                        style={{ height: 26 }}
                        title={d.name}
                      >
                        <span className="text-[11px] text-gray-400 font-mono text-right leading-tight max-w-[180px] truncate">
                          {d.shortName}
                        </span>
                        {/* Full name tooltip on hover */}
                        {d.name !== d.shortName && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-50 hidden group-hover:block bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                            <span className="text-[11px] text-white font-mono">{d.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Chart bars */}
                  <div className="flex-1 min-w-0">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={overrunPctChart}
                        layout="vertical"
                        margin={{ left: 0, right: 10, top: 5, bottom: 0 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: "#4b5563", fontSize: 10 }}
                          tickFormatter={(v) => v + "%"}
                          axisLine={{ stroke: "#1f2937" }}
                          tickLine={false}
                        />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip
                          content={({ active, payload }) => (
                            <CustomTooltip active={active} payload={payload} renderFn={ttPct} />
                          )}
                        />
                        <Bar dataKey="pct" radius={[0, 3, 3, 0]} barSize={18}>
                          {overrunPctChart.map((d, i) => (
                            <Cell
                              key={i}
                              fill={i === 0 ? "#ef4444" : d.color}
                              fillOpacity={i === 0 ? 0.9 : 0.25}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </ChartCard>

              {/* Right panel — Cancelled Projects ticker */}
              {(() => {
                const cancelledProjects = projects.filter(p => p.status === "Cancelled").sort((a, b) => b.latestBudget - a.latestBudget);
                const cp = cancelledProjects[cancelledIdx % cancelledProjects.length];
                if (!cp) return null;
                const wasted = cp.latestBudget;
                const overrun = cp.latestBudget - cp.originalBudget;
                const potholeUnit = 100;
                const potholesEquiv = Math.round((wasted * 1e6) / potholeUnit);
                return (
                  <div className="border border-gray-800/60 bg-gray-950/50 flex flex-col">
                    {/* Header */}
                    <div className="px-5 py-3 border-b border-gray-800/40 flex items-center justify-between">
                      <div className="text-[12px] uppercase tracking-[0.25em] text-red-500/80 font-mono">Cancelled Project</div>
                      <div className="text-[11px] font-mono text-gray-700 tracking-wide">{(cancelledIdx % cancelledProjects.length) + 1}/{cancelledProjects.length}</div>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5 flex-1">
                      <div className="text-[15px] text-gray-300 font-semibold leading-tight">{cp.name}</div>
                      <div className="text-[11px] text-gray-600 font-mono uppercase tracking-wide mt-1">{cp.department}</div>

                      <div className="mt-5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-mono mb-1">Money spent before cancellation</div>
                        <div className="flex items-end justify-between gap-3">
                          <div className="text-3xl font-black text-red-500 tracking-tighter leading-none">{wasted >= 1000 ? "\u00a3" + (wasted / 1000).toFixed(0) + "bn" : "\u00a3" + wasted.toLocaleString() + "m"}</div>
                          {overrun > 0 && (
                            <div className="text-right shrink-0">
                              <div className="text-[10px] uppercase tracking-wider text-gray-700 font-mono">Over budget</div>
                              <div className="text-lg font-black text-amber-400 tracking-tight leading-none">+{overrun >= 1000 ? "\u00a3" + (overrun / 1000).toFixed(1) + "bn" : "\u00a3" + overrun.toLocaleString() + "m"}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-800/30">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-white tracking-tight">{potholesEquiv.toLocaleString()}</span>
                          <span className="text-[12px] text-gray-600">pothole repairs equivalent</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-800/30 grid grid-cols-2 gap-x-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-700 font-mono">Original budget</div>
                          <div className="text-[14px] text-gray-400 font-semibold">{cp.originalBudget >= 1000 ? "\u00a3" + (cp.originalBudget / 1000).toFixed(0) + "bn" : "\u00a3" + cp.originalBudget.toLocaleString() + "m"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-700 font-mono">Category</div>
                          <div className="text-[14px] text-gray-400 font-semibold">{cp.category}</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer disclaimer */}
                    <div className="px-5 py-2.5 border-t border-gray-800/40">
                      <div className="text-[10px] text-gray-700 font-mono tracking-[0.05em] leading-relaxed">
                        Project cancelled. Spend figure is total cost at cancellation per NAO/IPA reports.
                      </div>
                    </div>
                    {/* Controls */}
                    <div className="flex border-t border-gray-800/40">
                      <button onClick={() => setCancelledIdx(i => i > 0 ? i - 1 : cancelledProjects.length - 1)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-gray-500 hover:text-white hover:bg-white/[0.02] transition-colors border-r border-gray-800/40">
                        <ChevronLeft size={12} /> Prev
                      </button>
                      <button onClick={() => setCancelledIdx(i => (i + 1) % cancelledProjects.length)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-gray-500 hover:text-white hover:bg-white/[0.02] transition-colors border-r border-gray-800/40">
                        Next <ChevronRight size={12} />
                      </button>
                      <button onClick={() => {
                        handleChartShare({
                          _cancelledProject: true,
                          name: cp.name,
                          department: cp.department,
                          category: cp.category,
                          wasted: wasted,
                          overrun: overrun > 0 ? overrun : 0,
                          originalBudget: cp.originalBudget,
                          title: cp.name + " \u2014 Cancelled",
                          accent: "#FF4D4D"
                        });
                      }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-gray-500 hover:text-white hover:bg-white/[0.02] transition-colors">
                        <Share2 size={11} /> Share
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            <QuickViewBar
              presets={PROJECT_PRESETS}
              active={projQuickView}
              onSelect={handleProjectQuickView}
            />

            <FilterBar
              search={{
                value: search,
                onChange: setSearch,
                placeholder:
                  "Search projects, departments, " +
                  "contractors..."
              }}
              filters={[
                {
                  value: categoryFilter,
                  onChange: setCategoryFilter,
                  options: categories.map((c) => ({
                    value: c,
                    label: c === "All"
                      ? "All Categories" : c
                  }))
                },
                {
                  value: statusFilter,
                  onChange: setStatusFilter,
                  options: statuses.map((s) => ({
                    value: s,
                    label: s === "All"
                      ? "All Statuses" : s
                  }))
                }
              ]}
              hasActiveFilters={
                search !== "" ||
                categoryFilter !== "All" ||
                statusFilter !== "All"
              }
              onClear={() => {
                setSearch("");
                setCategoryFilter("All");
                setStatusFilter("All");
                setProjQuickView(null);
              }}
            />

            <DataTableShell
              columns={[
                { key: "rank", label: "#",
                  span: 1 },
                { key: "name", label: "Project",
                  span: 4, sortable: true },
                { key: "cat", label: "Cat",
                  span: 1 },
                { key: "budget", label: "Budget",
                  span: 2, align: "right",
                  sortable: true },
                { key: "overrun", label: "Overrun",
                  span: 2, align: "right",
                  sortable: true },
                { key: "status", label: "Status",
                  span: 2, align: "right" }
              ]}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={toggleSort}
              count={filtered.length}
              emptyMessage={
                "No projects match your filters"
              }
              csvExport={{
                filename: "gracchus-projects",
                headers: ["Project", "Category", "Original Budget (£m)", "Latest Budget (£m)", "Overrun (£m)", "Overrun %", "Status"],
                rows: filtered.map(p => [p.name, p.category, p.originalBudget, p.latestBudget, p.latestBudget - p.originalBudget, ((p.latestBudget - p.originalBudget) / p.originalBudget * 100).toFixed(1), p.status])
              }}
              totals={[
                { span: 1, content: "" },
                { span: 4, content:
                  filtered.length + " project" +
                  (filtered.length !== 1
                    ? "s" : ""),
                  className:
                    "uppercase tracking-[0.1em] " +
                    "text-[9px]"
                },
                { span: 1, content: "" },
                { span: 2, align: "right",
                  content: (
                    <>
                      {fmt(filtered.reduce(
                        (s, p) =>
                          s + p.originalBudget, 0
                      ))}
                      <span className={
                        "text-gray-700 mx-1"
                      }>
                        {"\u2192"}
                      </span>
                      {fmt(filtered.reduce(
                        (s, p) =>
                          s + p.latestBudget, 0
                      ))}
                    </>
                  )
                },
                { span: 2, align: "right",
                  bold: true,
                  className: (
                    filtered.reduce(
                      (s, p) => s + p.latestBudget
                        - p.originalBudget, 0
                    ) > 0
                      ? "text-red-400 font-bold"
                      : "text-gray-400 font-bold"
                  ),
                  content: "+" + fmt(Math.abs(
                    filtered.reduce(
                      (s, p) => s + p.latestBudget
                        - p.originalBudget, 0
                    )
                  ))
                },
                { span: 2, content: "" }
              ]}
            >
            <div>
              {filtered.map((p, i) => {
                const ov = getOverrun(p);
                const op = getOverrunPct(p);
                const neg = ov < 0;
                const severe = !neg && op > 100;
                const warn = !neg && op > 30 && op <= 100;
                const ovColor = neg
                  ? "text-emerald-500"
                  : severe
                    ? "text-red-500"
                    : warn
                      ? "text-amber-500"
                      : "text-gray-500";
                const ovBg = severe
                  ? "bg-red-500/[0.07]" : "";
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProject(p);
                      setSourceProject(p);
                    }}
                    className={
                      "min-w-[640px] grid grid-cols-12 gap-2 " +
                      "items-center " +
                      "px-1 py-1.5 cursor-pointer " +
                      "border-b border-gray-900/60 " +
                      "hover:bg-white/[0.03] group"
                    }
                  >
                    <div className="col-span-1 text-gray-800 text-[11px] font-mono">
                      {i + 1}
                    </div>
                    <div className="col-span-4 min-w-0">
                      <div className={
                        "text-gray-300 text-[12px] " +
                        "font-mono truncate " +
                        "group-hover:text-white " +
                        "flex items-center gap-1.5"
                      }>
                        <span className="truncate">
                          {p.name}
                        </span>
                        {p.cronyLinked && (
                          <span
                            title="Procurement Scrutiny"
                            className={
                              "flex-shrink-0 " +
                              "text-amber-500/70"
                            }
                          >
                            <ShieldAlert size={11} />
                          </span>
                        )}
                      </div>
                      <div className="text-gray-700 text-[10px] font-mono truncate">
                        {p.department}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <span className="text-[9px] uppercase tracking-[0.1em] text-gray-700 font-mono">
                        {p.category}
                      </span>
                    </div>
                    <div className="col-span-2 text-right font-mono">
                      <div className="text-gray-700 text-[11px] line-through decoration-gray-800">
                        {fmt(p.originalBudget)}
                      </div>
                      <div className="text-gray-400 text-[12px]">
                        {fmt(p.latestBudget)}
                      </div>
                    </div>
                    <div className={
                      "col-span-2 text-right font-mono " +
                      "px-1.5 py-0.5 -mx-1.5 rounded-sm " + ovBg
                    }>
                      <div className={"text-[13px] font-bold tabular-nums " + ovColor}>
                        {neg ? "" : "+"}{fmt(Math.abs(ov))}
                      </div>
                      <div className={"text-[10px] tabular-nums " + ovColor}>
                        {neg ? "" : "+"}{op.toFixed(1)}%
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                );
              })}
            </div>
            </DataTableShell>

          </div>
        )}

        {/* ============ PLANNING & APPROVALS ============ */}
        {view === "projects.planning" && (() => {
          const planProjects = planningData.projects;
          const gridQ = planningData.gridConnectionQueue;

          const planFiltered = planProjects.filter((p) => {
            if (planSearch) {
              const s = planSearch.toLowerCase();
              return (
                p.projectName.toLowerCase().includes(s) ||
                p.category.toLowerCase().includes(s) ||
                p.approvalType.toLowerCase().includes(s) ||
                p.responsibleBody.toLowerCase().includes(s)
              );
            }
            return true;
          }).filter((p) => {
            if (planQuickView === "still-pending") {
              return !p.actualDecisionDate;
            }
            if (planQuickView === "refused") {
              return p.approvalStatus === "Refused" ||
                p.approvalStatus === "Stalled";
            }
            return true;
          });

          const planSorted = [...planFiltered].sort(
            (a, b) => {
              const av = a[planSortBy] ?? -1;
              const bv = b[planSortBy] ?? -1;
              if (typeof av === "number" &&
                typeof bv === "number") {
                return planSortDir === "desc"
                  ? bv - av : av - bv;
              }
              return 0;
            }
          );

          const withDays = planProjects.filter(
            (p) => p.daysInApproval
          );
          const avgDays = withDays.length > 0
            ? Math.round(
                withDays.reduce(
                  (s, p) => s + p.daysInApproval, 0
                ) / withDays.length
              )
            : 0;
          const pending = planProjects.filter(
            (p) => !p.actualDecisionDate
          ).length;
          const refused = planProjects.filter(
            (p) => p.approvalStatus === "Refused" ||
              p.approvalStatus === "Stalled"
          ).length;
          const maxDays = Math.max(
            ...withDays.map(
              (p) => p.daysInApproval
            ), 0
          );

          return (
            <div className="space-y-4">
              <PageHeader
                eyebrow={"Waste & Projects \u203A Planning Failures"}
                title="Planning & Approvals"
                dataAsOf="Mar 2025"
                description={
                  "Stage 1 of the project failure funnel. " +
                  "Where UK infrastructure gets blocked " +
                  "before a single brick is laid."
                }
              />

              {/* Funnel nav */}
              <div className={
                "flex items-center gap-2 py-2 " +
                "text-[10px] font-mono uppercase " +
                "tracking-[0.12em]"
              }>
                <span className={
                  "text-white bg-white/[0.06] " +
                  "px-2 py-1 border border-gray-700"
                }>
                  1. Blocked
                </span>
                <span className="text-gray-700">
                  {"\u2192"}
                </span>
                <button
                  onClick={() =>
                    setView("projects.delays")
                  }
                  className={
                    "text-gray-600 px-2 py-1 " +
                    "border border-gray-800 " +
                    "hover:text-white " +
                    "hover:border-gray-600 " +
                    "transition-colors"
                  }
                >
                  2. Delayed
                </button>
                <span className="text-gray-700">
                  {"\u2192"}
                </span>
                <button
                  onClick={() =>
                    setView("projects")
                  }
                  className={
                    "text-gray-600 px-2 py-1 " +
                    "border border-gray-800 " +
                    "hover:text-white " +
                    "hover:border-gray-600 " +
                    "transition-colors"
                  }
                >
                  3. Over Budget
                </button>
              </div>

              {/* Summary + Chart grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  {/* Summary strip */}
                  <div className={
                    "grid grid-cols-2 gap-0 " +
                    "border border-gray-800/60"
                  }>
                    {[
                      {
                        label: "Avg Approval Wait",
                        value: Math.round(avgDays / 30)
                          + " months",
                        sub: avgDays + " days"
                      },
                      {
                        label: "Longest Approval",
                        value: Math.round(maxDays / 365)
                          + "+ years",
                        sub: maxDays + " days"
                      },
                      {
                        label: "Currently Blocked",
                        value: pending + " projects",
                        sub: "no decision yet"
                      },
                      {
                        label: "Refused / Stalled",
                        value: refused + " projects",
                        sub: "application failed"
                      }
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={
                          "px-4 py-3 " +
                          "border-r border-b " +
                          "border-gray-800/40"
                        }
                      >
                        <div className={
                          "text-[9px] uppercase " +
                          "tracking-[0.15em] " +
                          "text-gray-600 font-mono mb-1"
                        }>
                          {s.label}
                        </div>
                        <div className={
                          "text-lg font-black " +
                          "text-white tracking-tight"
                        }>
                          {s.value}
                        </div>
                        <div className={
                          "text-[10px] text-gray-600 " +
                          "font-mono"
                        }>
                          {s.sub}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Grid connection callout */}
                  <div className={
                    "border border-amber-900/40 " +
                    "bg-amber-950/20 px-5 py-4"
                  }>
                    <div className={
                      "text-[10px] uppercase " +
                      "tracking-[0.2em] " +
                      "text-amber-500 font-mono mb-2"
                    }>
                      Grid Connection Bottleneck
                    </div>
                    <div className={
                      "text-sm text-gray-300 " +
                      "leading-relaxed"
                    }>
                      <span className={
                        "text-xl font-black " +
                        "text-amber-400"
                      }>
                        {gridQ.totalCapacityInQueueGW}GW
                      </span>
                      {" "}of energy capacity is stuck in
                      the grid connection queue.{" "}
                      <span className="text-gray-400">
                        Average wait:{" "}
                        {gridQ.averageWaitMonths / 12}+
                        {" "}years.{" "}
                        {gridQ.projectsInQueue.toLocaleString(
                          "en-GB"
                        )} projects queued.
                      </span>
                    </div>
                    <div className={
                      "text-[9px] text-gray-600 " +
                      "font-mono mt-2"
                    }>
                      Source: {gridQ.sourceName}.
                      Ofgem reform package announced{" "}
                      {gridQ.reformDate}.
                    </div>
                  </div>
                </div>

                {/* Approval Duration Trend - right column */}
                {planningData.approvalTimeline && (
                  <ChartCard
                    chartId="planning-approvals"
                    label="Trend"
                    title="Average DCO Approval Duration"
                    subtitle="Months from application to Secretary of State decision, by year of decision. Source: PINS."
                    onShare={handleChartShare}
                    shareHeadline={"2.4\u00D7 slower to approve"}
                    shareSubline="Planning approvals now take years, not months"
                    accentColor="#f59e0b"
                    explainData={planningData.approvalTimeline.map(d => `${d.year}: ${d.avgMonths} months, ${d.decisions} decisions`).join("; ")}
                  >
                    <ResponsiveContainer
                      width="100%" height={220}
                    >
                      <ComposedChart
                        data={
                          planningData.approvalTimeline
                        }
                        margin={{
                          top: 5, right: 10,
                          bottom: 5, left: 0
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1f2937"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="year"
                          tick={{
                            fill: "#6b7280",
                            fontSize: 10,
                            fontFamily: "monospace"
                          }}
                          axisLine={{
                            stroke: "#374151"
                          }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fill: "#6b7280",
                            fontSize: 10,
                            fontFamily: "monospace"
                          }}
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: "months",
                            angle: -90,
                            position: "insideLeft",
                            style: {
                              fill: "#4b5563",
                              fontSize: 9,
                              fontFamily: "monospace"
                            }
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111",
                            border: "1px solid #333",
                            borderRadius: 0,
                            fontSize: 11,
                            fontFamily: "monospace"
                          }}
                          labelStyle={{
                            color: "#9ca3af"
                          }}
                          formatter={(val, name) => {
                            if (name === "avgMonths")
                              return [
                                val + " months",
                                "Avg Duration"
                              ];
                            return [
                              val + " decisions",
                              "Decisions"
                            ];
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="avgMonths"
                          fill="#f59e0b"
                          fillOpacity={0.08}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={{
                            fill: "#f59e0b",
                            r: 3,
                            strokeWidth: 0
                          }}
                          activeDot={{
                            r: 5,
                            fill: "#f59e0b"
                          }}
                        />
                        <Bar
                          dataKey="decisions"
                          fill="#374151"
                          opacity={0.5}
                          barSize={14}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className={
                      "flex justify-between " +
                      "text-[9px] text-gray-700 " +
                      "font-mono mt-2"
                    }>
                      <span>
                        {"\u25CF"}{" "}
                        <span className="text-amber-500">
                          Avg months
                        </span>
                        {" "}{"\u2502"}{" "}
                        <span className="text-gray-500">
                          Decisions per year
                        </span>
                      </span>
                      <span>
                        {planningData
                          .approvalTimelineMethodology
                          ? "Partial year for 2025"
                          : ""}
                      </span>
                    </div>
                  </ChartCard>
                )}
              </div>

              <QuickViewBar
                presets={PLANNING_PRESETS}
                active={planQuickView}
                onSelect={handlePlanQuickView}
              />

              <FilterBar
                search={{
                  value: planSearch,
                  onChange: setPlanSearch,
                  placeholder:
                    "Search projects, types, " +
                    "bodies..."
                }}
                filters={[]}
                hasActiveFilters={planSearch !== ""}
                onClear={() => {
                  setPlanSearch("");
                  setPlanQuickView(null);
                }}
              />

              <DataTableShell
                columns={[
                  { key: "rank", label: "#",
                    span: 1 },
                  { key: "name",
                    label: "Project",
                    span: 3, sortable: true },
                  { key: "type",
                    label: "Type",
                    span: 1 },
                  { key: "daysInApproval",
                    label: "Wait (days)",
                    span: 2, align: "right",
                    sortable: true },
                  { key: "deadlineExtensions",
                    label: "Ext.",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "status",
                    label: "Status",
                    span: 2, align: "right" },
                  { key: "source",
                    label: "Source",
                    span: 2, align: "right" }
                ]}
                sortBy={planSortBy}
                sortDir={planSortDir}
                onSort={togglePlanSort}
                count={planSorted.length}
                emptyMessage={
                  "No projects match your filters"
                }
                csvExport={{
                  filename: "gracchus-planning-pipeline",
                  headers: ["Project", "Type", "Wait (days)", "Extensions", "Status", "Source"],
                  rows: planSorted.map(p => [p.name, p.type, p.daysInApproval, p.deadlineExtensions, p.status, p.source])
                }}
              >
                {planSorted.map((p, i) => (
                  <div key={p.id}>
                    <button
                      onClick={() =>
                        setPlanExpanded(
                          planExpanded === p.id
                            ? null : p.id
                        )
                      }
                      className={
                        "w-full grid grid-cols-12 " +
                        "gap-2 px-4 py-3 border-b " +
                        "border-gray-800/30 " +
                        "text-left " +
                        "hover:bg-white/[0.02] " +
                        "transition-colors text-sm " +
                        "items-center " +
                        (planExpanded === p.id
                          ? "bg-white/[0.02]" : "")
                      }
                    >
                      <div className={
                        "col-span-1 text-gray-600 " +
                        "font-mono text-xs"
                      }>
                        {i + 1}
                      </div>
                      <div className="col-span-3">
                        <div className={
                          "text-gray-200 " +
                          "font-medium text-[13px] " +
                          "leading-tight"
                        }>
                          {p.projectName}
                        </div>
                        <div className={
                          "text-[10px] text-gray-600 " +
                          "mt-0.5"
                        }>
                          {p.category}
                        </div>
                      </div>
                      <div className={
                        "col-span-1 text-[11px] " +
                        "text-gray-500"
                      }>
                        {p.approvalType}
                      </div>
                      <div className={
                        "col-span-2 text-right " +
                        "font-mono"
                      }>
                        {p.daysInApproval ? (
                          <div>
                            <span className={
                              "text-white font-bold " +
                              "text-sm"
                            }>
                              {p.daysInApproval
                                .toLocaleString("en-GB")}
                            </span>
                            <div className={
                              "text-[10px] " +
                              "text-gray-600"
                            }>
                              {Math.round(
                                p.daysInApproval / 30
                              )} months
                            </div>
                          </div>
                        ) : (
                          <span className={
                            "text-gray-600 text-xs"
                          }>
                            ongoing
                          </span>
                        )}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "font-mono text-xs"
                      }>
                        {p.deadlineExtensions != null
                          ? p.deadlineExtensions
                          : "\u2014"}
                      </div>
                      <div className={
                        "col-span-2 text-right"
                      }>
                        <span className={
                          "text-[10px] font-mono " +
                          "uppercase px-1.5 py-0.5 " +
                          (p.approvalStatus === "Approved" ||
                           p.approvalStatus ===
                             "Approved (second attempt)"
                            ? "text-emerald-400 " +
                              "bg-emerald-900/20"
                            : p.approvalStatus === "Refused"
                            ? "text-red-400 " +
                              "bg-red-900/20"
                            : p.approvalStatus === "Stalled"
                            ? "text-red-400 " +
                              "bg-red-900/20"
                            : "text-amber-400 " +
                              "bg-amber-900/20")
                        }>
                          {p.approvalStatus}
                        </span>
                      </div>
                      <div className={
                        "col-span-2 text-right"
                      }>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              p.sourceUrl, "_blank"
                            );
                          }}
                          className={
                            "text-[10px] text-gray-600 " +
                            "hover:text-gray-400 " +
                            "font-mono inline-flex " +
                            "items-center gap-1 " +
                            "cursor-pointer"
                          }
                        >
                          {p.sourceName.length > 20
                            ? p.sourceName.slice(0, 18)
                              + "..."
                            : p.sourceName}
                          <ExternalLink size={9} />
                        </span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {planExpanded === p.id && (
                      <div className={
                        "px-4 py-5 " +
                        "border-b border-gray-800/30 " +
                        "bg-gray-950/50"
                      }>
                        <div className={
                          "grid grid-cols-1 " +
                          "md:grid-cols-3 gap-6 mb-5"
                        }>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Responsible Body
                            </div>
                            <div className={
                              "text-sm text-white " +
                              "mt-0.5"
                            }>
                              {p.responsibleBody}
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Submitted
                            </div>
                            <div className={
                              "text-sm text-white " +
                              "mt-0.5"
                            }>
                              {p.submissionDate
                                ? new Date(
                                    p.submissionDate
                                  ).toLocaleDateString(
                                    "en-GB",
                                    { day: "numeric",
                                      month: "short",
                                      year: "numeric" }
                                  )
                                : "\u2014"}
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Decision Date
                            </div>
                            <div className={
                              "text-sm text-white " +
                              "mt-0.5"
                            }>
                              {p.actualDecisionDate
                                ? new Date(
                                    p.actualDecisionDate
                                  ).toLocaleDateString(
                                    "en-GB",
                                    { day: "numeric",
                                      month: "short",
                                      year: "numeric" }
                                  )
                                : "Awaiting decision"}
                            </div>
                          </div>
                        </div>
                        {p.estimatedCostM && (
                          <div className={
                            "mb-4 border-l-2 " +
                            "border-amber-800/60 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Estimated Project Cost
                            </div>
                            <div className={
                              "text-lg font-black " +
                              "text-amber-400 mt-0.5"
                            }>
                              {"£"}{
                                p.estimatedCostM >= 1000
                                  ? (p.estimatedCostM /
                                      1000).toFixed(0) +
                                    "bn"
                                  : p.estimatedCostM + "m"
                              }
                            </div>
                          </div>
                        )}
                        <div className={
                          "text-xs text-gray-400 " +
                          "leading-relaxed mb-3"
                        }>
                          <span className={
                            "text-[9px] uppercase " +
                            "tracking-[0.15em] " +
                            "text-gray-600 font-mono " +
                            "block mb-1"
                          }>
                            Cause of Delay
                          </span>
                          <span className={
                            "text-amber-400 " +
                            "font-medium"
                          }>
                            {p.causeCategory}:
                          </span>{" "}
                          {p.causeDetail}
                        </div>
                        <div className={
                          "text-[10px] text-gray-600 " +
                          "font-mono flex items-center " +
                          "gap-1"
                        }>
                          Source:{" "}
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              "text-gray-500 " +
                              "hover:text-gray-300 " +
                              "inline-flex " +
                              "items-center gap-1"
                            }
                          >
                            {p.sourceName}
                            <ExternalLink size={9} />
                          </a>
                          {p.sourceConfidence ===
                            "very_high" && (
                            <span className={
                              "text-emerald-600 ml-1"
                            }>
                              {"\u2713"} verified
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </DataTableShell>

{/* Methodology */}
              <div className={
                "text-[10px] text-gray-700 " +
                "font-mono leading-relaxed " +
                "border-t border-gray-800/40 pt-4"
              }>
                <span className="text-gray-500">
                  Methodology:
                </span>{" "}
                {planningData.metadata.methodology}
                {" "}DCO process averages increased from{" "}
                {planningData.dcoProcessStats
                  .averageApprovalMonths2012} months
                (2012) to{" "}
                {planningData.dcoProcessStats
                  .averageApprovalMonths2024} months
                (2024), a{" "}
                {planningData.dcoProcessStats
                  .increasePct}% increase.
              </div>
            </div>
          );
        })()}

        {/* ============ DELAYS & DELIVERY ============ */}
        {view === "projects.delays" && (() => {
          const delayProjects = delaysData.projects;

          const delayFiltered = delayProjects.filter(
            (p) => {
              if (delaySearch) {
                const s = delaySearch.toLowerCase();
                return (
                  p.projectName
                    .toLowerCase().includes(s) ||
                  p.department
                    .toLowerCase().includes(s) ||
                  p.category
                    .toLowerCase().includes(s) ||
                  (p.primaryDelayCause || "")
                    .toLowerCase().includes(s)
                );
              }
              return true;
            }
          );

          const delaySorted = [...delayFiltered].sort(
            (a, b) => {
              const av = a[delaySortBy] ?? -1;
              const bv = b[delaySortBy] ?? -1;
              if (typeof av === "number" &&
                typeof bv === "number") {
                return delaySortDir === "desc"
                  ? bv - av : av - bv;
              }
              return 0;
            }
          );

          const withDelay = delayProjects.filter(
            (p) => p.delayYears
          );
          const avgDelayYrs = withDelay.length > 0
            ? (
                withDelay.reduce(
                  (s, p) => s + p.delayYears, 0
                ) / withDelay.length
              ).toFixed(1)
            : "0";
          const totalDelayYrs = withDelay.reduce(
            (s, p) => s + p.delayYears, 0
          ).toFixed(0);
          const withCost = delayProjects.filter(
            (p) => p.costGrowthM
          );
          const totalCostGrowth = withCost.reduce(
            (s, p) => s + p.costGrowthM, 0
          );
          const inProgress = delayProjects.filter(
            (p) => p.status === "In Progress"
          ).length;

          return (
            <div className="space-y-4">
              <PageHeader
                eyebrow={"Waste & Projects \u203A Delivery Delays"}
                title="Delays & Delivery"
                dataAsOf="Mar 2025"
                description={
                  "Stage 2 of the project failure funnel. " +
                  "What happens after approval: " +
                  "schedule slippage, revised deadlines, " +
                  "and ballooning costs."
                }
              />

              {/* Funnel nav */}
              <div className={
                "flex items-center gap-2 py-2 " +
                "text-[10px] font-mono uppercase " +
                "tracking-[0.12em]"
              }>
                <button
                  onClick={() =>
                    setView("projects.planning")
                  }
                  className={
                    "text-gray-600 px-2 py-1 " +
                    "border border-gray-800 " +
                    "hover:text-white " +
                    "hover:border-gray-600 " +
                    "transition-colors"
                  }
                >
                  1. Blocked
                </button>
                <span className="text-gray-700">
                  {"\u2192"}
                </span>
                <span className={
                  "text-white bg-white/[0.06] " +
                  "px-2 py-1 border border-gray-700"
                }>
                  2. Delayed
                </span>
                <span className="text-gray-700">
                  {"\u2192"}
                </span>
                <button
                  onClick={() =>
                    setView("projects")
                  }
                  className={
                    "text-gray-600 px-2 py-1 " +
                    "border border-gray-800 " +
                    "hover:text-white " +
                    "hover:border-gray-600 " +
                    "transition-colors"
                  }
                >
                  3. Over Budget
                </button>
              </div>

              {/* Summary + Chart grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  {/* Summary strip */}
                  <div className={
                    "grid grid-cols-2 gap-0 " +
                    "border border-gray-800/60"
                  }>
                    {[
                      {
                        label: "Avg Delivery Delay",
                        value: avgDelayYrs + " years",
                        sub: withDelay.length +
                          " projects measured"
                      },
                      {
                        label: "Total Delay Years",
                        value: totalDelayYrs + " years",
                        sub: "across all tracked projects"
                      },
                      {
                        label: "Total Cost Growth",
                        value: "\u00A3" +
                          (totalCostGrowth >= 1000
                            ? (totalCostGrowth / 1000)
                                .toFixed(0) + "bn"
                            : totalCostGrowth + "m"),
                        sub: withCost.length +
                          " projects with cost data"
                      },
                      {
                        label: "Still Delayed",
                        value: inProgress + " projects",
                        sub: "delivery ongoing"
                      }
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={
                          "px-4 py-3 " +
                          "border-r border-b " +
                          "border-gray-800/40"
                        }
                      >
                        <div className={
                          "text-[9px] uppercase " +
                          "tracking-[0.15em] " +
                          "text-gray-600 font-mono mb-1"
                        }>
                          {s.label}
                        </div>
                        <div className={
                          "text-lg font-black " +
                          "text-white tracking-tight"
                        }>
                          {s.value}
                        </div>
                        <div className={
                          "text-[10px] text-gray-600 " +
                          "font-mono"
                        }>
                          {s.sub}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delay Trend Chart - right column */}
                {delaysData.delayTimeline && (
                  <ChartCard
                    chartId="project-delays"
                    label="Trend"
                    title={"Delivery Delays & Cost Growth Over Time"}
                    subtitle="Average schedule slippage and cost growth across IPA-tracked major projects. Source: IPA / NAO."
                    onShare={handleChartShare}
                    shareHeadline="Every project late. Every project over budget."
                    shareSubline="Delivery delays and cost growth keep getting worse"
                    accentColor="#ef4444"
                    explainData={delaysData.delayTimeline.map(d => `${d.year}: ${d.avgDelayYears}yr delay, +${d.avgCostGrowthPct}% cost growth`).join("; ")}
                  >
                    <ResponsiveContainer
                      width="100%" height={220}
                    >
                      <ComposedChart
                        data={delaysData.delayTimeline}
                        margin={{
                          top: 5, right: 10,
                          bottom: 5, left: 0
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1f2937"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="year"
                          tick={{
                            fill: "#6b7280",
                            fontSize: 10,
                            fontFamily: "monospace"
                          }}
                          axisLine={{
                            stroke: "#374151"
                          }}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{
                            fill: "#6b7280",
                            fontSize: 10,
                            fontFamily: "monospace"
                          }}
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: "years",
                            angle: -90,
                            position: "insideLeft",
                            style: {
                              fill: "#4b5563",
                              fontSize: 9,
                              fontFamily: "monospace"
                            }
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{
                            fill: "#6b7280",
                            fontSize: 10,
                            fontFamily: "monospace"
                          }}
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: "cost growth %",
                            angle: 90,
                            position: "insideRight",
                            style: {
                              fill: "#4b5563",
                              fontSize: 9,
                              fontFamily: "monospace"
                            }
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111",
                            border: "1px solid #333",
                            borderRadius: 0,
                            fontSize: 11,
                            fontFamily: "monospace"
                          }}
                          labelStyle={{
                            color: "#9ca3af"
                          }}
                          formatter={(val, name) => {
                            if (name ===
                              "avgDelayYears")
                              return [
                                val + " years",
                                "Avg Delay"
                              ];
                            if (name ===
                              "avgCostGrowthPct")
                              return [
                                "+" + val + "%",
                                "Avg Cost Growth"
                              ];
                            return [val, name];
                          }}
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="avgDelayYears"
                          fill="#ef4444"
                          fillOpacity={0.08}
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={{
                            fill: "#ef4444",
                            r: 3,
                            strokeWidth: 0
                          }}
                          activeDot={{
                            r: 5,
                            fill: "#ef4444"
                          }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="avgCostGrowthPct"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={{
                            fill: "#f59e0b",
                            r: 3,
                            strokeWidth: 0
                          }}
                          activeDot={{
                            r: 5,
                            fill: "#f59e0b"
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className={
                      "flex justify-between " +
                      "text-[9px] text-gray-700 " +
                      "font-mono mt-2"
                    }>
                      <span>
                        {"\u25CF"}{" "}
                        <span className="text-red-400">
                          Avg delay (years)
                        </span>
                        {" "}{"\u2502"}{" "}
                        <span className="text-amber-400">
                          - - Avg cost growth %
                        </span>
                      </span>
                      <span>
                        {delaysData.delayTimeline
                          .length} data points,
                        biennial sampling
                      </span>
                    </div>
                  </ChartCard>
                )}
              </div>

              <QuickViewBar
                presets={DELAY_PRESETS}
                active={delayQuickView}
                onSelect={handleDelayQuickView}
              />

              <FilterBar
                search={{
                  value: delaySearch,
                  onChange: setDelaySearch,
                  placeholder:
                    "Search projects, departments, " +
                    "causes..."
                }}
                filters={[]}
                hasActiveFilters={
                  delaySearch !== ""
                }
                onClear={() => {
                  setDelaySearch("");
                  setDelayQuickView(null);
                }}
              />

              <DataTableShell
                columns={[
                  { key: "rank", label: "#",
                    span: 1 },
                  { key: "name",
                    label: "Project",
                    span: 3, sortable: true },
                  { key: "delayDays",
                    label: "Delay",
                    span: 2, align: "right",
                    sortable: true },
                  { key: "delayPct",
                    label: "Slip %",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "revisedDeadlines",
                    label: "Rev.",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "extraCostPerDelayDayM",
                    label: "£/Day",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "cause",
                    label: "Primary Cause",
                    span: 3 }
                ]}
                sortBy={delaySortBy}
                sortDir={delaySortDir}
                onSort={toggleDelaySort}
                count={delaySorted.length}
                emptyMessage={
                  "No projects match your filters"
                }
                csvExport={{
                  filename: "gracchus-project-delays",
                  headers: ["Project", "Delay (days)", "Slip %", "Revised Deadlines", "£/Day (£m)", "Primary Cause"],
                  rows: delaySorted.map(p => [p.name, p.delayDays, p.delayPct, p.revisedDeadlines, p.extraCostPerDelayDayM, p.cause])
                }}
                totals={[
                  { span: 1, content: "" },
                  { span: 3, content:
                    delaySorted.length +
                    " project" +
                    (delaySorted.length !== 1
                      ? "s" : "")
                  },
                  { span: 2, content:
                    "avg " + avgDelayYrs + "y"
                  },
                  { span: 1, content: "" },
                  { span: 1, content: "" },
                  { span: 1, content: "" },
                  { span: 3, content:
                    "£" +
                    (totalCostGrowth >= 1000
                      ? (totalCostGrowth / 1000)
                          .toFixed(0) + "bn"
                      : totalCostGrowth + "m") +
                    " cost growth"
                  }
                ]}
              >
                {delaySorted.map((p, i) => (
                  <div key={p.id}>
                    <button
                      onClick={() =>
                        setDelayExpanded(
                          delayExpanded === p.id
                            ? null : p.id
                        )
                      }
                      className={
                        "w-full grid grid-cols-12 " +
                        "gap-2 px-4 py-3 border-b " +
                        "border-gray-800/30 " +
                        "text-left " +
                        "hover:bg-white/[0.02] " +
                        "transition-colors text-sm " +
                        "items-start " +
                        (delayExpanded === p.id
                          ? "bg-white/[0.02]" : "")
                      }
                    >
                      <div className={
                        "col-span-1 text-gray-600 " +
                        "font-mono text-xs"
                      }>
                        {i + 1}
                      </div>
                      <div className="col-span-3">
                        <div className={
                          "text-gray-200 " +
                          "font-medium text-[13px] " +
                          "leading-tight"
                        }>
                          {p.projectName}
                        </div>
                        <div className={
                          "text-[10px] text-gray-600 " +
                          "mt-0.5"
                        }>
                          {p.department}
                        </div>
                      </div>
                      <div className={
                        "col-span-2 text-right " +
                        "font-mono"
                      }>
                        {p.delayYears ? (
                          <div>
                            <span className={
                              "text-red-400 " +
                              "font-bold text-sm"
                            }>
                              +{p.delayYears}y
                            </span>
                            <div className={
                              "text-[10px] " +
                              "text-gray-600"
                            }>
                              {p.delayDays
                                ? p.delayDays
                                    .toLocaleString(
                                      "en-GB"
                                    ) + " days"
                                : ""}
                            </div>
                          </div>
                        ) : (
                          <span className={
                            "text-gray-600 text-xs"
                          }>
                            n/a
                          </span>
                        )}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "font-mono text-xs"
                      }>
                        {p.delayPct
                          ? "+" + p.delayPct + "%"
                          : "\u2014"}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "font-mono text-xs"
                      }>
                        {p.revisedDeadlines ?? "\u2014"}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "font-mono text-xs"
                      }>
                        {p.extraCostPerDelayDayM
                          ? "£" +
                            p.extraCostPerDelayDayM
                              .toFixed(1) + "m"
                          : "\u2014"}
                      </div>
                      <div className={
                        "col-span-3 text-[11px] " +
                        "text-gray-500 leading-snug"
                      }>
                        <div className={
                          "text-gray-400 " +
                          "font-medium"
                        }>
                          {p.primaryDelayCause}
                        </div>
                        {p.costGrowthM ? (
                          <div className={
                            "text-[10px] " +
                            "text-gray-600 mt-0.5"
                          }>
                            Cost growth: {"£"}
                            {p.costGrowthM >= 1000
                              ? (p.costGrowthM / 1000)
                                  .toFixed(1) + "bn"
                              : p.costGrowthM + "m"}
                            {" "}(+{p.costGrowthPct}%)
                          </div>
                        ) : null}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {delayExpanded === p.id && (
                      <div className={
                        "px-4 py-5 " +
                        "border-b border-gray-800/30 " +
                        "bg-gray-950/50"
                      }>
                        <div className={
                          "grid grid-cols-1 " +
                          "md:grid-cols-4 gap-5 mb-5"
                        }>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Original Budget
                            </div>
                            <div className={
                              "text-sm text-white " +
                              "mt-0.5"
                            }>
                              {p.originalBudgetM
                                ? "£" + (
                                    p.originalBudgetM >=
                                      1000
                                    ? (p.originalBudgetM /
                                        1000).toFixed(1) +
                                      "bn"
                                    : p.originalBudgetM +
                                      "m"
                                  )
                                : "\u2014"}
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-red-800/60 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Latest Budget
                            </div>
                            <div className={
                              "text-sm text-red-400 " +
                              "font-bold mt-0.5"
                            }>
                              {p.latestBudgetM
                                ? "£" + (
                                    p.latestBudgetM >=
                                      1000
                                    ? (p.latestBudgetM /
                                        1000).toFixed(1) +
                                      "bn"
                                    : p.latestBudgetM +
                                      "m"
                                  )
                                : "\u2014"}
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Original Completion
                            </div>
                            <div className={
                              "text-sm text-white " +
                              "mt-0.5"
                            }>
                              {p.originalCompletionDate
                                ? new Date(
                                    p.originalCompletionDate
                                  ).toLocaleDateString(
                                    "en-GB",
                                    { month: "short",
                                      year: "numeric" }
                                  )
                                : "\u2014"}
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-red-800/60 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Latest Completion
                            </div>
                            <div className={
                              "text-sm text-red-400 " +
                              "mt-0.5"
                            }>
                              {p.latestCompletionDate
                                ? new Date(
                                    p.latestCompletionDate
                                  ).toLocaleDateString(
                                    "en-GB",
                                    { month: "short",
                                      year: "numeric" }
                                  )
                                : "TBC"}
                              {p.actualCompletionDate && (
                                <span className={
                                  "text-emerald-500 " +
                                  "ml-1 text-[10px]"
                                }>
                                  {"\u2713"} delivered
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={
                          "text-xs text-gray-400 " +
                          "leading-relaxed mb-3"
                        }>
                          <span className={
                            "text-[9px] uppercase " +
                            "tracking-[0.15em] " +
                            "text-gray-600 font-mono " +
                            "block mb-1"
                          }>
                            Delay Detail
                          </span>
                          <span className={
                            "text-red-400 " +
                            "font-medium"
                          }>
                            {p.primaryDelayCause}:
                          </span>{" "}
                          {p.delayCauseDetail}
                        </div>
                        {p.methodologyNote && (
                          <div className={
                            "text-[10px] text-gray-600 " +
                            "italic mb-3"
                          }>
                            {p.methodologyNote}
                          </div>
                        )}
                        <div className={
                          "flex items-center gap-3 " +
                          "text-[10px] text-gray-600 " +
                          "font-mono"
                        }>
                          <span>
                            Status:{" "}
                            <span className={
                              p.status === "Completed"
                                ? "text-emerald-500"
                                : p.status === "Cancelled"
                                ? "text-red-500"
                                : "text-amber-500"
                            }>
                              {p.status}
                            </span>
                          </span>
                          <span className="text-gray-800">
                            |
                          </span>
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              "text-gray-500 " +
                              "hover:text-gray-300 " +
                              "inline-flex " +
                              "items-center gap-1"
                            }
                          >
                            {p.sourceName}
                            <ExternalLink size={9} />
                          </a>
                          {p.sourceConfidence ===
                            "very_high" && (
                            <span className={
                              "text-emerald-600"
                            }>
                              {"\u2713"} verified
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </DataTableShell>

{/* Methodology */}
              <div className={
                "text-[10px] text-gray-700 " +
                "font-mono leading-relaxed " +
                "border-t border-gray-800/40 pt-4"
              }>
                <span className="text-gray-500">
                  Methodology:
                </span>{" "}
                {delaysData.metadata.methodology}
                {" £/delay day = total cost growth " +
                 "divided by total delay days. " +
                 "This is an average implied rate, " +
                 "not literal daily expenditure."}
              </div>
            </div>
          );
        })()}

        {/* Chart share modal */}

                {/* ===== TRANSPARENCY: POLITICAL DONATIONS ===== */}
        {view === "transparency.donations" && (() => {
          // ── Data setup ──
          const dd = donationsData;
          // Government period definitions
          const GOV_PERIODS = [
            { label: "All Time", filter: null },
            { label: "Labour (2024-)", filter: "Labour (2024-)" },
            { label: "Conservative (2019-24)", filter: "Conservative (2019-24)" },
            { label: "Conservative (2015-19)", filter: "Conservative (2015-19)" },
            { label: "Coalition (2010-15)", filter: "Coalition (2010-15)" },
            { label: "Labour (2007-10)", filter: "Labour (2007-10)" },
            { label: "Labour (2001-07)", filter: "Labour (2001-07)" },
          ];

          const PARTY_COLOURS = {
            Conservative: "#0087DC",
            Labour: "#DC241f",
            "Liberal Democrats": "#FDBB30",
            "Reform UK": "#12B6CF",
            SNP: "#FFF95D",
            Green: "#6AB023",
            UKIP: "#70147A",
            Other: "#6b7280",
          };

          // Aliases for top-level state (prefixed with don*)
          const govFilter = donGovFilter;
          const setGovFilter = setDonGovFilter;
          const partyFilter = donPartyFilter;
          const setPartyFilter = setDonPartyFilter;
          const donorTypeFilter = donDonorTypeFilter;
          const setDonorTypeFilter = setDonDonorTypeFilter;
          const minValue = donMinValue;
          const setMinValue = setDonMinValue;
          const searchQuery = donSearchQuery;
          const setSearchQuery = setDonSearchQuery;
          const sortCol = donSortCol;
          const setSortCol = setDonSortCol;
          const sortDir = donSortDir;
          const setSortDir = setDonSortDir;
          const page = donPage;
          const setPage = setDonPage;
          const recordsLoading = donRecordsLoading;
          const PAGE_SIZE = 50;

          // Filter donations (computed, no hook needed)
          const allDonations = donationRecords;
          const filtered = (() => {
            let result = allDonations;
            if (govFilter) result = result.filter(d => d.govPeriod === govFilter);
            if (partyFilter !== "All") result = result.filter(d => d.party === partyFilter);
            if (donorTypeFilter !== "All") result = result.filter(d => d.donorStatus === donorTypeFilter);
            if (minValue) {
              const mv = parseInt(minValue);
              if (!isNaN(mv)) result = result.filter(d => d.value >= mv);
            }
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              result = result.filter(d =>
                d.donor.toLowerCase().includes(q) ||
                d.entity.toLowerCase().includes(q) ||
                d.ecRef.toLowerCase().includes(q)
              );
            }
            result = [...result].sort((a, b) => {
              let av, bv;
              if (sortCol === "value") { av = a.value; bv = b.value; }
              else if (sortCol === "date") { av = a.accepted || ""; bv = b.accepted || ""; }
              else if (sortCol === "donor") { av = a.donor; bv = b.donor; }
              else if (sortCol === "entity") { av = a.entity; bv = b.entity; }
              else { av = a[sortCol]; bv = b[sortCol]; }
              if (typeof av === "number") return sortDir === "desc" ? bv - av : av - bv;
              return sortDir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
            });
            return result;
          })();

          const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
          const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

          // Compute summary stats for current filter
          const stats = (() => {
            const govData = govFilter
              ? dd.byGovernment.find(g => g.period === govFilter)
              : null;
            const totalVal = govFilter ? (govData ? govData.total : 0) : dd.summary.totalValue;
            const totalCount = govFilter ? (govData ? govData.count : 0) : dd.summary.totalDonations;
            const uniqueDonors = govFilter
              ? new Set(allDonations.filter(d => d.govPeriod === govFilter).map(d => d.donor)).size
              : dd.summary.uniqueDonors;
            const partyTotals = {};
            const relevantDonations = govFilter
              ? allDonations.filter(d => d.govPeriod === govFilter)
              : allDonations;
            relevantDonations.forEach(d => {
              partyTotals[d.party] = (partyTotals[d.party] || 0) + d.value;
            });
            const topParty = Object.entries(partyTotals).sort((a,b) => b[1] - a[1])[0];
            return { totalVal, totalCount, uniqueDonors, topParty };
          })();

          const fmt = (v) => {
            if (v >= 1e9) return "£" + (v / 1e9).toFixed(1) + "B";
            if (v >= 1e6) return "£" + (v / 1e6).toFixed(1) + "M";
            if (v >= 1e3) return "£" + (v / 1e3).toFixed(0) + "K";
            return "£" + v.toLocaleString();
          };

          const fmtFull = (v) => "£" + v.toLocaleString();

          const handleSort = (col) => {
            if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
            else { setSortCol(col); setSortDir("desc"); }
            setPage(0);
          };

          const SortIcon = ({ col }) => {
            if (sortCol !== col) return <span className="text-gray-600 ml-1">{"\u2195"}</span>;
            return <span className="text-red-400 ml-1">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>;
          };

          // Chart data
          const chartData = (() => {
            let series = dd.partyYearSeries;
            if (govFilter) {
              const yearRanges = {
                "Labour (2024-)": [2024, 2030],
                "Conservative (2019-24)": [2019, 2023],
                "Conservative (2015-19)": [2015, 2018],
                "Coalition (2010-15)": [2010, 2014],
                "Labour (2007-10)": [2007, 2009],
                "Labour (2001-07)": [2001, 2006],
              };
              const range = yearRanges[govFilter];
              if (range) series = series.filter(d => d.year >= range[0] && d.year <= range[1]);
            }
            return series.map(d => ({
              ...d,
              total: Object.entries(d).reduce((s, [k, v]) => k !== "year" && typeof v === "number" ? s + v : s, 0),
            }));
          })();

          // Donor-contract overlap data (from existing data or static)
          const donorContractOverlap = dd.donorContractOverlap || {
            count: 100,
            totalDonated: 16900000,
            totalContracts: 111000000000,
            examples: [],
          };

          return (
          <div className="space-y-6">
            {/* Header */}
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                Accountability {"\u2192"} Political Finance
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Political Donations
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                {"Every donation over £500 reported to the Electoral Commission since 2001. " +
                 "Covering " + dd.summary.totalDonations.toLocaleString() + " donations totalling " +
                 fmt(dd.summary.totalValue) + " across all UK political parties."}
              </p>
            </div>

            {/* Period selector pills */}
            <div className="flex flex-wrap gap-1.5">
              {GOV_PERIODS.map(gp => (
                <button
                  key={gp.label}
                  onClick={() => { setGovFilter(gp.filter); setPage(0); }}
                  className={
                    "px-3 py-1 rounded text-[10px] uppercase tracking-[0.08em] font-semibold transition-colors " +
                    (govFilter === gp.filter
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30")
                  }
                >
                  {gp.label}
                </button>
              ))}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={PoundSterling}
                label="Total Donated"
                value={fmt(stats.totalVal)}
                sub={stats.totalCount.toLocaleString() + " donations" + (govFilter ? " in period" : " since 2001")}
              />
              <StatCard
                icon={Hash}
                label="Total Donations"
                value={stats.totalCount.toLocaleString()}
                sub={"From " + stats.uniqueDonors.toLocaleString() + " unique donors"}
              />
              <StatCard
                icon={Users}
                label="Unique Donors"
                value={stats.uniqueDonors.toLocaleString()}
                sub={govFilter || "All time (2001-2026)"}
              />
              <StatCard
                icon={TrendingUp}
                label="Top Recipient"
                value={stats.topParty ? stats.topParty[0] : "N/A"}
                sub={stats.topParty ? fmt(stats.topParty[1]) : ""}
                accent={stats.topParty && stats.topParty[0] === "Labour" ? "red" : "blue"}
              />
            </div>

            {/* Donor-Contract Overlap Callout */}
            {!govFilter && donorContractOverlap && donorContractOverlap.count > 0 && (
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-400 mt-0.5 flex-shrink-0" size={16} />
                  <div>
                    <h3 className="text-gray-200 font-medium text-sm mb-1">
                      Donors Who Also Won Government Contracts
                    </h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      <span className="text-gray-200 font-mono">{donorContractOverlap.count} companies</span>
                      {" that donated a combined "}
                      <span className="text-gray-200 font-mono">{fmt(donorContractOverlap.totalDonated)}</span>
                      {" to political parties also received "}
                      <span className="text-gray-200 font-mono">{fmt(donorContractOverlap.totalContracts)}</span>
                      {" in government contracts. This does not prove corruption, but highlights potential conflicts of interest."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Charts grid — side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Stacked Area Chart — Donations by Party per Year */}
            <ChartCard
              title={"Donations by Party" + (govFilter ? " \u2014 " + govFilter : " \u2014 All Time")}
              subtitle={"Stacked by major UK parties, " + dd.summary.totalDonations.toLocaleString() + " total donations"}
              shareHeadline={fmt(dd.summary.totalValue)}
              shareSubline={"Total political donations " + (govFilter || "2001-2026")}
              onShare={handleChartShare}
              accentColor="#ef4444"
            >
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                  <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={v => "\u00A3" + (v / 1e6).toFixed(0) + "m"} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#f3f4f6", fontWeight: 600 }}
                    formatter={(v, name) => ["\u00A3" + (v / 1e6).toFixed(1) + "m", name]}
                  />
                  {Object.entries(PARTY_COLOURS).map(([party, colour]) => (
                    <Area key={party} type="monotone" dataKey={party} stackId="1" fill={colour} stroke={colour} fillOpacity={0.7} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <ChartMeta
                note={"Data covers all registered donations \u2265\u00A3500 reported to the Electoral Commission."}
                source="Electoral Commission"
                sourceUrl="https://search.electoralcommission.org.uk"
              />
            </ChartCard>

            {/* Party breakdown bar chart */}
            <ChartCard
              title={"Donations by Party" + (govFilter ? " — " + govFilter : "")}
              subtitle="Total value received by each party"
              onShare={handleChartShare}
              shareHeadline="Follow the money"
              shareSubline="Political donations by party, per seat won"
              accentColor="#0087DC"
            >
              <ResponsiveContainer width="100%" height={Math.max(280, dd.byParty.length * 32)}>
                <BarChart
                  data={(() => {
                    if (govFilter) {
                      const partyTotals = {};
                      allDonations.filter(d => d.govPeriod === govFilter).forEach(d => {
                        partyTotals[d.party] = (partyTotals[d.party] || 0) + d.value;
                      });
                      return Object.entries(partyTotals)
                        .map(([name, total]) => ({ name, total: Math.round(total) }))
                        .sort((a, b) => b.total - a.total);
                    }
                    return dd.byParty;
                  })()}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => "£" + (v / 1e6).toFixed(0) + "m"} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fill: "#d1d5db", fontSize: 11 }} width={115} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#f3f4f6" }}
                    labelStyle={{ color: "#f3f4f6", fontWeight: 600 }}
                    itemStyle={{ color: "#d1d5db" }}
                    formatter={(v) => ["\u00A3" + (v / 1e6).toFixed(1) + "m", "Total"]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {(() => {
                      const data = govFilter
                        ? (() => {
                            const pt = {};
                            allDonations.filter(d => d.govPeriod === govFilter).forEach(d => {
                              pt[d.party] = (pt[d.party] || 0) + d.value;
                            });
                            return Object.entries(pt).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
                          })()
                        : dd.byParty;
                      return data.map((d, i) => (
                        <Cell key={i} fill={PARTY_COLOURS[d.name] || "#6b7280"} fillOpacity={0.85} />
                      ));
                    })()}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            </div>

            {/* Top Donors Table */}
            <SectionHeader title={"Top 25 Donors" + (govFilter ? " — " + govFilter : "")} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">#</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Donor</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Type</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Total</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Count</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Recipients</th>
                  </tr>
                </thead>
                <tbody>
                  {dd.topDonors.slice(0, 25).map((d, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 text-gray-600 text-xs">{i + 1}</td>
                      <td className="py-3 px-4 text-gray-200 font-medium text-xs">{d.name}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{d.type}</td>
                      <td className="py-3 px-4 text-right text-gray-200 font-mono text-xs">{fmt(d.total)}</td>
                      <td className="py-3 px-4 text-right text-gray-400 font-mono text-xs">{d.count}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {d.parties.slice(0, 3).map((p, j) => (
                          <span key={j} className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium" style={{
                            backgroundColor: (PARTY_COLOURS[p] || "#6b7280") + "22",
                            color: PARTY_COLOURS[p] || "#9ca3af",
                          }}>
                            {p}
                          </span>
                        ))}
                        {d.parties.length > 3 && <span className="text-gray-600 text-[9px]">+{d.parties.length - 3}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Individual Donations — Filterable Table */}
            <SectionHeader title="Individual Donations" />
            {recordsLoading && (
              <div className="text-center py-12 text-gray-500 text-sm">
                <RefreshCw className="animate-spin inline-block mr-2" size={14} />
                Loading donation records...
              </div>
            )}
            {!recordsLoading && <div className="space-y-3">
              {/* Filters row */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Recipient</label>
                  <select
                    value={partyFilter}
                    onChange={e => { setPartyFilter(e.target.value); setPage(0); }}
                    className="bg-gray-900/50 border border-gray-800 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-gray-600 focus:outline-none"
                  >
                    <option value="All">All recipients</option>
                    {["Conservative", "Labour", "Liberal Democrats", "Reform UK", "SNP", "Green", "UKIP", "Other"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Donor Type</label>
                  <select
                    value={donorTypeFilter}
                    onChange={e => { setDonorTypeFilter(e.target.value); setPage(0); }}
                    className="bg-gray-900/50 border border-gray-800 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-gray-600 focus:outline-none"
                  >
                    <option value="All">All donor types</option>
                    {dd.byDonorType.map(d => (
                      <option key={d.type} value={d.type}>{d.type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Min Value</label>
                  <select
                    value={minValue}
                    onChange={e => { setMinValue(e.target.value); setPage(0); }}
                    className="bg-gray-900/50 border border-gray-800 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-gray-600 focus:outline-none"
                  >
                    <option value="">No minimum</option>
                    <option value="10000">{"≥ £10,000"}</option>
                    <option value="50000">{"≥ £50,000"}</option>
                    <option value="100000">{"≥ £100,000"}</option>
                    <option value="500000">{"≥ £500,000"}</option>
                    <option value="1000000">{"≥ £1,000,000"}</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Search size={12} className="text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search donor or party..."
                    value={searchQuery}
                    maxLength={100}
                    onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
                    className="bg-gray-900/50 border border-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 w-48 focus:border-gray-600 focus:outline-none placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Results count */}
              <div className="text-[10px] text-gray-500">
                {"Showing " + (page * PAGE_SIZE + 1) + "-" + Math.min((page + 1) * PAGE_SIZE, filtered.length) +
                 " of " + filtered.length.toLocaleString() + " donations" +
                 (filtered.length < allDonations.length ? " (filtered)" : "") +
                 " · Top " + dd.metadata.recordsIncluded.toLocaleString() + " by value from " + dd.metadata.totalRecords.toLocaleString() + " total"}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th onClick={() => handleSort("donor")} className="text-left py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300">
                        Donor <SortIcon col="donor" />
                      </th>
                      <th className="text-left py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Type</th>
                      <th onClick={() => handleSort("entity")} className="text-left py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300">
                        Recipient <SortIcon col="entity" />
                      </th>
                      <th onClick={() => handleSort("value")} className="text-right py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300">
                        Value <SortIcon col="value" />
                      </th>
                      <th onClick={() => handleSort("date")} className="text-left py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300">
                        Date <SortIcon col="date" />
                      </th>
                      <th className="text-left py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((d, i) => (
                      <tr
                        key={d.ecRef + "-" + i}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedDonation(d)}
                      >
                        <td className="py-3 px-3 text-gray-200 text-xs font-medium max-w-[200px] truncate">{d.donor}</td>
                        <td className="py-3 px-3">
                          <span className={
                            "inline-block px-1.5 py-0.5 rounded text-[9px] font-medium " +
                            (d.donorStatus === "Individual" ? "bg-blue-500/10 text-blue-400" :
                             d.donorStatus === "Company" ? "bg-purple-500/10 text-purple-400" :
                             d.donorStatus === "Trade Union" ? "bg-orange-500/10 text-orange-400" :
                             "bg-gray-500/10 text-gray-400")
                          }>
                            {d.donorStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium" style={{
                            backgroundColor: (PARTY_COLOURS[d.party] || "#6b7280") + "22",
                            color: PARTY_COLOURS[d.party] || "#9ca3af",
                          }}>
                            {d.party}
                          </span>
                          {d.entity !== d.party && (
                            <span className="text-gray-600 text-[9px] ml-1">{d.entity.length > 30 ? d.entity.substring(0, 28) + "\u2026" : d.entity}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-200 font-mono text-xs font-medium">{fmtFull(d.value)}</td>
                        <td className="py-3 px-3 text-gray-400 text-xs font-mono">{d.accepted || "\u2014"}</td>
                        <td className="py-3 px-3 text-gray-500 text-[10px] font-mono">{d.companyReg || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded disabled:opacity-30 hover:bg-gray-700 transition-colors"
                  >
                    {"\u2190 Previous"}
                  </button>
                  <div className="text-[10px] text-gray-500">
                    Page {page + 1} of {pageCount}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded disabled:opacity-30 hover:bg-gray-700 transition-colors"
                  >
                    {"Next \u2192"}
                  </button>
                </div>
              )}
            </div>}

            {/* Donation Detail Modal */}
            {selectedDonation && (
              <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDonation(null)}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white">Donation Details</h3>
                    <button onClick={() => setSelectedDonation(null)} className="text-gray-500 hover:text-gray-300 text-lg">{"×"}</button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Donor Info</div>
                      <div className="text-gray-200 text-sm font-medium">{selectedDonation.donor}</div>
                      <div className="text-gray-400 text-xs mt-0.5">
                        <span className={
                          "inline-block px-1.5 py-0.5 rounded text-[9px] font-medium mr-2 " +
                          (selectedDonation.donorStatus === "Individual" ? "bg-blue-500/10 text-blue-400" :
                           selectedDonation.donorStatus === "Company" ? "bg-purple-500/10 text-purple-400" :
                           selectedDonation.donorStatus === "Trade Union" ? "bg-orange-500/10 text-orange-400" :
                           "bg-gray-500/10 text-gray-400")
                        }>
                          {selectedDonation.donorStatus}
                        </span>
                        {selectedDonation.companyReg && <span className="text-gray-500">Co. #{selectedDonation.companyReg}</span>}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Recipient Info</div>
                      <div className="text-gray-200 text-sm">{selectedDonation.entity}</div>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium mt-0.5" style={{
                        backgroundColor: (PARTY_COLOURS[selectedDonation.party] || "#6b7280") + "22",
                        color: PARTY_COLOURS[selectedDonation.party] || "#9ca3af",
                      }}>
                        {selectedDonation.party}
                      </span>
                      {selectedDonation.doneeType && <span className="text-gray-500 text-xs ml-2">{selectedDonation.doneeType}</span>}
                    </div>

                    <div className="border-t border-gray-800 pt-3">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Donation Details</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[9px] text-gray-600 uppercase">Value</div>
                          <div className="text-gray-100 font-mono font-bold">{fmtFull(selectedDonation.value)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-600 uppercase">Donation Type</div>
                          <div className="text-gray-300 text-sm">{selectedDonation.donationType || "\u2014"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-600 uppercase">Received Date</div>
                          <div className="text-gray-300 text-sm font-mono">{selectedDonation.received || "\u2014"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-600 uppercase">Accepted Date</div>
                          <div className="text-gray-300 text-sm font-mono">{selectedDonation.accepted || "\u2014"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-600 uppercase">Reported Date</div>
                          <div className="text-gray-300 text-sm font-mono">{selectedDonation.reported || "\u2014"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-600 uppercase">EC Reference</div>
                          <a
                            href={"https://search.electoralcommission.org.uk/?ecRef=" + selectedDonation.ecRef}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 text-sm font-mono hover:underline"
                          >
                            {selectedDonation.ecRef}
                          </a>
                        </div>
                      </div>
                      {selectedDonation.nature && (
                        <div className="mt-2">
                          <div className="text-[9px] text-gray-600 uppercase">Nature of Donation</div>
                          <div className="text-gray-400 text-xs">{selectedDonation.nature}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Source attribution */}
            <div className="text-gray-600 text-xs px-1 mt-4">
              Source: Electoral Commission — Open Government Licence v3.0.{" "}
              {dd.metadata.note}
            </div>
          </div>
          );
        })()}

        {/* ===== ACCOUNTABILITY: MPs' PAY vs THE COUNTRY ===== */}
        {view === "transparency.mppay" && (() => {
          const mpPayTimeline = mpPayVsCountryData.timeline;
          const mpCosts = mpPayVsCountryData.mpCosts;
          const hl = mpPayVsCountryData.headline;

          const base = mpPayTimeline[0];
          const filtered = filterByRange(mpPayTimeline, "year", mpPayRange);

          const filteredCosts = filterByRange(mpCosts, "year", mpPayRange);
          const latestCost = mpCosts[mpCosts.length - 1];
          const latest = mpPayTimeline[mpPayTimeline.length - 1];
          const gapFormatted = "\u00A3" + latest.pay_gap.toLocaleString();
          const salaryFormatted = "\u00A3" + latest.mp_salary.toLocaleString();
          const medianFormatted = "\u00A3" + latest.uk_median.toLocaleString();

          return (
          <div className="space-y-6">
            {/* HEADER */}
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                {"Accountability \u203A MPs\u2019 Pay"}
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                {"MPs\u2019 Pay vs the Country"}
              </h2>
              <p className="text-gray-500 text-sm mt-2 max-w-2xl">
                {"How MP pay has changed relative to the people they represent. All data from IPSA, ONS ASHE, and UK Parliament official records. Base year indexed to 100."}
              </p>
            </div>

            {/* TIME FILTER */}
            <TimeRangeControl range={mpPayRange} setRange={setMpPayRange} />

            {/* STAT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={PoundSterling} label={"MP Salary " + latest.year} value={salaryFormatted} accent="text-red-400" sub={"+" + hl.mp_growth_since_2000_pct + "% since 2000"} />
              <StatCard icon={Users} label={"UK Median " + latest.year} value={medianFormatted} accent="text-blue-400" sub={"+" + hl.median_growth_since_2000_pct + "% since 2000"} />
              <StatCard icon={TrendingUp} label="Pay Gap" value={gapFormatted} accent="text-amber-400" sub={"MP earns " + latest.mp_multiple.toFixed(1) + "\u00D7 median"} />
              <StatCard icon={Scale} label={"Total MP Cost " + latestCost.year} value={"\u00A3" + Math.round(latestCost.total / 1000) + "k"} accent="text-purple-400" sub="Salary + staff + office + travel" />
            </div>

            {/* === CHART PAIR: PAY GAP + MP COST === */}
            <ChartPair>
              {/* SECONDARY CHART: ABSOLUTE PAY GAP */}
              <ChartCard
                chartId="mp-pay-vs-median"
                title={"The Pay Gap in Pounds"}
                subtitle="Absolute difference between MP salary and UK median earnings"
                info="Shows how far apart MP and median pay are in real pounds. Even when percentage growth is similar, the absolute gap keeps widening because MPs start from a higher base."
                editorial={"The pay gap has grown from \u00A329,523 in 2000 to " + gapFormatted + " in " + latest.year + ". That\u2019s an extra \u00A3" + (latest.pay_gap - base.pay_gap).toLocaleString() + " of distance between MPs and the people they serve."}
                shareHeadline={"The gap keeps growing"}
                shareSubline={gapFormatted + " between MPs and the median worker"}
                accentColor="#f59e0b"
                onShare={handleChartShare}
                explainData={filtered.slice(-8).map(d => d.year + ": MP \u00A3" + d.mp_salary.toLocaleString() + " vs Median \u00A3" + d.uk_median.toLocaleString() + " = gap \u00A3" + d.pay_gap.toLocaleString()).join("; ")}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filtered} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={1}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={filtered.length > 15 ? 2 : 0} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => "\u00A3" + (v / 1000).toFixed(0) + "k"} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v) => ["\u00A3" + v.toLocaleString()]}
                    />
                    <Bar dataKey="uk_median" name="UK Median" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="mp_salary" name="MP Salary" fill="#ef4444" radius={[2, 2, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 inline-block rounded-sm" /> UK Median</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 inline-block rounded-sm" /> MP Salary</span>
                </div>
              </ChartCard>

              {/* THIRD CHART: TOTAL COST OF AN MP */}
              <ChartCard
                chartId="mp-business-costs"
                title={"The Real Cost of an MP"}
                subtitle="Total taxpayer-funded cost breakdown per MP per year"
                info="Includes base salary, staffing budget, office costs, accommodation, and travel allowances. Source: IPSA annual budget allocations (non-London). Actual spend varies by MP."
                editorial={"The total taxpayer cost per MP has risen from \u00A3" + Math.round(mpCosts[0].total / 1000) + "k in " + mpCosts[0].year + " to \u00A3" + Math.round(latestCost.total / 1000) + "k in " + latestCost.year + ". Staffing is by far the largest component, making up over 60% of total costs."}
                shareHeadline={"\u00A3" + Math.round(latestCost.total / 1000) + "k per MP"}
                shareSubline="The full taxpayer-funded cost per Member of Parliament"
                accentColor="#a855f7"
                onShare={handleChartShare}
                explainData={filteredCosts.slice(-6).map(d => d.year + ": salary \u00A3" + d.salary.toLocaleString() + ", staffing \u00A3" + d.staffing.toLocaleString() + ", office \u00A3" + d.office.toLocaleString() + ", accomm \u00A3" + d.accommodation.toLocaleString() + ", travel \u00A3" + d.travel.toLocaleString() + ", total \u00A3" + d.total.toLocaleString()).join("; ")}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filteredCosts} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => "\u00A3" + (v / 1000).toFixed(0) + "k"} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v) => ["\u00A3" + v.toLocaleString()]}
                    />
                    <Bar dataKey="salary" name="Base Salary" stackId="cost" fill="#ef4444" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="staffing" name="Staffing Budget" stackId="cost" fill="#a855f7" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="office" name="Office Costs" stackId="cost" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="accommodation" name="Accommodation" stackId="cost" fill="#22d3ee" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="travel" name="Travel" stackId="cost" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="other" name="Other" stackId="cost" fill="#64748b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 inline-block rounded-sm" /> Salary</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-purple-500 inline-block rounded-sm" /> Staffing</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 inline-block rounded-sm" /> Office</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-cyan-400 inline-block rounded-sm" /> Accommodation</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 inline-block rounded-sm" /> Travel</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gray-500 inline-block rounded-sm" /> Other</span>
                </div>
              </ChartCard>
            </ChartPair>

            {/* === THE DIVERGENCE: SALARY LINES + GAP + MULTIPLIER === */}
            <div className="border-t border-gray-800/40 mt-10 pt-10">
              <SectionHeader label={"Accountability \u203A Pay Ratio"} title="The Divergence" accent="text-red-400" />
              <p className="text-gray-500 text-sm mb-6 -mt-4 max-w-2xl">
                {"MP salary vs UK median earnings in absolute pounds. The shaded red area is the gap. The gold line tracks how many times more an MP earns \u2014 " + base.mp_multiple.toFixed(1) + "\u00D7 in 2000, " + latest.mp_multiple.toFixed(1) + "\u00D7 today."}
              </p>
              <ChartCard
                chartId="mp-pay-ratio"
                title="Two Salaries, One Country"
                subtitle={"MP salary and UK median earnings side by side \u2014 with the pay multiplier overlaid"}
                info={"Left axis: absolute salaries in \u00A3. Shaded area = the gap. Right axis (gold dashed): how many median salaries one MP salary equals. Sources: IPSA, ONS ASHE."}
                editorial={"The gap between the red and blue lines is what MPs take home above the median worker every year. In 2000 that gap was \u00A329,523. By " + latest.year + " it has grown to " + gapFormatted + " \u2014 an extra \u00A3" + (latest.pay_gap - base.pay_gap).toLocaleString() + " of daylight."}
                shareHeadline={latest.mp_multiple.toFixed(1) + "\u00D7 the median worker"}
                shareSubline={"MPs earn " + gapFormatted + " more than the UK median"}
                accentColor="#ef4444"
                onShare={handleChartShare}
                explainData={filtered.slice(-8).map(d => d.year + ": MP \u00A3" + d.mp_salary.toLocaleString() + ", Median \u00A3" + d.uk_median.toLocaleString() + ", Gap \u00A3" + d.pay_gap.toLocaleString() + ", Ratio " + d.mp_multiple.toFixed(2) + "\u00D7").join("; ")}
              >
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={filtered} margin={{ top: 10, right: 50, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mpSalaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="salary" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => "\u00A3" + (v / 1000).toFixed(0) + "k"} domain={[0, "auto"]} />
                    <YAxis yAxisId="ratio" orientation="right" tick={{ fill: "#f59e0b", fontSize: 10, opacity: 0.7 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + "\u00D7"} domain={[0, 4]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v, name) => {
                        if (name === "mp_salary") return ["\u00A3" + v.toLocaleString(), "MP Salary"];
                        if (name === "uk_median") return ["\u00A3" + v.toLocaleString(), "UK Median"];
                        if (name === "mp_multiple") return [v.toFixed(2) + "\u00D7", "Pay Multiplier"];
                        return [v];
                      }}
                    />
                    {/* Median salary area (blue, lower) */}
                    <Area yAxisId="salary" type="monotone" dataKey="uk_median" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} dot={false} name="uk_median" />
                    {/* MP salary area (red, higher) — the gap between red and blue is shaded */}
                    <Area yAxisId="salary" type="monotone" dataKey="mp_salary" stroke="#ef4444" fill="url(#mpSalaryGrad)" strokeWidth={2.5} dot={false} name="mp_salary" />
                    {/* Multiplier line on right axis */}
                    <Line yAxisId="ratio" type="monotone" dataKey="mp_multiple" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="mp_multiple" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> MP Salary</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> UK Median</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded opacity-60" style={{ borderTop: "1px dashed" }} /> Pay Multiplier</span>
                </div>
              </ChartCard>
            </div>

            {/* SOURCE NOTE */}
            <div className="text-[10px] text-gray-600 leading-relaxed mt-8 border-t border-gray-800/30 pt-4">
              {"Sources: IPSA (Independent Parliamentary Standards Authority), ONS Annual Survey of Hours and Earnings (ASHE) Table 1 & Table 13, House of Commons Library Research Briefings, UK Parliament official records. MP salary = basic parliamentary salary from 1 April each year. Median earnings = gross annual earnings for full-time employees. Private sector from ASHE Table 13 public/private breakdown. MP costs = IPSA non-London budget allocations."}
            </div>
          </div>
          );
        })()}

        {/* ===== TRANSPARENCY: MP ACCOUNTABILITY TRACKER ===== */}
        {view === "transparency.mp" && (() => {
          const agg = mpInterestsData.aggregateStats;
          const summary = mpInterestsData.summary;
          const expenseData = mpInterestsData.expenses.annualTotals
            .filter(d => d.total && typeof d.total === "number")
            .map(d => ({ year: d.year, total: d.total, staffing: d.staffing || 0, office: d.office || 0, accommodation: d.accommodation || 0, travel: d.travel || 0 }));
          const byParty = mpInterestsData.byParty || [];

          // Aliases for top-level hooks
          const partyFilter = mpPartyFilter;
          const setPartyFilter = setMpPartyFilter;
          const searchQuery = mpSearchQuery;
          const setSearchQuery = setMpSearchQuery;
          const sortCol = mpSortCol;
          const setSortCol = setMpSortCol;
          const sortDir = mpSortDir;
          const setSortDir = setMpSortDir;
          const page = mpPage;
          const setPage = setMpPage;
          const selectedMP = mpSelectedMP;
          const setSelectedMP = setMpSelectedMP;
          const allMPs = mpRecords;
          const recordsLoading = mpRecordsLoading;
          const detailTab = mpDetailTab;
          const setDetailTab = setMpDetailTab;

          const PAGE_SIZE = 50;

          // Party color map
          const partyColors = (() => {
            const m = {};
            for (const mp of allMPs) { if (mp.pc) m[mp.pa] = "#" + mp.pc; }
            return m;
          })();

          // Filtered + sorted MPs
          const filtered = (() => {
            let list = [...allMPs];
            if (partyFilter !== "All") {
              if (partyFilter === "Labour") {
                list = list.filter(m => m.p === "Labour" || m.p === "Labour (Co-op)");
              } else {
                list = list.filter(m => m.p === partyFilter || m.pa === partyFilter);
              }
            }
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              list = list.filter(m =>
                m.n.toLowerCase().includes(q) ||
                m.c.toLowerCase().includes(q) ||
                m.p.toLowerCase().includes(q)
              );
            }
            list.sort((a, b) => {
              const av = a[sortCol] || 0;
              const bv = b[sortCol] || 0;
              if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
              return sortDir === "asc" ? av - bv : bv - av;
            });
            return list;
          })();

          const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
          const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

          // Party tabs (main parties only)
          const partyTabs = (() => {
            const main = ["All", "Labour", "Conservative", "Liberal Democrat", "Reform UK", "SNP", "Green Party"];
            const counts = { All: allMPs.length };
            for (const mp of allMPs) {
              const key = (mp.p === "Labour (Co-op)") ? "Labour" : mp.p;
              counts[key] = (counts[key] || 0) + 1;
            }
            // Map SNP label
            counts["SNP"] = counts["Scottish National Party"] || 0;
            return main.map(name => ({ name, count: counts[name] || 0 }));
          })();

          const fmtMoney = (v) => {
            if (v >= 1e6) return "£" + (v / 1e6).toFixed(1) + "M";
            if (v >= 1e3) return "£" + (v / 1e3).toFixed(0) + "k";
            if (v > 0) return "£" + v.toLocaleString();
            return "—";
          };

          const handleSort = (col) => {
            if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else { setSortCol(col); setSortDir("desc"); }
            setPage(0);
          };

          // Compute filtered stats
          const filteredStats = (() => {
            return {
              totalOI: filtered.reduce((s, m) => s + (m.oi || 0), 0),
              totalGI: filtered.reduce((s, m) => s + (m.gi || 0), 0),
              totalDN: filtered.reduce((s, m) => s + (m.dn || 0), 0),
            };
          })();

          // MP detail view
          if (selectedMP) {
            const mp = selectedMP;
            const totalInterests = (mp.oi || 0) + (mp.gi || 0) + (mp.dn || 0);
            return (
            <div className="space-y-6">
              <button
                onClick={() => { setSelectedMP(null); setDetailTab("overview"); }}
                className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to all MPs
              </button>

              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 flex-shrink-0 border-2 border-gray-700">
                  <img
                    src={"https://members-api.parliament.uk/api/Members/" + mp.id + "/Thumbnail"}
                    alt={mp.n}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-black uppercase tracking-tight">{mp.n}</h1>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: (partyColors[mp.pa] || "#6b7280") + "20", color: partyColors[mp.pa] || "#9ca3af", border: "1px solid " + (partyColors[mp.pa] || "#6b7280") + "40" }}
                    >
                      {mp.p}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-400 text-sm">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {mp.c}</span>
                    <a
                      href={"https://members.parliament.uk/member/" + mp.id + "/registeredinterests"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Verify on Parliament.uk
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Briefcase} label="Outside Income" value={fmtMoney(mp.oi)} sub={mp.oi > 0 ? "Declared since July 2024" : "None declared"} accent={mp.oi > 100000 ? "red" : undefined} />
                <StatCard icon={Gift} label="Gifts & Hospitality" value={fmtMoney(mp.gi)} sub={mp.gi > 0 ? "Declared since July 2024" : "None declared"} />
                <StatCard icon={PoundSterling} label="Donations Received" value={fmtMoney(mp.dn)} sub={mp.dn > 0 ? "Declared since July 2024" : "None declared"} />
                <StatCard icon={Home} label="Property" value={mp.prC ? mp.prC + " declared" : "None"} sub={mp.shC ? mp.shC + " shareholding" + (mp.shC > 1 ? "s" : "") : "No shareholdings"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <ChartCard 
                    title="Financial Interests Breakdown" 
                    subtitle="All declared interests for this MP"
                    onShare={handleChartShare}
                    shareHeadline="Your MP's side hustle"
                    shareSubline="Declared financial interests of sitting MPs"
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: "Outside Income", value: mp.oi || 0, fill: "#ef4444" },
                        { name: "Gifts", value: mp.gi || 0, fill: "#f59e0b" },
                        { name: "Donations", value: mp.dn || 0, fill: "#6366f1" },
                      ]} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => fmtMoney(v)} />
                        <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} formatter={(v) => ["£" + v.toLocaleString(), "Value"]} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {[0,1,2].map(i => <Cell key={i} fill={["#ef4444","#f59e0b","#6366f1"][i]} fillOpacity={0.8} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {mp.oi > 0 && (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
                      <h3 className="text-gray-200 font-medium text-sm mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4 text-red-400" /> Outside Earnings</h3>
                      <p className="text-gray-400 text-sm">
                        {mp.n} has declared <span className="text-gray-200 font-mono">{fmtMoney(mp.oi)}</span> in outside earnings
                        since the July 2024 election.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Summary</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Total Interests", value: fmtMoney(totalInterests), color: "text-gray-200" },
                        { label: "Outside Income", value: fmtMoney(mp.oi), color: "text-red-400" },
                        { label: "Gifts", value: fmtMoney(mp.gi), color: "text-amber-400" },
                        { label: "Donations", value: fmtMoney(mp.dn), color: "text-indigo-400" },
                        { label: "Properties", value: mp.prC || 0, color: "text-gray-300" },
                        { label: "Shareholdings", value: mp.shC || 0, color: "text-gray-300" },
                        { label: "Family Links", value: mp.fmC || 0, color: "text-gray-300" },
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-gray-400">{row.label}</span>
                          <span className={"font-mono " + row.color}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-gray-600 text-xs px-1 mt-4">
                Sources: Register of Members' Financial Interests; MySociety Parsed Register; IPSA.
                Data from the current Parliament (since July 2024). Monetary values extracted from official declarations.
              </div>
            </div>
            );
          }

          // Main MP list view
          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Accountability → Parliament
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                MP Accountability Tracker
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                {mpInterestsData.contextSentences.headline}
              </p>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard icon={Users} label="MPs Tracked" value={summary.totalMPs.toString()} sub="Current Parliament" />
              <StatCard icon={Briefcase} label="Outside Income" value={fmtMoney(summary.totalOutsideIncome)} sub={summary.mpsWithOutsideIncome + " MPs with earnings"} accent="red" />
              <StatCard icon={Gift} label="Gifts Declared" value={fmtMoney(summary.totalGifts)} sub={summary.mpsWithGifts + " MPs received gifts"} />
              <StatCard icon={TrendingUp} label="Total Expenses" value="£693.6M" sub="IPSA 2019-2024 total" />
              <StatCard icon={PoundSterling} label="Donations Received" value={fmtMoney(summary.totalDonations)} sub={summary.mpsWithDonations + " MPs with donations"} />
            </div>

            {/* Party filter tabs */}
            <div className="flex flex-wrap gap-1.5">
              {partyTabs.map(tab => {
                const isActive = partyFilter === tab.name || (partyFilter === "SNP" && tab.name === "SNP");
                const filterVal = tab.name === "SNP" ? "Scottish National Party" : tab.name;
                return (
                  <button
                    key={tab.name}
                    onClick={() => { setPartyFilter(partyFilter === filterVal ? "All" : filterVal); setPage(0); }}
                    className={
                      "px-3 py-1 rounded text-[10px] uppercase tracking-[0.08em] font-semibold transition-colors " +
                      (isActive || (partyFilter === "All" && tab.name === "All")
                        ? "bg-gray-800 text-white"
                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30")
                    }
                  >
                    {tab.name} <span className="text-gray-600 ml-1">{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, constituency, or party..."
                value={searchQuery}
                maxLength={100}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="w-full bg-gray-900/50 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-500 hover:text-gray-300" />
                </button>
              )}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {filtered.length} MP{filtered.length !== 1 ? "s" : ""} found
                {partyFilter !== "All" ? (" — " + partyFilter) : ""}
              </span>
              <span className="text-gray-500 text-xs">
                Total outside income: <span className="text-gray-300 font-mono">{fmtMoney(filteredStats.totalOI)}</span>
                {" · "}Gifts: <span className="text-gray-300 font-mono">{fmtMoney(filteredStats.totalGI)}</span>
                {" · "}Donations: <span className="text-gray-300 font-mono">{fmtMoney(filteredStats.totalDN)}</span>
              </span>
            </div>

            {/* MP table */}
            {recordsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                <span className="ml-3 text-gray-400">Loading MP records...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        { key: "n", label: "Name", align: "left" },
                        { key: "p", label: "Party", align: "left" },
                        { key: "c", label: "Constituency", align: "left" },
                        { key: "oi", label: "Outside Income", align: "right" },
                        { key: "gi", label: "Gifts", align: "right" },
                        { key: "dn", label: "Donations", align: "right" },
                      ].map(col => (
                        <th
                          key={col.key}
                          className={
                            (col.align === "right" ? "text-right " : "text-left ") +
                            "py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none"
                          }
                          onClick={() => handleSort(col.key)}
                        >
                          <span className="flex items-center gap-1" style={{ justifyContent: col.align === "right" ? "flex-end" : "flex-start" }}>
                            {col.label}
                            <ArrowUpDown className={"w-3 h-3 " + (sortCol === col.key ? "text-gray-300" : "text-gray-600")} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((mp, i) => (
                      <tr
                        key={mp.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedMP(mp)}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: partyColors[mp.pa] || "#6b7280" }}
                            />
                            <span className="text-gray-200 font-medium">{mp.n}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium"
                            style={{ backgroundColor: (partyColors[mp.pa] || "#6b7280") + "15", color: partyColors[mp.pa] || "#9ca3af" }}
                          >
                            {mp.pa}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-400 text-xs">{mp.c}</td>
                        <td className={"py-3 px-3 text-right font-mono " + (mp.oi > 100000 ? "text-red-400" : mp.oi > 0 ? "text-gray-200" : "text-gray-600")}>{mp.oi > 0 ? fmtMoney(mp.oi) : "—"}</td>
                        <td className={"py-3 px-3 text-right font-mono " + (mp.gi > 0 ? "text-amber-400/80" : "text-gray-600")}>{mp.gi > 0 ? fmtMoney(mp.gi) : "—"}</td>
                        <td className={"py-3 px-3 text-right font-mono " + (mp.dn > 0 ? "text-indigo-400/80" : "text-gray-600")}>{mp.dn > 0 ? fmtMoney(mp.dn) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-500 text-xs">
                  Page {page + 1} of {totalPages} ({filtered.length} MPs)
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <ChartCard chartId="outside-income-by-party" title="Outside Income by Party" subtitle="Total declared external earnings" shareHeadline={fmtMoney(summary.totalOutsideIncome)} shareSubline="Total outside income declared by current MPs" onShare={handleChartShare} accentColor="#ef4444" explainData={byParty.filter(p => p.oi > 0).slice(0, 6).map(p => `${p.name}: £${p.oi.toLocaleString()}`).join("; ")}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byParty.filter(p => p.oi > 0).slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis type="number" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => fmtMoney(v)} />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fill: "#d1d5db", fontSize: 10 }} width={95} />
                    <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} formatter={(v) => ["£" + v.toLocaleString(), "Outside Income"]} />
                    <Bar dataKey="oi" radius={[0, 4, 4, 0]} fill="#ef4444" fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
                <ChartMeta
                  note={mpInterestsData.contextSentences.earnings}
                  source="Register of Members' Financial Interests"
                  sourceUrl={mpInterestsData.metadata.primarySources[0].url}
                />
              </ChartCard>

              <ChartCard chartId="mp-expense-trends" title="MP Business Costs Over Time" subtitle="IPSA annual publications — staffing dominates" shareHeadline="£157m" shareSubline="Total expenses 2023-24" onShare={handleChartShare} explainData={expenseData.map(d => `${d.year}: staffing £${d.staffing}m, office £${d.office}m, accommodation £${d.accommodation}m, travel £${d.travel}m`).join("; ")}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={expenseData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => "£" + v + "m"} />
                    <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} formatter={(v, name) => ["£" + v.toFixed(1) + "m", name]} />
                    <Bar dataKey="staffing" stackId="a" fill="#6366f1" fillOpacity={0.8} name="Staffing" />
                    <Bar dataKey="office" stackId="a" fill="#8b5cf6" fillOpacity={0.7} name="Office" />
                    <Bar dataKey="accommodation" stackId="a" fill="#a78bfa" fillOpacity={0.6} name="Accommodation" />
                    <Bar dataKey="travel" stackId="a" fill="#c4b5fd" fillOpacity={0.5} name="Travel" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <ChartMeta
                  note={mpInterestsData.contextSentences.expenses}
                  source="IPSA Annual Publications"
                  sourceUrl={mpInterestsData.metadata.primarySources[1].url}
                />
              </ChartCard>
            </div>

            {/* Gifts & Hospitality */}
            <SectionHeader title="Gifts & Hospitality Breakdown" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Category</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Value</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(agg.giftCategories || []).map((d, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 text-gray-200">{d.category}</td>
                      <td className="py-3 px-4 text-right text-gray-200 font-mono">£{d.value.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{d.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-gray-600 text-xs px-1 mt-4">
              Sources:{" "}
              {mpInterestsData.metadata.primarySources.map(s => s.name).join("; ")}; MySociety Register of Interests (NLP-parsed).{" "}
              {mpInterestsData.metadata.methodologyNote}
            </div>
          </div>
          );
        })()}

        {/* ===== TRANSPARENCY: LOBBYING ===== */}
        {view === "transparency.lobbying" && (() => {
          const regData = lobbyingData.registerStats.registrationSeries;
          const deptData = lobbyingData.ministerialMeetings.meetingsByDepartment.slice(0, 10);
          const intlData = lobbyingData.internationalComparison;
          const summ = lobbyingData.summary;
          const lobbyists = lobRecords.lobbyists || [];
          const topClients = lobRecords.topClients || [];
          const _lobSearch = lobSearchQuery;
          const _lobSortCol = lobSortCol;
          const _lobSortDir = lobSortDir;
          const _lobPage = lobPage;
          const _lobTab = lobTab;
          const _lobSelectedFirm = lobSelectedFirm;
          const setSearch = setLobSearchQuery;
          const setSortCol = setLobSortCol;
          const setSortDir = setLobSortDir;
          const setPage = setLobPage;
          const setTab = setLobTab;
          const setSelectedFirm = setLobSelectedFirm;

          /* Get MPs with family lobbying */
          const mpFamilyLobby = (typeof mpRecords !== "undefined" ? mpRecords : []).filter(m => m.fmC > 0).sort((a, b) => b.fmC - a.fmC);

          /* Filter & sort lobbyists */
          const q = _lobSearch.toLowerCase();
          const filtered = lobbyists.filter(l => {
            if (!q) return true;
            return l.n.toLowerCase().includes(q) || (l.cls || []).some(c => c.toLowerCase().includes(q));
          });

          const handleLobSort = (col) => {
            if (_lobSortCol === col) {
              setSortDir(_lobSortDir === "asc" ? "desc" : "asc");
            } else {
              setSortCol(col);
              setSortDir("desc");
            }
            setPage(0);
          };

          const sorted = [...filtered].sort((a, b) => {
            let va, vb;
            if (_lobSortCol === "cl") { va = a.cl; vb = b.cl; }
            else if (_lobSortCol === "n") { va = a.n.toLowerCase(); vb = b.n.toLowerCase(); }
            else if (_lobSortCol === "d") { va = a.d; vb = b.d; }
            else { va = a.cl; vb = b.cl; }
            if (va < vb) return _lobSortDir === "asc" ? -1 : 1;
            if (va > vb) return _lobSortDir === "asc" ? 1 : -1;
            return 0;
          });

          const PER_PAGE = 30;
          const totalPages = Math.ceil(sorted.length / PER_PAGE);
          const page = Math.min(_lobPage, totalPages - 1);
          const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

          const SortIcon = ({ col }) => {
            if (_lobSortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
            return <ArrowUpDown className={"w-3 h-3 text-gray-300" + (_lobSortDir === "asc" ? " rotate-180" : "")} />;
          };

          const typeLabel = (t) => t === "C" ? "Company" : t === "P" ? "Partnership" : t === "I" ? "Individual" : "Other";

          /* Tab buttons */
          const tabs = [
            { id: "directory", label: "Lobbyist Directory", icon: Building2 },
            { id: "clients", label: "Top Clients", icon: Briefcase },
            { id: "family", label: "MP Family Links", icon: Users },
            { id: "meetings", label: "Ministerial Meetings", icon: Landmark },
            { id: "comparison", label: "Int'l Comparison", icon: Globe }
          ];

          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Accountability → Lobbying
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                UK Lobbying Register
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                {lobbyingData.contextSentences.headline}
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard icon={Building2} label="Registered Lobbyists" value={summ.totalRegistrants.toLocaleString()} sub={"417 all-time (" + summ.totalInactive + " inactive)"} />
              <StatCard icon={Briefcase} label="Total Clients" value={summ.totalClients.toLocaleString()} sub={summ.totalRelationships.toLocaleString() + " relationships (Q4 2025)"} />
              <StatCard icon={Users} label="MP Family Links" value={mpFamilyLobby.length.toString()} sub={mpFamilyLobby.reduce((s, m) => s + m.fmC, 0) + " family connections"} accent="amber" />
              <StatCard icon={Landmark} label="Ministerial Meetings" value="60,000+" sub="Published since 2012" />
              <StatCard icon={AlertTriangle} label="Coverage" value="< 1%" sub="Of total UK lobbying" accent="red" />
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1 border-b border-gray-800/60">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { setTab(tab.id); setPage(0); }}
                    className={"flex items-center gap-1.5 px-4 py-2 text-[10px] uppercase tracking-[0.08em] font-semibold transition-colors border-b-2 -mb-px " +
                      (_lobTab === tab.id ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600")}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ===== TAB: LOBBYIST DIRECTORY ===== */}
            {_lobTab === "directory" && (
              <div className="space-y-6">
                <ChartCard title="Registered Consultant Lobbyists Over Time" subtitle="ORCL statutory register — covers third-party lobbyists only" shareHeadline={summ.totalRegistrants.toString()} shareSubline="Registered UK lobbyists — estimated to cover less than 1% of total lobbying activity" onShare={handleChartShare} accentColor="#6366f1">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={regData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} formatter={(v) => [v + " firms", "Registered"]} />
                      <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <ChartMeta note={lobbyingData.contextSentences.growth} source="Office of the Registrar of Consultant Lobbyists" sourceUrl={lobbyingData.metadata.primarySources[0].url} />
                </ChartCard>

                {/* Search & controls */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" placeholder="Search lobbyists or clients..." value={_lobSearch} maxLength={100} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none" />
                  </div>
                  <div className="text-xs text-gray-500">{filtered.length} of {lobbyists.length} firms</div>
                </div>

                {lobRecordsLoading ? (
                  <div className="py-20 text-center text-gray-500 text-sm">Loading lobbyist data...</div>
                ) : _lobSelectedFirm ? (
                  /* === Firm Detail View === */
                  (() => {
                    const firm = _lobSelectedFirm;
                    return (
                      <div className="space-y-6">
                        <button onClick={() => setSelectedFirm(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                          <ChevronLeft className="w-4 h-4" /> Back to Directory
                        </button>
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h2 className="text-xl font-black uppercase tracking-tight">{firm.n}</h2>
                              <p className="text-sm text-gray-500 mt-1">{typeLabel(firm.t)} · Registered {firm.d}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-white">{firm.cl}</div>
                              <div className="text-xs text-gray-500">clients (Q4 2025)</div>
                            </div>
                          </div>
                          {firm.cls && firm.cls.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-400 mb-3">Declared Clients</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {firm.cls.map((c, ci) => (
                                  <div key={ci} className="px-3 py-2 bg-gray-800/50 rounded text-sm text-gray-300 border border-gray-800/50">
                                    {c}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* === Lobbyist Table === */
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300" onClick={() => handleLobSort("n")}>
                              <span className="flex items-center gap-1">Lobbyist <SortIcon col="n" /></span>
                            </th>
                            <th className="text-center py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Type</th>
                            <th className="text-center py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300" onClick={() => handleLobSort("d")}>
                              <span className="flex items-center justify-center gap-1">Registered <SortIcon col="d" /></span>
                            </th>
                            <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300" onClick={() => handleLobSort("cl")}>
                              <span className="flex items-center justify-end gap-1">Clients <SortIcon col="cl" /></span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((l, i) => (
                            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => setSelectedFirm(l)}>
                              <td className="py-3 px-4">
                                <div className="text-gray-200 font-medium">{l.n}</div>
                                {l.cls && l.cls.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{l.cls.slice(0, 3).join(", ")}{l.cls.length > 3 ? " +" + (l.cls.length - 3) + " more" : ""}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center"><span className={"text-xs px-2 py-0.5 rounded-full " + (l.t === "C" ? "bg-blue-900/30 text-blue-400" : l.t === "P" ? "bg-purple-900/30 text-purple-400" : "bg-gray-800 text-gray-400")}>{typeLabel(l.t)}</span></td>
                              <td className="py-3 px-4 text-center text-gray-400 font-mono text-xs">{l.d}</td>
                              <td className="py-3 px-4 text-right text-gray-200 font-mono font-bold">{l.cl}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
                        <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== TAB: TOP CLIENTS ===== */}
            {_lobTab === "clients" && (
              <div className="space-y-6">
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400">
                    Clients declared by registered consultant lobbyists in Q4 2025 (Oct–Dec). {summ.clientsWithMultipleLobbyists} clients use multiple lobbying firms.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider w-8">#</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Client</th>
                        <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Lobbyists</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Represented By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClients.slice(0, 50).map((c, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{i + 1}</td>
                          <td className="py-3 px-4 text-gray-200 font-medium">{c.n}</td>
                          <td className="py-3 px-4 text-right text-gray-200 font-mono font-bold">{c.lc}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs truncate max-w-xs">{(c.ls || []).slice(0, 3).join(", ")}{c.ls && c.ls.length > 3 ? " +" + (c.ls.length - 3) + " more" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== TAB: MP FAMILY LINKS ===== */}
            {_lobTab === "family" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-2">
                  <StatCard icon={Users} label="MPs with Family Links" value={mpFamilyLobby.length.toString()} sub="To third-party lobbying" />
                  <StatCard icon={Hash} label="Total Connections" value={mpFamilyLobby.reduce((s, m) => s + m.fmC, 0).toString()} sub="Family members in lobbying" accent="amber" />
                  <StatCard icon={ShieldAlert} label="Disclosure Requirement" value="Category 1" sub="Registrable family interest" />
                </div>
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400">
                    MPs must declare family members engaged in lobbying under Category 1 of the Register of Members' Financial Interests. This covers spouses, partners, and close family members employed by lobbying firms or engaged in third-party advocacy.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">MP</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Party</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Constituency</th>
                        <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Family Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mpFamilyLobby.map((mp, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-4 text-gray-200 font-medium">{mp.n}</td>
                          <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: (mp.pc || "#6b7280") + "22", color: mp.pc || "#9ca3af" }}>{mp.pa || mp.p}</span></td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{mp.c}</td>
                          <td className="py-3 px-4 text-right text-amber-400 font-mono font-bold">{mp.fmC}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== TAB: MINISTERIAL MEETINGS ===== */}
            {_lobTab === "meetings" && (
              <div className="space-y-6">
                <ChartCard 
                  title="Ministerial Meetings by Department" 
                  subtitle="Approximate published meetings since 2012"
                  onShare={handleChartShare}
                  shareHeadline="Who gets the minister's ear?"
                  shareSubline="Ministerial meetings with outside organisations"
                >
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: 30, left: 140, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis type="number" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <YAxis type="category" dataKey="department" stroke="#6b7280" tick={{ fill: "#d1d5db", fontSize: 10 }} width={135} />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} formatter={(v) => [v.toLocaleString() + " meetings", "Published"]} />
                      <Bar dataKey="approxMeetings" radius={[0, 4, 4, 0]} fill="#6b7280" fillOpacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                  <ChartMeta note={lobbyingData.contextSentences.meetings} source="Transparency International UK — Open Access" sourceUrl={lobbyingData.metadata.primarySources[2].url} />
                </ChartCard>
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Gift className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-200 mb-1">Ministerial Gifts & Hospitality</h3>
                      <p className="text-sm text-gray-400">Since July 2024, ministerial gifts over £{lobbyingData.ministerialGiftsAndHospitality.giftThreshold} are published monthly in a new centralised Cabinet Office register — replacing the previous quarterly departmental system.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== TAB: INTERNATIONAL COMPARISON ===== */}
            {_lobTab === "comparison" && (
              <div className="space-y-6">
                <ChartCard 
                  title="Lobbying Transparency by Country" 
                  subtitle="How the UK compares to peer democracies"
                  onShare={handleChartShare}
                  shareHeadline="Britain's lobbying black hole"
                  shareSubline="UK transparency ranked against peer nations"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={intlData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="country" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} formatter={(v) => [v.toLocaleString(), "Registrants"]} />
                      <Bar dataKey="registrants" radius={[4, 4, 0, 0]}>
                        {intlData.map((d, i) => (
                          <Cell key={i} fill={d.country === "United Kingdom" ? "#ef4444" : "#6366f1"} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Country</th>
                        <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Registrants</th>
                        <th className="text-center py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">In-House</th>
                        <th className="text-center py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Spending</th>
                        <th className="text-center py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intlData.map((d, i) => (
                        <tr key={i} className={"border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors" + (d.country === "United Kingdom" ? " bg-red-900/10" : "")}>
                          <td className="py-3 px-4 text-gray-200 font-medium">{d.country}</td>
                          <td className="py-3 px-4 text-right text-gray-200 font-mono">{d.registrants.toLocaleString()}</td>
                          <td className="py-3 px-4 text-center">{d.coversInHouse ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                          <td className="py-3 px-4 text-center">{d.disclosesSpending ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                          <td className="py-3 px-4 text-center">{d.disclosesSubject ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-gray-500 text-xs">{lobbyingData.contextSentences.comparison}</p>

                <SectionHeader title="Register Limitations" />
                <div className="space-y-2">
                  {lobbyingData.registerStats.registerLimitations.map((lim, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-800/30">
                      <span className="text-red-400 text-xs mt-0.5">✗</span>
                      <span className="text-gray-400 text-sm">{lim}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-gray-600 text-xs px-1 mt-4">
              Sources:{" "}
              {lobbyingData.metadata.primarySources.map(s => s.name).join("; ")}.
            </div>
          </div>
          );
        })()}

        {/* ===== TRANSPARENCY: FOREIGN AID ===== */}
        {view === "transparency.aid" && (() => {
          const yearOptions = ["All Time", ...foreignAidData.annualODA.series.map(d => String(d.year)).reverse()];
          const selectedYearData = aidYear === "All Time"
            ? null
            : foreignAidData.annualODA.series.find(d => String(d.year) === aidYear);

          const odaSeries = foreignAidData.annualODA.series.map(d => ({
            year: d.year,
            total: d.value / 1e3,
            bilateral: (d.bilateral || 0) / 1e3,
            multilateral: (d.multilateral || 0) / 1e3,
            pctGNI: d.pctGNI * 100
          }));

          const gniSeries = foreignAidData.pctGNITrend.series.map(d => ({
            year: d.year,
            value: d.value * 100,
            target: 0.70 * 100
          }));

          const composition = foreignAidData.composition2024.components;
          const compositionTotal = composition.reduce((s, c) => s + c.value, 0);

          const departments = foreignAidData.byDepartment2024.departments;

          const allRecipients = foreignAidData.topRecipients2024.recipients;
          const visibleRecipients = aidShowAllRecipients ? allRecipients : allRecipients.slice(0, 10);

          const allSectors = foreignAidData.sectorBreakdown2024.sectors;
          const visibleSectors = aidShowAllSectors ? allSectors : allSectors.slice(0, 6);

          const regions = foreignAidData.regionalAllocation?.regions || [];

          const headlineTotal = selectedYearData ? (selectedYearData.value / 1e3).toFixed(1) : "14.1";
          const headlineGNI = selectedYearData ? (selectedYearData.pctGNI * 100).toFixed(1) + "%" : "0.50%";
          const headlineBilateral = selectedYearData && selectedYearData.bilateral ? "\u00a3" + (selectedYearData.bilateral / 1e3).toFixed(1) + "bn" : "\u00a311.3bn";
          const headlineMultilateral = selectedYearData && selectedYearData.multilateral ? "\u00a3" + (selectedYearData.multilateral / 1e3).toFixed(1) + "bn" : "\u00a32.8bn";

          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                Accountability &rarr; International
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Foreign Aid (ODA)
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                {foreignAidData.contextSentences.headline}
              </p>
            </div>

            {/* Year selector pills */}
            <div className="flex flex-wrap gap-1.5">
              {yearOptions.map(yr => (
                <button
                  key={yr}
                  onClick={() => { setAidYear(yr); setAidShowAllRecipients(false); setAidShowAllSectors(false); }}
                  className={
                    "px-3 py-1 text-[10px] uppercase tracking-[0.08em] font-semibold transition-colors rounded " +
                    (aidYear === yr
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30")
                  }
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={Globe}
                label={aidYear === "All Time" ? "2024 Total ODA" : aidYear + " Total ODA"}
                value={"\u00a3" + headlineTotal + "bn"}
                sub={headlineGNI + " of GNI"}
              />
              <StatCard
                icon={TrendingUp}
                label="Bilateral"
                value={headlineBilateral}
                sub={aidYear === "All Time" ? "2024 bilateral aid" : aidYear + " bilateral aid"}
              />
              <StatCard
                icon={Building2}
                label="Multilateral"
                value={headlineMultilateral}
                sub={aidYear === "All Time" ? "2024 multilateral" : aidYear + " multilateral"}
              />
              <StatCard
                icon={AlertTriangle}
                label="By 2027"
                value="0.30%"
                sub="Planned further cut from 0.50%"
                accent="red"
              />
            </div>

            {/* ODA as % of GNI chart */}
            <ChartCard chartId="oda-gni-ratio" title="ODA as % of GNI" subtitle={"UN target: 0.70% \u2014 met 2013\u20132020, cut to 0.50% in 2021"} shareHeadline={headlineGNI} shareSubline={"UK foreign aid as % of GNI \u2014 down from 0.70%, set to fall to 0.30% by 2027"} onShare={handleChartShare} accentColor="#ef4444" explainData={gniSeries.map(d => `${d.year}: ${d.value.toFixed(2)}%`).join("; ") + " | UN target: 0.70%"}>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={gniSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => v.toFixed(1) + "%"} domain={[0, 0.85 * 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v, name) => [v.toFixed(2) + "%", name === "target" ? "UN Target" : "UK ODA"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} name="UK ODA" />
                  <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} dot={false} name="UN Target (0.70%)" />
                </ComposedChart>
              </ResponsiveContainer>
              <ChartMeta
                note={foreignAidData.contextSentences.future}
                source={foreignAidData.metadata.primarySource.name}
                sourceUrl={foreignAidData.metadata.primarySource.url}
              />
            </ChartCard>

            {/* Total ODA with bilateral/multilateral split */}
            <ChartCard chartId="oda-total-spending" title="Total UK ODA Spending" subtitle="Bilateral vs multilateral split (billions GBP)" shareHeadline={"\u00a3" + headlineTotal + "bn"} shareSubline="UK Official Development Assistance" onShare={handleChartShare} accentColor="#10b981" explainData={odaSeries.map(d => `${d.year}: bilateral £${d.bilateral.toFixed(1)}bn, multilateral £${d.multilateral.toFixed(1)}bn`).join("; ")}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={odaSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="year" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => "\u00a3" + v.toFixed(0) + "bn"} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v, name) => ["\u00a3" + v.toFixed(1) + "bn", name]}
                  />
                  <Bar dataKey="bilateral" stackId="a" fill="#10b981" fillOpacity={0.8} name="Bilateral" />
                  <Bar dataKey="multilateral" stackId="a" fill="#3b82f6" fillOpacity={0.6} name="Multilateral" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <ChartMeta
                note={foreignAidData.contextSentences.multilateral}
                source={foreignAidData.metadata.primarySource.name}
                sourceUrl={foreignAidData.metadata.primarySource.url}
              />
            </ChartCard>

            {/* ODA Composition 2024 — horizontal stacked bar */}
            <ChartCard title={"ODA Composition \u2014 2024"} subtitle={"How the \u00a314.1bn breaks down by type"}
              onShare={handleChartShare}
              shareHeadline="Where your foreign aid actually goes"
              shareSubline="Bilateral vs multilateral ODA breakdown"
            >
              <div className="px-4 py-6 space-y-4">
                {/* Stacked bar */}
                <div className="flex h-10 rounded overflow-hidden">
                  {composition.map((c, i) => (
                    <div
                      key={i}
                      style={{ width: c.pct + "%", backgroundColor: c.colour }}
                      className="flex items-center justify-center transition-all hover:opacity-90"
                      title={c.type + ": \u00a3" + (c.value / 1e3).toFixed(1) + "bn (" + c.pct.toFixed(1) + "%)"}
                    >
                      {c.pct > 12 && (
                        <span className="text-white text-[10px] font-mono font-bold truncate px-1">
                          {c.pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {composition.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-3 h-3 rounded-sm mt-0.5 flex-shrink-0" style={{ backgroundColor: c.colour }} />
                      <div>
                        <div className="text-gray-300 text-xs font-medium">{c.type}</div>
                        <div className="text-gray-500 text-[10px]">{"\u00a3" + (c.value / 1e3).toFixed(1) + "bn"} ({c.pct.toFixed(1)}%)</div>
                        <div className="text-gray-600 text-[10px]">{c.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <ChartMeta
                note={foreignAidData.contextSentences.refugees}
                source={foreignAidData.composition2024.sourceName}
                sourceUrl={foreignAidData.composition2024.sourceUrl}
              />
            </ChartCard>

            {/* Spending by Department 2024 */}
            <ChartCard chartId="oda-by-department" title={"Spending by Department \u2014 2024"} subtitle="Which government departments spend ODA" shareHeadline="FCDO 67%" shareSubline="FCDO accounted for two-thirds of all UK foreign aid spending in 2024" onShare={handleChartShare} accentColor="#059669" explainData={departments.slice(0, 6).map(d => `${d.dept}: £${d.value}m`).join("; ")}>
              <ResponsiveContainer width="100%" height={Math.max(340, departments.length * 36)}>
                <BarChart data={departments} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => "\u00a3" + (v / 1e3).toFixed(1) + "bn"} />
                  <YAxis type="category" dataKey="dept" stroke="#6b7280" tick={{ fill: "#d1d5db", fontSize: 10 }} width={70} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v, name, props) => {
                      const d = props.payload;
                      return ["\u00a3" + v.toLocaleString() + "m" + (d.fullName ? " \u2014 " + d.fullName : ""), "ODA"];
                    }}
                    labelFormatter={l => l}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {departments.map((d, i) => (
                      <Cell key={i} fill={d.colour || "#6b7280"} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <ChartMeta
                note={foreignAidData.contextSentences.department}
                source={foreignAidData.byDepartment2024.sourceName}
                sourceUrl={foreignAidData.byDepartment2024.sourceUrl}
              />
            </ChartCard>

            {/* Top Recipients */}
            <ChartCard
              title={"Top " + visibleRecipients.length + " Bilateral Aid Recipients \u2014 2024"}
              subtitle="Country-level bilateral ODA allocations"
              shareHeadline="Ukraine \u00a3270m"
              shareSubline="Largest UK bilateral aid recipient in 2024"
              onShare={handleChartShare}
              accentColor="#fbbf24"
            >
              <ResponsiveContainer width="100%" height={Math.max(340, visibleRecipients.length * 28)}>
                <BarChart data={visibleRecipients} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => "\u00a3" + v + "m"} />
                  <YAxis type="category" dataKey="country" stroke="#6b7280" tick={{ fill: "#d1d5db", fontSize: 10 }} width={110} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v, name, props) => {
                      const d = props.payload;
                      return ["\u00a3" + v + "m" + (d.region ? " (" + d.region + ")" : ""), "Bilateral ODA"];
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {visibleRecipients.map((d, i) => {
                      const regionColours = { "Africa": "#10b981", "South Asia": "#6366f1", "Middle East": "#f59e0b", "Europe": "#3b82f6" };
                      return <Cell key={i} fill={regionColours[d.region] || "#6b7280"} fillOpacity={i < 3 ? 0.9 : 0.65} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {allRecipients.length > 10 && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => setAidShowAllRecipients(!aidShowAllRecipients)}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-mono transition-colors"
                  >
                    {aidShowAllRecipients ? "Show top 10" : "Show all " + allRecipients.length + " countries"}
                  </button>
                </div>
              )}
              {/* Region legend */}
              <div className="px-4 pb-3 flex flex-wrap gap-3">
                {[{r:"Africa",c:"#10b981"},{r:"South Asia",c:"#6366f1"},{r:"Middle East",c:"#f59e0b"},{r:"Europe",c:"#3b82f6"}].map(({r,c}) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                    <span className="text-gray-500 text-[10px]">{r}</span>
                  </div>
                ))}
              </div>
              <ChartMeta
                source={foreignAidData.topRecipients2024.sourceName}
                sourceUrl={foreignAidData.topRecipients2024.sourceUrl}
              />
            </ChartCard>

            {/* Sector Breakdown 2024 */}
            <ChartCard
              title={"Sector Breakdown \u2014 2024"}
              subtitle="ODA by thematic sector"
              shareHeadline="\u00a32.8bn refugees"
              shareSubline="In-donor refugee costs were the largest single ODA sector in 2024"
              onShare={handleChartShare}
              accentColor="#ef4444"
            >
              <ResponsiveContainer width="100%" height={Math.max(280, visibleSectors.length * 36)}>
                <BarChart data={visibleSectors} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={v => "\u00a3" + (v >= 1000 ? (v / 1e3).toFixed(1) + "bn" : v + "m")} />
                  <YAxis type="category" dataKey="sector" stroke="#6b7280" tick={{ fill: "#d1d5db", fontSize: 10 }} width={160} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(v) => ["\u00a3" + (v >= 1000 ? (v / 1e3).toFixed(2) + "bn" : v + "m"), "ODA"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {visibleSectors.map((d, i) => (
                      <Cell key={i} fill={d.colour || "#6b7280"} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {allSectors.length > 6 && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => setAidShowAllSectors(!aidShowAllSectors)}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-mono transition-colors"
                  >
                    {aidShowAllSectors ? "Show top 6 sectors" : "Show all " + allSectors.length + " sectors"}
                  </button>
                </div>
              )}
              <ChartMeta
                source={foreignAidData.sectorBreakdown2024.sourceName}
                sourceUrl={foreignAidData.sectorBreakdown2024.sourceUrl}
              />
            </ChartCard>

            {/* Regional Allocation */}
            {regions.length > 0 && (
              <ChartCard title={"Regional Allocation of Bilateral ODA \u2014 2024"} subtitle="Share of bilateral aid by world region"
                onShare={handleChartShare}
                shareHeadline="Who gets British aid money?"
                shareSubline="Regional allocation of UK bilateral aid"
              >
                <div className="px-4 py-6 space-y-3">
                  {regions.map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-gray-400 font-medium truncate">{r.region}</div>
                      <div className="flex-1 h-6 bg-gray-800/50 rounded overflow-hidden relative">
                        <div
                          className="h-full rounded transition-all"
                          style={{ width: Math.max(r.pctBilateral, 2) + "%", backgroundColor: r.colour || "#6b7280" }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white font-mono">
                          {r.pctBilateral > 5 ? r.pctBilateral.toFixed(1) + "%" : ""}
                        </span>
                      </div>
                      <div className="w-20 text-right text-xs text-gray-500 font-mono">{"\u00a3" + r.value + "m"}</div>
                    </div>
                  ))}
                </div>
                <ChartMeta
                  note="Africa received the largest share at 49.4% of bilateral ODA."
                  source={foreignAidData.metadata.primarySource.name}
                  sourceUrl={foreignAidData.metadata.primarySource.url}
                />
              </ChartCard>
            )}

            {/* ODA Data Table */}
            <SectionHeader title="ODA Data by Year" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Year</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Total ODA</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Bilateral</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Multilateral</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">% of GNI</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-mono text-[10px] uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {foreignAidData.annualODA.series.slice().reverse().map((d, i) => (
                    <tr key={i} className={"border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors" + (String(d.year) === aidYear ? " bg-emerald-900/10" : "")}>
                      <td className="py-3 px-4 text-gray-300 font-medium">{d.year}</td>
                      <td className="py-3 px-4 text-right text-gray-200 font-mono">{"\u00a3" + (d.value / 1e3).toFixed(1) + "bn"}</td>
                      <td className="py-3 px-4 text-right text-gray-400 font-mono">{d.bilateral ? "\u00a3" + (d.bilateral / 1e3).toFixed(1) + "bn" : "\u2014"}</td>
                      <td className="py-3 px-4 text-right text-gray-400 font-mono">{d.multilateral ? "\u00a3" + (d.multilateral / 1e3).toFixed(1) + "bn" : "\u2014"}</td>
                      <td className={"py-3 px-4 text-right font-mono " + (d.pctGNI >= 0.7 ? "text-green-400" : d.pctGNI >= 0.5 ? "text-yellow-400" : "text-red-400")}>{(d.pctGNI * 100).toFixed(1) + "%"}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-xs">{d.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FCDO Programmes Table */}
            <SectionHeader title={"FCDO Development Programmes (" + fcdoProgrammes.metadata.totalProgrammes.toLocaleString() + " active)"} />

            {/* Search and filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                <input
                  type="text"
                  placeholder="Search programmes by title, country, sector..."
                  value={aidProgSearch}
                  maxLength={100}
                  onChange={e => { setAidProgSearch(e.target.value); setAidProgPage(0); }}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>
              <select
                value={aidProgSector}
                onChange={e => { setAidProgSector(e.target.value); setAidProgPage(0); }}
                className="bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:border-gray-600"
              >
                <option value="All">All Sectors</option>
                {fcdoProgrammes.summary.topSectors.map(s => (
                  <option key={s.sector} value={s.sector}>{s.sector} ({s.programmes})</option>
                ))}
              </select>
            </div>

            {(() => {
              const PAGE_SIZE = 25;
              const searchLower = aidProgSearch.toLowerCase();

              let filtered = fcdoProgrammes.programmes.filter(p => {
                if (aidProgSector !== "All" && p.sec !== aidProgSector) return false;
                if (searchLower) {
                  return (
                    (p.t || "").toLowerCase().includes(searchLower) ||
                    (p.co || "").toLowerCase().includes(searchLower) ||
                    (p.sec || "").toLowerCase().includes(searchLower) ||
                    (p.imp || "").toLowerCase().includes(searchLower) ||
                    (p.id || "").toLowerCase().includes(searchLower)
                  );
                }
                return true;
              });

              // Sort
              const sortKey = aidProgSort;
              const dir = aidProgSortDir === "desc" ? -1 : 1;
              filtered.sort((a, b) => {
                const av = a[sortKey] || 0;
                const bv = b[sortKey] || 0;
                if (typeof av === "string") return dir * av.localeCompare(bv);
                return dir * (av - bv);
              });

              const totalFiltered = filtered.length;
              const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);
              const page = Math.min(aidProgPage, totalPages - 1);
              const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

              const handleSort = (key) => {
                if (aidProgSort === key) {
                  setAidProgSortDir(aidProgSortDir === "desc" ? "asc" : "desc");
                } else {
                  setAidProgSort(key);
                  setAidProgSortDir(key === "t" ? "asc" : "desc");
                }
              };

              const SortHeader = ({ label, field, align }) => (
                <th
                  className={"py-3 px-3 text-gray-500 font-mono text-[10px] uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none " + (align === "right" ? "text-right" : "text-left")}
                  onClick={() => handleSort(field)}
                >
                  {label}
                  {aidProgSort === field && (
                    <span className="ml-1 text-emerald-500">{aidProgSortDir === "desc" ? "\u25BC" : "\u25B2"}</span>
                  )}
                </th>
              );

              const fmtGBP = (v) => {
                if (!v) return "\u2014";
                if (v >= 1e9) return "\u00a3" + (v / 1e9).toFixed(2) + "bn";
                if (v >= 1e6) return "\u00a3" + (v / 1e6).toFixed(1) + "m";
                if (v >= 1e3) return "\u00a3" + (v / 1e3).toFixed(0) + "k";
                return "\u00a3" + v.toLocaleString();
              };

              return (
                <div>
                  <div className="text-xs text-gray-500 mb-2 font-mono">
                    {totalFiltered.toLocaleString()} programmes{searchLower || aidProgSector !== "All" ? " matching filters" : ""}
                    {" \u2022 Total budget: " + fmtGBP(filtered.reduce((s, p) => s + (p.b || 0), 0))}
                    {" \u2022 Total spend: " + fmtGBP(filtered.reduce((s, p) => s + (p.s || 0), 0))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <SortHeader label="Programme" field="t" align="left" />
                          <SortHeader label="Budget" field="b" align="right" />
                          <SortHeader label="Spend" field="s" align="right" />
                          <SortHeader label="Country" field="co" align="left" />
                          <SortHeader label="Sector" field="sec" align="left" />
                          <SortHeader label="Start" field="sd" align="left" />
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((p, i) => (
                          <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group">
                            <td className="py-3 px-3 max-w-xs">
                              <a
                                href={fcdoProgrammes.metadata.devTrackerBase + p.id + "/summary"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-300 hover:text-emerald-400 transition-colors text-xs leading-tight block"
                                title={p.t}
                              >
                                {p.t}
                              </a>
                              {p.imp && <div className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[250px]">{p.imp}</div>}
                            </td>
                            <td className="py-3 px-3 text-right text-gray-200 font-mono text-xs whitespace-nowrap">{fmtGBP(p.b)}</td>
                            <td className="py-3 px-3 text-right text-gray-400 font-mono text-xs whitespace-nowrap">{fmtGBP(p.s)}</td>
                            <td className="py-3 px-3 text-gray-400 text-xs whitespace-nowrap">{p.co || p.rg || "\u2014"}</td>
                            <td className="py-3 px-3 text-gray-500 text-[11px] max-w-[180px] truncate">{p.sec || "\u2014"}</td>
                            <td className="py-3 px-3 text-gray-500 text-xs font-mono whitespace-nowrap">{p.sd || "\u2014"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-1">
                      <div className="text-xs text-gray-600 font-mono">
                        Page {page + 1} of {totalPages}
                      </div>
                      <div className="flex gap-1">
                        <button
                          disabled={page === 0}
                          onClick={() => setAidProgPage(0)}
                          className={"px-2 py-1 text-xs rounded font-mono " + (page === 0 ? "text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
                        >
                          First
                        </button>
                        <button
                          disabled={page === 0}
                          onClick={() => setAidProgPage(Math.max(0, page - 1))}
                          className={"px-2 py-1 text-xs rounded font-mono " + (page === 0 ? "text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
                        >
                          Prev
                        </button>
                        <button
                          disabled={page >= totalPages - 1}
                          onClick={() => setAidProgPage(Math.min(totalPages - 1, page + 1))}
                          className={"px-2 py-1 text-xs rounded font-mono " + (page >= totalPages - 1 ? "text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
                        >
                          Next
                        </button>
                        <button
                          disabled={page >= totalPages - 1}
                          onClick={() => setAidProgPage(totalPages - 1)}
                          className={"px-2 py-1 text-xs rounded font-mono " + (page >= totalPages - 1 ? "text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800")}
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="text-gray-600 text-xs px-1 mt-4">
              Programme data source:{" "}
              <a href="https://devtracker.fcdo.gov.uk" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">
                FCDO Development Tracker
              </a>{" "}
              (IATI standard). {fcdoProgrammes.metadata.totalProgrammes.toLocaleString()} active programmes.{" "}
              Published under Open Government Licence v3.0.
            </div>

            <div className="text-gray-600 text-xs px-1 mt-4">
              Source:{" "}
              {foreignAidData.metadata.primarySource.name}.{" "}
              {foreignAidData.metadata.methodologyNote}
            </div>
          </div>
          );
        })()}

        {chartShare && (
          <div
            className={
              "fixed inset-0 z-50 " +
              "flex items-center " +
              "justify-center px-3 sm:px-4"
            }
            onClick={() =>
              setChartShare(null)
            }
          >
            <div className={
              "absolute inset-0 bg-black/80"
            } />
            <div
              className={
                "relative w-full " +
                "max-w-lg " +
                "bg-[#0a0a0a] border " +
                "border-gray-800/60 " +
                "overflow-hidden"
              }
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div
                className="h-0.5"
                style={{
                  backgroundColor:
                    chartShare.accent
                }}
              />
              <div className={
                "px-4 sm:px-6 pt-5 pb-4 flex " +
                "items-center " +
                "justify-between " +
                "border-b " +
                "border-gray-800/40"
              }>
                <div className={
                  "text-[11px] uppercase " +
                  "tracking-[0.2em] " +
                  "text-gray-500 font-mono"
                }>
                  Share This Chart
                </div>
                <button
                  onClick={() =>
                    setChartShare(null)
                  }
                  className={
                    "text-gray-600 " +
                    "hover:text-gray-400 " +
                    "transition-colors"
                  }
                >
                  <X size={16} />
                </button>
              </div>
              <div className={
                "px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4"
              }>
                {/* Render canvas image as preview so modal matches PNG exactly */}
                <img
                  src={chartShare._cancelledProject ? renderCancelledProjectCard(chartShare) : renderChartShareCard(chartShare)}
                  alt="Share preview"
                  className="w-full border border-gray-800/40"
                />
                <button
                  onClick={() => {
                    const dataUrl = chartShare._cancelledProject
                      ? renderCancelledProjectCard(chartShare)
                      : renderChartShareCard(chartShare);
                    const link =
                      document.createElement(
                        "a"
                      );
                    link.download =
                      "gracchus-" +
                      (chartShare.title || "chart")
                        .toLowerCase()
                        .replace(
                          /[^a-z0-9]+/g, "-"
                        )
                        .slice(0, 30) + ".png";
                    link.href = dataUrl;
                    link.click();
                  }}
                  className={
                    "w-full flex " +
                    "items-center " +
                    "justify-center gap-2 " +
                    "py-3 text-[11px] " +
                    "font-mono uppercase " +
                    "tracking-[0.12em] " +
                    "bg-white/[0.04] " +
                    "border border-gray-800 " +
                    "text-gray-300 " +
                    "hover:bg-white/[0.08] " +
                    "hover:text-white " +
                    "transition-all"
                  }
                >
                  <Download size={12} />
                  Download as PNG
                </button>
                <button
                  onClick={() => {
                    const payload = {
                      type: "chart",
                      h: chartShare.headline,
                      s: chartShare.subline,
                      t: chartShare.title
                    };
                    const id =
                      encodeShareId(payload);
                    const shareUrl =
                      window.location.origin +
                      "/share/chart/" + id;
                    const text =
                      (chartShare.headline || chartShare.title || "UK data") +
                      (chartShare.subline ? " — " + chartShare.subline : "") +
                      "\n\nvia @GracchusHQ";
                    window.open(
                      "https://x.com/intent/post?text=" +
                      encodeURIComponent(text) +
                      "&url=" +
                      encodeURIComponent(shareUrl),
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  className={
                    "w-full flex " +
                    "items-center " +
                    "justify-center gap-2 " +
                    "py-3 text-[11px] " +
                    "font-mono uppercase " +
                    "tracking-[0.12em] " +
                    "bg-white/[0.06] " +
                    "border border-gray-800 " +
                    "text-gray-300 " +
                    "hover:bg-white/[0.12] " +
                    "hover:text-white " +
                    "transition-all"
                  }
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Post to X
                </button>
                <button
                  onClick={() => {
                    const payload = {
                      type: "chart",
                      h: chartShare.headline,
                      s: chartShare.subline,
                      t: chartShare.title
                    };
                    const id =
                      encodeShareId(payload);
                    const url =
                      window.location.origin +
                      "/share/chart/" + id;
                    navigator.clipboard
                      .writeText(url)
                      .then(() => {
                        setChartShareCopied(
                          true
                        );
                        setTimeout(
                          () =>
                            setChartShareCopied(
                              false
                            ),
                          2000
                        );
                      });
                  }}
                  className={
                    "w-full flex " +
                    "items-center " +
                    "justify-center gap-2 " +
                    "py-3 text-[11px] " +
                    "font-mono uppercase " +
                    "tracking-[0.12em] " +
                    "border border-gray-800 " +
                    "text-gray-500 " +
                    "hover:text-gray-300 " +
                    "transition-all"
                  }
                >
                  <Copy size={12} />
                  {chartShareCopied
                    ? "Copied!"
                    : "Copy Share Link"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trend share modal */}
        {showTrendShare && (() => {
          const tType = showTrendShare;
          const timeline = tType === "approval"
            ? planningData.approvalTimeline
            : delaysData.delayTimeline;
          const accent = tType === "approval"
            ? "amber" : "red";

          const first = timeline[0];
          const last = timeline[
            timeline.length - 1
          ];

          let headline = "";
          let subline = "";
          if (tType === "approval") {
            const mult = (
              last.avgMonths / first.avgMonths
            ).toFixed(1);
            headline = mult +
              "× slower to approve";
            subline = first.year + ": " +
              first.avgMonths + " months \u2192 " +
              last.year + ": " +
              last.avgMonths + " months";
          } else {
            const dMult = (
              last.avgDelayYears /
              first.avgDelayYears
            ).toFixed(0);
            const cMult = (
              last.avgCostGrowthPct /
              first.avgCostGrowthPct
            ).toFixed(0);
            headline = dMult +
              "× later, " + cMult +
              "× over budget";
            subline = first.year + ": " +
              first.avgDelayYears + "y late, +" +
              first.avgCostGrowthPct +
              "% \u2192 " + last.year + ": " +
              last.avgDelayYears + "y late, +" +
              last.avgCostGrowthPct + "%";
          }

          const handleDownloadTrend = () => {
            const dataUrl = renderTrendCard(
              tType, timeline
            );
            const link =
              document.createElement("a");
            link.download = "uk-infrastructure-" +
              tType + "-trend.png";
            link.href = dataUrl;
            link.click();
          };

          const handleCopyTrendUrl = () => {
            const payload = {
              type: "trend",
              t: tType
            };
            const id = encodeShareId(payload);
            const url = window.location.origin +
              "/share/trend/" + id;
            navigator.clipboard.writeText(url)
              .then(() => {
                setTrendShareCopied(true);
                setTimeout(
                  () => setTrendShareCopied(
                    false
                  ), 2000
                );
              });
          };

          return (
            <div
              className={
                "fixed inset-0 z-50 " +
                "flex items-center " +
                "justify-center px-4"
              }
              onClick={() =>
                setShowTrendShare(null)
              }
            >
              <div className={
                "absolute inset-0 bg-black/80"
              } />
              <div
                className={
                  "relative w-full " +
                  "max-w-lg " +
                  "bg-[#0a0a0a] border " +
                  "border-gray-800/60 " +
                  "overflow-hidden"
                }
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <div className={
                  "h-0.5 bg-" + accent + "-500"
                } />
                <div className={
                  "px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 flex " +
                  "items-center justify-between " +
                  "border-b border-gray-800/40"
                }>
                  <div className={
                    "text-[11px] uppercase " +
                    "tracking-[0.2em] " +
                    "text-gray-500 font-mono"
                  }>
                    Share This Trend
                  </div>
                  <button
                    onClick={() =>
                      setShowTrendShare(null)
                    }
                    className={
                      "text-gray-600 " +
                      "hover:text-gray-400 " +
                      "transition-colors"
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className={
                  "px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4"
                }>
                  <div className={
                    "bg-[#030303] border " +
                    "border-gray-800/40 " +
                    "overflow-hidden"
                  }>
                    <div className={
                      "h-0.5 bg-" + accent +
                      "-500"
                    } />
                    <div className="px-5 py-4">
                      <div className={
                        "text-[8px] uppercase " +
                        "tracking-[0.25em] " +
                        "text-gray-700 " +
                        "font-mono mb-3"
                      }>
                        GRACCHUS
                      </div>
                      <div className={
                        "text-2xl " +
                        "font-black " +
                        "text-white " +
                        "tracking-tighter " +
                        "leading-tight mb-1"
                      }>
                        {headline}
                      </div>
                      <div className={
                        "text-sm text-gray-500 " +
                        "font-mono"
                      }>
                        {subline}
                      </div>
                      <div className={
                        "text-[9px] " +
                        "text-gray-700 " +
                        "font-mono mt-3 " +
                        "flex justify-between"
                      }>
                        <span>
                          {"Source-backed estimates \u00B7 Published UK data"}
                        </span>
                        <span className={
                          "text-gray-600 " +
                          "font-bold"
                        }>
                          GRACCHUS.AI
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadTrend}
                    className={
                      "w-full flex items-center " +
                      "justify-center gap-2 " +
                      "py-3 text-[11px] " +
                      "font-mono uppercase " +
                      "tracking-[0.12em] " +
                      "bg-white/[0.04] " +
                      "border border-gray-800 " +
                      "text-gray-300 " +
                      "hover:bg-white/[0.08] " +
                      "hover:text-white " +
                      "transition-all"
                    }
                  >
                    <Download size={12} />
                    Download as PNG
                  </button>
                  <button
                    onClick={() => {
                      const payload = {
                        type: "trend",
                        t: tType
                      };
                      const id = encodeShareId(payload);
                      const shareUrl = window.location.origin +
                        "/share/trend/" + id;
                      const text = headline +
                        (subline ? " — " + subline : "") +
                        "\n\nvia @GracchusHQ";
                      window.open(
                        "https://x.com/intent/post?text=" +
                        encodeURIComponent(text) +
                        "&url=" +
                        encodeURIComponent(shareUrl),
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className={
                      "w-full flex items-center " +
                      "justify-center gap-2 " +
                      "py-3 text-[11px] " +
                      "font-mono uppercase " +
                      "tracking-[0.12em] " +
                      "bg-white/[0.06] " +
                      "border border-gray-800 " +
                      "text-gray-300 " +
                      "hover:bg-white/[0.12] " +
                      "hover:text-white " +
                      "transition-all"
                    }
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Post to X
                  </button>
                  <button
                    onClick={handleCopyTrendUrl}
                    className={
                      "w-full flex items-center " +
                      "justify-center gap-2 " +
                      "py-3 text-[11px] " +
                      "font-mono uppercase " +
                      "tracking-[0.12em] " +
                      "border border-gray-800 " +
                      "text-gray-500 " +
                      "hover:text-gray-300 " +
                      "transition-all"
                    }
                  >
                    <Copy size={12} />
                    {trendShareCopied
                      ? "Copied!"
                      : "Copy Share Link"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

                {/* ============ SUPPLIERS ============ */}
        {view === "suppliers" && (
          <div className="space-y-4">
            <div className={
              "flex flex-col lg:flex-row " +
              "lg:items-start lg:justify-between " +
              "gap-4"
            }>
              <PageHeader
                eyebrow={"Waste & Projects \u203A Suppliers & Contracts"}
                title="Who Got Paid?"
                dataAsOf="Feb 2025"
                description={
                  "Government supplier spend based " +
                  "on contract awards, MOD " +
                  "procurement data, and Tussell " +
                  "strategic supplier analysis."
                }
              />
              <button
                onClick={() => {
                  const el = document.getElementById(
                    "crony-contracts"
                  );
                  if (el) el.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }}
                className={
                  "group shrink-0 self-start " +
                  "lg:mt-6 " +
                  "inline-flex items-center gap-2.5 " +
                  "px-5 py-3 " +
                  "border border-red-500/30 " +
                  "bg-red-500/[0.06] " +
                  "hover:bg-red-500/[0.12] " +
                  "hover:border-red-500/50 " +
                  "active:bg-red-500/[0.18] " +
                  "text-red-400 hover:text-red-300 " +
                  "text-[12px] font-bold " +
                  "uppercase tracking-[0.12em] " +
                  "transition-all duration-200 " +
                  "rounded " +
                  "focus:outline-none " +
                  "focus-visible:ring-1 " +
                  "focus-visible:ring-red-500/50 " +
                  "shadow-[0_0_20px_rgba(" +
                  "239,68,68,0.04)] " +
                  "hover:shadow-[0_0_25px_rgba(" +
                  "239,68,68,0.10)]"
                }
              >
                <ShieldAlert
                  size={14}
                  className={
                    "opacity-70 " +
                    "group-hover:opacity-100 " +
                    "transition-opacity"
                  }
                />
                See Crony Contracts
                <span className={
                  "text-red-500/60 " +
                  "group-hover:text-red-400 " +
                  "group-hover:translate-x-0.5 " +
                  "transition-all duration-200 " +
                  "text-sm"
                }>
                  {"\u2192"}
                </span>
              </button>
            </div>

            {/* Sector summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["Defence", "IT", "Outsourcing", "Consulting"].map((sec) => {
                const items = suppliersSummary.filter(
                  (s) => s.sector === sec
                );
                const total = items.reduce(
                  (sum, s) => sum + s.annualGovSpend, 0
                );
                const cnt = items.length;
                const colors = {
                  Defence: "text-red-400",
                  IT: "text-cyan-400",
                  Outsourcing: "text-amber-400",
                  Consulting: "text-purple-400"
                };
                return (
                  <div
                    key={sec}
                    className="border-l-2 border-gray-800 pl-4 py-3"
                  >
                    <p className="text-gray-500 text-xs uppercase">
                      {sec}
                    </p>
                    <p className={"text-xl font-bold " + (colors[sec] || "text-white")}>
                      {fmt(total / 1e6)}
                    </p>
                    <p className="text-gray-600 text-xs">
                      {cnt} tracked suppliers
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Bar chart: annual gov spend by supplier */}
            <div className="py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-1">
                Supplier Data
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-4">
                Annual Government Spend by Supplier
              </h3>
              <div style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={suppliersSummary
                      .filter((s) => s.annualGovSpend > 0)
                      .sort(
                        (a, b) => b.annualGovSpend - a.annualGovSpend
                      )
                      .slice(0, 15)
                      .map((s) => ({
                        name: s.name,
                        spend: Math.round(
                          s.annualGovSpend / 1e6
                        ),
                        sector: s.sector
                      }))}
                    layout="vertical"
                    margin={{
                      left: 120,
                      right: 20,
                      top: 5,
                      bottom: 5
                    }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => fmt(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#d1d5db", fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#030712",
                        border: "1px solid #1f2937",
                        borderRadius: 4
                      }}
                      formatter={(v) => [fmt(v), "Annual Spend"]}
                    />
                    <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                      {suppliersSummary
                        .filter((s) => s.annualGovSpend > 0)
                        .sort(
                          (a, b) =>
                            b.annualGovSpend - a.annualGovSpend
                        )
                        .slice(0, 15)
                        .map((s, i) => {
                          const c = {
                            Defence: "#ef4444",
                            IT: "#06b6d4",
                            Outsourcing: "#f59e0b",
                            Construction: "#10b981",
                            Consulting: "#a855f7"
                          };
                          return (
                            <Cell
                              key={i}
                              fill={c[s.sector] || "#6b7280"}
                            />
                          );
                        })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-3 justify-center">
                {[
                  { l: "Defence", c: "bg-red-500" },
                  { l: "IT", c: "bg-cyan-500" },
                  { l: "Outsourcing", c: "bg-amber-500" },
                  { l: "Construction", c: "bg-emerald-500" },
                  { l: "Consulting", c: "bg-purple-500" }
                ].map((x) => (
                  <div
                    key={x.l}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-600"
                  >
                    <div
                      className={"w-2 h-2 inline-block " + x.c}
                    />
                    {x.l}
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier table */}
            <DataTableShell
              columns={[
                { key: "rank", label: "#", span: 1 },
                { key: "name", label: "Supplier",
                  span: 3 },
                { key: "spend", label: "Annual Spend",
                  span: 2, align: "right" },
                { key: "contracts",
                  label: "Contracts",
                  span: 2, align: "right" },
                { key: "value", label: "Total Value",
                  span: 2, align: "right" },
                { key: "sector", label: "Sector",
                  span: 2, align: "right" }
              ]}
              count={suppliersSummary.length}
              csvExport={{
                filename: "gracchus-government-suppliers",
                headers: ["Supplier", "Annual Spend (£)", "Contracts", "Total Value (£)", "Sector", "Strategic Supplier", "Departments"],
                rows: suppliersSummary.sort((a, b) => b.annualGovSpend - a.annualGovSpend).map(s => [s.name, s.annualGovSpend, s.contractCount, s.totalValue, s.sector, s.strategicSupplier ? "Yes" : "No", s.departments.join("; ")])
              }}
              totals={[
                { span: 1, content: "" },
                { span: 3, content:
                  suppliersSummary.length +
                  " supplier" +
                  (suppliersSummary.length !== 1
                    ? "s" : ""),
                  className:
                    "uppercase tracking-[0.1em] " +
                    "text-[9px]"
                },
                { span: 2, align: "right",
                  bold: true,
                  content: fmt(Math.round(
                    suppliersSummary.reduce(
                      (s, x) =>
                        s + x.annualGovSpend, 0
                    ) / 1e6
                  ))
                },
                { span: 2, align: "right",
                  content: suppliersSummary.reduce(
                    (s, x) =>
                      s + x.contractCount, 0
                  ) + " contracts"
                },
                { span: 2, align: "right",
                  content: fmt(Math.round(
                    suppliersSummary.reduce(
                      (s, x) =>
                        s + x.totalValue, 0
                    ) / 1e6
                  ))
                },
                { span: 2, content: "" }
              ]}
            >
              {suppliersSummary
                .sort(
                  (a, b) => b.annualGovSpend - a.annualGovSpend
                )
                .map((s, i) => {
                  const secColor = {
                    Defence: "text-red-500",
                    IT: "text-cyan-500",
                    Outsourcing:
                      "text-amber-500",
                    Construction:
                      "text-emerald-500",
                    Consulting:
                      "text-purple-500"
                  };
                  return (
                    <div
                      key={s.name}
                      className="min-w-[640px] grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-gray-800/20 hover:bg-white/[0.02]"
                    >
                      <div className="col-span-1 text-gray-700 text-xs font-mono">
                        {i + 1}
                      </div>
                      <div className="col-span-3">
                        <div className="text-white text-sm font-medium">
                          {s.name}
                          {s.strategicSupplier && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-800/50 text-gray-400">
                              Strategic
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 text-xs truncate">
                          {s.departments
                            .slice(0, 2)
                            .join(", ")}
                          {s.departments.length > 2
                            ? " +" +
                              (s.departments.length - 2)
                            : ""}
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-white text-sm font-medium">
                        {fmt(
                          Math.round(
                            s.annualGovSpend / 1e6
                          )
                        )}
                      </div>
                      <div className="col-span-2 text-right text-gray-400 text-sm">
                        {s.contractCount > 0
                          ? s.contractCount
                          : "-"}
                      </div>
                      <div className="col-span-2 text-right text-gray-400 text-sm">
                        {s.totalValue > 0
                          ? fmt(
                              Math.round(
                                s.totalValue / 1e6
                              )
                            )
                          : "-"}
                      </div>
                      <div className="col-span-2 text-right">
                        <span
                          className={
                            "text-[10px] uppercase tracking-[0.1em] " +
                            (secColor[s.sector] ||
                              "text-gray-500")
                          }
                        >
                          {s.sector}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </DataTableShell>

            {/* Recent major contracts */}
            <div className="pt-6">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Contracts
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-4">
                Recent Major Contract Awards
              </h3>
              <div className="space-y-2">
                {contractsRaw
                  .sort(
                    (a, b) => b.value - a.value
                  )
                  .slice(0, 10)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-800/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">
                          {c.title}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {c.buyer}
                          {" \u2192 "}
                          {c.suppliers
                            .map((s) => s.name)
                            .join(", ")}
                        </div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="text-white text-sm font-bold">
                          {fmt(
                            Math.round(c.value / 1e6)
                          )}
                        </div>
                        <div className="text-gray-600 text-xs">
                          {c.awardDate.slice(0, 4)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="text-gray-500 text-xs">
              <strong className="text-gray-400">
                Sources:
              </strong>{" "}
              MOD Trade, Industry and Contracts 2025;
              Tussell Strategic Supplier Analysis 2025;
              Contracts Finder; NAO reports. Annual spend
              figures are estimates based on published data.
            </div>

            <div
              id="crony-contracts"
              className="border-t border-gray-800/40 mt-10 pt-10 scroll-mt-24"
            >
              <SectionHeader
                label="Procurement Scrutiny"
                title="Questionable Contracts"
                accent="text-red-500"
              />
              <p className="text-gray-500 text-sm mb-6 -mt-4">
                Contracts flagged by auditors, courts, or parliamentary
                committees. Covers competitive vs non-competitive awards,
                connection disclosures, and procurement outcomes.
              </p>

              {/* Key stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="border-l-2 border-gray-800 pl-4 py-3">
                  <p className="text-gray-500 text-xs uppercase">
                    VIP Lane Contracts
                  </p>
                  <p className="text-xl font-bold text-red-400">
                    {"£"}1.7bn
                  </p>
                  <p className="text-gray-600 text-xs">
                    51 companies, 115 contracts
                  </p>
                </div>
                <div className="border-l-2 border-gray-800 pl-4 py-3">
                  <p className="text-gray-500 text-xs uppercase">
                    Unfit PPE from VIP Lane
                  </p>
                  <p className="text-xl font-bold text-red-400">
                    {"£"}1bn
                  </p>
                  <p className="text-gray-600 text-xs">
                    59% of VIP PPE spending
                  </p>
                </div>
                <div className="border-l-2 border-gray-800 pl-4 py-3">
                  <p className="text-gray-500 text-xs uppercase">
                    High-Risk Contracts
                  </p>
                  <p className="text-xl font-bold text-amber-400">
                    135
                  </p>
                  <p className="text-gray-600 text-xs">
                    Worth {"£"}15.3bn (TI UK)
                  </p>
                </div>
                <div className="border-l-2 border-gray-800 pl-4 py-3">
                  <p className="text-gray-500 text-xs uppercase">
                    No-Competition Awards
                  </p>
                  <p className="text-xl font-bold text-amber-400">
                    {"£"}30.7bn
                  </p>
                  <p className="text-gray-600 text-xs">
                    2/3 of all COVID contracts
                  </p>
                </div>
              </div>

              {/* Crony contracts chart + list grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Treemap visualization */}
                <div className={
                  "border border-gray-800/60 " +
                  "bg-gray-950/30 relative"
                }>
                  <div className="px-5 pt-5 pb-3">
                    <h3 className={
                      "text-[14px] font-bold " +
                      "text-gray-300 leading-tight"
                    }>
                      Questionable Contracts by Value
                    </h3>
                    <div className={
                      "text-[10px] text-gray-600 " +
                      "font-mono mt-1"
                    }>
                      Area proportional to contract value.
                      Hover for details.
                    </div>
                  </div>
                  <div className="px-3 pb-3" style={{ position: "relative" }}>
                    <ResponsiveContainer width="100%" height={440}>
                      <Treemap
                        data={cronyData.contracts
                          .filter(c => c.value > 0)
                          .sort((a, b) => b.value - a.value)
                          .map(c => ({
                            name: c.company,
                            size: c.value / 1e6,
                            severity: c.severity,
                            era: c.era,
                            id: c.id,
                            rawValue: c.value,
                            vipLane: c.vipLane,
                            product: c.product
                          }))}
                        dataKey="size"
                        stroke="#0a0a0a"
                        strokeWidth={3}
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                        content={(props) => {
                          const {
                            x, y, width, height,
                            name, depth
                          } = props;
                          if (!width || !height ||
                            width < 2 || height < 2 ||
                            depth !== 1) return null;

                          const sev = props.severity;
                          const id = props.id;
                          const rawVal = props.rawValue || 0;
                          const sizeMil = props.size || 0;
                          const era = props.era || "";
                          const vip = props.vipLane;
                          const product = props.product || "";
                          const isHov = cronyHover === id;

                          const baseColor =
                            sev === "critical"
                              ? "#dc2626"
                              : sev === "high"
                                ? "#d97706"
                                : "#4b5563";
                          const hovColor =
                            sev === "critical"
                              ? "#ef4444"
                              : sev === "high"
                                ? "#f59e0b"
                                : "#6b7280";
                          const fillColor = isHov
                            ? hovColor : baseColor;

                          const maxChars = Math.max(
                            3,
                            Math.floor(width / 7.5)
                          );
                          const displayName = !name
                            ? ""
                            : name.length > maxChars
                              ? name.slice(
                                  0, maxChars - 1
                                ) + "\u2026"
                              : name;

                          const showLabel =
                            width > 36 && height > 24;
                          const showValue =
                            width > 50 && height > 40;
                          const showSev =
                            width > 70 && height > 58;
                          const showEra =
                            width > 90 && height > 74;
                          const isLarge =
                            width > 180 && height > 100;

                          const valStr = rawVal >= 1e9
                            ? "\u00A3" +
                              (rawVal / 1e9).toFixed(1) +
                              "bn"
                            : "\u00A3" +
                              Math.round(
                                rawVal / 1e6
                              ) + "m";

                          return (
                            <g
                              onMouseEnter={() =>
                                setCronyHover(id)
                              }
                              onMouseLeave={() =>
                                setCronyHover(null)
                              }
                              style={{
                                cursor: "pointer"
                              }}
                            >
                              <rect
                                x={x + 1.5}
                                y={y + 1.5}
                                width={
                                  Math.max(0, width - 3)
                                }
                                height={
                                  Math.max(0, height - 3)
                                }
                                rx={4}
                                fill={fillColor}
                                fillOpacity={
                                  isHov ? 1 : 0.82
                                }
                                stroke={
                                  isHov
                                    ? "#ffffff20"
                                    : "transparent"
                                }
                                strokeWidth={1}
                                style={{
                                  transition:
                                    "fill 0.2s, " +
                                    "fill-opacity 0.2s, " +
                                    "stroke 0.2s",
                                  filter: isHov
                                    ? "brightness(1.15)"
                                    : "none"
                                }}
                              />
                              {showLabel && (
                                <foreignObject
                                  x={x + 1.5}
                                  y={y + 1.5}
                                  width={
                                    Math.max(
                                      0, width - 3
                                    )
                                  }
                                  height={
                                    Math.max(
                                      0, height - 3
                                    )
                                  }
                                  style={{
                                    pointerEvents:
                                      "none"
                                  }}
                                >
                                  <div
                                    xmlns={
                                      "http://www.w3.org" +
                                      "/1999/xhtml"
                                    }
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      padding: isLarge
                                        ? "12px 14px"
                                        : "6px 8px",
                                      overflow: "hidden",
                                      boxSizing:
                                        "border-box",
                                      display: "flex",
                                      flexDirection:
                                        "column",
                                      justifyContent:
                                        isLarge
                                          ? "flex-end"
                                          : "center"
                                    }}
                                  >
                                    <div style={{
                                      color: "#ffffff",
                                      fontSize: isLarge
                                        ? 16
                                        : width > 100
                                          ? 13 : 11,
                                      fontWeight: 700,
                                      lineHeight: 1.2,
                                      whiteSpace:
                                        "nowrap",
                                      overflow:
                                        "hidden",
                                      textOverflow:
                                        "ellipsis",
                                      textShadow:
                                        "0 1px 3px " +
                                        "rgba(0,0,0,0.5)"
                                    }}>
                                      {displayName}
                                    </div>
                                    {showValue && (
                                      <div style={{
                                        color:
                                          "#ffffffcc",
                                        fontSize:
                                          isLarge
                                            ? 15
                                            : 11,
                                        fontFamily:
                                          "monospace",
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        marginTop: 2,
                                        textShadow:
                                          "0 1px 2px " +
                                          "rgba(" +
                                          "0,0,0,0.4)"
                                      }}>
                                        {valStr}
                                      </div>
                                    )}
                                    {showSev && (
                                      <div style={{
                                        color:
                                          "#ffffff80",
                                        fontSize: 9,
                                        fontFamily:
                                          "monospace",
                                        textTransform:
                                          "uppercase",
                                        letterSpacing:
                                          "0.1em",
                                        marginTop: 3
                                      }}>
                                        {sev} severity
                                      </div>
                                    )}
                                    {showEra && (
                                      <div style={{
                                        color:
                                          "#ffffff50",
                                        fontSize: 9,
                                        fontFamily:
                                          "monospace",
                                        textTransform:
                                          "uppercase",
                                        letterSpacing:
                                          "0.08em",
                                        marginTop: 2
                                      }}>
                                        {era}
                                        {vip
                                          ? " \u00B7 VIP"
                                          : ""}
                                      </div>
                                    )}
                                  </div>
                                </foreignObject>
                              )}
                            </g>
                          );
                        }}
                      />
                    </ResponsiveContainer>

                    {/* Floating tooltip on hover */}
                    {cronyHover && (() => {
                      const c = cronyData.contracts.find(
                        x => x.id === cronyHover
                      );
                      if (!c) return null;
                      return (
                        <div
                          className={
                            "absolute top-4 right-4 " +
                            "z-20 pointer-events-none"
                          }
                          style={{
                            animation:
                              "fadeIn 0.15s ease-out"
                          }}
                        >
                          <div className={
                            "bg-gray-950/95 " +
                            "border border-gray-700/60 " +
                            "backdrop-blur-sm " +
                            "px-4 py-3 " +
                            "max-w-[260px] " +
                            "shadow-2xl"
                          }>
                            <div className={
                              "text-[13px] font-bold " +
                              "text-white leading-tight"
                            }>
                              {c.company}
                            </div>
                            <div className={
                              "text-[11px] " +
                              "text-gray-400 " +
                              "font-mono mt-1"
                            }>
                              {c.product}
                            </div>
                            <div className={
                              "flex items-center " +
                              "gap-3 mt-2"
                            }>
                              <span className={
                                "text-[15px] " +
                                "font-black text-white " +
                                "font-mono"
                              }>
                                {c.value >= 1e9
                                  ? "\u00A3" +
                                    (c.value / 1e9)
                                      .toFixed(1) + "bn"
                                  : "\u00A3" +
                                    Math.round(
                                      c.value / 1e6
                                    ) + "m"}
                              </span>
                              <span className={
                                "text-[9px] " +
                                "uppercase " +
                                "tracking-wider " +
                                "px-1.5 py-0.5 " +
                                (c.severity ===
                                  "critical"
                                  ? "bg-red-500/20 " +
                                    "text-red-400 " +
                                    "border " +
                                    "border-red-500/30"
                                  : c.severity ===
                                    "high"
                                    ? "bg-amber-500/20 " +
                                      "text-amber-400 " +
                                      "border border-" +
                                      "amber-500/30"
                                    : "bg-gray-700/40 " +
                                      "text-gray-400 " +
                                      "border border-" +
                                      "gray-600/30")
                              }>
                                {c.severity}
                              </span>
                            </div>
                            <div className={
                              "text-[10px] " +
                              "text-gray-600 " +
                              "font-mono mt-2 " +
                              "flex items-center gap-2"
                            }>
                              <span>
                                {c.awardDate}
                              </span>
                              <span>
                                {"\u00B7"}
                              </span>
                              <span>{c.era}</span>
                              {c.vipLane && (
                                <>
                                  <span>
                                    {"\u00B7"}
                                  </span>
                                  <span className={
                                    "text-red-500"
                                  }>
                                    VIP Lane
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Legend */}
                  <div className={
                    "flex gap-4 px-5 pb-4 " +
                    "justify-center"
                  }>
                    {[
                      {
                        l: "Critical",
                        c: "bg-red-600"
                      },
                      {
                        l: "High",
                        c: "bg-amber-600"
                      },
                      {
                        l: "Medium",
                        c: "bg-gray-600"
                      }
                    ].map(x => (
                      <div
                        key={x.l}
                        className={
                          "flex items-center " +
                          "gap-1.5 text-[10px] " +
                          "text-gray-500 font-mono " +
                          "uppercase tracking-wider"
                        }
                      >
                        <div className={
                          "w-3 h-3 rounded-sm " +
                          x.c
                        } />
                        {x.l}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scrollable contracts list */}
                <div className={
                  "border border-gray-800/60 " +
                  "bg-gray-950/30 " +
                  "flex flex-col max-h-[540px]"
                }>
                  <div className={
                    "px-4 py-3 border-b " +
                    "border-gray-800/40 shrink-0"
                  }>
                    <div className={
                      "text-[10px] uppercase " +
                      "tracking-[0.2em] " +
                      "text-gray-500 font-mono"
                    }>
                      All Flagged Contracts
                    </div>
                    <div className={
                      "text-sm font-bold " +
                      "text-white mt-0.5"
                    }>
                      {cronyData.contracts.length} Contracts
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {cronyData.contracts
                      .sort((a, b) => b.value - a.value)
                      .map((c) => (
                      <div key={c.id}>
                        <button
                          onClick={() =>
                            setCronyExpanded(
                              cronyExpanded === c.id
                                ? null : c.id
                            )
                          }
                          className={
                            "w-full text-left px-4 py-3 " +
                            "border-b border-gray-800/30 " +
                            "hover:bg-white/[0.03] " +
                            "transition-colors " +
                            (cronyExpanded === c.id
                              ? "bg-white/[0.03]" : "")
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className={
                                  "w-2 h-2 rounded-full shrink-0 " +
                                  (c.severity === "critical"
                                    ? "bg-red-500"
                                    : c.severity === "high"
                                      ? "bg-amber-500"
                                      : "bg-gray-500")
                                } />
                                <span className={
                                  "text-[13px] font-medium " +
                                  "text-gray-200 truncate"
                                }>
                                  {c.company}
                                </span>
                              </div>
                              <div className={
                                "text-[10px] text-gray-600 " +
                                "font-mono mt-0.5 ml-4"
                              }>
                                {c.product}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={
                                "text-[13px] font-bold " +
                                "text-white font-mono"
                              }>
                                {c.value >= 1e9
                                  ? "\u00A3" + (c.value / 1e9).toFixed(1) + "bn"
                                  : "\u00A3" + Math.round(c.value / 1e6) + "m"}
                              </div>
                              <div className={
                                "text-[10px] text-gray-600 " +
                                "font-mono"
                              }>
                                {c.awardDate}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1 ml-4">
                            {c.vipLane && (
                              <span className={
                                "text-[9px] px-1.5 py-0.5 " +
                                "bg-red-500/10 text-red-400 " +
                                "border border-red-500/20 " +
                                "uppercase tracking-wider"
                              }>
                                VIP Lane
                              </span>
                            )}
                            {!c.competitive && (
                              <span className={
                                "text-[9px] px-1.5 py-0.5 " +
                                "bg-amber-500/10 text-amber-400 " +
                                "border border-amber-500/20 " +
                                "uppercase tracking-wider"
                              }>
                                No Competition
                              </span>
                            )}
                            <span className={
                              "text-[9px] px-1.5 py-0.5 " +
                              "bg-gray-800/60 text-gray-500 " +
                              "border border-gray-700/40 " +
                              "uppercase tracking-wider"
                            }>
                              {c.era}
                            </span>
                          </div>
                        </button>

                        {/* Expanded detail panel */}
                        {cronyExpanded === c.id && (
                          <div className={
                            "px-4 py-4 bg-gray-900/40 " +
                            "border-b border-gray-800/30 " +
                            "space-y-3"
                          }>
                            <div>
                              <div className={
                                "text-[9px] uppercase " +
                                "tracking-[0.15em] " +
                                "text-gray-600 font-mono mb-1"
                              }>
                                Political Connection
                              </div>
                              <div className={
                                "text-[12px] text-gray-300 " +
                                "leading-relaxed"
                              }>
                                {c.connection}
                              </div>
                              <div className={
                                "text-[10px] text-gray-600 " +
                                "font-mono mt-0.5"
                              }>
                                Type: {c.connectionType}
                              </div>
                            </div>

                            <div>
                              <div className={
                                "text-[9px] uppercase " +
                                "tracking-[0.15em] " +
                                "text-gray-600 font-mono mb-1"
                              }>
                                Outcome
                              </div>
                              <div className={
                                "text-[12px] text-gray-300 " +
                                "leading-relaxed"
                              }>
                                {c.outcome}
                              </div>
                            </div>

                            <div className={
                              "flex items-center " +
                              "justify-between pt-2 " +
                              "border-t border-gray-800/30"
                            }>
                              <div className={
                                "text-[10px] text-gray-600 " +
                                "font-mono"
                              }>
                                {c.department}
                              </div>
                              {c.source && (
                                <a
                                  href={c.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={
                                    "text-[10px] text-gray-500 " +
                                    "hover:text-gray-300 " +
                                    "font-mono inline-flex " +
                                    "items-center gap-1"
                                  }
                                >
                                  Source <ExternalLink size={9} />
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-gray-500 text-xs mt-4">
                <strong className="text-gray-400">Sources:</strong>{" "}
                NAO Government procurement during COVID-19;
                Transparency International UK Behind the Masks (2024);
                Good Law Project VIP Lane investigations;
                High Court judgments; PAC.
              </div>
            </div>
          </div>
        )}

        {/* ============ SUPPLIERS: CONSULTANTS & ADVISERS ============ */}
        {view === "suppliers.consultants" && (
          <div className="space-y-6">
            <PageHeader
              eyebrow={"Waste & Projects \u203A Consultancy Spend"}
              title={"Consultants & Advisers"}
              dataAsOf="Jan 2025"
              description={
                "Government spending on management " +
                "consultancies, advisory firms, " +
                "and outsourced programme delivery."
              }
            />

            <QuickViewBar
              presets={SUPPLIER_PRESETS}
              active={supQuickView}
              onSelect={handleSupplierQuickView}
            />

            <SummaryStrip metrics={[
              {
                label: "Total Spend",
                value: fmt(Math.round(
                  conTotalValue / 1e6
                )),
                sub: conFiltered.length +
                  " contract" +
                  (conFiltered.length !== 1
                    ? "s" : "") + " shown"
              },
              {
                label: "Contracts",
                value: conFiltered.length,
                sub: "of " +
                  consultancyRaw.length + " total"
              },
              {
                label: "Firms",
                value: conCompanyRollups.length
              },
              {
                label: "Departments",
                value: new Set(conFiltered.map(
                  (c) => c.department
                )).size
              },
              {
                label: "Project-Linked",
                value: conLinkedCount +
                  " (" + (conFiltered.length > 0
                    ? Math.round(
                      conLinkedCount /
                      conFiltered.length * 100
                    ) : 0) + "%)"
              }
            ]} />

            <FilterBar
              search={{
                value: supConSearch,
                onChange: setSupConSearch,
                placeholder: "Search contracts..."
              }}
              filters={[
                {
                  value: conCompany,
                  onChange: setConCompany,
                  options: conCompanies.map(
                    (o) => ({
                      value: o,
                      label: o === "All"
                        ? "All Firms" : o
                    })
                  )
                },
                {
                  value: conDept,
                  onChange: setConDept,
                  options: conDepts.map(
                    (o) => ({
                      value: o,
                      label: o === "All"
                        ? "All Depts" : o
                    })
                  )
                },
                {
                  value: conCategory,
                  onChange: setConCategory,
                  options: conCategories.map(
                    (o) => ({
                      value: o,
                      label: o === "All"
                        ? "All Categories" : o
                    })
                  )
                },
                {
                  value: conLinked,
                  onChange: setConLinked,
                  options: [
                    { value: "All",
                      label: "All Contracts" },
                    { value: "Linked",
                      label: "Project-Linked" },
                    { value: "Standalone",
                      label: "Standalone" }
                  ]
                }
              ]}
              hasActiveFilters={
                supConSearch !== "" ||
                conCompany !== "All" ||
                conDept !== "All" ||
                conCategory !== "All" ||
                conLinked !== "All"
              }
              onClear={() => {
                setSupConSearch("");
                setConCompany("All");
                setConDept("All");
                setConCategory("All");
                setConLinked("All");
                setSupQuickView(null);
              }}
            />

            {/* Main contracts table */}
            <DataTableShell
              columns={[
                { key: "company", label: "Firm",
                  span: 2, sortable: true },
                { key: "dept", label: "Department",
                  span: 2 },
                { key: "contract",
                  label: "Contract", span: 3 },
                { key: "cat", label: "Category",
                  span: 1 },
                { key: "date", label: "Date",
                  span: 1, align: "right",
                  sortable: true },
                { key: "value", label: "Value",
                  span: 2, align: "right",
                  sortable: true },
                { key: "link", label: "Link",
                  span: 1, align: "right" }
              ]}
              sortBy={supConSortBy}
              sortDir={supConSortDir}
              onSort={(col) => {
                if (supConSortBy === col) {
                  setSupConSortDir(
                    supConSortDir === "desc"
                      ? "asc" : "desc"
                  );
                } else {
                  setSupConSortBy(col);
                  setSupConSortDir("desc");
                }
              }}
              count={conFiltered.length}
              emptyMessage={
                "No contracts match your filters"
              }
              totals={[
                { span: 2, content:
                  conFiltered.length +
                  " contract" +
                  (conFiltered.length !== 1
                    ? "s" : ""),
                  className:
                    "uppercase tracking-[0.1em] " +
                    "text-[9px]"
                },
                { span: 2, content: "" },
                { span: 3, content: "" },
                { span: 1, content: "" },
                { span: 1, content: "" },
                { span: 2, align: "right",
                  bold: true,
                  content: fmt(Math.round(
                    conTotalValue / 1e6
                  ))
                },
                { span: 1, align: "right",
                  content: conLinkedCount +
                    " linked",
                  className: "text-gray-600 " +
                    "text-[9px]"
                }
              ]}
            >

              {/* Table rows */}
              {conFiltered.map((c) => (
                <div
                  key={c.id}
                  className="min-w-[640px] grid grid-cols-12 gap-2 px-3 py-1.5 items-center border-b border-gray-900/60 hover:bg-white/[0.03] text-xs font-mono"
                >
                  <div className="col-span-2 text-gray-300 truncate">
                    {c.normalizedCompanyName}
                  </div>
                  <div className="col-span-2 text-gray-600 truncate text-[11px]">
                    {c.department.replace("Department of ", "").replace("Department for ", "")}
                  </div>
                  <div className="col-span-3 truncate">
                    <span className="text-gray-400">{c.contractTitle}</span>
                  </div>
                  <div className="col-span-1 text-gray-700 text-[10px] truncate">
                    {c.contractCategory}
                  </div>
                  <div className="col-span-1 text-right text-gray-600">
                    {c.awardDate || "\u2014"}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={
                      "font-bold tabular-nums " +
                      (c.contractValue >= 500000000 ? "text-red-400" :
                       c.contractValue >= 100000000 ? "text-amber-400" :
                       "text-gray-300")
                    }>
                      {c.contractValue >= 1e9
                        ? "£" + (c.contractValue / 1e9).toFixed(2) + "bn"
                        : c.contractValue >= 1e6
                          ? "£" + (c.contractValue / 1e6).toFixed(0) + "m"
                          : "£" + (c.contractValue / 1e3).toFixed(0) + "k"}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    {c.linkedProjectId ? (
                      <span className="text-[9px] uppercase tracking-[0.1em] text-cyan-500">
                        Linked
                      </span>
                    ) : (
                      <span className="text-gray-800">&mdash;</span>
                    )}
                  </div>
                </div>
              ))}

            </DataTableShell>

            {/* Company rollups */}
            <div className="pt-6">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Aggregated
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-4">
                Spend by Firm
              </h3>
              <DataTableShell
                columns={[
                  { key: "firm", label: "Firm",
                    span: 3 },
                  { key: "spend",
                    label: "Total Spend",
                    span: 2, align: "right" },
                  { key: "contracts",
                    label: "Contracts",
                    span: 1, align: "right" },
                  { key: "depts",
                    label: "Departments",
                    span: 2, align: "right" },
                  { key: "projects",
                    label: "Projects",
                    span: 2, align: "right" },
                  { key: "period",
                    label: "Period",
                    span: 2, align: "right" }
                ]}
                count={conCompanyRollups.length}
                totals={[
                  { span: 3, content:
                    conCompanyRollups.length +
                    " firm" +
                    (conCompanyRollups.length !== 1
                      ? "s" : ""),
                    className:
                      "uppercase tracking-[0.1em]" +
                      " text-[9px]"
                  },
                  { span: 2, align: "right",
                    bold: true,
                    content: fmt(Math.round(
                      conTotalValue / 1e6
                    ))
                  },
                  { span: 1, align: "right",
                    content: conFiltered.length
                  },
                  { span: 2, content: "" },
                  { span: 2, content: "" },
                  { span: 2, content: "" }
                ]}
              >

                {conCompanyRollups.map((r) => (
                  <div
                    key={r.name}
                    className="min-w-[640px] grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-gray-900/60 hover:bg-white/[0.03] text-xs font-mono"
                  >
                    <div className="col-span-3 text-white font-medium">
                      {r.name}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={
                        "font-bold tabular-nums " +
                        (r.totalValue >= 1e9 ? "text-red-400" :
                         r.totalValue >= 500e6 ? "text-amber-400" :
                         "text-gray-300")
                      }>
                        {r.totalValue >= 1e9
                          ? "£" + (r.totalValue / 1e9).toFixed(2) + "bn"
                          : "£" + (r.totalValue / 1e6).toFixed(0) + "m"}
                      </span>
                    </div>
                    <div className="col-span-1 text-right text-gray-400">
                      {r.contracts}
                    </div>
                    <div className="col-span-2 text-right text-gray-500">
                      {r.departments} dept{r.departments !== 1 ? "s" : ""}
                    </div>
                    <div className="col-span-2 text-right text-gray-500">
                      {r.projects > 0 ? (
                        <span className="text-cyan-500/80">{r.projects} linked</span>
                      ) : (
                        <span className="text-gray-700">&mdash;</span>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-gray-600 text-[10px]">
                      {r.firstDate ? r.firstDate.slice(0, 4) : ""}&ndash;{r.latestDate ? r.latestDate.slice(0, 4) : ""}
                    </div>
                  </div>
                ))}

              </DataTableShell>
            </div>

            <SourcesFooter>
              Contracts Finder; NAO Major Projects
              reports; Public Accounts Committee
              evidence sessions; openDemocracy;
              Good Law Project FOI releases;
              departmental annual reports.
            </SourcesFooter>
          </div>
        )}

        {/* ============ GOVERNMENT: CIVIL SERVICE ============ */}
        {view === "government" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                {"Tax & Spending \u203A Civil Service"}
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                The Government Machine
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                UK Civil Service headcount, pay, and departmental breakdown.
                Source: Cabinet Office Civil Service Statistics 2025.
              </p>
            </div>

            <TimeRangeControl range={govRange} setRange={setGovRange} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={Users} label="Total Headcount"
                value="549,660" accent="text-white"
                sub="As at March 2025 (FTE: 516,150)"
              />
              <StatCard
                icon={TrendingUp} label="Since 2016"
                value="+31.4%" accent="text-red-400"
                sub="+131,320 headcount since Brexit"
              />
              <StatCard
                icon={Clock} label="Since 2019"
                value="+31.1%" accent="text-amber-400"
                sub="+130,261 since pre-COVID"
              />
              <StatCard
                icon={MapPin} label="In London"
                value="19.6%" accent="text-cyan-400"
                sub="107,693 staff, down from 21.2%"
              />
            </div>

              <ChartPair>
              <ChartCard
            chartId="civil-service-headcount"
            title="Civil Service Headcount Over Time"
            info="Full-time equivalent (FTE) and headcount of UK civil servants. Source: ONS Civil Service Statistics."
            editorial="The civil service has grown by over 100,000 since 2016, reversing years of austerity-era cuts. Headcount is now at its highest since the early 2000s."
            shareHeadline="Civil service back to bloated levels"
            shareSubline="100,000+ MORE SINCE 2016."
            accentColor="#8b5cf6"
            shareData={filterByRange(civilServiceTimeline, "year", govRange).map(d => d.headcount)}
            onShare={handleChartShare}
            explainData={filterByRange(civilServiceTimeline, "year", govRange).slice(-6).map(d => `${d.year}: ${d.headcount.toLocaleString()} (FTE ${d.fte.toLocaleString()})`).join("; ")}>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={filterByRange(civilServiceTimeline, "year", govRange)}
                    margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip active={active} payload={payload} renderFn={(d) => (
                          <>
                            <p className="text-white font-medium">{d.year}</p>
                            <p className="text-gray-300 text-xs">
                              Headcount: {d.headcount.toLocaleString()}
                            </p>
                            <p className="text-cyan-400 text-xs">
                              FTE: {d.fte.toLocaleString()}
                            </p>
                          </>
                        )} />
                      )}
                    />
                    <Area
                      type="monotone" dataKey="headcount"
                      stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2}
                    />
                    <Area
                      type="monotone" dataKey="fte"
                      stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
            chartId="civil-service-by-department"
            title="Headcount by Department (Top 15)"
            info="Staff count by government department. HMRC and DWP together employ more than the rest of Whitehall combined."
            editorial="HMRC and DWP dwarf all other departments. Most of the civil service works in tax collection and benefits administration, not policy-making."
            shareHeadline="Two departments employ half the civil service"
            shareSubline="HMRC + DWP DOMINATE."
            accentColor="#6366f1"
            shareData={departmentHeadcounts.map(d => d.headcount)}
            onShare={handleChartShare}
            explainData={departmentHeadcounts.slice(0, 8).map(d => `${d.dept}: ${d.headcount.toLocaleString()}`).join("; ")}>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={departmentHeadcounts} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                    <XAxis
                      type="number"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
                    />
                    <YAxis
                      type="category" dataKey="dept" width={120}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip active={active} payload={payload} renderFn={(d) => (
                          <>
                            <p className="text-white font-medium">{d.dept}</p>
                            <p className="text-gray-300 text-xs">
                              Headcount: {d.headcount.toLocaleString()}
                            </p>
                            <p className={"text-xs " + (d.change > 0 ? "text-red-400" : "text-emerald-400")}>
                              YoY: {d.change > 0 ? "+" : ""}{d.change.toLocaleString()} ({d.changePct > 0 ? "+" : ""}{d.changePct}%)
                            </p>
                          </>
                        )} />
                      )}
                    />
                    <Bar dataKey="headcount" fill="#3b82f6" fillOpacity={0.7} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              </ChartPair>

              <div className="border-t border-gray-800/40 mt-10 pt-10">
                <SectionHeader
                  label="Welfare & Benefits"
                  title="Where the Money Goes"
                  accent="text-green-500"
                />
                <p className="text-gray-500 text-sm mb-6 -mt-4">
                  UK welfare spending, departmental budgets, and benefit bill
                  breakdown. FY 2025-26 data.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={PoundSterling} label="Total Welfare Bill"
                    value="£334bn" accent="text-green-400"
                    sub="2025-26 forecast (10.8% of GDP)"
                  />
                  <StatCard
                    icon={Users} label="Per Household"
                    value="£11,844/yr" accent="text-amber-400"
                    sub="~228/week across 28.2m households"
                  />
                  <StatCard
                    icon={TrendingUp} label="State Pension"
                    value="£146bn" accent="text-white"
                    sub="43.7% of total welfare spending"
                  />
                  <StatCard
                    icon={AlertTriangle} label="Disability Benefits"
                    value="£76.9bn" accent="text-red-400"
                    sub="Fastest growing benefit area"
                  />
                </div>

                <ChartPair>
                  <ChartCard
                    title="Welfare Spending Over Time"
                    info="Total welfare and social protection spending in real terms."
                    editorial="Welfare spending has risen relentlessly. The UK now spends more on benefits than on health, defence, and education combined."
                    shareHeadline="Welfare bill hits record levels"
                    shareSubline="AND STILL RISING."
                    accentColor="#ef4444"
                    shareData={filterByRange(welfareTimeline, "year", govRange).map(d => d.total)}
                    onShare={handleChartShare}
                  >
                    <ChartMeta
                      metric="Welfare Spending" geo="UK" unit="£bn"
                      data={filterByRange(welfareTimeline, "year", govRange)}
                      dateKey="year" source="DWP / HM Treasury PESA" freq="annual"
                      fullData={welfareTimeline}
                    />
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={filterByRange(welfareTimeline, "year", govRange)} margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => "£" + v + "bn"} />
                        <Tooltip content={({ active, payload }) => (
                          <CustomTooltip active={active} payload={payload} renderFn={(d) => (
                            <>
                              <p className="text-white font-medium">{d.year}</p>
                              <p className="text-green-400 text-xs">{"£"}{d.total}bn</p>
                              <p className="text-gray-400 text-xs">{d.pctGdp}% of GDP</p>
                            </>
                          )} />
                        )} />
                        <Area type="monotone" dataKey="total" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Welfare Breakdown (2025-26)"
                    onShare={handleChartShare}
                    shareHeadline="£300bn+ on welfare"
                    shareSubline="Where Britain's welfare bill actually goes"
                  >
                    <ChartMeta metric="Welfare Breakdown" geo="UK" unit="£bn" data={welfareBreakdown} dateKey="year" source="DWP" freq="annual" />
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={welfareBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => "£" + v + "bn"} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <Tooltip content={({ active, payload }) => (
                          <CustomTooltip active={active} payload={payload} renderFn={(d) => (
                            <>
                              <p className="text-white font-medium">{d.name}</p>
                              <p className="text-green-400 text-xs">{"£"}{d.value}bn</p>
                            </>
                          )} />
                        )} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                          {welfareBreakdown.map((d, i) => (
                            <Cell key={i} fill={d.color} fillOpacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </ChartPair>

                <ChartCard
                  title="Departmental Spending (2025-26)"
                  info="Planned departmental expenditure limits for 2025-26."
                  editorial="Health dominates everything. The NHS consumes nearly 40% of all departmental spending."
                  shareHeadline="NHS swallows 40% of all spending"
                  shareSubline="EVERYTHING ELSE FIGHTS FOR SCRAPS."
                  accentColor="#ef4444"
                  shareData={deptSpending.map(d => d.spending)}
                  onShare={handleChartShare}
                >
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={deptSpending} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => "£" + v + "bn"} />
                      <YAxis type="category" dataKey="dept" width={140} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <Tooltip content={({ active, payload }) => (
                        <CustomTooltip active={active} payload={payload} renderFn={(d) => (
                          <>
                            <p className="text-white font-medium">{d.dept}</p>
                            <p className="text-gray-300 text-xs">{"£"}{d.spending}bn</p>
                          </>
                        )} />
                      )} />
                      <Bar dataKey="spending" radius={[0, 4, 4, 0]} barSize={22}>
                        {deptSpending.map((d, i) => (
                          <Cell key={i} fill={d.color} fillOpacity={0.75} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="text-gray-500 text-xs">
                  <strong className="text-gray-400">Sources:</strong> DWP Benefit
                  Expenditure Tables 2025, HM Treasury PESA 2025, OBR Public Finances
                  Databank.
                </div>

                {/* ═══════ WHERE THE MONEY GOES — INTERACTIVE DONUT + TREEMAP ═══════ */}
                <div className="mt-10 pt-10 border-t border-gray-800/50">
                  <div className="mb-6">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                      HM Treasury PESA 2025
                    </div>
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                      Where the Money Goes
                    </h3>
                    <p className="text-gray-500 text-sm mt-2">
                      Government spending by department, FY {deptSpendingData.metadata.year}. Click a segment to drill into sub-departmental breakdown.
                    </p>
                  </div>

                  {/* Headline stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard icon={PoundSterling} label="Total Spending" value={"£" + (deptSpendingData.metadata.totalPolicySpending / 1000).toFixed(1) + "tn"} sub={"FY " + deptSpendingData.metadata.year} accent="text-white" />
                    <StatCard icon={Landmark} label="Spending / GDP" value="44%" sub="Total managed expenditure" accent="text-amber-400" />
                    <StatCard icon={TrendingUp} label="Net Borrowing" value="£152.7bn" sub="Receipts minus spending" accent="text-red-400" />
                    <StatCard icon={Activity} label="Debt Interest" value="£106.2bn" sub="8% of total spending" accent="text-red-500" />
                  </div>

                  {(() => {
                    const departments = deptSpendingData.departments;
                    const activeDept = govSpendDrill;
                    const drillData = activeDept
                      ? departments.find(d => d.name === activeDept)
                      : null;

                    const listData = drillData && drillData.children
                      ? drillData.children
                          .slice()
                          .sort((a, b) => b.spend - a.spend)
                          .map(c => ({ name: c.name, spend: c.spend, fill: drillData.color, drillable: false }))
                      : departments
                          .slice()
                          .sort((a, b) => b.spend - a.spend)
                          .map(d => ({ name: d.name, spend: d.spend, fill: d.color, drillable: !!d.children }));

                    const totalForView = listData.reduce((s, d) => s + d.spend, 0);

                    const treemapData = listData.map(d => ({
                      name: d.name,
                      size: d.spend,
                      fill: d.fill,
                      drillable: d.drillable
                    }));

                    return (
                      <div>
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 mb-4">
                          <button
                            onClick={() => setGovSpendDrill(null)}
                            className={
                              "text-[11px] font-mono uppercase tracking-[0.15em] " +
                              (activeDept ? "text-cyan-400 hover:text-cyan-300" : "text-white") +
                              " transition-colors"
                            }
                          >
                            All spending
                          </button>
                          {activeDept && (
                            <>
                              <ChevronRight size={10} className="text-gray-600" />
                              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-white">
                                {activeDept}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Total */}
                        <div className="mb-5">
                          <div className="text-3xl font-black text-white tracking-tight">
                            £{totalForView >= 1000 ? (totalForView / 1000).toFixed(1) + "tn" : totalForView.toFixed(1) + "bn"}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono uppercase tracking-wide mt-1">
                            {activeDept || "Policy spending, FY " + deptSpendingData.metadata.year}
                          </div>
                        </div>

                        {/* Department table */}
                        <div className="mt-6 border border-gray-800/60 divide-y divide-gray-800/40">
                          {listData.map((d, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (d.drillable) setGovSpendDrill(d.name);
                              }}
                              className={
                                "w-full flex items-center justify-between px-4 py-2.5 " +
                                "text-left hover:bg-white/[0.02] transition-colors " +
                                (d.drillable ? "cursor-pointer" : "cursor-default")
                              }
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: d.fill, opacity: 0.85 }}
                                />
                                <span className="text-[13px] text-gray-300 truncate">
                                  {d.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className="text-[13px] font-mono text-gray-400">
                                  £{d.spend.toFixed(1)}bn
                                </span>
                                <span className="text-[11px] font-mono text-gray-600 w-12 text-right">
                                  {(d.spend / totalForView * 100).toFixed(1)}%
                                </span>
                                {d.drillable && (
                                  <ChevronRight size={12} className="text-gray-700" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Year trend line */}
                        <div className="mt-8">
                          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-600 mb-3">
                            Policy spending by year
                          </div>
                          <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={deptSpendingData.yearTrend} margin={{ left: 10, right: 10, top: 5, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                              <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 11 }} />
                              <YAxis
                                tick={{ fill: "#6b7280", fontSize: 11 }}
                                tickFormatter={v => "£" + v + "bn"}
                                domain={["dataMin - 50", "dataMax + 50"]}
                              />
                              <Tooltip content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const d = payload[0].payload;
                                return (
                                  <div className="bg-gray-900/95 border border-gray-700 rounded px-3 py-2 text-xs">
                                    <p className="text-white font-medium">{d.year}</p>
                                    <p className="text-gray-300">£{d.total}bn</p>
                                  </div>
                                );
                              }} />
                              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="mt-4 text-[10px] text-gray-700 font-mono">
                          {deptSpendingData.metadata.adjustmentNote}
                        </div>
                        <div className="mt-2 text-gray-500 text-xs">
                          <strong className="text-gray-400">Source:</strong> {deptSpendingData.metadata.source}
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
              </div>

        )}

        {/* ============ GOVERNMENT: WHERE YOUR MONEY GOES (FLOW) ============ */}
        {view === "government.flow" && (() => {
          const flowData = publicFinancesFlowData.annual;
          const yearData = flowData.find(d => d.year === flowYear) || flowData[flowData.length - 2];
          const latestMonth = publicFinancesFlowData.latestMonth;
          const isPartial = yearData.isPartial || false;

          const r = yearData.receipts;
          const s = yearData.spending;
          const borrowing = yearData.netBorrowing;
          const debtInt = yearData.debtInterestNet;

          // Pence-in-the-pound derived metrics
          const debtPencePerPound = s.total > 0 ? ((s.debtInterest / s.total) * 100).toFixed(0) : "?";
          const healthPencePerPound = s.total > 0 ? ((s.health / s.total) * 100).toFixed(0) : "?";
          const welfarePencePerPound = s.total > 0 ? ((s.socialProtection / s.total) * 100).toFixed(0) : "?";
          const borrowingPctSpend = s.total > 0 ? ((borrowing / s.total) * 100).toFixed(0) : "?";

          // ── Sankey flow chart data ──
          const receiptStreams = [
            { label: "Income Tax", value: r.incomeTax, color: "#3b82f6" },
            { label: "NICs", value: r.nationalInsurance, color: "#6366f1" },
            { label: "VAT", value: r.vat, color: "#8b5cf6" },
            { label: "Corporation Tax", value: r.corporationTax, color: "#a78bfa" },
            { label: "Other Tax", value: r.otherHMRC, color: "#64748b" },
            { label: "Non-Tax Income", value: r.nonHMRC, color: "#475569" },
          ];

          const spendStreams = [
            { label: "Social Protection", value: s.socialProtection, color: "#ef4444" },
            { label: "Health & NHS", value: s.health, color: "#f97316" },
            { label: "Education", value: s.education, color: "#eab308" },
            { label: "Defence", value: s.defence, color: "#22c55e" },
            { label: "Debt Interest", value: s.debtInterest, color: "#dc2626" },
            { label: "Public Order", value: s.publicOrder, color: "#06b6d4" },
            { label: "Transport", value: s.transport, color: "#14b8a6" },
            { label: "Other Spending", value: s.other, color: "#64748b" },
          ];

          // Layout constants for the SVG Sankey
          const SVG_W = 920;
          const SVG_H = 520;
          const COL_LEFT = 10;
          const COL_LEFT_W = 160;
          const COL_RIGHT = SVG_W - 170;
          const COL_RIGHT_W = 160;
          const FLOW_LEFT = COL_LEFT + COL_LEFT_W + 8;
          const FLOW_RIGHT = COL_RIGHT - 8;
          const BAR_GAP = 4;

          const totalReceipts = r.total;
          const totalSpend = s.total;
          const maxSide = Math.max(totalReceipts, totalSpend);
          const usableH = SVG_H - 40;

          // Calculate bar heights proportional to max side
          const calcBars = (streams, total) => {
            const scale = usableH / maxSide;
            let y = 20;
            return streams.map(st => {
              const h = Math.max(4, st.value * scale);
              const bar = { ...st, y, h };
              y += h + BAR_GAP;
              return bar;
            });
          };

          const leftBars = calcBars(receiptStreams, totalReceipts);
          const rightBars = calcBars(spendStreams, totalSpend);

          // Borrowing bar (extra on right side, below spending)
          const borrowingScale = usableH / maxSide;
          const lastRight = rightBars[rightBars.length - 1];
          const borrowingY = lastRight.y + lastRight.h + BAR_GAP * 2;
          const borrowingH = Math.max(4, borrowing * borrowingScale);

          // Build flow paths: each left stream connects to the central pool, then fans to right
          // Simplified: draw curved paths from each left bar center to each right bar proportionally
          const buildFlowPaths = () => {
            const paths = [];
            // Each receipt stream distributes proportionally to all spending categories
            let leftOffset = {};
            let rightOffset = {};
            leftBars.forEach(b => { leftOffset[b.label] = b.y; });
            rightBars.forEach(b => { rightOffset[b.label] = b.y; });

            for (const lb of leftBars) {
              // This receipt distributes to spending in proportion to spending shares
              const receiptShare = lb.value / totalReceipts;
              for (const rb of rightBars) {
                const spendShare = rb.value / totalSpend;
                const flowValue = receiptShare * spendShare * Math.min(totalReceipts, totalSpend);
                const flowH = Math.max(0.5, flowValue * (usableH / maxSide));

                const x1 = FLOW_LEFT;
                const y1 = leftOffset[lb.label] + flowH / 2;
                const x2 = FLOW_RIGHT;
                const y2 = rightOffset[rb.label] + flowH / 2;
                const cx1 = x1 + (x2 - x1) * 0.4;
                const cx2 = x1 + (x2 - x1) * 0.6;

                paths.push({
                  d: `M${x1},${y1 - flowH / 2} C${cx1},${y1 - flowH / 2} ${cx2},${y2 - flowH / 2} ${x2},${y2 - flowH / 2} L${x2},${y2 + flowH / 2} C${cx2},${y2 + flowH / 2} ${cx1},${y1 + flowH / 2} ${x1},${y1 + flowH / 2} Z`,
                  color: lb.color,
                  opacity: 0.15,
                });

                leftOffset[lb.label] += flowH;
                rightOffset[rb.label] += flowH;
              }
            }
            return paths;
          };

          const flowPaths = buildFlowPaths();

          const fmtB = (v) => v >= 1000 ? `£${(v / 1000).toFixed(2)}tn` : `£${v.toFixed(0)}bn`;
          const fmtBn = (v) => `£${v.toFixed(0)}bn`;
          const fmtTn = (v) => `£${(v / 1000).toFixed(2)}tn`;

          // Available years for selector
          const availableYears = flowData.map(d => d.year).filter(yr => spendingTreeData.years[yr]);

          return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Tax & Spending"
              breadcrumb="← Tax & Spending"
              breadcrumbAction={() => setView("government.flow")}
              dataAsOf="2025-26"
              title="Where Your Money Goes"
              description={`How the UK government collects and spends public money. ${isPartial ? yearData.partialLabel + " (partial year)." : "Financial year " + yearData.year + "."} All figures in billions.`}
            />

            {/* ── Year selector ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-gray-600 mr-1">Year</span>
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => { setFlowYear(yr); setGovSpendDrill(null); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    flowYear === yr
                      ? "bg-white text-black border-white font-semibold"
                      : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  {flowData.find(d => d.year === yr)?.isPartial ? yr + " (YTD)" : yr}
                </button>
              ))}
            </div>

            {/* ── Key metrics ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={TrendingUp}
                label="Total Receipts"
                value={fmtB(r.total)}
                accent="text-emerald-400"
                sub={isPartial ? yearData.partialLabel : yearData.year}
              />
              <StatCard
                icon={Briefcase}
                label="Total Spending"
                value={fmtB(s.total)}
                accent="text-red-400"
                sub={`${fmtBn(s.total - r.total)} more than receipts`}
              />
              <StatCard
                icon={AlertTriangle}
                label="Debt Interest"
                value={fmtBn(s.debtInterest)}
                accent="text-amber-400"
                sub={`${debtPencePerPound}p in every £1 spent`}
              />
              <StatCard
                icon={TrendingDown}
                label="Borrowing Required"
                value={fmtBn(borrowing)}
                accent="text-red-500"
                sub={`${borrowingPctSpend}% of spending unfunded`}
              />
            </div>

            {/* ── Spending treemap (hierarchical, year-aware) ── */}
            {(() => {
              // Pick year-matched tree, fall back to latest
              const treeYear = spendingTreeData.years[flowYear] || spendingTreeData.years["2025-26"];
              const nodes = treeYear.nodes;

              // Find the current drill node (if any)
              const drillNode = govSpendDrill
                ? nodes.find(n => n.name === govSpendDrill && n.parent === "total")
                : null;

              // Resolve the parent id to show children of
              const parentId = drillNode ? drillNode.id : "total";

              // Get children of the current parent
              const children = nodes.filter(n => n.parent === parentId);

              // For each child, compute its total value (sum of its leaf descendants, or its own value)
              const getNodeValue = (node) => {
                if (node.value !== undefined) return node.value;
                const kids = nodes.filter(n => n.parent === node.id);
                return kids.reduce((sum, k) => sum + getNodeValue(k), 0);
              };

              // Check if a node has children (is drillable)
              const hasChildren = (node) => nodes.some(n => n.parent === node.id);

              // Get colour: from the node itself, or inherit from the drilled parent
              const getColor = (node) => {
                if (node.color) return node.color;
                if (drillNode && drillNode.color) return drillNode.color;
                // Walk up to find a coloured ancestor
                let current = node;
                while (current && !current.color) {
                  current = nodes.find(n => n.id === current.parent);
                }
                return current?.color || "#374151";
              };

              const listData = children
                .map(c => ({ name: c.name, spend: getNodeValue(c), fill: getColor(c), drillable: hasChildren(c), id: c.id }))
                .sort((a, b) => b.spend - a.spend);

              const totalForView = listData.reduce((sum, d) => sum + d.spend, 0);
              const flowTreemapData = listData.map(d => ({ name: d.name, size: d.spend, fill: d.fill, drillable: d.drillable }));

              // Build breadcrumb trail
              const breadcrumbs = [];
              if (govSpendDrill && drillNode) {
                breadcrumbs.push({ label: drillNode.name, id: null });
              }

              return (
                <div>
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-mono">
                      {govSpendDrill ? (
                        <button onClick={() => setGovSpendDrill(null)} className="hover:text-gray-400 transition-colors">All Spending</button>
                      ) : "All Spending"}
                    </span>
                    {govSpendDrill && (
                      <>
                        <ChevronRight size={10} className="text-gray-700" />
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white font-mono font-bold">{govSpendDrill}</span>
                      </>
                    )}
                    <span className="ml-auto text-[11px] font-mono text-gray-600">£{totalForView.toFixed(1)}bn total</span>
                  </div>

                  <ResponsiveContainer width="100%" height={480}>
                    <Treemap
                      data={flowTreemapData}
                      dataKey="size"
                      stroke="#0a0a0a"
                      strokeWidth={2}
                      isAnimationActive={false}
                      content={(props) => {
                        const { x, y, width, height, name, depth } = props;
                        if (!width || !height || width < 2 || height < 2 || depth !== 1) return null;
                        const sizeVal = props.size || 0;
                        const match = flowTreemapData.find(d => d.name === name);
                        const fillColor = match?.fill || "#374151";
                        const canDrill = match?.drillable;
                        const maxChars = Math.max(4, Math.floor(width / 8));
                        const displayName = !name ? "" : name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
                        const showLabel = width > 40 && height > 28 && name;
                        const showValue = width > 40 && height > 44;

                        return (
                          <g>
                            <rect x={x} y={y} width={width} height={height} rx={3} fill={fillColor} stroke="#0a0a0a" strokeWidth={2} />
                            <foreignObject x={x} y={y} width={width} height={height}>
                              <div
                                xmlns="http://www.w3.org/1999/xhtml"
                                onClick={() => { if (canDrill) setGovSpendDrill(name); }}
                                style={{ width: "100%", height: "100%", padding: "8px 10px", cursor: canDrill ? "pointer" : "default", overflow: "hidden", boxSizing: "border-box" }}
                              >
                                {showLabel && (
                                  <div style={{ color: "#ffffff", fontSize: width > 160 ? 16 : width > 100 ? 14 : 12, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {displayName}
                                  </div>
                                )}
                                {showValue && (
                                  <div style={{ color: "#e5e7eb", fontSize: width > 160 ? 14 : 12, fontFamily: "monospace", lineHeight: 1.4, marginTop: 2 }}>
                                    £{sizeVal.toFixed(1)}bn
                                  </div>
                                )}
                                {showValue && height > 60 && (
                                  <div style={{ color: "#9ca3af", fontSize: 12, fontFamily: "monospace", lineHeight: 1.3 }}>
                                    {(sizeVal / totalForView * 100).toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            </foreignObject>
                          </g>
                        );
                      }}
                    />
                  </ResponsiveContainer>
                  {/* Category table – two-column compact grid */}
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-0 border border-gray-800/60 rounded-lg overflow-hidden">
                    {listData.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => { if (d.drillable) setGovSpendDrill(d.name); }}
                        className={
                          "flex items-center justify-between px-3 py-2 " +
                          "text-left hover:bg-white/[0.03] transition-colors border-b border-gray-800/30 " +
                          (d.drillable ? "cursor-pointer" : "cursor-default")
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill, opacity: 0.85 }} />
                          <span className="text-[12px] text-gray-300 truncate">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[12px] font-mono text-gray-400">£{d.spend.toFixed(1)}bn</span>
                          <span className="text-[10px] font-mono text-gray-600 w-10 text-right">{(d.spend / totalForView * 100).toFixed(1)}%</span>
                          {d.drillable && <ChevronRight size={10} className="text-gray-700" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Spending breakdown cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {spendStreams.map(st => {
                const pct = ((st.value / s.total) * 100).toFixed(1);
                // Compare with previous full year to show change
                const prevYear = flowData.filter(d => !d.isPartial).slice(-2)[0];
                const prevSpend = prevYear ? prevYear.spending : null;
                const prevMap = {
                  "Social Protection": prevSpend?.socialProtection,
                  "Health & NHS": prevSpend?.health,
                  "Education": prevSpend?.education,
                  "Defence": prevSpend?.defence,
                  "Debt Interest": prevSpend?.debtInterest,
                  "Public Order": prevSpend?.publicOrder,
                  "Transport": prevSpend?.transport,
                  "Other Spending": prevSpend?.other,
                };
                const prev = prevMap[st.label];
                const change = prev && prev > 0 ? ((st.value - prev) / prev * 100) : null;
                const changeColor = change === null ? "text-gray-600" : change > 5 ? "text-red-400" : change > 0 ? "text-amber-400" : "text-emerald-400";
                const changeIcon = change === null ? "" : change > 0 ? "↑" : "↓";

                return (
                  <div key={st.label} className="bg-gray-900/30 border border-gray-800/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: st.color, opacity: 0.85 }} />
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{st.label}</span>
                    </div>
                    <div className="text-lg font-black text-white">{fmtBn(st.value)}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{pct}% of total</span>
                      {change !== null && (
                        <span className={"text-[10px] font-mono font-semibold " + changeColor}>
                          {changeIcon} {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Bottom row: trend chart + tax calculator ── */}
            <div className="flex gap-4">
              {/* Historical trend (left half) */}
              <div className="flex-1 min-w-0">
                <ChartCard
                  chartId="public-finances-flow"
                  label="Trend"
                  title="Receipts vs Spending"
                  explainData={flowData.filter(d => !d.isPartial).map(d => `${d.year}: Receipts £${d.receipts.total}bn, Spending £${d.spending.total}bn, Gap £${(d.spending.total - d.receipts.total).toFixed(0)}bn`).join("; ")}
                  onShare={handleChartShare}
                  shareHeadline="Spending more than we earn"
                  shareSubline="Government receipts vs total managed expenditure"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={flowData.filter(d => !d.isPartial).map(d => ({
                      year: d.year.replace(/(\d{4})-(\d{2})/, "$1"),
                      Receipts: d.receipts.total,
                      Spending: d.spending.total,
                    }))} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}bn`} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => [`£${v}bn`, undefined]} />
                      <Area type="monotone" dataKey="Spending" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="Receipts" stroke="#22c55e" fill="#22c55e" fillOpacity={0.08} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Your Tax Contribution calculator (right half) */}
              <div className="flex-1 min-w-0">
                {(() => {
                  const sal = flowTaxSalary;
                  // 2025-26 UK tax bands
                  const personalAllowance = 12570;
                  const basicRate = 0.20;
                  const higherRate = 0.40;
                  const additionalRate = 0.45;
                  const basicLimit = 50270;
                  const higherLimit = 125140;

                  // Income tax
                  let incomeTax = 0;
                  const taxable = Math.max(0, sal - personalAllowance);
                  if (taxable > 0) {
                    const basicBand = Math.min(taxable, basicLimit - personalAllowance);
                    incomeTax += basicBand * basicRate;
                    if (taxable > basicLimit - personalAllowance) {
                      const higherBand = Math.min(taxable - (basicLimit - personalAllowance), higherLimit - basicLimit);
                      incomeTax += higherBand * higherRate;
                      if (taxable > higherLimit - personalAllowance) {
                        incomeTax += (taxable - (higherLimit - personalAllowance)) * additionalRate;
                      }
                    }
                  }

                  // Employee NICs (2025-26: 8% on £12,570–£50,270, 2% above)
                  let nic = 0;
                  if (sal > 12570) {
                    const nicBasic = Math.min(sal, 50270) - 12570;
                    nic += nicBasic * 0.08;
                    if (sal > 50270) nic += (sal - 50270) * 0.02;
                  }

                  const totalTax = incomeTax + nic;

                  // Allocate across spending tree top-level categories proportionally
                  const treeYear = spendingTreeData.years[flowYear] || spendingTreeData.years["2025-26"];
                  const nodes = treeYear.nodes;
                  const topCategories = nodes.filter(n => n.parent === "total");
                  const getNodeValue = (node) => {
                    if (node.value !== undefined) return node.value;
                    const kids = nodes.filter(n => n.parent === node.id);
                    return kids.reduce((sum, k) => sum + getNodeValue(k), 0);
                  };
                  const totalSpend = topCategories.reduce((sum, c) => sum + getNodeValue(c), 0);
                  const allocations = topCategories
                    .map(c => {
                      const catSpend = getNodeValue(c);
                      const share = catSpend / totalSpend;
                      return { name: c.name, amount: totalTax * share, color: c.color || "#6b7280", share };
                    })
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10);

                  return (
                    <div className="bg-gray-900/30 border border-gray-800/40 rounded-xl p-4 md:p-5 h-full">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-3">Your Tax Contribution</div>
                      <div className="mb-3">
                        <div className="text-[11px] text-gray-500 mb-1.5">Annual salary</div>
                        <input
                          type="range"
                          min={12570}
                          max={200000}
                          step={1000}
                          value={flowTaxSalary}
                          onChange={e => setFlowTaxSalary(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-white"
                        />
                        <div className="flex items-baseline justify-between mt-1.5">
                          <span className="text-xl font-black text-white">£{sal.toLocaleString()}</span>
                          <span className="text-xs font-mono text-gray-500">≈ £{Math.round(totalTax).toLocaleString()} tax/yr</span>
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-600 font-mono mb-2">Your money goes to</div>
                      <div className="space-y-1.5">
                        {allocations.map(a => (
                          <div key={a.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
                              <span className="text-[12px] text-gray-300 truncate">{a.name}</span>
                            </div>
                            <span className="text-[12px] font-mono text-gray-400 shrink-0">£{Math.round(a.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-600 italic mt-3 leading-relaxed">Approximation based on income tax + NI. Excludes VAT, council tax, and other indirect taxes.</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Context: latest month ── */}
            {latestMonth && (
              <div className="bg-gray-900/30 border border-gray-800/40 rounded-xl p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-300 mb-1">Latest: {latestMonth.period}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{latestMonth.notes}</p>
                    <div className="flex gap-4 mt-3 flex-wrap">
                      <div className="text-xs"><span className="text-gray-500">Receipts</span> <span className="text-emerald-400 font-semibold">{fmtBn(latestMonth.receipts)}</span></div>
                      <div className="text-xs"><span className="text-gray-500">Spending</span> <span className="text-red-400 font-semibold">{fmtBn(latestMonth.expenditure)}</span></div>
                      <div className="text-xs"><span className="text-gray-500">Debt Interest</span> <span className="text-amber-400 font-semibold">{fmtBn(latestMonth.debtInterest)}</span></div>
                      <div className="text-xs"><span className="text-gray-500">Borrowing</span> <span className="text-red-500 font-semibold">{fmtBn(latestMonth.netBorrowing)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Methodology / Source ── */}
            <div className="border-t border-gray-800/50 pt-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Sources & Methodology</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Receipts: ONS public sector current receipts with HMRC tax breakdown. Spending categories: OBR/HMT functional classification (COFOG). Borrowing: ONS public sector net borrowing. Debt interest: OBR net measure (net of APF). All figures in nominal terms, not inflation-adjusted.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Spending categories are available on a full financial year basis only. Monthly totals come from the ONS Public Sector Finances bulletin. The "Other Spending" category is a residual including housing, environment, economic affairs (excl. transport), general public services, and accounting adjustments.
              </p>
              <p className="text-xs text-gray-700 mt-1">
                Last updated: {publicFinancesFlowData.metadata.lastUpdated} · Source: {publicFinancesFlowData.metadata.latestSource}
              </p>
            </div>
          </div>
          );
        })()}

        {/* ============ GOVERNMENT: TAX & DEBT ============ */}
        {view === "government.taxdebt" && (() => {
          const taxSeries = taxReceiptsData.series;
          const pfSeries = publicFinancesData.series;
          const ranges = {
            "2y": 2, "5y": 5, "10y": 10, "max": 999
          };
          const rangeN = ranges[taxDebtRange] || 5;
          const taxFiltered = rangeN >= 999
            ? taxSeries
            : taxSeries.slice(-rangeN);
          const pfFiltered = rangeN >= 999
            ? pfSeries
            : pfSeries.slice(-rangeN);

          const latest = taxSeries[
            taxSeries.length - 1
          ];
          const pfLatest = pfSeries[
            pfSeries.length - 1
          ];

          // Derived metrics
          const receiptsPerCapita = pfLatest.population > 0
            ? (pfLatest.totalReceipts * 1000 /
              pfLatest.population).toFixed(0)
            : "N/A";
          const taxPctGDP = pfLatest.nominalGDP > 0
            ? ((pfLatest.totalReceipts /
              pfLatest.nominalGDP) * 100).toFixed(1)
            : "N/A";
          const debtIntPctReceipts =
            pfLatest.totalReceipts > 0
            ? ((pfLatest.debtInterestGross /
              pfLatest.totalReceipts) * 100)
              .toFixed(1)
            : "N/A";
          const debtIntPctSpending =
            pfLatest.totalExpenditure > 0
            ? ((pfLatest.debtInterestGross /
              pfLatest.totalExpenditure) * 100)
              .toFixed(1)
            : "N/A";

          // Tax breakdown chart data
          const breakdownChart = taxFiltered.map(
            (d) => ({
              year: d.year.replace(
                /(\d{4})-(\d{2})/,
                "$1"
              ),
              "Income Tax": d.incomeTax,
              "NICs": d.nationalInsurance,
              "VAT": d.vat,
              "Corporation Tax": d.corporationTax,
              "Fuel Duty": d.fuelDuty,
              "Other": (
                d.stampDuties + d.tobaccoDuty +
                d.alcoholDuty + d.capitalGainsTax +
                d.inheritanceTax + d.other
              )
            })
          );

          // Debt interest chart data
          const debtChart = pfFiltered.map(
            (d) => ({
              year: d.year.replace(
                /(\d{4})-(\d{2})/,
                "$1"
              ),
              "Net (OBR)": d.debtInterestNet,
              "Gross": d.debtInterestGross,
              "% GDP": d.debtInterestPctGDP
            })
          );

          // Receipts vs expenditure
          const balanceChart = pfFiltered.map(
            (d) => ({
              year: d.year.replace(
                /(\d{4})-(\d{2})/,
                "$1"
              ),
              Receipts: d.totalReceipts,
              Expenditure: d.totalExpenditure,
              Deficit: d.totalExpenditure -
                d.totalReceipts
            })
          );

          // Per-capita series
          const perCapChart = pfFiltered.map(
            (d) => ({
              year: d.year.replace(
                /(\d{4})-(\d{2})/,
                "$1"
              ),
              "Receipts per capita (£)":
                d.population > 0
                ? Math.round(
                  d.totalReceipts * 1000 /
                  d.population
                )
                : 0,
              "Tax % GDP":
                d.nominalGDP > 0
                ? +(
                  d.totalReceipts /
                  d.nominalGDP * 100
                ).toFixed(1)
                : 0
            })
          );

          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase " +
                "tracking-[0.2em] font-medium " +
                "text-gray-600 mb-2"
              }>
                {"Tax & Spending \u203A Tax & Public Finances"}
              </div>
              <h2 className={
                "text-2xl md:text-3xl " +
                "font-black uppercase " +
                "tracking-tight"
              }>
                Tax & Public Finances
              </h2>
              <p className={
                "text-gray-500 text-sm mt-2"
              }>
                UK tax receipts and debt
                {" "}servicing costs.
                {" "}20 years of HMRC, ONS,
                {" "}and OBR data.
              </p>
            </div>

            {/* Time range selector */}
            <div className={
              "flex gap-2 border-b " +
              "border-gray-800/40 pb-4 mb-6"
            }>
              {["2y", "5y", "10y", "max"].map(
                (r) => (
                <button
                  key={r}
                  onClick={() =>
                    setTaxDebtRange(r)
                  }
                  className={
                    "text-[10px] font-mono " +
                    "uppercase tracking-[0.15em] " +
                    "px-3 py-1.5 transition-colors " +
                    (taxDebtRange === r
                      ? "text-white " +
                        "border-b-2 " +
                        "border-red-500"
                      : "text-gray-600 " +
                        "hover:text-gray-400")
                  }
                >
                  {r === "max" ? "All" : r}
                </button>
              ))}
            </div>

            {/* Headline metrics */}
            <div className={
              "grid grid-cols-2 " +
              "md:grid-cols-4 gap-4 mb-8"
            }>
              <div className={
                "border border-gray-800/40 " +
                "p-4"
              }>
                <div className={
                  "text-[9px] uppercase " +
                  "tracking-[0.2em] " +
                  "text-gray-700 font-mono mb-1"
                }>
                  Total Tax Receipts
                </div>
                <div className={
                  "text-2xl font-black " +
                  "text-white font-mono"
                }>
                  {"£"}{latest.totalHMRC}bn
                </div>
                <div className={
                  "text-[10px] text-gray-600 " +
                  "font-mono mt-0.5"
                }>
                  HMRC {latest.year}
                </div>
              </div>
              <div className={
                "border border-gray-800/40 " +
                "p-4"
              }>
                <div className={
                  "text-[9px] uppercase " +
                  "tracking-[0.2em] " +
                  "text-gray-700 font-mono mb-1"
                }>
                  Debt Interest
                </div>
                <div className={
                  "text-2xl font-black " +
                  "text-red-500 font-mono"
                }>
                  {"£"}{
                    pfLatest.debtInterestGross
                  }bn
                </div>
                <div className={
                  "text-[10px] text-gray-600 " +
                  "font-mono mt-0.5"
                }>
                  Gross {pfLatest.year}
                </div>
              </div>
              <div className={
                "border border-gray-800/40 " +
                "p-4"
              }>
                <div className={
                  "text-[9px] uppercase " +
                  "tracking-[0.2em] " +
                  "text-gray-700 font-mono mb-1"
                }>
                  Debt Int. % Receipts
                </div>
                <div className={
                  "text-2xl font-black " +
                  "text-amber-400 font-mono"
                }>
                  {debtIntPctReceipts}%
                </div>
                <div className={
                  "text-[10px] text-gray-600 " +
                  "font-mono mt-0.5"
                }>
                  Of total receipts
                </div>
              </div>
              <div className={
                "border border-gray-800/40 " +
                "p-4"
              }>
                <div className={
                  "text-[9px] uppercase " +
                  "tracking-[0.2em] " +
                  "text-gray-700 font-mono mb-1"
                }>
                  Receipts Per Capita
                </div>
                <div className={
                  "text-2xl font-black " +
                  "text-white font-mono"
                }>
                  {"£"}{Number(
                    receiptsPerCapita
                  ).toLocaleString("en-GB")}
                </div>
                <div className={
                  "text-[10px] text-gray-600 " +
                  "font-mono mt-0.5"
                }>
                  {taxPctGDP}% of GDP
                </div>
              </div>
            </div>

            {/* Charts */}
            <ChartPair>
              {/* Tax breakdown stacked area */}
              <ChartCard
                label="Tax Receipts"
                title="HMRC Receipts by Category"
                onShare={handleChartShare}
                shareHeadline="Where your tax money comes from"
                shareSubline="HMRC receipts broken down by tax type"
              >
                <ResponsiveContainer
                  width="100%" height={260}
                >
                  <AreaChart data={breakdownChart}>
                    <XAxis
                      dataKey="year"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        (v) => "£" + v + "bn"
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #333",
                        fontSize: 11
                      }}
                      formatter={
                        (v) => [
                          "£" +
                          v.toFixed(1) + "bn",
                          undefined
                        ]
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="Income Tax"
                      stackId="1"
                      fill="#ef4444"
                      fillOpacity={0.7}
                      stroke="#ef4444"
                    />
                    <Area
                      type="monotone"
                      dataKey="NICs"
                      stackId="1"
                      fill="#f97316"
                      fillOpacity={0.5}
                      stroke="#f97316"
                    />
                    <Area
                      type="monotone"
                      dataKey="VAT"
                      stackId="1"
                      fill="#eab308"
                      fillOpacity={0.4}
                      stroke="#eab308"
                    />
                    <Area
                      type="monotone"
                      dataKey="Corporation Tax"
                      stackId="1"
                      fill="#22d3ee"
                      fillOpacity={0.4}
                      stroke="#22d3ee"
                    />
                    <Area
                      type="monotone"
                      dataKey="Fuel Duty"
                      stackId="1"
                      fill="#a78bfa"
                      fillOpacity={0.3}
                      stroke="#a78bfa"
                    />
                    <Area
                      type="monotone"
                      dataKey="Other"
                      stackId="1"
                      fill="#6b7280"
                      fillOpacity={0.3}
                      stroke="#6b7280"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Debt interest over time */}
              <ChartCard
                label="Debt Servicing"
                title="Central Government Debt Interest"
                onShare={handleChartShare}
                shareHeadline="£100bn+ just on interest"
                shareSubline="The staggering cost of servicing Britain's debt"
              >
                <ResponsiveContainer
                  width="100%" height={260}
                >
                  <ComposedChart data={debtChart}>
                    <XAxis
                      dataKey="year"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        (v) => "£" + v + "bn"
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        (v) => v + "%"
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #333",
                        fontSize: 11
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="Net (OBR)"
                      fill="#ef4444"
                      fillOpacity={0.6}
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="Gross"
                      fill="#ef4444"
                      fillOpacity={0.25}
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="% GDP"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </ChartPair>

            <div id="debt-section" className="border-t border-gray-800/40 mt-10 pt-10">
              <SectionHeader
                label="Debt & Interest"
                title="What We Owe"
                accent="text-red-500"
              />
            </div>

            <ChartPair>
            {/* Receipts vs Expenditure */}
              <ChartCard
                label="Balance"
                title="Receipts vs Expenditure"
                onShare={handleChartShare}
                shareHeadline="Britain can't balance the books"
                shareSubline="Receipts vs expenditure — the deficit laid bare"
              >
                <ResponsiveContainer
                  width="100%" height={260}
                >
                  <AreaChart data={balanceChart}>
                    <XAxis
                      dataKey="year"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        (v) => "£" + v + "bn"
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #333",
                        fontSize: 11
                      }}
                      formatter={
                        (v) => [
                          "£" +
                          v.toFixed(1) + "bn",
                          undefined
                        ]
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="Receipts"
                      fill="#22d3ee"
                      fillOpacity={0.2}
                      stroke="#22d3ee"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Expenditure"
                      fill="#ef4444"
                      fillOpacity={0.2}
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                label="Burden"
                title="Tax Burden Over Time"
                onShare={handleChartShare}
                shareHeadline="Tax burden at a 70-year high"
                shareSubline="Receipts per capita and tax as % of GDP"
              >
                <ResponsiveContainer
                  width="100%" height={260}
                >
                  <ComposedChart
                    data={perCapChart}
                  >
                    <XAxis
                      dataKey="year"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        (v) => "£" +
                          (v / 1000).toFixed(0) +
                          "k"
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{
                        fontSize: 10,
                        fill: "#555"
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={
                        (v) => v + "%"
                      }
                      domain={[30, 45]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #333",
                        fontSize: 11
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey={
                        "Receipts per capita " +
                        "(£)"
                      }
                      fill="#22d3ee"
                      fillOpacity={0.4}
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Tax % GDP"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </ChartPair>

              {/* ── Credit Ratings ── */}
              <div className="border border-gray-800/40 p-5">
                <div className="text-[9px] uppercase tracking-[0.2em] text-gray-700 font-mono mb-4">Sovereign Credit Ratings</div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { agency: "S&P", ...giltYieldsData.creditRatings.sp },
                    { agency: "Moody's", ...giltYieldsData.creditRatings.moodys },
                    { agency: "Fitch", ...giltYieldsData.creditRatings.fitch }
                  ].map((r) => (
                    <div key={r.agency} className="text-center border border-gray-800/30 p-4">
                      <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">{r.agency}</div>
                      <div className="text-3xl font-black text-white mt-1">{r.rating}</div>
                      <div className={"text-[10px] font-mono mt-1 " + (r.outlook === "Stable" ? "text-emerald-500" : r.outlook === "Negative" ? "text-red-500" : "text-amber-400")}>{r.outlook}</div>
                      <div className="text-[9px] text-gray-700 font-mono mt-0.5">Since {r.lastChanged}</div>
                    </div>
                  ))}
                </div>
              </div>

            <ChartPair>
              {/* ── Gilt Yields ── */}
              <ChartCard chartId="gilt-yields" label="Bond Market" title="UK Gilt Yields by Maturity" explainData={giltYieldsData.monthly.slice(-6).map(d => `${d.m}: 2yr=${d["2yr"]}%, 10yr=${d["10yr"]}%, 30yr=${d["30yr"]}%`).join("; ")} onShare={handleChartShare} shareHeadline="Bond markets are screaming" shareSubline="UK gilt yields across the maturity curve">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={giltYieldsData.monthly}>
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} domain={[-0.5, 6]} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => [v.toFixed(2) + "%", undefined]} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <Line type="monotone" dataKey="y2" name="2-year" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="y5" name="5-year" stroke="#a78bfa" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="y10" name="10-year" stroke="#f97316" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="y30" name="30-year" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  {[{ k: "2yr", c: "#22d3ee" }, { k: "5yr", c: "#a78bfa" }, { k: "10yr", c: "#f97316" }, { k: "30yr", c: "#ef4444" }].map((l) => (
                    <span key={l.k} className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
                      <span className="w-3 h-0.5 inline-block" style={{ background: l.c }} /> {l.k}
                    </span>
                  ))}
                </div>
              </ChartCard>

              {/* ── Tax Burden as % GDP ── */}
              <ChartCard chartId="tax-burden" label="Tax Burden" title="Tax Receipts as % of GDP — Heading for Post-War High" explainData={giltYieldsData.taxBurden.data.map(d => `${d.year}: ${d.pct}%${d.type === "forecast" ? " (forecast)" : ""}`).join("; ") + ` | OECD avg: ${giltYieldsData.taxBurden.oecdAvg2024}%`} onShare={handleChartShare} shareHeadline="Highest tax burden since WWII" shareSubline="UK tax receipts heading for post-war record">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={giltYieldsData.taxBurden.data}>
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#555" }} axisLine={false} tickLine={false} interval={2} tickFormatter={(v) => v.replace(/(\d{4})-\d{2}/, "$1")} />
                    <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} domain={[30, 40]} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v, name) => [v.toFixed(1) + "%", name]} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    {/* OECD average reference line */}
                    <Area type="monotone" dataKey="pct" fill="none" stroke="none" />
                    <Bar dataKey="pct" name="UK Tax Burden" radius={[2, 2, 0, 0]}>
                      {giltYieldsData.taxBurden.data.map((d, i) => (
                        <Cell key={i} fill={d.type === "forecast" ? "#f97316" : "#ef4444"} fillOpacity={d.type === "forecast" ? 0.5 : 0.7} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey={() => giltYieldsData.taxBurden.oecdAvg2024} name="OECD Average" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2 text-[10px] font-mono text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 inline-block bg-red-500/70 rounded-sm" /> Actual</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 inline-block bg-orange-500/50 rounded-sm" /> OBR Forecast</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block border-t border-dashed border-cyan-400" /> OECD avg ({giltYieldsData.taxBurden.oecdAvg2024}%)</span>
                </div>
              </ChartCard>
            </ChartPair>

            <ChartPair>
              {/* ── Monthly Borrowing ── */}
              <ChartCard chartId="monthly-borrowing" label="Borrowing" title="Monthly Public Sector Net Borrowing" explainData={giltYieldsData.monthlyBorrowing.months.map((m, i) => `${m}: 2024-25 £${giltYieldsData.monthlyBorrowing.years["2024-25"][i]}bn, 2023-24 £${giltYieldsData.monthlyBorrowing.years["2023-24"][i]}bn`).join("; ")} onShare={handleChartShare} shareHeadline="Borrowing billions every month" shareSubline="Public sector net borrowing — month by month">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={giltYieldsData.monthlyBorrowing.months.map((m, i) => ({
                    month: m,
                    "2024-25": giltYieldsData.monthlyBorrowing.years["2024-25"][i],
                    "2023-24": giltYieldsData.monthlyBorrowing.years["2023-24"][i],
                    "2022-23": giltYieldsData.monthlyBorrowing.years["2022-23"][i]
                  }))}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => "£" + v + "bn"} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => ["£" + v.toFixed(1) + "bn", undefined]} />
                    <Bar dataKey="2022-23" fill="#6b7280" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="2023-24" fill="#a78bfa" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="2024-25" fill="#ef4444" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Income Tax Concentration ── */}
              <ChartCard chartId="income-tax-concentration" label="Who Pays" title="Income Tax Concentration — Who Really Pays" explainData={giltYieldsData.incomeTaxConcentration.groups.map(g => `${g.group}: ${g.pctOfTax}% of tax, ${g.pctOfIncome}% of income (${g.threshold})`).join("; ")} onShare={handleChartShare} shareHeadline="Top 1% pay 29% of all income tax" shareSubline="Who really pays Britain's tax bill">
                <div className="space-y-2 mt-2">
                  {giltYieldsData.incomeTaxConcentration.groups.map((g) => (
                    <div key={g.group} className="flex items-center gap-3">
                      <div className="w-24 text-[11px] font-mono text-gray-400 text-right">{g.group}</div>
                      <div className="flex-1 relative h-6 bg-gray-900 rounded-sm overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-red-500/70 rounded-sm" style={{ width: g.pctOfTax + "%" }} />
                        <div className="absolute inset-y-0 left-0 bg-cyan-400/30 rounded-sm" style={{ width: g.pctOfIncome + "%" }} />
                        <div className="absolute inset-y-0 right-2 flex items-center text-[10px] font-mono text-white font-bold">{g.pctOfTax}%</div>
                      </div>
                      <div className="w-20 text-[9px] font-mono text-gray-600">{g.threshold}</div>
                    </div>
                  ))}
                  <div className="flex justify-center gap-6 mt-3 text-[10px] font-mono text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 inline-block bg-red-500/70 rounded-sm" /> Share of tax paid</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 inline-block bg-cyan-400/30 rounded-sm" /> Share of income</span>
                  </div>
                </div>
              </ChartCard>
            </ChartPair>

            <ChartPair>
              {/* ── Debt Maturity Profile ── */}
              <ChartCard chartId="debt-maturity" label="Debt Structure" title="Government Debt Maturity Profile" explainData={giltYieldsData.debtMaturity.buckets.map(b => `${b.range}: conventional £${b.conventional}bn, index-linked £${b.indexLinked}bn`).join("; ") + ` | Total conventional £${giltYieldsData.debtMaturity.totalConventional}bn, index-linked £${giltYieldsData.debtMaturity.totalIndexLinked}bn (${giltYieldsData.debtMaturity.indexLinkedPct}%), avg maturity ${giltYieldsData.debtMaturity.avgMaturity}yrs`} onShare={handleChartShare} shareHeadline="£2 trillion in gilts — and counting" shareSubline="When Britain's debts come due">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={giltYieldsData.debtMaturity.buckets}>
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => "£" + v + "bn"} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => ["£" + v + "bn", undefined]} />
                    <Bar dataKey="conventional" name="Conventional Gilts" stackId="a" fill="#ef4444" fillOpacity={0.7} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="indexLinked" name="Index-Linked Gilts" stackId="a" fill="#f97316" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Conventional</div>
                    <div className="text-lg font-black text-white font-mono">£{giltYieldsData.debtMaturity.totalConventional}bn</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Index-Linked</div>
                    <div className="text-lg font-black text-orange-400 font-mono">£{giltYieldsData.debtMaturity.totalIndexLinked}bn</div>
                    <div className="text-[9px] text-gray-600 font-mono">{giltYieldsData.debtMaturity.indexLinkedPct}% of total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Avg Maturity</div>
                    <div className="text-lg font-black text-white font-mono">{giltYieldsData.debtMaturity.avgMaturity} yrs</div>
                  </div>
                </div>
              </ChartCard>

              {/* ── Tax Calculator ── */}
              <div className="border border-gray-800/40 p-5">
                <div className="text-[9px] uppercase tracking-[0.2em] text-gray-700 font-mono mb-2">Interactive</div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">Your Tax Contribution</h3>
                <div className="flex items-center gap-4 mb-6">
                  <label className="text-[11px] font-mono text-gray-500">Annual salary</label>
                  <div className="flex items-center border border-gray-700 bg-gray-900/50 px-3 py-2 flex-1 max-w-xs">
                    <span className="text-gray-500 font-mono text-sm mr-1">£</span>
                    <input
                      type="number"
                      value={taxCalcSalary}
                      onChange={(e) => setTaxCalcSalary(Math.max(0, Number(e.target.value)))}
                      className="bg-transparent text-white font-mono text-sm w-full outline-none"
                      step={1000}
                    />
                  </div>
                </div>
                {(() => {
                  const s = taxCalcSalary;
                  const bands = moneySupplyData.taxCalculator.bands;
                  let incomeTax = 0;
                  let ni = 0;
                  // Personal allowance taper
                  let pa = 12570;
                  if (s > 100000) pa = Math.max(0, 12570 - (s - 100000) * 0.5);
                  // Income tax
                  const taxable = Math.max(0, s - pa);
                  if (taxable > 0) {
                    const basic = Math.min(taxable, 50270 - 12570);
                    incomeTax += basic * 0.20;
                    const higher = Math.min(Math.max(0, taxable - (50270 - 12570)), 125140 - 50270);
                    incomeTax += higher * 0.40;
                    const additional = Math.max(0, taxable - (125140 - 12570));
                    incomeTax += additional * 0.45;
                  }
                  // NI
                  if (s > 12570) {
                    const niBasic = Math.min(s, 50270) - 12570;
                    ni += niBasic * 0.08;
                    if (s > 50270) ni += (s - 50270) * 0.02;
                  }
                  const totalTax = incomeTax + ni;
                  const takeHome = s - totalTax;
                  const effectiveRate = s > 0 ? (totalTax / s * 100) : 0;
                  // Where it goes (proportional to departmental spending)
                  const taxShare = [
                    { name: "NHS & Social Care", pct: 19.2, color: "#059669" },
                    { name: "Welfare & Pensions", pct: 25.6, color: "#ef4444" },
                    { name: "Education", pct: 11.4, color: "#1d4ed8" },
                    { name: "Debt Interest", pct: 7.3, color: "#d97706" },
                    { name: "Defence", pct: 6.1, color: "#78716c" },
                    { name: "Other", pct: 30.4, color: "#4b5563" }
                  ];
                  return (
                    <div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="border border-gray-800/40 p-3">
                          <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Income Tax</div>
                          <div className="text-xl font-black text-red-500 font-mono">£{Math.round(incomeTax).toLocaleString("en-GB")}</div>
                        </div>
                        <div className="border border-gray-800/40 p-3">
                          <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">National Insurance</div>
                          <div className="text-xl font-black text-amber-400 font-mono">£{Math.round(ni).toLocaleString("en-GB")}</div>
                        </div>
                        <div className="border border-gray-800/40 p-3">
                          <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Take Home</div>
                          <div className="text-xl font-black text-emerald-400 font-mono">£{Math.round(takeHome).toLocaleString("en-GB")}</div>
                        </div>
                        <div className="border border-gray-800/40 p-3">
                          <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Effective Rate</div>
                          <div className="text-xl font-black text-white font-mono">{effectiveRate.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-gray-700 font-mono mb-3">Where Your £{Math.round(totalTax).toLocaleString("en-GB")} Goes</div>
                      <div className="space-y-1.5">
                        {taxShare.map((t) => {
                          const amt = totalTax * t.pct / 100;
                          return (
                            <div key={t.name} className="flex items-center gap-3">
                              <div className="w-36 text-[11px] font-mono text-gray-400 text-right">{t.name}</div>
                              <div className="flex-1 relative h-5 bg-gray-900 rounded-sm overflow-hidden">
                                <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: t.pct + "%", background: t.color, opacity: 0.7 }} />
                              </div>
                              <div className="w-20 text-[10px] font-mono text-gray-500 text-right">£{Math.round(amt).toLocaleString("en-GB")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </ChartPair>

            <Divider />

            {/* Methodology / Sources */}
            <div className={
              "border border-gray-800/40 p-6"
            }>
              <div className={
                "text-[9px] uppercase " +
                "tracking-[0.2em] " +
                "text-gray-700 font-mono mb-3"
              }>
                Sources & Methodology
              </div>
              <div className={
                "space-y-3 text-[12px] " +
                "text-gray-500 font-mono " +
                "leading-relaxed"
              }>
                <p>
                  <span className="text-gray-400">
                    Tax receipts:
                  </span>
                  {" "}HMRC Tax Receipts and NICs
                  Annual Bulletin. Covers
                  HMRC-administered taxes only.
                  Does not include council tax,
                  business rates, or other
                  non-HMRC revenues.
                </p>
                <p>
                  <span className="text-gray-400">
                    Debt interest:
                  </span>
                  {" "}OBR net measure (central
                  government, net of APF) and
                  gross measure (including
                  index-linked gilt uplift).
                  Gross figure in 2024-25 was
                  {" "}{"£"}106bn vs net
                  {" "}{"£"}84.8bn. Difference
                  is treatment of RPI-linked
                  capital uplift.
                </p>
                <p>
                  <span className="text-gray-400">
                    Public finances:
                  </span>
                  {" "}ONS public sector current
                  receipts and total managed
                  expenditure.
                  ONS receipts ({"£"}1,139bn)
                  are broader than HMRC receipts
                  ({"£"}858.6bn) by ~{"£"}
                  280bn, covering council tax,
                  business rates, and other
                  income.
                </p>
                <p>
                  <span className="text-gray-400">
                    GDP:
                  </span>
                  {" "}ONS nominal GDP estimates.
                  {" "}
                  <span className="text-gray-400">
                    Population:
                  </span>
                  {" "}ONS mid-year estimates.
                </p>
                <p className={
                  "text-gray-700 text-[10px]"
                }>
                  All figures financial year
                  basis. Derived metrics
                  (per capita, % GDP, %
                  receipts) calculated from
                  underlying sourced series.
                  Last verified March 2026.
                </p>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ============ SUPPLIERS: PROCUREMENT SCRUTINY ============ */}

        {/* ============ ECONOMY: LANDING PAGE ============ */}

        {/* ============ ECONOMY: ECONOMIC OUTPUT ============ */}
        {view === "economy.output" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Economic Output
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                Economic Output
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                GDP growth, productivity, employment and business investment
                across the UK economy.
              </p>
            </div>

            <TimeRangeControl range={econRange} setRange={setEconRange} />

            {/* Headline stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={TrendingUp}
                label="GDP (nominal)"
                value={
                  "£" + (econOutputData.headline.gdpBnGbp / 1000)
                    .toFixed(2) + "tn"
                }
                sub={
                  "QoQ " +
                  (econOutputData.headline.gdpGrowthQoQ > 0 ? "+" : "") +
                  econOutputData.headline.gdpGrowthQoQ + "%"
                }
              />
              <StatCard
                icon={TrendingUp}
                label="GDP Growth (YoY)"
                value={
                  (econOutputData.headline.gdpGrowthYoY > 0 ? "+" : "") +
                  econOutputData.headline.gdpGrowthYoY + "%"
                }
                accent={
                  econOutputData.headline.gdpGrowthYoY >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              />
              <StatCard
                icon={Factory}
                label="Manufacturing PMI"
                value={econOutputData.headline.mfgPmi}
                sub="50+ = expansion"
                accent={
                  econOutputData.headline.mfgPmi >= 50
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              />
              <StatCard
                icon={Users}
                label="Unemployment"
                value={econOutputData.headline.unemploymentPct + "%"}
                accent="text-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={PoundSterling}
                label="GDP per Capita (PPP)"
                value={"$" + econOutputData.headline.gdpPerCapitaPPP
                  .toLocaleString()}
                sub="Current intl $"
              />
              <StatCard
                icon={Briefcase}
                label="Services PMI"
                value={econOutputData.headline.svcPmi}
                sub="50+ = expansion"
                accent={
                  econOutputData.headline.svcPmi >= 50
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              />
              <StatCard
                icon={TrendingUp}
                label="Business Investment"
                value={
                  "+" + econOutputData.headline
                    .businessInvestGrowthPct + "%"
                }
                sub="YoY growth"
                accent="text-emerald-400"
              />
              <StatCard
                icon={AlertTriangle}
                label="Productivity (YoY)"
                value={
                  (econOutputData.headline.productivityYoYPct > 0
                    ? "+" : "") +
                  econOutputData.headline.productivityYoYPct + "%"
                }
                accent={
                  econOutputData.headline.productivityYoYPct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              />
            </div>

            {/* GDP quarterly growth */}
            <ChartCard
            chartId="gdp-growth"
            title="GDP Quarterly Growth (%, Q-on-Q)"
            info="Quarter-on-quarter real GDP growth. Negative values indicate economic contraction. Source: ONS."
            editorial="Growth has been anaemic since 2008. The UK has had the weakest recovery of any major economy after the financial crisis."
            shareHeadline="A lost decade of growth"
            shareSubline="FLATLINED SINCE 2008."
            accentColor="#ef4444"
            shareData={filterByRange(econOutputData.gdpGrowthQuarterly, "q",
                    econRange).map(d => d.v)}
            onShare={handleChartShare}
            explainData={filterByRange(econOutputData.gdpGrowthQuarterly, "q", econRange).slice(-8).map(d => `${d.q}: ${d.v > 0 ? "+" : ""}${d.v}%`).join("; ")}>
              <ChartMeta
                metric="GDP Quarterly Growth"
                geo="UK"
                unit="%"
                data={filterByRange(econOutputData.gdpGrowthQuarterly, "q", econRange)}
                dateKey="q"
                source="ONS"
                freq="quarterly"
                fullData={econOutputData.gdpGrowthQuarterly}
              />
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={filterByRange(econOutputData.gdpGrowthQuarterly, "q",
                    econRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="q"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={3}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.q}
                            </div>
                            <div className="text-white font-medium">
                              {d.v > 0 ? "+" : ""}{d.v}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                    {econOutputData.gdpGrowthQuarterly.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.v >= 0 ? "#10b981" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* GDP per capita comparison */}
            <ChartCard
              title={"GDP per Capita (PPP, current intl $) \u2014 UK vs France vs Germany"} onShare={handleChartShare} shareHeadline="Britain is getting poorer" shareSubline="GDP per capita — how the UK compares">
              <ChartMeta
                metric="GDP per Capita"
                geo="UK / France / Germany"
                unit="$ current intl"
                data={filterByRange(econOutputData.gdpPerCapita.data, "year",
                  econRange)}
                dateKey="year"
                source="IMF World Economic Outlook"
                freq="annual"
                fullData={econOutputData.gdpPerCapita.data}
              />
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={filterByRange(econOutputData.gdpPerCapita.data, "year",
                    econRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) =>
                      "$" + (v / 1000).toFixed(0) + "k"
                    }
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.year}
                            </div>
                            <div className="text-gray-300">
                              UK: ${d.UK?.toLocaleString()}
                            </div>
                            <div className="text-emerald-400">
                              France: ${d.France?.toLocaleString()}
                            </div>
                            <div className="text-amber-400">
                              Germany: ${d.Germany?.toLocaleString()}
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="UK"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="France"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Germany"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block" />
                  UK
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  France
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                  Germany
                </span>
              </div>
            </ChartCard>

            {/* PMI trend */}
            <ChartPair>
            <ChartCard
            title="PMI Trends (Manufacturing & Services)"
            info="Purchasing Managers' Index measuring manufacturing and services sector activity. Values above 50 indicate expansion, below 50 contraction."
            editorial="UK manufacturing has been stalled for years, stuck in contraction territory. Services are holding it together, but barely."
            shareHeadline="UK manufacturing in the doldrums"
            shareSubline="PMI STUCK BELOW 50."
            accentColor="#EF4444"
            shareData={filterByRange(econOutputData.pmi.data, "m",
                  econRange).map(d => d.mfg)}
            onShare={handleChartShare}>
              <ChartMeta
                metric="PMI Index"
                geo="UK"
                unit="50+ expansion"
                data={filterByRange(econOutputData.pmi.data, "m", econRange)}
                dateKey="m"
                source="S&P Global PMI"
                freq="monthly"
                fullData={econOutputData.pmi.data}
              />
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filterByRange(econOutputData.pmi.data, "m",
                  econRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="m"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={2}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={[42, 58]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.m}
                            </div>
                            <div className="text-gray-300">
                              Manufacturing: {d.mfg}
                            </div>
                            <div className="text-purple-400">
                              Services: {d.svc}
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  {/* 50 threshold line */}
                  <Line
                    type="monotone"
                    dataKey={() => 50}
                    stroke="#6b728080"
                    strokeWidth={1}
                    strokeDasharray="6 3"
                    dot={false}
                    name="threshold"
                  />
                  <Line
                    type="monotone"
                    dataKey="mfg"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Manufacturing"
                  />
                  <Line
                    type="monotone"
                    dataKey="svc"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Services"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block" />
                  Manufacturing
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-purple-500 inline-block" />
                  Services
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-gray-600 inline-block" />
                  50 threshold
                </span>
              </div>
            </ChartCard>

            {/* Unemployment */}
            <ChartCard
            title="Unemployment Rate (%)"
            info="ILO unemployment rate (16+). Source: ONS Labour Force Survey."
            editorial="Low headline unemployment masks a deeper problem: rising economic inactivity. Millions have dropped out of the labour force entirely."
            shareHeadline="Low unemployment hides the real crisis"
            shareSubline="MILLIONS NOT EVEN LOOKING FOR WORK."
            accentColor="#f59e0b"
            shareData={filterByRange(econOutputData.unemployment.data, "year",
                    econRange).map(d => d.v)}
            onShare={handleChartShare}>
              <ChartMeta
                metric="Unemployment Rate"
                geo="UK"
                unit="%"
                data={filterByRange(econOutputData.unemployment.data, "year",
                  econRange)}
                dateKey="year"
                source="ONS Labour Force Survey"
                freq="annual"
                fullData={econOutputData.unemployment.data}
              />
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart
                  data={filterByRange(econOutputData.unemployment.data, "year",
                    econRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={[3, 6]}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.year}
                            </div>
                            <div className="text-white font-medium">
                              {d.v}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#ef4444"
                    fill="#ef444420"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            </ChartPair>
            {/* Productivity comparison */}
            <ChartPair>
            <ChartCard
            title="Productivity (Output per Hour, 2015 = 100)"
            info="Real output per hour worked, indexed to 2015. The UK\\'s persistent productivity gap vs peers. Source: ONS."
            editorial="UK productivity has barely grown in 15 years. This is the single biggest reason wages haven\\'t risen and living standards have stagnated."
            shareHeadline="Productivity growth has collapsed"
            shareSubline="THE ROOT OF EVERY OTHER PROBLEM."
            accentColor="#ef4444"
            shareData={filterByRange(econOutputData.productivity.data, "year",
                    econRange).map(d => d.UK)}
            onShare={handleChartShare}>
              <ChartMeta
                metric="Productivity Index"
                geo="UK"
                unit="index 2015=100"
                data={filterByRange(econOutputData.productivity.data, "year",
                  econRange)}
                dateKey="year"
                source="ONS Productivity Measures"
                freq="annual"
                fullData={econOutputData.productivity.data}
              />
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={filterByRange(econOutputData.productivity.data, "year",
                    econRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={[98, 106]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.year}
                            </div>
                            <div className="text-gray-300">
                              UK: {d.UK}
                            </div>
                            <div className="text-emerald-400">
                              France: {d.France}
                            </div>
                            <div className="text-amber-400">
                              Germany: {d.Germany}
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="UK"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="France"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Germany"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block" />
                  UK
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  France
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                  Germany
                </span>
              </div>
            </ChartCard>

            {/* Business investment */}
            <ChartCard
            title="Gross Fixed Capital Formation (% of GDP)"
            info="Business and government investment as a share of GDP. A key driver of future productivity. Source: OECD."
            editorial="The UK invests less than almost every other G7 nation. Decades of under-investment have left crumbling infrastructure and weak productivity."
            shareHeadline="Britain doesn\\'t invest in its future"
            shareSubline="BOTTOM OF THE G7."
            accentColor="#ef4444"
            shareData={filterByRange(econOutputData.businessInvestment.data,
                    "year", econRange).map(d => d.UK)}
            onShare={handleChartShare}>
              <ChartMeta
                metric="Business Investment"
                geo="UK"
                unit="% of GDP"
                data={filterByRange(econOutputData.businessInvestment.data,
                  "year", econRange)}
                dateKey="year"
                source="ONS National Accounts"
                freq="annual"
                fullData={econOutputData.businessInvestment.data}
              />
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={filterByRange(econOutputData.businessInvestment.data,
                    "year", econRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={[15, 25]}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.year}
                            </div>
                            <div className="text-gray-300">
                              UK: {d.UK}%
                            </div>
                            <div className="text-emerald-400">
                              France: {d.France}%
                            </div>
                            <div className="text-amber-400">
                              Germany: {d.Germany}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="UK"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="France"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Germany"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block" />
                  UK
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  France
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                  Germany
                </span>
              </div>
            </ChartCard>

            </ChartPair>

            <Divider />

            {/* ── M4 Money Supply ── */}
            <ChartCard chartId="m4-money-supply" label="Money Supply" title="M4 Broad Money Supply" explainData={moneySupplyData.m4MoneySupply.data.slice(-6).map(d => `${d.m}: £${(d.level / 1000).toFixed(2)}tn (YoY ${d.yoyPct}%)`).join("; ")} onShare={handleChartShare} shareHeadline="The money printer went brrr" shareSubline="M4 broad money supply — how much cash is in the system">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={moneySupplyData.m4MoneySupply.data}>
                  <XAxis dataKey="m" tick={{ fontSize: 9, fill: "#555" }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => "£" + (v / 1000).toFixed(1) + "tn"} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <Area yAxisId="left" type="monotone" dataKey="level" name="M4 (£bn)" fill="#22d3ee" fillOpacity={0.15} stroke="#22d3ee" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="yoyPct" name="YoY Growth %" stroke="#f97316" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-[10px] font-mono text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block bg-cyan-400" /> M4 Level</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block bg-orange-500" /> YoY Growth</span>
              </div>
            </ChartCard>

            {/* ── QE Timeline ── */}
            <div className="border border-gray-800/40 p-5">
              <div className="text-[9px] uppercase tracking-[0.2em] text-gray-700 font-mono mb-2">Bank of England</div>
              <h3 className="text-base font-black uppercase tracking-tight mb-4">Quantitative Easing Timeline</h3>
              <div className="space-y-2">
                {moneySupplyData.qeTimeline.phases.map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-40 text-[11px] font-mono text-gray-400 text-right">{p.name}</div>
                    <div className="flex-1 relative h-6 bg-gray-900 rounded-sm overflow-hidden">
                      <div className={"absolute inset-y-0 left-0 rounded-sm " + (p.purchased < 0 ? "bg-emerald-500/50" : "bg-red-500/60")} style={{ width: Math.abs(p.purchased) / 10 + "%" }} />
                    </div>
                    <div className={"w-20 text-[11px] font-mono text-right font-bold " + (p.purchased < 0 ? "text-emerald-400" : "text-red-400")}>
                      {p.purchased > 0 ? "+" : ""}{p.purchased > 0 ? "£" + p.purchased + "bn" : "-£" + Math.abs(p.purchased) + "bn"}
                    </div>
                    <div className="w-20 text-[10px] font-mono text-gray-600 text-right">= £{p.cumulative}bn</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-gray-800/40">
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Peak Holdings</div>
                  <div className="text-lg font-black text-red-400 font-mono">£{moneySupplyData.qeTimeline.peakHoldings}bn</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Current Holdings</div>
                  <div className="text-lg font-black text-white font-mono">£{moneySupplyData.qeTimeline.currentHoldings}bn</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Peak % GDP</div>
                  <div className="text-lg font-black text-amber-400 font-mono">{moneySupplyData.qeTimeline.peakPctGDP}%</div>
                </div>
              </div>
            </div>

            <div className="text-gray-600 text-xs px-1">
              Sources: ONS National Accounts; S&P Global /
              CIPS PMI; ONS Labour Force Survey; OECD
              Productivity Statistics; World Bank; ONS Gross
              Fixed Capital Formation; Bank of England
              Statistical Interactive Database; Bank of England
              Asset Purchase Facility quarterly reports.
            </div>
          </div>
        )}

        {/* ============ ECONOMY: COST OF LIVING ============ */}
        {view === "economy.costOfLiving" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Cost of Living
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                Cost of Living
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                Inflation, wages, housing, energy and everyday costs facing UK
                households.
              </p>
            </div>

            <TimeRangeControl range={colRange} setRange={setColRange} />

            {/* Headline stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                icon={TrendingUp}
                label="CPI Inflation"
                value={costOfLivingData.headline.cpiPct + "%"}
                sub="Year-on-year"
                accent="text-red-400"
              />
              <StatCard
                icon={PoundSterling}
                label="Real Wage Growth"
                value={
                  (costOfLivingData.headline.realWageGrowthPct > 0
                    ? "+" : "") +
                  costOfLivingData.headline.realWageGrowthPct + "%"
                }
                sub="Nominal minus CPI"
                accent={
                  costOfLivingData.headline.realWageGrowthPct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              />
              <StatCard
                icon={Building2}
                label="Avg Rent (UK)"
                value={
                  "£" + costOfLivingData.headline.avgRentGbp
                    .toLocaleString() + "/mo"
                }
                sub="Private rental"
              />
              <StatCard
                icon={AlertTriangle}
                label="Energy Price Cap"
                value={
                  "£" + costOfLivingData.headline.energyCapGbp
                    .toLocaleString() + "/yr"
                }
                sub="Ofgem typical dual-fuel"
                accent="text-amber-400"
              />
              <StatCard
                icon={PoundSterling}
                label="Food Inflation"
                value={costOfLivingData.headline.foodInflationPct + "%"}
                sub="CPI food & non-alcoholic"
                accent="text-orange-400"
              />
              <StatCard
                icon={MapPin}
                label="Petrol"
                value={
                  costOfLivingData.headline.petrolPenceLitre + "p"
                }
                sub={"Current retail · diesel " +
                  costOfLivingData.headline.dieselPenceLitre + "p"}
              />
            </div>

            {/* CPI Inflation trend */}
              <ChartPair>
              <ChartCard
            title="CPI Inflation (% YoY)"
            info="Consumer Price Index annual change over time. Source: ONS CPI time series."
            editorial="Inflation hit 11.1% in October 2022 — the highest in 41 years. The Bank of England was too slow to act, and ordinary people paid the price."
            shareHeadline="Inflation hit 41-year high"
            shareSubline="11.1% IN OCTOBER 2022."
            accentColor="#ef4444"
            shareData={filterByRange(costOfLivingData.cpiInflation.data, "m",
                    colRange).map(d => d.v)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="CPI Inflation"
                  geo="UK"
                  unit="%"
                  data={filterByRange(costOfLivingData.cpiInflation.data, "m",
                    colRange)}
                  dateKey="m"
                  source="ONS Consumer Price Index"
                  freq="monthly"
                  fullData={costOfLivingData.cpiInflation.data}
                />
                <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={filterByRange(costOfLivingData.cpiInflation.data, "m",
                    colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="m"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={4}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.m}
                            </div>
                            <div className="text-white font-medium">
                              {d.v}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#ef4444"
                    fill="#ef444420"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Nominal vs Real wage growth */}
            <ChartCard
            title="Wage Growth: Nominal vs Real"
            info="Nominal wages vs real wages adjusted for inflation. The gap shows purchasing power loss."
            editorial="Nominal wages creeping up, but real wages tell the brutal truth—workers are getting poorer. The inflation gap is devastating."
            shareHeadline="Workers getting poorer despite higher nominal wages"
            shareSubline="REAL WAGES LAGGING INFLATION."
            accentColor="#DC2626"
            shareData={filterByRange(costOfLivingData.realWageGrowth.data, "m",
                    colRange).map(d => d.nominal)}
            onShare={handleChartShare}>
              <ChartMeta
                metric="Wage Growth"
                geo="UK"
                unit="%"
                data={filterByRange(costOfLivingData.realWageGrowth.data, "m",
                  colRange)}
                dateKey="m"
                source="ONS Average Earnings"
                freq="monthly"
                fullData={costOfLivingData.realWageGrowth.data}
              />
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={filterByRange(costOfLivingData.realWageGrowth.data, "m",
                    colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="m"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={2}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.m}
                            </div>
                            <div className="text-gray-300">
                              Nominal: {d.nominal > 0 ? "+" : ""}
                              {d.nominal}%
                            </div>
                            <div className={
                              d.real >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }>
                              Real: {d.real > 0 ? "+" : ""}{d.real}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  {/* zero line */}
                  <Line
                    type="monotone"
                    dataKey={() => 0}
                    stroke="#6b728080"
                    strokeWidth={1}
                    strokeDasharray="6 3"
                    dot={false}
                    name="zero"
                  />
                  <Line
                    type="monotone"
                    dataKey="nominal"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Nominal"
                  />
                  <Line
                    type="monotone"
                    dataKey="real"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Real"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block" />
                  Nominal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  Real (inflation-adjusted)
                </span>
              </div>
            </ChartCard>

              </ChartPair>
              {/* Rent: UK vs London */}
              <ChartPair>
              <ChartCard
            title="Average Monthly Rent (£)"
            info="Average advertised rent for new tenancies. Source: ONS Index of Private Housing Rental Prices."
            editorial="Rents have surged 30%+ since 2019 in many areas. For a generation of renters, home ownership is a fantasy and renting is barely affordable."
            shareHeadline="Rents have surged 30% in five years"
            shareSubline="A GENERATION PRICED OUT."
            accentColor="#ef4444"
            shareData={filterByRange(costOfLivingData.housing.avgRent.data,
                    "year", colRange).map(d => d.UK)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Average Rent"
                  geo="UK"
                  unit="£/month"
                  data={filterByRange(costOfLivingData.housing.avgRent.data,
                    "year", colRange)}
                  dateKey="year"
                  source="Rightmove / ONS"
                  freq="annual"
                  fullData={costOfLivingData.housing.avgRent.data}
                />
                <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={filterByRange(costOfLivingData.housing.avgRent.data,
                    "year", colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => "£" + v}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.year}
                            </div>
                            <div className="text-gray-300">
                              UK avg: {"£"}{d.UK?.toLocaleString()}
                            </div>
                            <div className="text-purple-400">
                              London: {"£"}{d.London?.toLocaleString()}
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="UK"
                    fill="#3b82f6"
                    radius={[3, 3, 0, 0]}
                    name="UK average"
                  />
                  <Bar
                    dataKey="London"
                    fill="#a855f7"
                    radius={[3, 3, 0, 0]}
                    name="London"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" />
                  UK average
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-purple-500 rounded-sm inline-block" />
                  London
                </span>
              </div>
            </ChartCard>

            {/* Energy price cap */}
            <ChartCard
            title="Ofgem Energy Price Cap (£/year, typical dual-fuel)"
            info="Ofgem's regulated energy price cap for typical dual-fuel (gas and electricity) household bills per year."
            editorial="Energy bills have surged to catastrophic levels. Households are squeezed as the price cap keeps climbing."
            shareHeadline="Energy bills at breaking point"
            shareSubline="£1,700+ PER YEAR."
            accentColor="#DC2626"
            shareData={filterByRange(costOfLivingData.energy.priceCap.data, "q",
                    colRange).map(d => d.v)}
            onShare={handleChartShare}>
              <ChartMeta
                metric="Energy Price Cap"
                geo="UK"
                unit="£/year"
                data={filterByRange(costOfLivingData.energy.priceCap.data, "q",
                  colRange)}
                dateKey="q"
                source="Ofgem"
                freq="quarterly"
                fullData={costOfLivingData.energy.priceCap.data}
              />
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={filterByRange(costOfLivingData.energy.priceCap.data, "q",
                    colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="q"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={3}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => "£" + v}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.q}
                            </div>
                            <div className="text-white font-medium">
                              {"£"}{d.v.toLocaleString()}/yr
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#f59e0b"
                    fill="#f59e0b20"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

              </ChartPair>
              {/* Food inflation */}
              <ChartPair>
              <ChartCard
            title="Food Inflation (% YoY)"
            info="Year-on-year percentage change in food and non-alcoholic beverage prices."
            editorial="Food prices have exploded. People are choosing between eating and heating. This is a genuine cost-of-living crisis."
            shareHeadline="Food prices spiralling out of control"
            shareSubline="10%+ ANNUAL INCREASES."
            accentColor="#EF4444"
            shareData={filterByRange(costOfLivingData.food.inflation.data, "m",
                    colRange).map(d => d.v)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Food Inflation"
                  geo="UK"
                  unit="%"
                  data={filterByRange(costOfLivingData.food.inflation.data, "m",
                    colRange)}
                  dateKey="m"
                  source="ONS CPI Food & Non-Alcoholic"
                  freq="monthly"
                  fullData={costOfLivingData.food.inflation.data}
                />
                <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={filterByRange(costOfLivingData.food.inflation.data, "m",
                    colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="m"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={2}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.m}
                            </div>
                            <div className="text-white font-medium">
                              {d.v}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#f97316"
                    fill="#f9731620"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Grocery basket breakdown */}
            <ChartCard
            title="Monthly Grocery Spend by Category (£)"
            info="Average monthly household grocery spending broken down by food category."
            editorial="Households are spending enormous sums on basics. Every shopping trip hits harder as prices stay elevated."
            shareHeadline="Grocery bills eating household budgets"
            shareSubline="£400+ MONTHLY AVERAGE."
            accentColor="#F97316"
            shareData={costOfLivingData.food.basketItems.data.map(d => d.v2023)}
            onShare={handleChartShare}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={costOfLivingData.food.basketItems.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="item"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => "£" + v}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.item}
                            </div>
                            <div className="text-gray-300">
                              2023: {"£"}{d.v2023}
                            </div>
                            <div className="text-white font-medium">
                              2025: {"£"}{d.v2025}
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="v2023"
                    fill="#6b7280"
                    radius={[3, 3, 0, 0]}
                    name="2023"
                  />
                  <Bar
                    dataKey="v2025"
                    fill="#f97316"
                    radius={[3, 3, 0, 0]}
                    name="2025"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-gray-500 rounded-sm inline-block" />
                  2023
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-orange-500 rounded-sm inline-block" />
                  2025
                </span>
              </div>
            </ChartCard>

              </ChartPair>
              {/* ---- Current fuel prices banner ---- */}
              <div className={
                "border border-gray-800/60 bg-gray-950/40 " +
                "px-5 py-4 mb-2"
              }>
                <div className={
                  "text-[9px] uppercase tracking-[0.2em] " +
                  "text-gray-600 font-mono mb-3"
                }>
                  Current UK Retail Prices &middot;{" "}
                  {costOfLivingData.transport.currentPrice
                    .lastUpdated}
                </div>
                <div className={
                  "grid grid-cols-2 gap-6"
                }>
                  <div>
                    <div className={
                      "text-[10px] uppercase tracking-wider " +
                      "text-gray-500 mb-1"
                    }>
                      Unleaded Petrol
                    </div>
                    <div className={
                      "text-3xl font-black text-white " +
                      "tracking-tight font-mono"
                    }>
                      {costOfLivingData.transport.currentPrice
                        .petrolPence}
                      <span className={
                        "text-base font-medium text-gray-500 ml-1"
                      }>
                        p/litre
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className={
                      "text-[10px] uppercase tracking-wider " +
                      "text-gray-500 mb-1"
                    }>
                      Diesel
                    </div>
                    <div className={
                      "text-3xl font-black text-white " +
                      "tracking-tight font-mono"
                    }>
                      {costOfLivingData.transport.currentPrice
                        .dieselPence}
                      <span className={
                        "text-base font-medium text-gray-500 ml-1"
                      }>
                        p/litre
                      </span>
                    </div>
                  </div>
                </div>
                <div className={
                  "text-[9px] text-gray-600 mt-3 " +
                  "border-t border-gray-800/40 pt-2"
                }>
                  Source:{" "}
                  {costOfLivingData.transport.currentPrice
                    .sourceName}.{" "}
                  {costOfLivingData.transport.currentPrice
                    .methodologyNote}
                </div>
              </div>

              {/* Petrol + Diesel dual trend chart */}
              <ChartPair>
              <ChartCard
            title="Petrol Price (Pence/Litre, Unleaded)"
            info={costOfLivingData.transport.petrol.methodologyNote}
            editorial="Petrol surged 12p in March alone as geopolitical shock hit supply lines. Commuters are paying the price at the pump."
            shareHeadline="Petrol surges past 150p"
            shareSubline={"NOW " + costOfLivingData.transport.currentPrice.petrolPence + "P/LITRE."}
            accentColor="#F97316"
            shareData={filterByRange(costOfLivingData.transport.petrol.data,
                    "m", colRange).map(d => d.v)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Petrol Price"
                  geo="UK"
                  unit="p/litre"
                  data={filterByRange(costOfLivingData.transport.petrol.data, "m",
                    colRange)}
                  dateKey="m"
                  source="DESNZ Weekly Road Fuel Prices"
                  freq="weekly"
                  fullData={costOfLivingData.transport.petrol.data}
                />
                <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={filterByRange(costOfLivingData.transport.petrol.data,
                    "m", colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="m"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={Math.max(1, Math.floor(
                      filterByRange(costOfLivingData.transport.petrol.data,
                        "m", colRange).length / 8
                    ))}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "p"}
                    domain={["dataMin - 5", "dataMax + 5"]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.m}
                              {d.freq === "weekly"
                                ? " (weekly avg)"
                                : " (monthly avg)"}
                            </div>
                            <div className="text-white font-medium">
                              {d.v}p/litre
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="#ef4444"
                    fillOpacity={0.08}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
            title="Diesel Price (Pence/Litre)"
            info={costOfLivingData.transport.diesel.methodologyNote}
            editorial="Diesel spiked 25p in three weeks — the sharpest move since the 2022 energy crisis. Haulage, logistics, and food costs will follow."
            shareHeadline="Diesel hits crisis levels"
            shareSubline={"NOW " + costOfLivingData.transport.currentPrice.dieselPence + "P/LITRE."}
            accentColor="#8B5CF6"
            shareData={filterByRange(costOfLivingData.transport.diesel.data,
                    "m", colRange).map(d => d.v)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Diesel Price"
                  geo="UK"
                  unit="p/litre"
                  data={filterByRange(costOfLivingData.transport.diesel.data, "m",
                    colRange)}
                  dateKey="m"
                  source="DESNZ Weekly Road Fuel Prices"
                  freq="weekly"
                  fullData={costOfLivingData.transport.diesel.data}
                />
                <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={filterByRange(costOfLivingData.transport.diesel.data,
                    "m", colRange)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="m"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    interval={Math.max(1, Math.floor(
                      filterByRange(costOfLivingData.transport.diesel.data,
                        "m", colRange).length / 8
                    ))}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "p"}
                    domain={["dataMin - 5", "dataMax + 5"]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div>
                            <div className="text-gray-400 text-xs">
                              {d.m}
                              {d.freq === "weekly"
                                ? " (weekly avg)"
                                : " (monthly avg)"}
                            </div>
                            <div className="text-white font-medium">
                              {d.v}p/litre
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="#8b5cf6"
                    fillOpacity={0.08}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Household basket comparison */}
            <ChartCard
            title="Monthly Household Costs: UK Average vs London (£)"
            info="Average monthly household living costs including rent, utilities, food, and transport. Compares UK average to London."
            editorial="London households are in a different financial universe—costs are nearly double the national average. Both are unsustainable."
            shareHeadline="London households spending double the UK average"
            shareSubline="LONDON PREMIUM: 80%+."
            accentColor="#DC2626"
            shareData={costOfLivingData.householdBasket.data.map(d => d.ukAvg)}
            onShare={handleChartShare}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={costOfLivingData.householdBasket.data}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => "£" + v}
                  />
                  <YAxis
                    dataKey="cat"
                    type="category"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    width={120}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(d) => (
                          <div className="space-y-1">
                            <div className="text-gray-400 text-xs">
                              {d.cat}
                            </div>
                            <div className="text-gray-300">
                              UK avg: {"£"}{d.ukAvg?.toLocaleString()}
                            </div>
                            <div className="text-purple-400">
                              London: {"£"}{d.london?.toLocaleString()}
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="ukAvg"
                    fill="#3b82f6"
                    radius={[0, 3, 3, 0]}
                    name="UK average"
                  />
                  <Bar
                    dataKey="london"
                    fill="#a855f7"
                    radius={[0, 3, 3, 0]}
                    name="London"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" />
                  UK average
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-purple-500 rounded-sm inline-block" />
                  London
                </span>
              </div>
            </ChartCard>

              </ChartPair>
              <div className="text-gray-600 text-xs px-1">
              Sources: ONS Consumer Prices Index; ONS Average
              Weekly Earnings; ONS Index of Private Housing
              Rental Prices; Rightmove; ONS House Price Index;
              Ofgem; DESNZ Energy Statistics; ONS Family
              Spending Survey; Kantar Worldpanel; RAC Fuel
              Watch; DfT; ORR.
            </div>
          </div>
        )}

        {/* ============ ECONOMY: PRODUCTION VS IMPORTS ============ */}
        {view === "economy.production" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                Critical Industries
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                Domestic Production vs Imports
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                UK import dependency across critical industries, with France
                & Germany comparisons. Source-backed, factual data.
              </p>
            </div>

            <TimeRangeControl range={prodRange} setRange={setProdRange} />

            {/* Import dependency comparison */}
            <ChartCard
            title="Import Dependency by Industry (%)"
            info="Share of domestic demand met by imports. Higher = more dependent on foreign supply. Source: ONS Supply and Use tables."
            editorial="The UK can\\'t feed itself, can\\'t build with its own steel, and can\\'t power itself independently. Strategic vulnerability is baked in."
            shareHeadline="Britain can\\'t build or feed itself"
            shareSubline="DANGEROUSLY DEPENDENT ON IMPORTS."
            accentColor="#ef4444"
            shareData={prodImportsData.comparison
                      .importDependency.data.map(d => d.UK)}
            onShare={handleChartShare}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={
                    prodImportsData.comparison
                      .importDependency.data
                  }
                  margin={{
                    left: 10,
                    right: 20,
                    top: 5,
                    bottom: 5
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1f2937"
                  />
                  <XAxis
                    dataKey="industry"
                    tick={{
                      fill: "#9ca3af",
                      fontSize: 11
                    }}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{
                      fill: "#6b7280",
                      fontSize: 11
                    }}
                    tickFormatter={(v) =>
                      v + "%"
                    }
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#030712",
                      border: "1px solid #1f2937",
                      borderRadius: 4
                    }}
                    formatter={(v) => [
                      v + "%",
                      ""
                    ]}
                  />
                  <Bar
                    dataKey="UK"
                    fill="#ef4444"
                    fillOpacity={0.8}
                    barSize={16}
                  />
                  <Bar
                    dataKey="France"
                    fill="#3b82f6"
                    fillOpacity={0.7}
                    barSize={16}
                  />
                  <Bar
                    dataKey="Germany"
                    fill="#f59e0b"
                    fillOpacity={0.7}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 inline-block bg-red-500/80" />
                  UK
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 inline-block bg-blue-500/70" />
                  France
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 inline-block bg-amber-500/70" />
                  Germany
                </span>
              </div>
            </ChartCard>

            {/* Time series */}
              <ChartPair>
              <ChartCard
            title="UK Energy Import Dependency (%)"
            info="Net energy imports as a share of total energy supply. The UK became a net energy importer in 2004. Source: DESNZ."
            editorial="Once self-sufficient in energy, the UK now imports over a third of its supply. North Sea production has halved and no replacement is ready."
            shareHeadline="Energy independence lost"
            shareSubline="NET IMPORTER SINCE 2004."
            accentColor="#ef4444"
            shareData={filterByRange(
                      prodImportsData.timeSeries.ukEnergyDependency.data,
                      "year",
                      prodRange
                    ).map(d => d.value)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Energy Import Dependency"
                  geo="UK"
                  unit="%"
                  data={filterByRange(
                    prodImportsData.timeSeries.ukEnergyDependency.data,
                    "year",
                    prodRange
                  )}
                  dateKey="year"
                  source="DESNZ/DUKES"
                  freq="annual"
                  fullData={
                    prodImportsData.timeSeries.ukEnergyDependency.data
                  }
                />
                <ResponsiveContainer
                  width="100%"
                  height={260}
                >
                  <AreaChart
                    data={filterByRange(
                      prodImportsData.timeSeries.ukEnergyDependency.data,
                      "year",
                      prodRange
                    )}
                    margin={{
                      left: 10,
                      right: 20
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      tick={{
                        fill: "#9ca3af",
                        fontSize: 11
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280",
                        fontSize: 11
                      }}
                      tickFormatter={(v) =>
                        v + "%"
                      }
                      domain={[0, 55]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#030712",
                        border:
                          "1px solid #1f2937",
                        borderRadius: 4
                      }}
                      formatter={(v) => [
                        v + "%",
                        "Import Dependency"
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-gray-600 text-xs mt-1">
                  Source: DESNZ/DUKES
                </p>
              </ChartCard>

              <ChartCard
            title="UK Food Self-Sufficiency (%)"
            info="Ratio of domestic food production to food consumed. Declining since the 1980s. Source: DEFRA."
            editorial="Food self-sufficiency has fallen below 60%. In a supply chain crisis, the UK is days away from empty shelves."
            shareHeadline="Britain produces less than 60% of its food"
            shareSubline="AND FALLING."
            accentColor="#ef4444"
            shareData={filterByRange(
                      prodImportsData.timeSeries.ukFoodSelfSufficiency.data,
                      "year",
                      prodRange
                    ).map(d => d.value)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Food Self-Sufficiency"
                  geo="UK"
                  unit="%"
                  data={filterByRange(
                    prodImportsData.timeSeries.ukFoodSelfSufficiency.data,
                    "year",
                    prodRange
                  )}
                  dateKey="year"
                  source="DEFRA / Defra Food Statistics"
                  freq="annual"
                  fullData={
                    prodImportsData.timeSeries.ukFoodSelfSufficiency.data
                  }
                />
                <ResponsiveContainer
                  width="100%"
                  height={260}
                >
                  <AreaChart
                    data={filterByRange(
                      prodImportsData.timeSeries.ukFoodSelfSufficiency.data,
                      "year",
                      prodRange
                    )}
                    margin={{
                      left: 10,
                      right: 20
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      tick={{
                        fill: "#9ca3af",
                        fontSize: 11
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280",
                        fontSize: 11
                      }}
                      tickFormatter={(v) =>
                        v + "%"
                      }
                      domain={[50, 75]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#030712",
                        border:
                          "1px solid #1f2937",
                        borderRadius: 4
                      }}
                      formatter={(v) => [
                        v + "%",
                        "Self-Sufficiency"
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-gray-600 text-xs mt-1">
                  Source: DEFRA Food Statistics
                </p>
              </ChartCard>

              </ChartPair>
              <ChartPair>
              <ChartCard
            title="UK Steel Import Dependency (%)"
            info="Percentage of steel consumed in the UK that is imported. Shows domestic production capacity."
            editorial="UK produces less than half the steel it uses. We've gutted our manufacturing base and depend on imports."
            shareHeadline="UK dependent on imported steel for half its needs"
            shareSubline="50%+ IMPORTED."
            accentColor="#F97316"
            shareData={prodImportsData.timeSeries
                        .ukSteelImportDependency
                        .data.map(d => d.value)}
            onShare={handleChartShare}>
                <ResponsiveContainer
                  width="100%"
                  height={260}
                >
                  <AreaChart
                    data={
                      prodImportsData.timeSeries
                        .ukSteelImportDependency
                        .data
                    }
                    margin={{
                      left: 10,
                      right: 20
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      tick={{
                        fill: "#9ca3af",
                        fontSize: 11
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280",
                        fontSize: 11
                      }}
                      tickFormatter={(v) =>
                        v + "%"
                      }
                      domain={[25, 80]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#030712",
                        border:
                          "1px solid #1f2937",
                        borderRadius: 4
                      }}
                      formatter={(v) => [
                        v + "%",
                        "Import Share"
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-gray-600 text-xs mt-1">
                  Source: World Steel Association
                </p>
              </ChartCard>

              <ChartCard
            title="UK Vehicle Production (units)"
            info="Annual number of vehicles produced in UK factories, including cars and commercial vehicles."
            editorial="UK car production has collapsed. We once dominated the industry; now it's a fraction of what it was."
            shareHeadline="British car industry in free fall"
            shareSubline="PRODUCTION DOWN 60%+."
            accentColor="#EF4444"
            shareData={prodImportsData.timeSeries
                        .ukAutoProduction.data.map(d => d.value)}
            onShare={handleChartShare}>
                <ResponsiveContainer
                  width="100%"
                  height={260}
                >
                  <AreaChart
                    data={
                      prodImportsData.timeSeries
                        .ukAutoProduction.data
                    }
                    margin={{
                      left: 10,
                      right: 20
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      tick={{
                        fill: "#9ca3af",
                        fontSize: 11
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280",
                        fontSize: 11
                      }}
                      tickFormatter={(v) =>
                        (v / 1000000).toFixed(
                          1
                        ) + "M"
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#030712",
                        border:
                          "1px solid #1f2937",
                        borderRadius: 4
                      }}
                      formatter={(v) => [
                        v.toLocaleString() +
                          " units",
                        "Production"
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#a855f7"
                      fill="#a855f7"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-gray-600 text-xs mt-1">
                  Source: SMMT
                </p>
              </ChartCard>

              </ChartPair>
            {/* Food breakdown */}
              <ChartPair>
              <ChartCard
            title="UK Food Self-Sufficiency by Category (%)"
            info="Percentage of food consumed in the UK that is produced domestically, broken down by food category."
            editorial="UK can't feed itself. We rely on imports for most food. One supply chain disruption away from serious trouble."
            shareHeadline="UK dependent on food imports for survival"
            shareSubline="LESS THAN 60% SELF-SUFFICIENT."
            accentColor="#EF4444"
            shareData={prodImportsData.foodBreakdown
                      .data.map(d => d.value)}
            onShare={handleChartShare}>
                <ResponsiveContainer
                  width="100%"
                  height={260}
                >
                  <BarChart
                  data={
                    prodImportsData.foodBreakdown
                      .data
                  }
                  layout="vertical"
                  margin={{
                    left: 120,
                    right: 30,
                    top: 5,
                    bottom: 5
                  }}
                >
                  <XAxis
                    type="number"
                    tick={{
                      fill: "#9ca3af",
                      fontSize: 11
                    }}
                    tickFormatter={(v) =>
                      v + "%"
                    }
                    domain={[0, 100]}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{
                      fill: "#d1d5db",
                      fontSize: 11
                    }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#030712",
                      border:
                        "1px solid #1f2937",
                      borderRadius: 4
                    }}
                    formatter={(v) => [
                      v + "%",
                      "Self-Sufficiency"
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                  >
                    {prodImportsData.foodBreakdown
                      .data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.value >= 80
                            ? "#10b981"
                            : d.value >= 60
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 inline-block bg-emerald-500" />
                  80%+
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 inline-block bg-amber-500" />
                  60-79%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 inline-block bg-red-500" />
                  Below 60%
                </span>
              </div>
            </ChartCard>

            {/* Construction breakdown */}
            <ChartCard
            title="UK Construction Materials Import Dependency (%)"
            info="Percentage of construction materials used in the UK that are imported."
            editorial="Building materials? We import most of them. UK construction is entirely dependent on global supply chains."
            shareHeadline="UK construction reliant on imported materials"
            shareSubline="IMPORT DEPENDENT."
            accentColor="#F97316"
            shareData={prodImportsData
                      .constructionBreakdown.data.map(d => d.importPct)}
            onShare={handleChartShare}>
              <ResponsiveContainer
                width="100%"
                height={260}
              >
                <BarChart
                  data={
                    prodImportsData
                      .constructionBreakdown.data
                  }
                  layout="vertical"
                  margin={{
                    left: 100,
                    right: 30,
                    top: 5,
                    bottom: 5
                  }}
                >
                  <XAxis
                    type="number"
                    tick={{
                      fill: "#9ca3af",
                      fontSize: 11
                    }}
                    tickFormatter={(v) =>
                      v + "%"
                    }
                    domain={[0, 100]}
                  />
                  <YAxis
                    type="category"
                    dataKey="material"
                    tick={{
                      fill: "#d1d5db",
                      fontSize: 11
                    }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#030712",
                      border:
                        "1px solid #1f2937",
                      borderRadius: 4
                    }}
                    formatter={(v) => [
                      v + "%",
                      "Import Share"
                    ]}
                  />
                  <Bar
                    dataKey="importPct"
                    radius={[0, 4, 4, 0]}
                  >
                    {prodImportsData
                      .constructionBreakdown
                      .data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.importPct >= 50
                            ? "#ef4444"
                            : d.importPct >= 25
                            ? "#f59e0b"
                            : "#10b981"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

              </ChartPair>
            {/* Industry summary cards */}
            <h3 className="text-sm font-semibold text-gray-300 mt-4">
              Industry Detail
            </h3>
              {prodImportsData.industries.map(
                (ind) => {
                  const ukData =
                    prodImportsData.current.find(
                      (d) =>
                        d.industry === ind.id &&
                        d.country === "UK"
                    );
                  const depRow =
                    prodImportsData.comparison
                      .importDependency.data.find(
                      (d) =>
                        d.industry ===
                        ind.name.split(" &")[0]
                          .split(" (")[0]
                    );
                  const depPct = depRow
                    ? depRow.UK
                    : null;
                  const depColor =
                    depPct === null
                      ? "text-gray-500"
                      : depPct >= 70
                      ? "text-red-400"
                      : depPct >= 40
                      ? "text-amber-400"
                      : "text-emerald-400";
                  return (
                    <div
                      key={ind.id}
                      className="py-2"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-white font-semibold text-sm">
                          {ind.name}
                        </h4>
                        {depPct !== null && (
                          <span
                            className={
                              "text-lg font-bold " +
                              depColor
                            }
                          >
                            {depPct}%
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mb-2">
                        {ind.definition}
                      </p>
                      {ukData && ukData.notes && (
                        <p className="text-gray-400 text-xs">
                          {ukData.notes}
                        </p>
                      )}
                      {ukData && (
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                            {ukData.source}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                            {ukData.year}
                          </span>
                          <span
                            className={
                              "text-[10px] px-1.5 py-0.5 rounded " +
                              (ukData.confidence ===
                              "high"
                                ? "bg-emerald-900/40 text-emerald-400"
                                : "bg-amber-900/40 text-amber-400")
                            }
                          >
                            {ukData.confidence}{" "}
                            confidence
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
              )}

            <Divider />

            {/* ── Purchasing Power of £1 ── */}
            <ChartCard chartId="purchasing-power" label="Your Money" title="Purchasing Power of £1 Since 2000" explainData={moneySupplyData.purchasingPower.data.filter((d, i) => i % 4 === 0 || i === moneySupplyData.purchasingPower.data.length - 1).map(d => `${d.year}: £${d.value.toFixed(2)}`).join("; ")} onShare={handleChartShare} shareHeadline="Your pound buys 40% less than in 2000" shareSubline="The collapsing purchasing power of sterling">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={moneySupplyData.purchasingPower.data}>
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(2) + "p"} domain={[0.4, 1.05]} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => ["£" + v.toFixed(2), "Value of £1 (2000)"]} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <Area type="monotone" dataKey="value" fill="#ef4444" fillOpacity={0.15} stroke="#ef4444" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 text-center">
                <span className="text-[11px] font-mono text-gray-500">A pound from 2000 now buys just </span>
                <span className="text-[13px] font-mono font-black text-red-400">
                  {moneySupplyData.purchasingPower.data[moneySupplyData.purchasingPower.data.length - 1].value.toFixed(0)}p
                </span>
                <span className="text-[11px] font-mono text-gray-500"> of goods</span>
              </div>
            </ChartCard>

            {/* ── Mortgage Rates ── */}
            <ChartCard chartId="mortgage-rates" label="Mortgages" title="Average UK Mortgage Rates" explainData={`Current rates: 2yr fixed ${moneySupplyData.personalFinance.mortgages.headline.avgFixed2yr}%, 5yr fixed ${moneySupplyData.personalFinance.mortgages.headline.avgFixed5yr}%, avg house price £${(moneySupplyData.personalFinance.mortgages.headline.avgHousePrice / 1000).toFixed(0)}k, price:earnings ratio ${moneySupplyData.personalFinance.mortgages.headline.priceToEarnings}x | ` + moneySupplyData.personalFinance.mortgages.rateHistory.slice(-6).map(d => `${d.m}: 2yr=${d.fixed2yr}%, 5yr=${d.fixed5yr}%, SVR=${d.svr}%`).join("; ")}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={moneySupplyData.personalFinance.mortgages.rateHistory}>
                  <XAxis dataKey="m" tick={{ fontSize: 9, fill: "#555" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} domain={[0, 9]} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => [v.toFixed(2) + "%", undefined]} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <Line type="monotone" dataKey="fixed2yr" name="2yr Fixed" stroke="#22d3ee" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fixed5yr" name="5yr Fixed" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="svr" name="SVR" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">2yr Fixed</div>
                  <div className="text-lg font-black text-cyan-400 font-mono">{moneySupplyData.personalFinance.mortgages.headline.avgFixed2yr}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">5yr Fixed</div>
                  <div className="text-lg font-black text-purple-400 font-mono">{moneySupplyData.personalFinance.mortgages.headline.avgFixed5yr}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Avg House Price</div>
                  <div className="text-lg font-black text-white font-mono">£{(moneySupplyData.personalFinance.mortgages.headline.avgHousePrice / 1000).toFixed(0)}k</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Price:Earnings</div>
                  <div className="text-lg font-black text-amber-400 font-mono">{moneySupplyData.personalFinance.mortgages.headline.priceToEarnings}x</div>
                </div>
              </div>
            </ChartCard>

            {/* ── Consumer Credit ── */}
            <ChartCard chartId="consumer-credit" label="Household Debt" title="Consumer Credit Outstanding" explainData={moneySupplyData.personalFinance.consumerCredit.data.slice(-6).map(d => `${d.m}: outstanding £${d.outstanding}bn, net monthly £${d.netMonthly}bn`).join("; ")} onShare={handleChartShare} shareHeadline="Britain is drowning in debt" shareSubline="Consumer credit outstanding — the borrowing binge">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={moneySupplyData.personalFinance.consumerCredit.data}>
                  <XAxis dataKey="m" tick={{ fontSize: 9, fill: "#555" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => "£" + v + "bn"} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => "£" + v + "bn"} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} />
                  <Area yAxisId="left" type="monotone" dataKey="outstanding" name="Total Outstanding (£bn)" fill="#ef4444" fillOpacity={0.15} stroke="#ef4444" strokeWidth={2} />
                  <Bar yAxisId="right" dataKey="netMonthly" name="Monthly Net Lending (£bn)" fill="#22d3ee" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ── Savings ── */}
            <ChartCard chartId="savings-ratio" label="Savings" title="Household Savings Ratio" explainData={moneySupplyData.personalFinance.savings.householdSavingsRatio.map(d => `${d.year}: ${d.pct}%`).join("; ") + ` | ISA holders: ${moneySupplyData.personalFinance.savings.isaSubscriptions.totalIsaHolders}m, cash ISA rate: ${moneySupplyData.personalFinance.savings.isaSubscriptions.cashIsaAvgRate}%`} onShare={handleChartShare} shareHeadline="Nobody can save anymore" shareSubline="Household savings ratio — squeezed to the limit">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={moneySupplyData.personalFinance.savings.householdSavingsRatio}>
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#555" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} formatter={(v) => [v + "%", "Savings Ratio"]} />
                  <Bar dataKey="pct" name="Savings Ratio" radius={[3, 3, 0, 0]}>
                    {moneySupplyData.personalFinance.savings.householdSavingsRatio.map((d, i) => (
                      <Cell key={i} fill={d.pct > 12 ? "#22d3ee" : "#6b7280"} fillOpacity={0.6} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">ISA Holders</div>
                  <div className="text-lg font-black text-white font-mono">{moneySupplyData.personalFinance.savings.isaSubscriptions.totalIsaHolders}m</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Cash ISA Rate</div>
                  <div className="text-lg font-black text-emerald-400 font-mono">{moneySupplyData.personalFinance.savings.isaSubscriptions.cashIsaAvgRate}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">S&S ISA Inflows</div>
                  <div className="text-lg font-black text-cyan-400 font-mono">£{moneySupplyData.personalFinance.savings.isaSubscriptions.stocksSharesInflows}bn</div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-700 font-mono">Total ISA Assets</div>
                  <div className="text-lg font-black text-white font-mono">£{moneySupplyData.personalFinance.savings.isaSubscriptions.totalIsaAssets}bn</div>
                </div>
              </div>
            </ChartCard>

            <div className="text-gray-500 text-xs">
              <strong className="text-gray-400">
                Sources:
              </strong>{" "}
              ONS Consumer Prices Index; Bank of England
              Money & Credit statistics; HMRC ISA Statistics;
              ONS Household Savings Ratio;
              DESNZ Digest of UK Energy Statistics
              (DUKES) 2025; DEFRA Food Statistics
              Pocketbook 2024; Eurostat; OECD Statistics.
            </div>
          </div>
        )}

        {/* ============ ECONOMY: ENERGY ============ */}
        {view === "economy.energy" && (() => {
          const ranges = { "2y": 2, "5y": 5, "10y": 10, max: 999 };
          const rangeN = ranges[energyRange] || 10;

          const balSeries = energyData.energyBalance.series;
          const balSlice = balSeries.slice(-rangeN);
          const latest = balSlice[balSlice.length - 1];
          const prev = balSlice.length > 1
            ? balSlice[balSlice.length - 2] : latest;
          const first = balSlice[0];

          const oilSlice = energyData.oilProduction.series
            .slice(-rangeN);
          const gasSlice = energyData.gasProduction.series
            .slice(-rangeN);
          const elecSlice = energyData.electricityMix.series
            .slice(-rangeN);

          const latestOil = oilSlice[oilSlice.length - 1];
          const latestGas = gasSlice[gasSlice.length - 1];
          const latestElec = elecSlice[elecSlice.length - 1];

          const ssDelta = (
            latest.selfSufficiencyPct -
            prev.selfSufficiencyPct
          ).toFixed(1);
          const ssRangeDelta = (
            latest.selfSufficiencyPct -
            first.selfSufficiencyPct
          ).toFixed(1);

          /* Combined oil+gas chart data */
          const oilGasData = oilSlice.map((o) => {
            const g = gasSlice.find(
              (x) => x.year === o.year
            );
            return {
              year: o.year,
              oil: o.value,
              gas: g ? g.value : 0
            };
          });

          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                Energy Independence
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Energy
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                UK energy production, imports, and
                self-sufficiency. How dependent is
                Britain on overseas energy?
              </p>
            </div>

            <TimeRangeControl
              range={energyRange}
              setRange={setEnergyRange}
            />

            {/* ---- Headline metrics ---- */}
            <div className={
              "grid grid-cols-2 md:grid-cols-4 gap-4"
            }>
              <div className={
                "border border-gray-800/60 rounded-lg " +
                "p-4"
              }>
                <div className={
                  "text-[10px] uppercase tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  Self-Sufficiency
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {latest.selfSufficiencyPct}%
                </div>
                <div className={
                  "text-xs mt-1 " +
                  (Number(ssDelta) < 0
                    ? "text-red-400" : "text-green-400")
                }>
                  {Number(ssDelta) > 0 ? "+" : ""}
                  {ssDelta}pp YoY
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg " +
                "p-4"
              }>
                <div className={
                  "text-[10px] uppercase tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  Import Dependency
                </div>
                <div className={
                  "text-2xl font-black text-red-400"
                }>
                  {latest.importDependencyPct}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  Net imports / total supply
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg " +
                "p-4"
              }>
                <div className={
                  "text-[10px] uppercase tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  Oil Production
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {latestOil.value}Mt
                </div>
                <div className="text-xs mt-1 text-red-400">
                  Down{" "}
                  {(
                    ((oilSlice[0].value - latestOil.value) /
                      oilSlice[0].value) * 100
                  ).toFixed(0)}
                  % since {oilSlice[0].year}
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg " +
                "p-4"
              }>
                <div className={
                  "text-[10px] uppercase tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  Renewables Share
                </div>
                <div className={
                  "text-2xl font-black text-green-400"
                }>
                  {latestElec.renewables}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  of electricity ({latestElec.year})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

            {/* ---- Self-Sufficiency Chart ---- */}
              <ChartCard
                title="UK Energy Self-Sufficiency (%)"
                label="Domestic vs Imported"
                onShare={handleChartShare} shareHeadline={"Britain can\u2019t power itself"} shareSubline="UK energy self-sufficiency in freefall"
              >
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={balSlice}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    interval={
                      balSlice.length > 12
                        ? Math.floor(balSlice.length / 6) : 0
                    }
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "%"}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-gray-300">
                              Self-sufficiency:{" "}
                              {row.selfSufficiencyPct}%
                            </div>
                            <div className="text-gray-300">
                              Import dependency:{" "}
                              {row.importDependencyPct}%
                            </div>
                            <div className="text-gray-300">
                              Production:{" "}
                              {row.production} Mtoe
                            </div>
                            <div className="text-gray-300">
                              Total supply:{" "}
                              {row.totalSupply} Mtoe
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="selfSufficiencyPct"
                    stroke="#f97316"
                    fill="#f9731620"
                    strokeWidth={2}
                    name="Self-sufficiency"
                  />
                  <Line
                    type="monotone"
                    dataKey="importDependencyPct"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    name="Import dependency"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className={
                "flex items-center gap-4 mt-2 " +
                "text-xs text-gray-500"
              }>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-0.5 " +
                    "bg-orange-500"
                  } />
                  Self-sufficiency
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-0.5 " +
                    "bg-red-500 border-dashed"
                  } />
                  Import dependency
                </span>
              </div>
            </ChartCard>

            {/* ---- Energy Balance ---- */}
            <ChartCard
              title="Primary Energy Balance (Mtoe)" onShare={handleChartShare} shareHeadline="Energy gap keeps growing" shareSubline="UK primary energy production vs consumption"
              label="Production vs Imports"
            >
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={balSlice}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    interval={
                      balSlice.length > 12
                        ? Math.floor(balSlice.length / 6) : 0
                    }
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-orange-400">
                              Production: {row.production} Mtoe
                            </div>
                            <div className="text-red-400">
                              Imports: {row.imports} Mtoe
                            </div>
                            <div className="text-blue-400">
                              Exports: {row.exports} Mtoe
                            </div>
                            <div className="text-gray-300">
                              Total supply:{" "}
                              {row.totalSupply} Mtoe
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="production"
                    fill="#f97316"
                    name="Production"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="imports"
                    fill="#ef444480"
                    name="Imports"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalSupply"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    dot={false}
                    name="Total supply"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className={
                "flex items-center gap-4 mt-2 " +
                "text-xs text-gray-500"
              }>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-orange-500"
                  } />
                  Production
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-red-500/50"
                  } />
                  Imports
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-0.5 bg-gray-400"
                  } />
                  Total supply
                </span>
              </div>
            </ChartCard>

            {/* ---- Oil & Gas Production ---- */}
              <ChartCard
                title="Oil & Gas Production" onShare={handleChartShare} shareHeadline="North Sea is running dry" shareSubline="UK oil and gas production in terminal decline"
                label="North Sea Decline"
              >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={oilGasData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    interval={
                      oilGasData.length > 12
                        ? Math.floor(oilGasData.length / 6)
                        : 0
                    }
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-orange-400">
                              Oil: {row.oil} Mt
                            </div>
                            <div className="text-blue-400">
                              Gas: {row.gas} bcm
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="oil"
                    stackId="1"
                    stroke="#f97316"
                    fill="#f9731640"
                    name="Oil (Mt)"
                  />
                  <Area
                    type="monotone"
                    dataKey="gas"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f640"
                    name="Gas (bcm)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className={
                "flex items-center gap-4 mt-2 " +
                "text-xs text-gray-500"
              }>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-orange-500/50"
                  } />
                  Oil (million tonnes)
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-blue-500/50"
                  } />
                  Gas (billion cubic metres)
                </span>
              </div>
            </ChartCard>

            {/* ---- Electricity Mix ---- */}
            <ChartCard
              title={
                "Electricity Generation Mix (%)"
              }
              label="The Grid Transformation"
              onShare={handleChartShare} shareHeadline="The grid is going green — slowly" shareSubline="How Britain generates its electricity"
            >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={elecSlice}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => v + "%"}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-green-400">
                              Renewables: {row.renewables}%
                            </div>
                            <div className="text-yellow-400">
                              Nuclear: {row.nuclear}%
                            </div>
                            <div className="text-blue-400">
                              Gas: {row.gas}%
                            </div>
                            <div className="text-gray-400">
                              Coal: {row.coal}%
                            </div>
                            <div className="text-purple-400">
                              Imports: {row.imports}%
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="renewables"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e80"
                    name="Renewables"
                  />
                  <Area
                    type="monotone"
                    dataKey="nuclear"
                    stackId="1"
                    stroke="#eab308"
                    fill="#eab30860"
                    name="Nuclear"
                  />
                  <Area
                    type="monotone"
                    dataKey="gas"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f660"
                    name="Gas"
                  />
                  <Area
                    type="monotone"
                    dataKey="coal"
                    stackId="1"
                    stroke="#6b7280"
                    fill="#6b728060"
                    name="Coal"
                  />
                  <Area
                    type="monotone"
                    dataKey="imports"
                    stackId="1"
                    stroke="#a855f7"
                    fill="#a855f740"
                    name="Imports"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className={
                "flex flex-wrap items-center gap-3 " +
                "mt-2 text-xs text-gray-500"
              }>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-green-500/60"
                  } />
                  Renewables
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-yellow-500/60"
                  } />
                  Nuclear
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-blue-500/60"
                  } />
                  Gas
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-gray-500/60"
                  } />
                  Coal
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 rounded-sm " +
                    "bg-purple-500/40"
                  } />
                  Imports
                </span>
              </div>
            </ChartCard>
            </div>

            {/* ---- Key context panel ---- */}
            <div className={
              "border border-gray-800/60 rounded-lg " +
              "p-5 space-y-3"
            }>
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "text-gray-500 mb-2"
              }>
                Key Context
              </div>
              <div className="text-sm text-gray-400 space-y-2">
                <p>
                  The UK was a net energy exporter until 2004,
                  thanks to North Sea oil and gas. Since then,
                  production has declined by approximately 66%,
                  driving import dependency above 50%.
                </p>
                <p>
                  Renewables have transformed electricity
                  generation, rising from 7% in 2010 to over
                  50% in 2024. The last coal power station
                  closed in September 2024.
                </p>
                <p>
                  Despite strong renewables growth, overall
                  primary energy self-sufficiency continues
                  to decline as oil and gas depletion outpaces
                  renewable capacity additions.
                </p>
              </div>
            </div>

            {/* ---- Sources ---- */}
            <div className={
              "text-[10px] text-gray-600 " +
              "leading-relaxed"
            }>
              Sources: DESNZ Digest of UK Energy Statistics
              (DUKES) 2025; DESNZ Energy Trends; DESNZ UK
              Energy in Brief 2025; NSTA Production Data.
              Self-sufficiency = indigenous production /
              inland energy consumption. Import dependency =
              net imports / total supply. All primary energy
              figures in million tonnes of oil equivalent
              (Mtoe).
            </div>
          </div>
          );
        })()}

        {/* ============ ECONOMY: INNOVATION ============ */}
        {view === "economy.innovation" && (() => {
          const ranges = {
            "2y": 2, "5y": 5, "10y": 10, max: 999
          };
          const rangeN = ranges[innovRange] || 5;

          const vcSlice = innovationData.vcInvestmentUK
            .series.slice(-rangeN);
          const uniSlice = innovationData.unicornsUK
            .series.slice(-rangeN);
          const aiSlice = innovationData.aiInvestmentUK
            .series.slice(-rangeN);
          const rdSlice = innovationData.rdSpendUK
            .series.slice(-rangeN);

          const hl = innovationData.headline;

          /* Combined VC + AI overlay */
          const vcAiData = vcSlice.map((v) => {
            const a = aiSlice.find(
              (x) => x.year === v.year
            );
            return {
              year: v.year,
              vc: v.value,
              ai: a ? a.value : null
            };
          });

          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                Technology & Investment
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Innovation
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                UK venture capital, unicorns, AI funding,
                and R&D investment.
              </p>
            </div>

            <TimeRangeControl
              range={innovRange}
              setRange={setInnovRange}
            />

            {/* ---- Headline metrics ---- */}
            <div className={
              "grid grid-cols-2 md:grid-cols-4 gap-4"
            }>
              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  VC Investment
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {"£"}{hl.vcLatestBn}bn
                </div>
                <div className={
                  "text-xs mt-1 " +
                  (hl.vcChangeYoY > 0
                    ? "text-green-400"
                    : "text-red-400")
                }>
                  {hl.vcChangeYoY > 0 ? "+" : ""}
                  {hl.vcChangeYoY}% YoY
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  UK Unicorns
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {hl.unicornsCount}
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  #{hl.unicornsRankGlobal} globally
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  AI Investment
                </div>
                <div className={
                  "text-2xl font-black text-green-400"
                }>
                  {"£"}{hl.aiLatestBn}bn
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  Record ({hl.aiLatestYear})
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  R&D Spend
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {hl.rdPctGDP}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  of GDP ({hl.rdLatestYear})
                </div>
              </div>
            </div>

            <Divider />

            {/* ---- VC Investment Over Time ---- */}
              <ChartCard
                title={
                  "UK Venture Capital Investment " +
                  "(£bn)"
                }
                label="Startup Funding"
                onShare={handleChartShare}
                shareHeadline="VC money is drying up"
                shareSubline="UK venture capital investment — boom to bust"
              >
              <ResponsiveContainer
                width="100%" height={260}
              >
                <ComposedChart data={vcAiData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                  />
                  <YAxis
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    tickFormatter={
                      (v) => "£" + v + "bn"
                    }
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-orange-400">
                              VC: {"£"}
                              {row.vc}bn
                            </div>
                            {row.ai != null && (
                              <div className={
                                "text-green-400"
                              }>
                                AI: {"£"}
                                {row.ai}bn
                              </div>
                            )}
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="vc"
                    fill="#f97316"
                    name="Total VC"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="ai"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 3 }}
                    name="AI subset"
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className={
                "flex items-center gap-4 mt-2 " +
                "text-xs text-gray-500"
              }>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 " +
                    "rounded-sm bg-orange-500"
                  } />
                  Total VC
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-0.5 " +
                    "bg-green-500"
                  } />
                  AI investment
                </span>
              </div>
            </ChartCard>

            <Divider />

            {/* ---- Unicorn Growth ---- */}
            <ChartCard
              title="UK Active Unicorns"
              label="$1bn+ Companies"
              onShare={handleChartShare}
              shareHeadline="Britain's billion-pound startups"
              shareSubline="Active UK unicorns — how many made it?"
            >
              <ResponsiveContainer
                width="100%" height={260}
              >
                <AreaChart data={uniSlice}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                  />
                  <YAxis
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-orange-400">
                              {row.value} unicorns
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    fill="#f9731620"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <Divider />

            {/* ---- R&D Spend ---- */}
            <ChartCard
              title="R&D Expenditure (% of GDP)"
              label="GERD"
              onShare={handleChartShare}
              shareHeadline="Britain doesn't invest in its future"
              shareSubline="R&D spending as % of GDP — lagging behind"
            >
              <ResponsiveContainer
                width="100%" height={260}
              >
                <ComposedChart data={rdSlice}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                  />
                  <YAxis
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    tickFormatter={
                      (v) => v + "%"
                    }
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className="text-orange-400">
                              {row.value}% of GDP
                            </div>
                            {row.valueBn && (
                              <div className={
                                "text-gray-300"
                              }>
                                {"£"}
                                {row.valueBn}bn total
                              </div>
                            )}
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    fill="#f9731660"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey={() => hl.rdTargetPct}
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="5 3"
                    dot={false}
                    name="Gov target"
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className={
                "flex items-center gap-4 mt-2 " +
                "text-xs text-gray-500"
              }>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-3 " +
                    "rounded-sm bg-orange-500/40"
                  } />
                  GERD % GDP
                </span>
                <span className="flex items-center gap-1">
                  <span className={
                    "inline-block w-3 h-0.5 " +
                    "bg-red-500"
                  } />
                  Gov target (2.4%)
                </span>
              </div>
            </ChartCard>

            <Divider />

            {/* ---- G7 link ---- */}
            <button
              onClick={() => setView("economy.innovation")}
              className={
                "w-full border border-gray-800/60 " +
                "rounded-lg p-4 text-left " +
                "hover:border-orange-600 " +
                "transition-colors"
              }
            >
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-orange-400" />
                <div>
                  <div className={
                    "text-sm font-bold text-white"
                  }>
                    Compare with G7 Countries
                  </div>
                  <div className={
                    "text-xs text-gray-500 mt-0.5"
                  }>
                    VC per capita, AI investment, and
                    R&D spend across G7 nations
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-gray-600 ml-auto"
                />
              </div>
            </button>

            <Divider />

            {/* ==== GOV R&D SECTION ==== */}
            <div className="py-2 mb-2">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                Public Investment
              </div>
              <h3 className={
                "text-xl font-black uppercase " +
                "tracking-tight"
              }>
                Government R&D
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                How much does the UK government invest in
                R&D compared to peer nations?
              </p>
            </div>

            {/* Gov R&D headline metrics */}
            <div className={
              "grid grid-cols-2 md:grid-cols-4 gap-4"
            }>
              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  Gov R&D Spend
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {"£"}
                  {govInnovationData.headline.ukGovRdBn}bn
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  {govInnovationData.headline.ukGovRdYear}
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  Gov Share of R&D
                </div>
                <div className={
                  "text-2xl font-black text-red-400"
                }>
                  {govInnovationData.headline
                    .ukGovSharePct}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  Lowest in G7 (with Japan)
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  R&D Tax Incentive
                </div>
                <div className={
                  "text-2xl font-black text-green-400"
                }>
                  {govInnovationData.headline
                    .ukTaxIncentivePctGDP}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  of GDP (4th in OECD)
                </div>
              </div>

              <div className={
                "border border-gray-800/60 rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] text-gray-500 mb-1"
                }>
                  UK GERD Rank (G7)
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  #{govInnovationData.headline
                    .ukGerdRankG7}
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  of 7 ({
                    govInnovationData.headline
                      .ukGerdPctGDP
                  }% GDP)
                </div>
              </div>
            </div>

            <Divider />

            {/* ---- Total GERD G7 Time Series ---- */}
              <ChartCard
                title="Total R&D Intensity (% GDP)"
                label="G7 Comparison"
                onShare={handleChartShare}
                shareHeadline="R&D intensity stuck in the slow lane"
                shareSubline="Total R&D investment as share of GDP"
              >
                {(() => {
                  const countries = ["US", "Japan",
                    "Germany", "France", "UK",
                    "Canada", "Italy"];
                  const colors = {
                    US: "#6b7280", Japan: "#6b7280",
                    Germany: "#6b7280",
                    France: "#6b7280",
                    UK: "#f97316",
                    Canada: "#6b7280",
                    Italy: "#6b7280"
                  };
                  const cs =
                    govInnovationData
                      .gerdByCountryTimeSeries.countries;
                  /* Build year-keyed array */
                  const yearSet = new Set();
                  countries.forEach((c) => {
                    if (cs[c]) cs[c].series.forEach(
                      (d) => yearSet.add(d.year)
                    );
                  });
                  const years = [...yearSet]
                    .sort((a, b) => a - b);
                  const chartData = years.map((yr) => {
                    const row = { year: yr };
                    countries.forEach((c) => {
                      if (!cs[c]) return;
                      const pt = cs[c].series.find(
                        (d) => d.year === yr
                      );
                      row[c] = pt ? pt.value : null;
                    });
                    return row;
                  });
                  return (
                    <div>
                      <ResponsiveContainer
                        width="100%" height={260}
                      >
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                        />
                        <XAxis
                          dataKey="year"
                          tick={{
                            fill: "#9ca3af",
                            fontSize: 11
                          }}
                        />
                        <YAxis
                          tick={{
                            fill: "#9ca3af",
                            fontSize: 11
                          }}
                          tickFormatter={
                            (v) => v + "%"
                          }
                          domain={[0, 4]}
                        />
                        <Tooltip
                          content={
                            <CustomTooltip
                              renderFn={(row) => (
                                <div>
                                  <div className={
                                    "font-bold " +
                                    "text-white mb-1"
                                  }>
                                    {row.year}
                                  </div>
                                  {countries.map(
                                    (c) =>
                                    row[c] != null && (
                                    <div
                                      key={c}
                                      style={{
                                        color:
                                          colors[c]
                                            === "#f97316"
                                          ? "#f97316"
                                          : "#9ca3af"
                                      }}
                                    >
                                      {c}: {row[c]}%
                                    </div>
                                    )
                                  )}
                                </div>
                              )}
                            />
                          }
                        />
                        {countries.map((c) => (
                          <Line
                            key={c}
                            type="monotone"
                            dataKey={c}
                            stroke={colors[c]}
                            strokeWidth={
                              c === "UK" ? 3 : 1
                            }
                            dot={false}
                            connectNulls
                            opacity={
                              c === "UK" ? 1 : 0.5
                            }
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    <div className={
                      "flex flex-wrap gap-3 mt-2 " +
                      "text-xs text-gray-500"
                    }>
                      {countries.map((c) => (
                        <span
                          key={c}
                          className={
                            "flex items-center gap-1"
                          }
                        >
                          <span
                            className={
                              "inline-block w-3 " +
                              "h-0.5"
                            }
                            style={{
                              backgroundColor:
                                colors[c]
                            }}
                          />
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className={
                      "text-[10px] text-gray-600 " +
                      "mt-2 italic"
                    }>
                      Note: UK data has a methodology
                      break at 2018. Pre-2018 figures
                      (~1.7%) use old ONS methodology;
                      post-2018 (~2.7%) use revised
                      methodology. The jump is NOT a
                      real increase in R&D spending.
                    </div>
                  </div>
                );
              })()}
            </ChartCard>

            {/* ---- Gov share of GERD ---- */}
            <ChartCard
              title={
                "Government-Funded Share of " +
                "Total R&D (%)"
              }
              label="Who Pays for R&D?"
              onShare={handleChartShare}
              shareHeadline="Government retreating from R&D"
              shareSubline="Taxpayer-funded share of research keeps shrinking"
            >
              {(() => {
                const data = govInnovationData
                  .govShareOfGerd.series.slice()
                  .sort((a, b) => b.value - a.value);
                return (
                  <ResponsiveContainer
                    width="100%" height={260}
                  >
                    <BarChart
                      data={data}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#374151"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: "#9ca3af",
                          fontSize: 11
                        }}
                        tickFormatter={
                          (v) => v + "%"
                        }
                        domain={[0, 40]}
                      />
                      <YAxis
                        type="category"
                        dataKey="country"
                        tick={{
                          fill: "#9ca3af",
                          fontSize: 11
                        }}
                        width={65}
                      />
                      <Tooltip
                        content={
                          <CustomTooltip
                            renderFn={(row) => (
                              <div>
                                <div className={
                                  "font-bold " +
                                  "text-white mb-1"
                                }>
                                  {row.country}
                                </div>
                                <div className={
                                  "text-orange-400"
                                }>
                                  {row.value}%
                                  government-funded
                                </div>
                              </div>
                            )}
                          />
                        }
                      />
                      <Bar
                        dataKey="value"
                        radius={[0, 3, 3, 0]}
                      >
                        {data.map((d, i) => (
                          <Cell
                            key={i}
                            fill={
                              d.country === "UK"
                                ? "#f97316"
                                : "#374151"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
              <div className={
                "text-[10px] text-gray-600 " +
                "mt-2 italic"
              }>
                Note: Lower government share does not
                mean less total R&D. The UK and
                Japan rely more on business-funded R&D
                and tax incentives.
              </div>
            </ChartCard>
            <Divider />

            {/* ---- Gov support for business R&D ---- */}
              <ChartCard
                title={
                  "Government Support for Business " +
                  "R&D (% GDP)"
                }
                label="Tax Incentives + Direct Funding"
                onShare={handleChartShare}
                shareHeadline="Business R&D support — rhetoric vs reality"
                shareSubline="How much government actually backs business innovation"
              >
              {(() => {
                const data = govInnovationData
                  .govSupportForBusinessRd.series
                  .slice()
                  .sort((a, b) => b.total - a.total);
                return (
                  <div>
                    <ResponsiveContainer
                      width="100%" height={260}
                    >
                      <BarChart
                        data={data}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fill: "#9ca3af",
                            fontSize: 11
                          }}
                          tickFormatter={
                            (v) => v + "%"
                          }
                          domain={[0, 0.5]}
                        />
                        <YAxis
                          type="category"
                          dataKey="country"
                          tick={{
                            fill: "#9ca3af",
                            fontSize: 11
                          }}
                          width={65}
                        />
                        <Tooltip
                          content={
                            <CustomTooltip
                              renderFn={(row) => (
                                <div>
                                  <div className={
                                    "font-bold " +
                                    "text-white mb-1"
                                  }>
                                    {row.country}
                                  </div>
                                  <div className={
                                    "text-green-400"
                                  }>
                                    Tax: {
                                      row.taxIncentive
                                    }%
                                  </div>
                                  <div className={
                                    "text-blue-400"
                                  }>
                                    Direct: {
                                      row.directFunding
                                    }%
                                  </div>
                                  <div className={
                                    "text-orange-400"
                                  }>
                                    Total: {
                                      row.total
                                    }%
                                  </div>
                                </div>
                              )}
                            />
                          }
                        />
                        <Bar
                          dataKey="taxIncentive"
                          stackId="a"
                          fill="#22c55e60"
                          name="Tax incentive"
                        />
                        <Bar
                          dataKey="directFunding"
                          stackId="a"
                          fill="#3b82f660"
                          name="Direct funding"
                          radius={[0, 3, 3, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className={
                      "flex items-center gap-4 " +
                      "mt-2 text-xs text-gray-500"
                    }>
                      <span className={
                        "flex items-center gap-1"
                      }>
                        <span className={
                          "inline-block w-3 h-3 " +
                          "rounded-sm bg-green-500/40"
                        } />
                        Tax incentive
                      </span>
                      <span className={
                        "flex items-center gap-1"
                      }>
                        <span className={
                          "inline-block w-3 h-3 " +
                          "rounded-sm bg-blue-500/40"
                        } />
                        Direct funding
                      </span>
                    </div>
                  </div>
                );
              })()}
            </ChartCard>

            {/* ---- UK Gov R&D spending ---- */}
            <ChartCard
              title={
                "UK Government R&D Expenditure " +
                "(£bn)"
              }
              label="Public Investment Trend"
              onShare={handleChartShare}
              shareHeadline="Where does government R&D money go?"
              shareSubline="UK government research expenditure by department"
            >
              <ResponsiveContainer
                width="100%" height={220}
              >
                <BarChart
                  data={
                    govInnovationData.ukGovRdSpending
                      .series
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                  />
                  <YAxis
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    tickFormatter={
                      (v) => "£" + v + "bn"
                    }
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold " +
                              "text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            <div className={
                              "text-orange-400"
                            }>
                              {"£"}{row.value}bn
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    fill="#f97316"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            {/* ---- Sources ---- */}
            <div className={
              "text-[10px] text-gray-600 " +
              "leading-relaxed"
            }>
              Sources: BVCA Annual VC Reports; British
              Business Bank; GlobalData; Tracxn / CB
              Insights (unicorns); UK Gov AI Sector Study
              2024 / DSIT; Stanford HAI AI Index 2025;
              ONS UK GERD Statistics; OECD Main Science
              and Technology Indicators; ONS Government
              SET Expenditure; OECD R&D Tax
              Incentives Database; OECD GBARD Statistics;
              NSF S&E Indicators 2025. VC figures
              are VC-specific (excl. broader PE). R&D
              uses post-2018 ONS methodology. Government
              support combines tax incentives and direct
              funding.
            </div>
          </div>
          );
        })()}

        {/* ============ COMPARE: LANDING PAGE ============ */}

        {/* ===== COMPARE: INFRASTRUCTURE COSTS ===== */}
        {view === "compare.infrastructure" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                {"Cost of Living \u203A Infrastructure"}
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Infrastructure Costs
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                High-speed rail cost per kilometre, ranked.
                {" "}{compareData.infrastructure.source}.
              </p>
            </div>

            {/* Headline callout */}
            <div className={
              "border-l-2 border-red-500 pl-5 py-4 mb-6 " +
              "bg-red-950/20"
            }>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-red-400/70 mb-1"
              }>
                The comparison
              </div>
              <div className="text-white text-lg font-bold">
                HS2 costs{" "}
                <span className="text-red-400">$348M per km</span>
                {" "}&mdash; the global median is{" "}
                <span className="text-emerald-400">$46M</span>.
              </div>
              <div className="text-gray-500 text-xs mt-1">
                That makes UK high-speed rail roughly 8x
                more expensive per kilometre than the
                international median, and 17x more than China.
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {(() => {
                const infra = compareData.infrastructure.data;
                const sorted = [...infra].sort(
                  (a, b) => b.costPerKmUsdM - a.costPerKmUsdM
                );
                const ukEntry = sorted.find(
                  (d) => d.country === "UK"
                );
                const cheapest = sorted[sorted.length - 1];
                const median = sorted[
                  Math.floor(sorted.length / 2)
                ];
                return [
                  {
                    label: "UK (HS2 Phase 1)",
                    value: "$" + ukEntry.costPerKmUsdM + "M/km",
                    color: "text-red-400"
                  },
                  {
                    label: "Cheapest",
                    value: "$" + cheapest.costPerKmUsdM
                      + "M/km (" + cheapest.country + ")",
                    color: "text-emerald-400"
                  },
                  {
                    label: "Median",
                    value: "$" + median.costPerKmUsdM + "M/km",
                    color: "text-gray-300"
                  },
                  {
                    label: "UK vs median",
                    value: Math.round(
                      ukEntry.costPerKmUsdM
                      / median.costPerKmUsdM
                    ) + "x more expensive",
                    color: "text-red-400"
                  }
                ].map((s) => (
                  <div
                    key={s.label}
                    className={
                      "border-l-2 border-gray-800 pl-4 py-2"
                    }
                  >
                    <div className={
                      "text-[9px] uppercase tracking-[0.2em] " +
                      "text-gray-500 mb-1"
                    }>
                      {s.label}
                    </div>
                    <div className={
                      "text-lg font-bold font-mono " + s.color
                    }>
                      {s.value}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <ChartCard
              title="HSR Cost per Kilometre ($M USD)"
              onShare={handleChartShare}
              shareHeadline="HS2 is the most expensive railway on Earth"
              shareSubline="High-speed rail cost per km — global comparison"
            >
              <ResponsiveContainer width="100%" height={420}>
                <BarChart
                  data={
                    [...compareData.infrastructure.data].sort(
                      (a, b) =>
                        a.costPerKmUsdM - b.costPerKmUsdM
                    )
                  }
                  layout="vertical"
                  margin={{
                    left: 120, right: 30, top: 10, bottom: 10
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1f2937"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickFormatter={(v) => "$" + v + "M"}
                  />
                  <YAxis
                    type="category"
                    dataKey="country"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    content={({ active, payload }) => (
                      <CustomTooltip
                        active={active}
                        payload={payload}
                        renderFn={(d) => (
                          <>
                            <p className="text-white font-medium">
                              {d.country}
                            </p>
                            <p className="text-gray-300 text-xs">
                              {d.project}
                            </p>
                            <p className="text-red-400 text-xs">
                              ${d.costPerKmUsdM}M per km
                            </p>
                            <p className="text-gray-400 text-xs">
                              {d.kmBuilt} km built
                              {" · "}{d.year}
                            </p>
                          </>
                        )}
                      />
                    )}
                  />
                  <Bar dataKey="costPerKmUsdM" barSize={16}>
                    {[...compareData.infrastructure.data]
                      .sort(
                        (a, b) =>
                          a.costPerKmUsdM - b.costPerKmUsdM
                      )
                      .map((d) => (
                        <Cell
                          key={d.country}
                          fill={
                            d.country === "UK"
                              ? "#ef4444"
                              : "#3b82f6"
                          }
                          fillOpacity={
                            d.country === "UK" ? 0.9 : 0.5
                          }
                        />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Data table */}
            <div className="overflow-x-auto">
              <table className={
                "w-full text-sm text-left " +
                "border-collapse"
              }>
                <thead>
                  <tr className="border-b border-gray-800">
                    {[
                      "Country", "Project", "$/km (M)",
                      "km Built", "Year", "Confidence"
                    ].map((h) => (
                      <th
                        key={h}
                        className={
                          "px-3 py-3 text-[9px] uppercase " +
                          "tracking-[0.15em] text-gray-600 " +
                          "font-mono font-medium"
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...compareData.infrastructure.data]
                    .sort(
                      (a, b) =>
                        b.costPerKmUsdM - a.costPerKmUsdM
                    )
                    .map((d) => (
                      <tr
                        key={d.country}
                        className={
                          "border-b border-gray-800/50 " +
                          (d.country === "UK"
                            ? "bg-red-900/10"
                            : "hover:bg-gray-900/30")
                        }
                      >
                        <td className={
                          "px-3 py-2 font-medium " +
                          (d.country === "UK"
                            ? "text-red-400"
                            : "text-white")
                        }>
                          {d.country}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          {d.project}
                        </td>
                        <td className={
                          "px-3 py-2 font-mono font-semibold " +
                          (d.country === "UK"
                            ? "text-red-400"
                            : "text-white")
                        }>
                          ${d.costPerKmUsdM}
                        </td>
                        <td className={
                          "px-3 py-2 text-gray-400 font-mono"
                        }>
                          {d.kmBuilt.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {d.year}
                        </td>
                        <td className="px-3 py-2">
                          <span className={
                            "text-[10px] uppercase px-2 py-0.5 " +
                            "rounded-full " +
                            (d.confidence === "high"
                              ? "bg-emerald-900/40 text-emerald-400"
                              : "bg-amber-900/40 text-amber-400")
                          }>
                            {d.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            
            <div className="border-t border-gray-800/40 mt-10 pt-10">
              <SectionHeader
                label="Rail & Metro"
                title="Transport Costs"
                accent="text-red-500"
              />
              <p className="text-gray-500 text-sm mb-6 -mt-4">
                Comparing UK rail and metro fares with international peers.
              </p>

              {/* Intercity Rail Fares */}
              <ChartCard
                title="Cost Per Km by Country (Advance vs Flexible)"
                info="Cost per kilometre for equivalent train journeys across European countries."
                editorial="UK rail is the most expensive in Europe. A flexible fare costs 3-4x what the same journey costs in France, Germany, or Spain."
                shareHeadline="UK trains cost 4x more than Europe"
                shareSubline="THE MOST EXPENSIVE RAILWAY ON EARTH."
                accentColor="#ef4444"
                shareData={(() => {
                  const tf = transportCompareData.trainFares.costPerKm.data || [];
                  return [...tf].sort((a, b) => (b.flexibleGbpPerKm || 0) - (a.flexibleGbpPerKm || 0)).map(d => d.advanceGbpPerKm);
                })()}
                onShare={handleChartShare}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={(() => {
                      const tf = transportCompareData.trainFares.costPerKm.data || [];
                      return [...tf].sort((a, b) => (b.flexibleGbpPerKm || 0) - (a.flexibleGbpPerKm || 0));
                    })()}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis
                      dataKey="country"
                      type="category"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      width={70}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.country}</div>
                              <div className="text-blue-400 text-xs">Advance: £{(d.advanceGbpPerKm || 0).toFixed(2)}/km</div>
                              <div className="text-red-400 text-xs">Flexible: £{(d.flexibleGbpPerKm || 0).toFixed(2)}/km</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="advanceGbpPerKm" fill="#3b82f6" name="Advance" />
                    <Bar dataKey="flexibleGbpPerKm" fill="#ef4444" name="Flexible" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Metro Single Fare */}
              <ChartCard
                title="Metro Single Fare Comparison (GBP Equivalent)"
                info="Cost of a single metro/underground journey in major cities."
                editorial="London is the most expensive metro system in the world for a single journey."
                shareHeadline="London metro fares dwarf global peers"
                shareSubline="MOST EXPENSIVE METRO ON EARTH."
                accentColor="#ef4444"
                shareData={(() => {
                  const mf = transportCompareData.metroFares.data || [];
                  return [...mf].sort((a, b) => (b.singleGbp || 0) - (a.singleGbp || 0)).map(d => d.singleGbp);
                })()}
                onShare={handleChartShare}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={(() => {
                      const mf = transportCompareData.metroFares.data || [];
                      return [...mf].sort((a, b) => (b.singleGbp || 0) - (a.singleGbp || 0));
                    })()}
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis dataKey="city" type="category" tick={{ fill: "#9ca3af", fontSize: 10 }} width={90} />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.city}, {d.country}</div>
                              <div className="text-white font-medium">£{d.singleGbp.toFixed(2)}</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="singleGbp" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="text-gray-500 text-xs mt-4">
                <strong className="text-gray-400">Sources:</strong>{" "}
                Transport & Environment 2024 European Rail Ranking;
                TfL, SNCF, DB, RATP, Metro de Madrid.
              </div>
            </div>

            <div className="text-gray-500 text-xs">
              <strong className="text-gray-400">Sources:</strong>{" "}
              {compareData.infrastructure.source}.{" "}
              {compareData.infrastructure.sourceYear}.
            </div>
          </div>
        )}

        {/* ===== COMPARE: HOUSEHOLD BILLS ===== */}
        {view === "compare.bills" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                Compare &rsaquo; Household Bills
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Household Electricity Prices
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                Residential electricity price per kWh in
                USD PPP, tax-inclusive.{" "}
                {compareData.electricity.source}.
              </p>
            </div>

            {/* Headline callout */}
            <div className={
              "border-l-2 border-amber-500 pl-5 py-4 mb-6 " +
              "bg-amber-950/20"
            }>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-amber-400/70 mb-1"
              }>
                The comparison
              </div>
              <div className="text-white text-lg font-bold">
                UK households pay{" "}
                <span className="text-amber-400">
                  $0.31/kWh
                </span>
                {" "}&mdash; 82% more than the US, but
                below Germany and Denmark.
              </div>
              <div className="text-gray-500 text-xs mt-1">
                The UK ranks 4th most expensive of 14
                countries surveyed. The cheapest (Norway)
                pays just $0.12/kWh thanks to hydropower.
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {(() => {
                const elec = compareData.electricity.data;
                const sorted = [...elec].sort(
                  (a, b) =>
                    b.pricePerKwhUsd - a.pricePerKwhUsd
                );
                const ukE = sorted.find(
                  (d) => d.country === "UK"
                );
                const ukRank = sorted.findIndex(
                  (d) => d.country === "UK"
                ) + 1;
                const cheapest = sorted[sorted.length - 1];
                return [
                  {
                    label: "UK price",
                    value: "$" + ukE.pricePerKwhUsd
                      .toFixed(2) + "/kWh",
                    color: "text-amber-400"
                  },
                  {
                    label: "UK rank",
                    value: ukRank + " of "
                      + sorted.length + " (most expensive)",
                    color: "text-amber-400"
                  },
                  {
                    label: "Most expensive",
                    value: sorted[0].country + " $"
                      + sorted[0].pricePerKwhUsd
                        .toFixed(2),
                    color: "text-red-400"
                  },
                  {
                    label: "Cheapest",
                    value: cheapest.country + " $"
                      + cheapest.pricePerKwhUsd
                        .toFixed(2),
                    color: "text-emerald-400"
                  }
                ].map((s) => (
                  <div
                    key={s.label}
                    className={
                      "border-l-2 border-gray-800 pl-4 py-2"
                    }
                  >
                    <div className={
                      "text-[9px] uppercase tracking-[0.2em] " +
                      "text-gray-500 mb-1"
                    }>
                      {s.label}
                    </div>
                    <div className={
                      "text-lg font-bold font-mono " + s.color
                    }>
                      {s.value}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <ChartCard
              title="Electricity Price Per kWh (USD PPP)"
              onShare={handleChartShare}
              shareHeadline="British electricity among the priciest in the world"
              shareSubline="Electricity prices — UK vs the rest"
            >
              <ResponsiveContainer width="100%" height={420}>
                <BarChart
                  data={
                    [...compareData.electricity.data].sort(
                      (a, b) =>
                        a.pricePerKwhUsd - b.pricePerKwhUsd
                    )
                  }
                  layout="vertical"
                  margin={{
                    left: 100, right: 30, top: 10, bottom: 10
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1f2937"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickFormatter={(v) => "$" + v.toFixed(2)}
                  />
                  <YAxis
                    type="category"
                    dataKey="country"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip
                    content={({ active, payload }) => (
                      <CustomTooltip
                        active={active}
                        payload={payload}
                        renderFn={(d) => (
                          <>
                            <p className="text-white font-medium">
                              {d.country}
                            </p>
                            <p className="text-amber-400 text-xs">
                              ${d.pricePerKwhUsd.toFixed(2)}/kWh
                              (USD PPP)
                            </p>
                            <p className="text-gray-400 text-xs">
                              Local: {d.currency}{" "}
                              {d.localPrice}
                            </p>
                          </>
                        )}
                      />
                    )}
                  />
                  <Bar dataKey="pricePerKwhUsd" barSize={16}>
                    {[...compareData.electricity.data]
                      .sort(
                        (a, b) =>
                          a.pricePerKwhUsd - b.pricePerKwhUsd
                      )
                      .map((d) => (
                        <Cell
                          key={d.country}
                          fill={
                            d.country === "UK"
                              ? "#f59e0b"
                              : d.country.includes("EU")
                                ? "#6b7280"
                                : "#3b82f6"
                          }
                          fillOpacity={
                            d.country === "UK" ? 0.9 : 0.5
                          }
                        />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="overflow-x-auto">
              <table className={
                "w-full text-sm text-left border-collapse"
              }>
                <thead>
                  <tr className="border-b border-gray-800">
                    {[
                      "Country", "$/kWh (PPP)", "Local Price",
                      "Currency", "Confidence"
                    ].map((h) => (
                      <th
                        key={h}
                        className={
                          "px-3 py-3 text-[9px] uppercase " +
                          "tracking-[0.15em] text-gray-600 " +
                          "font-mono font-medium"
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...compareData.electricity.data]
                    .sort(
                      (a, b) =>
                        b.pricePerKwhUsd - a.pricePerKwhUsd
                    )
                    .map((d) => (
                      <tr
                        key={d.country}
                        className={
                          "border-b border-gray-800/50 " +
                          (d.country === "UK"
                            ? "bg-amber-900/10"
                            : "hover:bg-gray-900/30")
                        }
                      >
                        <td className={
                          "px-3 py-2 font-medium " +
                          (d.country === "UK"
                            ? "text-amber-400"
                            : "text-white")
                        }>
                          {d.country}
                        </td>
                        <td className={
                          "px-3 py-2 font-mono font-semibold " +
                          (d.country === "UK"
                            ? "text-amber-400"
                            : "text-white")
                        }>
                          ${d.pricePerKwhUsd.toFixed(2)}
                        </td>
                        <td className={
                          "px-3 py-2 text-gray-400 font-mono"
                        }>
                          {d.localPrice}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {d.currency}
                        </td>
                        <td className="px-3 py-2">
                          <span className={
                            "text-[10px] uppercase px-2 " +
                            "py-0.5 rounded-full " +
                            (d.confidence === "high"
                              ? "bg-emerald-900/40 " +
                                "text-emerald-400"
                              : "bg-amber-900/40 " +
                                "text-amber-400")
                          }>
                            {d.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            
            <div className="border-t border-gray-800/40 mt-10 pt-10">
              <SectionHeader
                label="Fuel Costs"
                title="Petrol & Diesel Prices"
                accent="text-amber-500"
              />
              <p className="text-gray-500 text-sm mb-6 -mt-4">
                International fuel price comparison.
                {" "}{compareData.fuel.source}.
              </p>

              <ChartCard
                title="Petrol Price Per Litre (USD)"
                onShare={handleChartShare}
                shareHeadline="Fleeced at the pump"
                shareSubline="UK petrol prices vs the world"
              >
                <ResponsiveContainer width="100%" height={420}>
                  <BarChart
                    data={
                      [...compareData.fuel.data].sort(
                        (a, b) => a.petrolPerLitre - b.petrolPerLitre
                      )
                    }
                    layout="vertical"
                    margin={{ left: 100, right: 30, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      tickFormatter={(v) => "$" + v.toFixed(2)}
                    />
                    <YAxis
                      type="category"
                      dataKey="country"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      width={90}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          renderFn={(d) => (
                            <>
                              <p className="text-white font-medium">{d.country}</p>
                              <p className="text-red-400 text-xs">
                                Petrol: ${d.petrolPerLitre.toFixed(2)}/L
                              </p>
                              {d.dieselPerLitre && (
                                <p className="text-amber-400 text-xs">
                                  Diesel: ${d.dieselPerLitre.toFixed(2)}/L
                                </p>
                              )}
                            </>
                          )}
                        />
                      )}
                    />
                    <Bar dataKey="petrolPerLitre" barSize={16}>
                      {[...compareData.fuel.data]
                        .sort((a, b) => a.petrolPerLitre - b.petrolPerLitre)
                        .map((d) => (
                          <Cell
                            key={d.country}
                            fill={d.country === "UK" ? "#ef4444" : "#3b82f6"}
                            fillOpacity={d.country === "UK" ? 0.9 : 0.5}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="text-gray-500 text-xs mt-4">
                <strong className="text-gray-400">Sources:</strong>{" "}
                {compareData.fuel.source}.
              </div>
            </div>

          </div>
        )}

        {/* ===== COMPARE: STRUCTURAL PERFORMANCE ===== */}
        {view === "compare.structural" && (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                {"Economy \u203A Structural Performance"}
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Structural Performance
              </h2>
              <p className={
                "text-gray-500 text-sm mt-2"
              }>
                Long-term UK performance vs peers on
                productivity, wages, housing, and health
                capacity. OECD, ONS, and World Bank data.
              </p>
            </div>

            {/* ==== METRIC 1: PRODUCTIVITY ==== */}
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-600 mb-1"
              }>
                Metric 1
              </div>
              <h3 className={
                "text-lg font-bold text-white " +
                "uppercase tracking-tight mb-1"
              }>
                Productivity &mdash; Output per Hour
              </h3>
              <p className={
                "text-gray-500 text-xs mb-4 max-w-xl"
              }>
                {structuralData.productivity.subtitle}.{" "}
                {structuralData.productivity.methodology}
              </p>

              {/* Headline */}
              <div className={
                "border-l-2 border-cyan-500 pl-5 py-3 " +
                "mb-6 bg-cyan-950/20"
              }>
                <div className="text-white text-base font-bold">
                  {structuralData.productivity.keyFinding}
                </div>
              </div>

              {/* Chart */}
              <ChartCard
            title="GDP Per Hour Worked (USD PPP)"
            info="Labour productivity measured as GDP per hour worked in USD purchasing power parity. Source: OECD."
            editorial="UK workers produce less per hour than their French, German, or American counterparts. This gap has persisted for decades with no sign of closing."
            shareHeadline="British workers produce less per hour than France"
            shareSubline="THE PRODUCTIVITY PUZZLE PERSISTS."
            accentColor="#ef4444"
            shareData={structuralData.productivity.data.filter((d) => d.country === "UK").map(d => d.value)}
            onShare={handleChartShare}>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart
                    margin={{
                      left: 10, right: 20, top: 10, bottom: 10
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      type="number"
                      domain={[2005, 2022]}
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      tickFormatter={(v) => "$" + v}
                      domain={[30, 100]}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          renderFn={(d) => (
                            <>
                              <p className={
                                "text-white font-medium"
                              }>
                                {d.country} ({d.year})
                              </p>
                              <p className={
                                "text-cyan-400 text-xs"
                              }>
                                ${d.value}/hour
                              </p>
                            </>
                          )}
                        />
                      )}
                    />
                    {["UK", "France", "Germany", "USA"]
                      .map((c) => (
                        <Line
                          key={c}
                          data={
                            structuralData.productivity.data
                              .filter(
                                (d) => d.country === c
                              )
                          }
                          dataKey="value"
                          name={c}
                          stroke={
                            c === "UK"
                              ? "#ef4444"
                              : c === "France"
                                ? "#3b82f6"
                                : c === "Germany"
                                  ? "#f59e0b"
                                  : "#10b981"
                          }
                          strokeWidth={
                            c === "UK" ? 3 : 1.5
                          }
                          strokeOpacity={
                            c === "UK" ? 1 : 0.6
                          }
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className={
                  "flex gap-4 mt-2 justify-center " +
                  "text-xs text-gray-500"
                }>
                  {[
                    { c: "UK", col: "bg-red-500" },
                    { c: "France", col: "bg-blue-500" },
                    { c: "Germany", col: "bg-amber-500" },
                    { c: "USA", col: "bg-emerald-500" }
                  ].map((l) => (
                    <span
                      key={l.c}
                      className="flex items-center gap-1"
                    >
                      <span className={
                        "w-3 h-1.5 inline-block " + l.col
                      } />
                      {l.c}
                    </span>
                  ))}
                </div>
              </ChartCard>

              {/* Latest values table */}
              <div className="overflow-x-auto mt-4">
                <table className={
                  "w-full text-sm text-left " +
                  "border-collapse"
                }>
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "Country", "Latest (2022)",
                        "2015 Value", "Change"
                      ].map((h) => (
                        <th
                          key={h}
                          className={
                            "px-3 py-2 text-[10px] " +
                            "uppercase tracking-wider " +
                            "text-gray-500 font-medium"
                          }
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["UK", "France", "Germany", "USA"]
                      .map((c) => {
                        const latest =
                          structuralData.productivity.data
                            .filter(
                              (d) => d.country === c
                            )
                            .sort(
                              (a, b) => b.year - a.year
                            )[0];
                        const base =
                          structuralData.productivity.data
                            .find(
                              (d) =>
                                d.country === c &&
                                d.year === 2015
                            );
                        const chg = base
                          ? (
                              ((latest.value - base.value)
                              / base.value)
                              * 100
                            ).toFixed(1)
                          : null;
                        return (
                          <tr
                            key={c}
                            className={
                              "border-b " +
                              "border-gray-800/50 " +
                              (c === "UK"
                                ? "bg-red-900/10"
                                : "hover:bg-gray-900/30")
                            }
                          >
                            <td className={
                              "px-3 py-2 font-medium " +
                              (c === "UK"
                                ? "text-red-400"
                                : "text-white")
                            }>
                              {c}
                            </td>
                            <td className={
                              "px-3 py-2 font-mono " +
                              "font-semibold " +
                              (c === "UK"
                                ? "text-red-400"
                                : "text-white")
                            }>
                              ${latest.value}
                            </td>
                            <td className={
                              "px-3 py-2 font-mono " +
                              "text-gray-400"
                            }>
                              {base
                                ? "$" + base.value
                                : "\u2014"}
                            </td>
                            <td className={
                              "px-3 py-2 font-mono " +
                              (chg > 20
                                ? "text-emerald-400"
                                : "text-amber-400")
                            }>
                              {chg
                                ? "+" + chg + "%"
                                : "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="text-gray-600 text-xs mt-2 italic">
                {structuralData.productivity.limitations}
              </div>
            </div>

            <Divider />

            {/* ==== METRIC 2: REAL WAGES ==== */}
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-600 mb-1"
              }>
                Metric 2
              </div>
              <h3 className={
                "text-lg font-bold text-white " +
                "uppercase tracking-tight mb-1"
              }>
                Real Wages &mdash; Average Annual Earnings
              </h3>
              <p className={
                "text-gray-500 text-xs mb-4 max-w-xl"
              }>
                {structuralData.realWages.subtitle}.{" "}
                {structuralData.realWages.methodology}
              </p>

              <div className={
                "border-l-2 border-cyan-500 pl-5 py-3 " +
                "mb-6 bg-cyan-950/20"
              }>
                <div className="text-white text-base font-bold">
                  {structuralData.realWages.keyFinding}
                </div>
              </div>

              <ChartCard
                title="Real Average Annual Wages (2022 USD PPP)"
                onShare={handleChartShare}
                shareHeadline="Wages haven't grown in 15 years"
                shareSubline="Real average wages — Britain's lost decade(s)"
              >
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart
                    margin={{
                      left: 10, right: 20, top: 10, bottom: 10
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      type="number"
                      domain={[2000, 2023]}
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      tickFormatter={
                        (v) => "$" + (v / 1000) + "k"
                      }
                      domain={[35000, 85000]}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          renderFn={(d) => (
                            <>
                              <p className={
                                "text-white font-medium"
                              }>
                                {d.country} ({d.year})
                              </p>
                              <p className={
                                "text-cyan-400 text-xs"
                              }>
                                $
                                {d.value.toLocaleString()}
                                /year
                              </p>
                            </>
                          )}
                        />
                      )}
                    />
                    {["UK", "France", "Germany", "USA"]
                      .map((c) => (
                        <Line
                          key={c}
                          data={
                            structuralData.realWages.data
                              .filter(
                                (d) => d.country === c
                              )
                          }
                          dataKey="value"
                          name={c}
                          stroke={
                            c === "UK"
                              ? "#ef4444"
                              : c === "France"
                                ? "#3b82f6"
                                : c === "Germany"
                                  ? "#f59e0b"
                                  : "#10b981"
                          }
                          strokeWidth={
                            c === "UK" ? 3 : 1.5
                          }
                          strokeOpacity={
                            c === "UK" ? 1 : 0.6
                          }
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className={
                  "flex gap-4 mt-2 justify-center " +
                  "text-xs text-gray-500"
                }>
                  {[
                    { c: "UK", col: "bg-red-500" },
                    { c: "France", col: "bg-blue-500" },
                    { c: "Germany", col: "bg-amber-500" },
                    { c: "USA", col: "bg-emerald-500" }
                  ].map((l) => (
                    <span
                      key={l.c}
                      className="flex items-center gap-1"
                    >
                      <span className={
                        "w-3 h-1.5 inline-block " + l.col
                      } />
                      {l.c}
                    </span>
                  ))}
                </div>
              </ChartCard>

              <div className="overflow-x-auto mt-4">
                <table className={
                  "w-full text-sm text-left " +
                  "border-collapse"
                }>
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "Country", "2000", "2023",
                        "Growth"
                      ].map((h) => (
                        <th
                          key={h}
                          className={
                            "px-3 py-2 text-[10px] " +
                            "uppercase tracking-wider " +
                            "text-gray-500 font-medium"
                          }
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["UK", "France", "Germany", "USA"]
                      .map((c) => {
                        const y2000 =
                          structuralData.realWages.data
                            .find(
                              (d) =>
                                d.country === c &&
                                d.year === 2000
                            );
                        const latest =
                          structuralData.realWages.data
                            .filter(
                              (d) => d.country === c
                            )
                            .sort(
                              (a, b) => b.year - a.year
                            )[0];
                        const chg = y2000
                          ? (
                              ((latest.value
                              - y2000.value)
                              / y2000.value)
                              * 100
                            ).toFixed(0)
                          : null;
                        return (
                          <tr
                            key={c}
                            className={
                              "border-b " +
                              "border-gray-800/50 " +
                              (c === "UK"
                                ? "bg-red-900/10"
                                : "hover:bg-gray-900/30")
                            }
                          >
                            <td className={
                              "px-3 py-2 font-medium " +
                              (c === "UK"
                                ? "text-red-400"
                                : "text-white")
                            }>
                              {c}
                            </td>
                            <td className={
                              "px-3 py-2 font-mono " +
                              "text-gray-400"
                            }>
                              {y2000
                                ? "$" + y2000.value
                                    .toLocaleString()
                                : "\u2014"}
                            </td>
                            <td className={
                              "px-3 py-2 font-mono " +
                              "font-semibold " +
                              (c === "UK"
                                ? "text-red-400"
                                : "text-white")
                            }>
                              $
                              {latest.value.toLocaleString()}
                            </td>
                            <td className={
                              "px-3 py-2 font-mono " +
                              (chg >= 30
                                ? "text-emerald-400"
                                : chg >= 15
                                  ? "text-amber-400"
                                  : "text-red-400")
                            }>
                              {chg
                                ? "+" + chg + "%"
                                : "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="text-gray-600 text-xs mt-2 italic">
                {structuralData.realWages.limitations}
              </div>
            </div>

            <Divider />

            {/* ==== METRIC 3: HOUSING ==== */}
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-600 mb-1"
              }>
                Metric 3
              </div>
              <h3 className={
                "text-lg font-bold text-white " +
                "uppercase tracking-tight mb-1"
              }>
                Housing Affordability
              </h3>
              <p className={
                "text-gray-500 text-xs mb-4 max-w-xl"
              }>
                {structuralData.housingAffordability
                  .subtitle}.{" "}
                {structuralData.housingAffordability
                  .methodology}
              </p>

              <div className={
                "border-l-2 border-cyan-500 pl-5 py-3 " +
                "mb-6 bg-cyan-950/20"
              }>
                <div className={
                  "text-white text-base font-bold"
                }>
                  {structuralData.housingAffordability
                    .keyFinding}
                </div>
              </div>

              <ChartCard
                title="Price-to-Income Ratio (2015=100)"
                onShare={handleChartShare}
                shareHeadline="Houses cost 9x the average salary"
                shareSubline="Price-to-income ratio — housing unaffordability laid bare"
              >
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart
                    margin={{
                      left: 10, right: 20, top: 10, bottom: 10
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      type="number"
                      domain={[2000, 2023]}
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      domain={[60, 140]}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          renderFn={(d) => (
                            <>
                              <p className={
                                "text-white font-medium"
                              }>
                                {d.country} ({d.year})
                              </p>
                              <p className={
                                "text-cyan-400 text-xs"
                              }>
                                Index: {d.value}
                                {d.value > 100
                                  ? " (less affordable)"
                                  : " (more affordable)"}
                              </p>
                            </>
                          )}
                        />
                      )}
                    />
                    {/* 100 baseline */}
                    <Line
                      data={[
                        { year: 2000, value: 100 },
                        { year: 2023, value: 100 }
                      ]}
                      dataKey="value"
                      stroke="#374151"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1}
                    />
                    {["UK", "France", "Germany", "USA"]
                      .map((c) => (
                        <Line
                          key={c}
                          data={
                            structuralData
                              .housingAffordability.data
                              .filter(
                                (d) => d.country === c
                              )
                          }
                          dataKey="value"
                          name={c}
                          stroke={
                            c === "UK"
                              ? "#ef4444"
                              : c === "France"
                                ? "#3b82f6"
                                : c === "Germany"
                                  ? "#f59e0b"
                                  : "#10b981"
                          }
                          strokeWidth={
                            c === "UK" ? 3 : 1.5
                          }
                          strokeOpacity={
                            c === "UK" ? 1 : 0.6
                          }
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className={
                  "flex gap-4 mt-2 justify-center " +
                  "text-xs text-gray-500"
                }>
                  {[
                    { c: "UK", col: "bg-red-500" },
                    { c: "France", col: "bg-blue-500" },
                    { c: "Germany", col: "bg-amber-500" },
                    { c: "USA", col: "bg-emerald-500" }
                  ].map((l) => (
                    <span
                      key={l.c}
                      className="flex items-center gap-1"
                    >
                      <span className={
                        "w-3 h-1.5 inline-block " + l.col
                      } />
                      {l.c}
                    </span>
                  ))}
                </div>
                <div className={
                  "text-center text-gray-600 " +
                  "text-[10px] mt-1"
                }>
                  Above 100 = less affordable than 2015.
                  Below 100 = more affordable.
                </div>
              </ChartCard>

              <div className="text-gray-600 text-xs mt-2 italic">
                {structuralData.housingAffordability
                  .limitations}
              </div>
            </div>

            <Divider />

            {/* ==== METRIC 4: HOSPITAL BEDS ==== */}
            <div>
              <div className={
                "text-[9px] uppercase tracking-[0.2em] " +
                "text-gray-600 mb-1"
              }>
                Metric 4
              </div>
              <h3 className={
                "text-lg font-bold text-white " +
                "uppercase tracking-tight mb-1"
              }>
                Health System Capacity &mdash; Hospital Beds
              </h3>
              <p className={
                "text-gray-500 text-xs mb-4 max-w-xl"
              }>
                {structuralData.hospitalBeds.subtitle}.{" "}
                {structuralData.hospitalBeds.methodology}
              </p>

              <div className={
                "border-l-2 border-cyan-500 pl-5 py-3 " +
                "mb-6 bg-cyan-950/20"
              }>
                <div className={
                  "text-white text-base font-bold"
                }>
                  {structuralData.hospitalBeds.keyFinding}
                </div>
              </div>

              <ChartCard
                title="Hospital Beds Per 1,000 Population"
                onShare={handleChartShare}
                shareHeadline="Britain has fewer hospital beds than Kazakhstan"
                shareSubline="Hospital beds per 1,000 people — international comparison"
              >
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart
                    margin={{
                      left: 10, right: 20, top: 10, bottom: 10
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="year"
                      type="number"
                      domain={[2000, 2022]}
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      tick={{
                        fill: "#6b7280", fontSize: 11
                      }}
                      domain={[0, 16]}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          renderFn={(d) => (
                            <>
                              <p className={
                                "text-white font-medium"
                              }>
                                {d.country} ({d.year})
                              </p>
                              <p className={
                                "text-cyan-400 text-xs"
                              }>
                                {d.value} beds per 1,000
                              </p>
                            </>
                          )}
                        />
                      )}
                    />
                    {[
                      "UK", "France", "Germany",
                      "USA", "Japan"
                    ].map((c) => (
                      <Line
                        key={c}
                        data={
                          structuralData.hospitalBeds.data
                            .filter(
                              (d) => d.country === c
                            )
                        }
                        dataKey="value"
                        name={c}
                        stroke={
                          c === "UK"
                            ? "#ef4444"
                            : c === "France"
                              ? "#3b82f6"
                              : c === "Germany"
                                ? "#f59e0b"
                                : c === "USA"
                                  ? "#10b981"
                                  : "#a855f7"
                        }
                        strokeWidth={
                          c === "UK" ? 3 : 1.5
                        }
                        strokeOpacity={
                          c === "UK" ? 1 : 0.6
                        }
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className={
                  "flex gap-4 mt-2 justify-center " +
                  "text-xs text-gray-500"
                }>
                  {[
                    { c: "UK", col: "bg-red-500" },
                    { c: "France", col: "bg-blue-500" },
                    { c: "Germany", col: "bg-amber-500" },
                    { c: "USA", col: "bg-emerald-500" },
                    { c: "Japan", col: "bg-purple-500" }
                  ].map((l) => (
                    <span
                      key={l.c}
                      className="flex items-center gap-1"
                    >
                      <span className={
                        "w-3 h-1.5 inline-block " + l.col
                      } />
                      {l.c}
                    </span>
                  ))}
                </div>
              </ChartCard>

              {/* Latest values comparison */}
              <div className="overflow-x-auto mt-4">
                <table className={
                  "w-full text-sm text-left " +
                  "border-collapse"
                }>
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "Country", "2000", "Latest",
                        "Change"
                      ].map((h) => (
                        <th
                          key={h}
                          className={
                            "px-3 py-2 text-[10px] " +
                            "uppercase tracking-wider " +
                            "text-gray-500 font-medium"
                          }
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      "UK", "France", "Germany",
                      "USA", "Japan"
                    ].map((c) => {
                      const y2000 =
                        structuralData.hospitalBeds.data
                          .find(
                            (d) =>
                              d.country === c &&
                              d.year === 2000
                          );
                      const latest =
                        structuralData.hospitalBeds.data
                          .filter(
                            (d) => d.country === c
                          )
                          .sort(
                            (a, b) => b.year - a.year
                          )[0];
                      const chg = y2000
                        ? (
                            ((latest.value - y2000.value)
                            / y2000.value)
                            * 100
                          ).toFixed(0)
                        : null;
                      return (
                        <tr
                          key={c}
                          className={
                            "border-b " +
                            "border-gray-800/50 " +
                            (c === "UK"
                              ? "bg-red-900/10"
                              : "hover:bg-gray-900/30")
                          }
                        >
                          <td className={
                            "px-3 py-2 font-medium " +
                            (c === "UK"
                              ? "text-red-400"
                              : "text-white")
                          }>
                            {c}
                          </td>
                          <td className={
                            "px-3 py-2 font-mono " +
                            "text-gray-400"
                          }>
                            {y2000
                              ? y2000.value
                              : "\u2014"}
                          </td>
                          <td className={
                            "px-3 py-2 font-mono " +
                            "font-semibold " +
                            (c === "UK"
                              ? "text-red-400"
                              : "text-white")
                          }>
                            {latest.value}
                          </td>
                          <td className={
                            "px-3 py-2 font-mono " +
                            (chg < 0
                              ? "text-red-400"
                              : "text-gray-400")
                          }>
                            {chg
                              ? chg + "%"
                              : "\u2014"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-gray-600 text-xs mt-2 italic">
                {structuralData.hospitalBeds.limitations}
              </div>
            </div>

            <Divider />

            {/* SOURCES BLOCK */}
            <div className="space-y-3">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-500"
              }>
                Sources & Methodology
              </div>
              {[
                structuralData.productivity,
                structuralData.realWages,
                structuralData.housingAffordability,
                structuralData.hospitalBeds
              ].map((metric) => (
                <div key={metric.title} className="mb-2">
                  <div className={
                    "text-gray-400 text-xs font-medium"
                  }>
                    {metric.title}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {metric.sources.map(
                      (s) => s.name
                    ).join("; ")}.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== COMPARE: INNOVATION (G7) ===== */}

        {/* ===== COMPARE: DEFENCE ===== */}
        {view === "compare.defence" && (() => {
          const ranges = {
            "2y": 2, "5y": 5, "10y": 10, max: 999
          };
          const rangeN = ranges[defenceRange] || 5;
          const cs =
            defenceData.defenceSpendPctGDP.countries;
          const countries = [
            "US", "UK", "France", "Germany",
            "Italy", "Canada", "Japan"
          ];
          const colors = {
            US: "#6b7280", UK: "#f97316",
            France: "#6b7280", Germany: "#6b7280",
            Italy: "#6b7280", Canada: "#6b7280",
            Japan: "#6b7280"
          };

          /* Build year-keyed array */
          const yearSet = new Set();
          countries.forEach((c) => {
            if (cs[c]) cs[c].series.forEach(
              (d) => yearSet.add(d.year)
            );
          });
          const years = [...yearSet]
            .sort((a, b) => a - b)
            .slice(-rangeN);
          const chartData = years.map((yr) => {
            const row = { year: yr };
            countries.forEach((c) => {
              if (!cs[c]) return;
              const pt = cs[c].series.find(
                (d) => d.year === yr
              );
              row[c] = pt ? pt.value : null;
            });
            return row;
          });

          const hl = defenceData.headline;

          /* Latest values for bar chart */
          const latestBars = countries.map((c) => {
            const s = cs[c] ? cs[c].series : [];
            const last = s[s.length - 1];
            return {
              country: c,
              value: last ? last.value : 0,
              label: cs[c]
                ? cs[c].label : c
            };
          }).sort((a, b) => b.value - a.value);

          return (
          <div className="space-y-6">
            <div className="py-6 mb-4">
              <div className={
                "text-[10px] uppercase tracking-[0.2em] " +
                "font-medium text-gray-600 mb-2"
              }>
                International Comparison
              </div>
              <h2 className={
                "text-2xl md:text-3xl font-black " +
                "uppercase tracking-tight"
              }>
                Defence Spending
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                Spending as a share of GDP
              </p>
            </div>

            <TimeRangeControl
              range={defenceRange}
              setRange={setDefenceRange}
            />

            {/* ---- Headlines ---- */}
            <div className={
              "grid grid-cols-2 md:grid-cols-5 gap-4"
            }>
              <div className={
                "border border-gray-800/60 " +
                "rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  UK ({hl.ukLatestYear})
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {hl.ukLatestPct}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  of GDP
                </div>
              </div>

              <div className={
                "border border-orange-500/40 " +
                "rounded-lg p-4 bg-orange-950/20"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  UK Budget ({hl.ukBudgetYear || hl.ukLatestYear})
                </div>
                <div className={
                  "text-2xl font-black text-orange-400"
                }>
                  {"\u00A3"}{hl.ukBudgetBn || "—"}bn
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  total MoD spending
                </div>
              </div>

              <div className={
                "border border-gray-800/60 " +
                "rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  NATO Target
                </div>
                <div className={
                  "text-2xl font-black text-yellow-400"
                }>
                  {hl.natoTargetPct}%
                </div>
                <div className="text-xs mt-1 text-green-400">
                  UK meets target
                </div>
              </div>

              <div className={
                "border border-gray-800/60 " +
                "rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  US ({hl.ukLatestYear})
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {hl.usLatestPct}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  of GDP
                </div>
              </div>

              <div className={
                "border border-gray-800/60 " +
                "rounded-lg p-4"
              }>
                <div className={
                  "text-[10px] uppercase " +
                  "tracking-[0.15em] " +
                  "text-gray-500 mb-1"
                }>
                  UK Target
                </div>
                <div className={
                  "text-2xl font-black text-white"
                }>
                  {hl.ukTargetPct}%
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  by {hl.ukTargetYear}
                </div>
              </div>
            </div>

            <Divider />

            {/* ---- Charts side by side ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <ChartCard
                title={
                  "Defence Spending (% GDP)"
                }
                label="G7 Over Time"
                onShare={handleChartShare}
                shareHeadline="Defence spending gutted since the Cold War"
                shareSubline="UK military spending as % of GDP"
              >
                <ResponsiveContainer
                  width="100%" height={260}
                >
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    interval={
                      chartData.length > 12
                        ? Math.floor(
                            chartData.length / 6
                          ) : 0
                    }
                  />
                  <YAxis
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    tickFormatter={(v) => v + "%"}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold " +
                              "text-white mb-1"
                            }>
                              {row.year}
                            </div>
                            {countries.map((c) =>
                              row[c] != null && (
                              <div
                                key={c}
                                style={{
                                  color:
                                    c === "UK"
                                    ? "#f97316"
                                    : "#9ca3af"
                                }}
                              >
                                {cs[c]
                                  ? cs[c].label
                                  : c}: {row[c]}%
                              </div>
                              )
                            )}
                          </div>
                        )}
                      />
                    }
                  />
                  {/* NATO 2% reference line */}
                  <Line
                    type="monotone"
                    dataKey={() => 2.0}
                    stroke="#eab308"
                    strokeWidth={1}
                    strokeDasharray="6 4"
                    dot={false}
                    name="NATO 2%"
                    connectNulls
                  />
                  {countries.map((c) => (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      stroke={colors[c]}
                      strokeWidth={
                        c === "UK" ? 3 : 1
                      }
                      dot={false}
                      connectNulls
                      opacity={
                        c === "UK" ? 1 : 0.5
                      }
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className={
                "flex flex-wrap gap-3 mt-2 " +
                "text-xs text-gray-500"
              }>
                {countries.map((c) => (
                  <span
                    key={c}
                    className={
                      "flex items-center gap-1"
                    }
                  >
                    <span
                      className={
                        "inline-block w-3 h-0.5"
                      }
                      style={{
                        backgroundColor: colors[c]
                      }}
                    />
                    {cs[c] ? cs[c].label : c}
                  </span>
                ))}
                <span className={
                  "flex items-center gap-1"
                }>
                  <span className={
                    "inline-block w-3 h-0.5 " +
                    "bg-yellow-500 border-dashed"
                  } />
                  NATO 2% target
                </span>
              </div>
            </ChartCard>

            {/* ---- Bar: latest year ---- */}
            <ChartCard
              title={
                "Defence Spending by Country " +
                "(% GDP, " +
                hl.ukLatestYear + ")"
              }
              label="Latest Comparison"
              onShare={handleChartShare}
              shareHeadline="Who's actually paying for NATO?"
              shareSubline="Defence spending by country — the free-rider problem"
            >
              <ResponsiveContainer
                width="100%" height={260}
              >
                <BarChart
                  data={latestBars}
                  layout="vertical"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    tickFormatter={(v) => v + "%"}
                    domain={[0, 4]}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{
                      fill: "#9ca3af", fontSize: 11
                    }}
                    width={100}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        renderFn={(row) => (
                          <div>
                            <div className={
                              "font-bold " +
                              "text-white mb-1"
                            }>
                              {row.label}
                            </div>
                            <div className={
                              "text-orange-400"
                            }>
                              {row.value}% of GDP
                            </div>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 3, 3, 0]}
                  >
                    {latestBars.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.country === "UK"
                            ? "#f97316"
                            : "#374151"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            </div>
            <Divider />

            {/* ---- Context ---- */}
            <div className={
              "border border-gray-800/60 " +
              "rounded-lg p-5 space-y-3"
            }>
              <div className={
                "text-[10px] uppercase " +
                "tracking-[0.2em] " +
                "text-gray-500 mb-2"
              }>
                Key Context
              </div>
              <div className={
                "text-sm text-gray-400 space-y-2"
              }>
                <p>
                  NATO allies agreed to spend at least
                  2% of GDP on defence at the 2014 Wales
                  Summit. In June 2025, this target was
                  raised to 5%.
                </p>
                <p>
                  The UK has consistently met the 2%
                  target, though spending dipped close to
                  the threshold during 2014-2016 austerity.
                  The government has committed to 2.5% of
                  GDP by 2027 and 3.5% by 2035.
                </p>
                <p>
                  Germany crossed 2% for the first time
                  in 2024 following its Zeitenwende
                  announcement. Japan is rapidly
                  increasing spending under its 2022
                  National Security Strategy (target:
                  2% by 2027).
                </p>
              </div>
            </div>

            {/* ---- Sources ---- */}
            <div className={
              "text-[10px] text-gray-600 " +
              "leading-relaxed"
            }>
              Sources: SIPRI Military Expenditure
              Database (primary). Cross-checked against
              NATO Defence Expenditure Reports (2014-2025)
              and World Bank indicator MS.MIL.XPND.GD.ZS.
              SIPRI and NATO figures may differ by
              0.05-0.15pp due to definitional differences.
              UK highlighted in orange. NATO 2% guideline
              shown as dashed yellow line.
            </div>
          </div>
          );
        })()}

        
        {view === "economy.markets" && (() => {
          const lseFiltered = lseMarketsData.listedCompanies.data || [];
          const lse2024 = lseFiltered.length > 0 ? lseFiltered[lseFiltered.length - 1] : {};
          const lse2007 = lseFiltered.find(d => d.year === 2007) || {};
          const decline = lse2024.total && lse2007.total ? 100 - (100 * lse2024.total / lse2007.total) : 0;

          return (
            <div className="space-y-6">
              <div className="py-6 mb-4">
                <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                  Economy › Markets & Growth
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                  Markets & Growth
                </h2>
                <p className="text-gray-500 text-sm mt-2">
                  Tracking UK capital market competitiveness and the health of the London Stock Exchange.
                </p>
              </div>

              {/* Key finding callout */}
              <div className="border border-gray-800/60 rounded-lg p-5 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                  Key Finding
                </div>
                <div className="text-sm text-gray-400">
                  <p>
                    LSE listed companies have declined from ~3,146 (2007 peak) to 1,775 (2024), representing approximately {decline.toFixed(0)}% loss of listed entities.
                  </p>
                </div>
              </div>

              {/* LineChart: LSE companies over time */}
              <ChartPair>
              <ChartCard
            title="LSE Listed Companies (Total, Main Market, AIM)"
            info="Number of companies listed on the London Stock Exchange. Total, Main Market, and AIM breakdown. Source: LSEG."
            editorial="London\\'s stock market is shrinking. Listed companies have halved since 2007 as firms delist, merge, or choose New York instead."
            shareHeadline="London\\'s stock market is dying"
            shareSubline="LISTED COMPANIES HALVED SINCE 2007."
            accentColor="#ef4444"
            shareData={lseFiltered.map(d => d.total)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Listed Companies"
                  geo="UK (LSE)"
                  unit="count"
                  data={lseFiltered}
                  dateKey="year"
                  source="LSE / Refinitiv"
                  freq="annual"
                  fullData={lseFiltered}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={lseFiltered}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      interval={3}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.year}</div>
                              <div className="text-white font-medium">Total: {d.total}</div>
                              <div className="text-blue-400 text-xs">Main Market: {d.mainMarket}</div>
                              <div className="text-amber-400 text-xs">AIM: {d.aim}</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Line dataKey="total" stroke="white" strokeWidth={2} dot={false} />
                    <Line dataKey="mainMarket" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                    <Line dataKey="aim" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* BarChart: IPO count over time */}
              <ChartCard
            title="IPO Activity (Count)"
            info="Number of new listings (IPOs) per year on the LSE. Source: EY UK IPO Report / LSEG."
            editorial="IPO activity has collapsed. In 2023, London had fewer new listings than at any point since records began. Companies are choosing New York."
            shareHeadline="London IPOs at record low"
            shareSubline="NOBODY WANTS TO LIST HERE."
            accentColor="#ef4444"
            shareData={lseMarketsData.ipos.data || [].map(d => d.count)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="IPO Count"
                  geo="UK (LSE)"
                  unit="count"
                  data={lseMarketsData.ipos.data || []}
                  dateKey="year"
                  source="LSE"
                  freq="annual"
                  fullData={lseMarketsData.ipos.data || []}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={lseMarketsData.ipos.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.year}</div>
                              <div className="text-red-400 font-medium">{d.count} IPOs</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="count" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              </ChartPair>
              {/* AreaChart: IPO proceeds over time */}
              <ChartPair>
              <ChartCard
            title="IPO Proceeds Over Time"
            info="Total capital raised by Initial Public Offerings on UK exchanges over time, measuring market vitality."
            editorial="UK IPO market has dried up. Companies aren't coming to public markets. Capital raising is weak."
            shareHeadline="IPO market showing signs of weakness"
            shareSubline="FUNDRAISING DOWN."
            accentColor="#F97316"
            shareData={lseMarketsData.ipos.data || [].map(d => d.proceedsM)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="IPO Proceeds"
                  geo="UK (LSE)"
                  unit="£m"
                  data={lseMarketsData.ipos.data || []}
                  dateKey="year"
                  source="LSE"
                  freq="annual"
                  fullData={lseMarketsData.ipos.data || []}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={lseMarketsData.ipos.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => "£" + (v / 1000).toFixed(0) + "bn"}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.year}</div>
                              <div className="text-green-400 font-medium">£{(d.proceedsM / 1000).toFixed(1)}bn</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Area dataKey="proceedsM" fill="#10b981" stroke="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Peer exchange comparison */}
              <ChartCard
            title="Global Exchange Comparison (Listed Companies, 2024)"
            info="Number of listed companies on major global stock exchanges as of 2024, comparing market depth."
            editorial="London Stock Exchange is shrinking compared to global rivals. We're losing companies to US and Asian exchanges."
            shareHeadline="London losing ground to global exchanges"
            shareSubline="LISTINGS DECLINING."
            accentColor="#F97316"
            shareData={lseMarketsData.peerExchanges.data || [].map(d => d.listed)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Listed Companies by Exchange"
                  geo="Global"
                  unit="count"
                  data={lseMarketsData.peerExchanges.data || []}
                  dateKey="exchange"
                  source="World Federation of Exchanges"
                  freq="2024"
                  fullData={lseMarketsData.peerExchanges.data || []}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={lseMarketsData.peerExchanges.data || []}
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis
                      dataKey="exchange"
                      type="category"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      width={90}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.exchange}</div>
                              <div className="text-white font-medium">{d.listed} listed</div>
                              <div className="text-gray-500 text-xs">{d.country}</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="listed" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              </ChartPair>
              {/* Sources */}
              <div className="text-[10px] text-gray-600 leading-relaxed">
                Sources: London Stock Exchange (LSE), World Federation of Exchanges, Refinitiv.
                Historical listing data standardised across market segments.
              </div>
            </div>
          );
        })()}

        {view === "government.apd" && (() => {
          const apdRates = apdData.rates.data || [];
          const apdRevenue = apdData.revenue.data || [];
          const apdPassengers = apdData.passengers.data || [];
          const latestRate = apdRates.length > 0 ? apdRates[apdRates.length - 1] : {};

          return (
            <div className="space-y-6">
              <div className="py-6 mb-4">
                <div className="text-[10px] uppercase tracking-[0.2em] font-medium text-gray-600 mb-2">
                  Government › Taxes & Charges
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                  Air Passenger Duty
                </h2>
                <p className="text-gray-500 text-sm mt-2">
                  Tracking the UK flight tax burden over time and its impact on aviation.
                </p>
              </div>

              {/* Key finding callout */}
              <div className="border border-gray-800/60 rounded-lg p-5 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                  30-Year Trajectory
                </div>
                <div className="text-sm text-gray-400">
                  <p>
                    APD short-haul rates have increased from £5 in 1994 to £{latestRate.shortHaul || 16} in 2026,
                    representing approximately a 220% increase over three decades.
                  </p>
                </div>
              </div>

              {/* LineChart: APD rates */}
              <ChartPair>
              <ChartCard
            title="Short-Haul APD Rate Over Time (£)"
            info="Air Passenger Duty rate for short-haul flights (up to 2,000km), showing tax escalation over time."
            editorial="APD has ballooned, making UK flights more expensive than European alternatives. We're pricing ourselves out of the market."
            shareHeadline="Air passenger duty killing UK aviation"
            shareSubline="TAX RATES SOARING."
            accentColor="#EF4444"
            shareData={apdRates.map(d => d.shortHaul)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="APD Rate (Short-Haul)"
                  geo="UK"
                  unit="£"
                  data={apdRates}
                  dateKey="year"
                  source="HM Treasury / HMRC"
                  freq="annual"
                  fullData={apdRates}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={apdRates}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      interval={3}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => "£" + v}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.year}</div>
                              <div className="text-red-400 font-medium">£{d.shortHaul}</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Line dataKey="shortHaul" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* AreaChart: APD revenue */}
              <ChartCard
            title="APD Revenue Over Time (£m)"
            info="Total revenue collected from Air Passenger Duty, measured in millions of pounds."
            editorial="Government is squeezing airlines and passengers, raking in revenue while destroying UK aviation competitiveness."
            shareHeadline="Government taxes aviation into decline"
            shareSubline="£3BN+ ANNUAL REVENUE."
            accentColor="#EF4444"
            shareData={apdRevenue.map(d => d.revenueM)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="APD Revenue"
                  geo="UK"
                  unit="£m"
                  data={apdRevenue}
                  dateKey="year"
                  source="HM Treasury / HMRC"
                  freq="annual"
                  fullData={apdRevenue}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={apdRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => "£" + (v / 1000).toFixed(0) + "bn"}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.year}</div>
                              <div className="text-green-400 font-medium">£{(d.revenueM / 1000).toFixed(1)}bn</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Area dataKey="revenueM" fill="#10b981" stroke="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              </ChartPair>
              {/* ComposedChart: Passengers + Revenue */}
              <ChartCard
            title="Passenger Volume & APD Revenue"
            info="Relationship between passenger numbers and APD tax revenue, showing how aviation taxes affect traffic."
            editorial="As APD rises, passenger numbers fall. The tax is working—but destroying the aviation industry in the process."
            shareHeadline="Higher taxes driving passengers away from UK airports"
            shareSubline="INVERSE RELATIONSHIP."
            accentColor="#EF4444"
            shareData={apdPassengers.map(d => d.passengers)}
            onShare={handleChartShare}>
                <ChartMeta
                  metric="Passengers & APD Revenue"
                  geo="UK"
                  unit="Mixed"
                  data={apdPassengers}
                  dateKey="year"
                  source="Civil Aviation Authority / HM Treasury"
                  freq="annual"
                  fullData={apdPassengers}
                />
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={apdPassengers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => (v / 1000000).toFixed(0) + "m"}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => "£" + (v / 1000).toFixed(0) + "bn"}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          renderFn={(d) => (
                            <div>
                              <div className="text-gray-400 text-xs">{d.year}</div>
                              <div className="text-blue-400 text-xs">Passengers: {(d.passengers / 1000000).toFixed(1)}m</div>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar yAxisId="left" dataKey="passengers" fill="#3b82f6" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Band structure note */}
              <div className="border border-gray-800/60 rounded-lg p-5 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                  Methodology
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>
                    APD has been progressively increased over the past three decades.
                    The tax applies to passengers departing UK airports. Band structure has evolved:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>1994: Single rate of £5 introduced</li>
                    <li>2007-2020: Two-band structure (standard and higher)</li>
                    <li>2021-2025: Three-band structure (children under 16 exempt since 2021)</li>
                    <li>2026 onwards: Revised bands and rates</li>
                  </ul>
                </div>
              </div>

              {/* Sources */}
              <div className="text-[10px] text-gray-600 leading-relaxed">
                Sources: HM Treasury, HMRC Tax and Duty Manual, Civil Aviation Authority (CAA).
              </div>
            </div>
          );
        })()}


{/* ============ LEAGUE TABLES — LANDING ============ */}

        {/* ============ LEAGUE — DEPARTMENTS ============ */}
        {view === "league.departments" && (() => {
          const league = buildDeptLeague(projects);
          const sorted = [...league].sort(
            (a, b) => {
              if (leagueSortBy === "score")
                return leagueSortDir === "desc"
                  ? b.score - a.score
                  : a.score - b.score;
              if (leagueSortBy === "overrun")
                return leagueSortDir === "desc"
                  ? b.totalOverrun - a.totalOverrun
                  : a.totalOverrun - b.totalOverrun;
              if (leagueSortBy === "overrunPct")
                return leagueSortDir === "desc"
                  ? b.overrunPct - a.overrunPct
                  : a.overrunPct - b.overrunPct;
              if (leagueSortBy === "wasted")
                return leagueSortDir === "desc"
                  ? b.cancelledSpend
                    - a.cancelledSpend
                  : a.cancelledSpend
                    - b.cancelledSpend;
              if (leagueSortBy === "projects")
                return leagueSortDir === "desc"
                  ? b.projectCount - a.projectCount
                  : a.projectCount - b.projectCount;
              if (leagueSortBy === "pctOver")
                return leagueSortDir === "desc"
                  ? b.pctOverBudget
                    - a.pctOverBudget
                  : a.pctOverBudget
                    - b.pctOverBudget;
              return b.score - a.score;
            }
          );
          // Apply search
          const filtered = leagueSearch
            ? sorted.filter((d) =>
              d.dept.toLowerCase().includes(
                leagueSearch.toLowerCase()
              ))
            : sorted;
          // Totals
          const totals = filtered.reduce(
            (acc, d) => ({
              depts: acc.depts + 1,
              projects: acc.projects
                + d.projectCount,
              spend: acc.spend + d.totalLatest,
              overrun: acc.overrun
                + d.totalOverrun,
              wasted: acc.wasted
                + d.cancelledSpend
            }),
            {
              depts: 0, projects: 0,
              spend: 0, overrun: 0, wasted: 0
            }
          );

          return (
            <div>
              <PageHeader
                eyebrow={"Waste & Projects \u203A Department Rankings"}
                title="Department Rankings"
                dataAsOf="Mar 2025"
                description={
                  "Ranked by budget performance " +
                  "score. Departments that " +
                  "repeatedly exceed budgets, " +
                  "cancel projects, or waste " +
                  "public money score highest."
                }
              />

              <QuickViewBar
                presets={LEAGUE_DEPT_PRESETS}
                active={leagueQuickView}
                onSelect={
                  handleLeagueDeptQuickView
                }
              />

              <SummaryStrip metrics={[
                {
                  label: "Departments",
                  value: totals.depts
                },
                {
                  label: "Projects",
                  value: totals.projects
                },
                {
                  label: "Total Spend",
                  value: fmt(totals.spend)
                },
                {
                  label: "Total Overrun",
                  value: fmt(totals.overrun),
                  red: true
                },
                {
                  label: "Cancelled / Wasted",
                  value: fmt(totals.wasted),
                  red: true
                }
              ]} />

              <FilterBar
                search={{
                  value: leagueSearch,
                  onChange: setLeagueSearch,
                  placeholder:
                    "Search departments"
                }}
                hasActiveFilters={
                  leagueSearch !== ""
                }
                onClear={() => {
                  setLeagueSearch("");
                  setLeagueQuickView(null);
                }}
              />

              <MethodologyNote
                title="Scoring Methodology"
              >
                Performance Score
                (0{"\u2013"}100): 40% overrun
                ratio + 30% proportion of
                projects over budget + 20%
                cancellation rate + 10% average
                overrun magnitude (log-scaled).
                Higher = worse.
              </MethodologyNote>

              <DataTableShell
                columns={[
                  { key: "rank", label: "#",
                    span: 1 },
                  { key: "dept", label: "Department",
                    span: 3 },
                  { key: "score", label: "Score",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "spend", label: "Spend",
                    span: 1, align: "right" },
                  { key: "overrun", label: "Overrun",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "overrunPct", label: "Ovr %",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "wasted", label: "Wasted",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "projects", label: "Proj",
                    span: 1, align: "right",
                    sortable: true },
                  { key: "pctOver",
                    label: "% Over Budget",
                    span: 2, align: "right",
                    sortable: true }
                ]}
                sortBy={leagueSortBy}
                sortDir={leagueSortDir}
                onSort={(id) => {
                  if (leagueSortBy === id) {
                    setLeagueSortDir((d) =>
                      d === "desc"
                        ? "asc" : "desc"
                    );
                  } else {
                    setLeagueSortBy(id);
                    setLeagueSortDir("desc");
                  }
                }}
                count={filtered.length}
                emptyMessage={
                  "No departments match your search"
                }
                totals={[
                  { span: 1, content: "" },
                  { span: 3, content:
                    totals.depts + " dept" +
                    (totals.depts !== 1
                      ? "s" : ""),
                    className:
                      "uppercase tracking-[0.1em] " +
                      "text-[9px]"
                  },
                  { span: 1, content: "" },
                  { span: 1, align: "right",
                    content: fmt(totals.spend),
                    bold: true },
                  { span: 1, align: "right",
                    content:
                      "+" + fmt(totals.overrun),
                    className: "text-red-400" },
                  { span: 1, content: "" },
                  { span: 1, align: "right",
                    content: fmt(totals.wasted),
                    className: "text-red-400" },
                  { span: 1, align: "right",
                    content: totals.projects,
                    bold: true },
                  { span: 2, content: "" }
                ]}
              >
                {filtered.map((d, rank) => (
                  <div key={d.dept}>
                    <button
                      onClick={() =>
                        setLeagueExpanded(
                          leagueExpanded === d.dept
                            ? null : d.dept
                        )
                      }
                      className={
                        "w-full min-w-[640px] grid grid-cols-12 " +
                        "gap-2 px-4 py-3 " +
                        "border-b border-gray-800/30 " +
                        "text-left " +
                        "hover:bg-white/[0.02] " +
                        "transition-colors " +
                        "items-center " +
                        (leagueExpanded === d.dept
                          ? "bg-white/[0.02]" : "")
                      }
                    >
                      <div className={
                        "col-span-1 text-gray-600 " +
                        "text-sm font-mono"
                      }>
                        {rank + 1}
                      </div>
                      <div className={
                        "col-span-3 text-sm " +
                        "font-semibold text-gray-200 " +
                        "truncate"
                      }>
                        {d.dept}
                      </div>
                      <div className={
                        "col-span-1 text-right"
                      }>
                        <span className={
                          "text-sm font-black " +
                          "font-mono " +
                          (d.score >= 60
                            ? "text-red-500"
                            : d.score >= 35
                              ? "text-amber-500"
                              : "text-gray-400")
                        }>
                          {d.score}
                        </span>
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "text-xs text-gray-500 " +
                        "font-mono"
                      }>
                        {fmt(d.totalLatest)}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "text-xs font-mono " +
                        (d.totalOverrun > 0
                          ? "text-red-400"
                          : "text-gray-500")
                      }>
                        {d.totalOverrun > 0
                          ? "+" + fmt(d.totalOverrun)
                          : "\u2014"}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "text-xs font-mono " +
                        (d.overrunPct > 50
                          ? "text-red-400"
                          : d.overrunPct > 20
                            ? "text-amber-400"
                            : "text-gray-500")
                      }>
                        {d.overrunPct > 0
                          ? "+" + d.overrunPct
                            .toFixed(0) + "%"
                          : "\u2014"}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "text-xs font-mono " +
                        (d.cancelledSpend > 0
                          ? "text-red-400"
                          : "text-gray-600")
                      }>
                        {d.cancelledSpend > 0
                          ? fmt(d.cancelledSpend)
                          : "\u2014"}
                      </div>
                      <div className={
                        "col-span-1 text-right " +
                        "text-xs text-gray-400 " +
                        "font-mono"
                      }>
                        {d.projectCount}
                      </div>
                      <div className={
                        "col-span-2 text-right"
                      }>
                        <div className={
                          "flex items-center " +
                          "justify-end gap-2"
                        }>
                          <div className={
                            "w-16 h-1.5 bg-gray-800 " +
                            "rounded-full overflow-hidden"
                          }>
                            <div
                              className={
                                "h-full rounded-full " +
                                (d.pctOverBudget >= 75
                                  ? "bg-red-500"
                                  : d.pctOverBudget >= 50
                                    ? "bg-amber-500"
                                    : "bg-gray-500")
                              }
                              style={{
                                width: Math.min(
                                  d.pctOverBudget, 100
                                ) + "%"
                              }}
                            />
                          </div>
                          <span className={
                            "text-xs font-mono " +
                            (d.pctOverBudget >= 75
                              ? "text-red-400"
                              : "text-gray-400")
                          }>
                            {d.pctOverBudget
                              .toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {leagueExpanded === d.dept && (
                      <div className={
                        "px-4 py-5 " +
                        "border-b border-gray-800/30 " +
                        "bg-gray-950/50"
                      }>
                        <div className={
                          "grid grid-cols-1 " +
                          "md:grid-cols-3 gap-6 mb-5"
                        }>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Avg Overrun / Project
                            </div>
                            <div className={
                              "text-lg font-black " +
                              "text-white mt-0.5"
                            }>
                              {fmt(Math.round(
                                d.avgOverrun
                              ))}
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Cancellation Rate
                            </div>
                            <div className={
                              "text-lg font-black " +
                              (d.pctCancelled > 0
                                ? "text-red-500"
                                : "text-white") +
                              " mt-0.5"
                            }>
                              {d.pctCancelled
                                .toFixed(0)}%
                            </div>
                          </div>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3"
                          }>
                            <div className={
                              "text-[9px] uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 font-mono"
                            }>
                              Original Budget
                            </div>
                            <div className={
                              "text-lg font-black " +
                              "text-white mt-0.5"
                            }>
                              {fmt(d.totalOrig)}
                            </div>
                          </div>
                        </div>
                        <div className={
                          "text-[9px] uppercase " +
                          "tracking-[0.2em] " +
                          "text-gray-600 font-mono " +
                          "mb-2"
                        }>
                          Worst projects by overrun
                        </div>
                        <div className={
                          "space-y-2"
                        }>
                          {d.worstProjects.map(
                            (p) => {
                              const ov =
                                p.latestBudget
                                - p.originalBudget;
                              return (
                                <div
                                  key={p.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSourceProject(
                                      sourceProject
                                        && sourceProject
                                          .name === p.name
                                        ? null : p
                                    );
                                  }}
                                  className={
                                    "flex items-center " +
                                    "justify-between " +
                                    "py-1.5 border-b " +
                                    "border-gray-800/20 " +
                                    "cursor-pointer " +
                                    "hover:bg-white/" +
                                    "[0.02] " +
                                    "transition-colors"
                                  }
                                >
                                  <div>
                                    <div className={
                                      "text-sm " +
                                      "text-gray-300"
                                    }>
                                      {p.name}
                                    </div>
                                    <div className={
                                      "text-[10px] " +
                                      "text-gray-600 " +
                                      "font-mono"
                                    }>
                                      {p.status}
                                    </div>
                                  </div>
                                  <div className={
                                    "text-right"
                                  }>
                                    <div className={
                                      "text-sm " +
                                      "font-mono " +
                                      "font-bold " +
                                      (ov > 0
                                        ? "text-red-400"
                                        : "text-gray-400")
                                    }>
                                      {ov > 0
                                        ? "+" + fmt(ov)
                                        : fmt(ov)}
                                    </div>
                                    <div className={
                                      "text-[10px] " +
                                      "text-gray-600 " +
                                      "font-mono"
                                    }>
                                      {p.originalBudget
                                        > 0
                                        ? "+" + (
                                          (ov /
                                          p.originalBudget)
                                          * 100
                                        ).toFixed(0) + "%"
                                        : ""}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                        <div className={
                          "text-[9px] text-gray-700 " +
                          "font-mono mt-3 " +
                          "tracking-[0.1em]"
                        }>
                          Source: NAO Major Projects,
                          IPA Annual Reports,
                          departmental accounts.
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </DataTableShell>

              {/* ========= BIGGEST OVERRUNS BY PROJECT ========= */}
              <div className="mt-8 border-t border-gray-800/50 pt-8">
                <ChartCard
                  label="Absolute Cost"
                  title="Biggest Overruns by Project"
                  onShare={handleChartShare}
                  shareHeadline="These projects cost billions more than planned"
                  shareSubline="The UK's worst infrastructure cost overruns"
                >
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={overrunChart}
                      layout="vertical"
                      margin={{ left: 10, right: 20 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fill: "#4b5563", fontSize: 10 }}
                        tickFormatter={(v) => fmt(v)}
                        axisLine={{ stroke: "#1f2937" }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={160}
                        tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "monospace" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => (
                          <CustomTooltip
                            active={active}
                            payload={payload}
                            renderFn={ttOverrun}
                          />
                        )}
                      />
                      <Bar dataKey="overrun" radius={[0, 2, 2, 0]} barSize={18}>
                        {overrunChart.map((d, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? "#ef4444" : "#e5e7eb"}
                            fillOpacity={i === 0 ? 1 : 0.15}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <SourcesFooter>
                NAO Major Projects reports;
                IPA Annual Report;
                Public Accounts Committee;
                departmental annual reports
                and accounts.
                <div className="mt-2 text-gray-700">
                  Department names normalised
                  where naming varies across
                  reporting periods. All figures
                  from the best available public
                  data. Scores are mechanically
                  derived from the formula above.
                </div>
              </SourcesFooter>
            </div>
          );
        })()}

        {/* ============ LEAGUE CONSULTANCY ============ */}
        {view === "league.consultancy" && (() => {
          // Currency formatter
          const fmtCon = (v) => {
            if (v >= 1e9) {
              return "£" + (v / 1e9).toFixed(1) + "bn";
            }
            if (v >= 1e6) {
              return "£" + (v / 1e6).toFixed(0) + "m";
            }
            if (v >= 1e3) {
              return "£" + (v / 1e3).toFixed(0) + "k";
            }
            return "£" + v.toFixed(0);
          };

          // Build league data
          const depLeague = buildConsultancyLeague(
            consultancyRaw,
            departmentHeadcounts,
            conFirmFilter,
            conCatFilter,
            conRouteFilter
          );

          // Sort department league
          let deptSorted = [...depLeague].sort((a, b) => {
            if (conSortBy === "depScore") {
              return conSortDir === "desc"
                ? b.depScore - a.depScore
                : a.depScore - b.depScore;
            }
            if (conSortBy === "spend") {
              return conSortDir === "desc"
                ? b.totalSpend - a.totalSpend
                : a.totalSpend - b.totalSpend;
            }
            if (conSortBy === "spendEmp") {
              return conSortDir === "desc"
                ? (b.spendPerEmployee || 0) -
                  (a.spendPerEmployee || 0)
                : (a.spendPerEmployee || 0) -
                  (b.spendPerEmployee || 0);
            }
            if (conSortBy === "concentration") {
              return conSortDir === "desc"
                ? b.concentration - a.concentration
                : a.concentration - b.concentration;
            }
            if (conSortBy === "contracts") {
              return conSortDir === "desc"
                ? b.n - a.n
                : a.n - b.n;
            }
            return b.depScore - a.depScore;
          });

          // Apply search filter
          const deptFiltered = conSearch
            ? deptSorted.filter((d) =>
              d.dept.toLowerCase().includes(
                conSearch.toLowerCase()
              )
            )
            : deptSorted;

          // Build firm league
          const firmLeague = buildFirmLeague(
            consultancyRaw,
            conFirmFilter,
            conCatFilter,
            conRouteFilter
          );

          // Sort firm league
          let firmSorted = [...firmLeague].sort((a, b) => {
            if (conSortBy === "depScore") {
              return conSortDir === "desc"
                ? b.totalSpend - a.totalSpend
                : a.totalSpend - b.totalSpend;
            }
            if (conSortBy === "spend") {
              return conSortDir === "desc"
                ? b.totalSpend - a.totalSpend
                : a.totalSpend - b.totalSpend;
            }
            if (conSortBy === "contracts") {
              return conSortDir === "desc"
                ? b.n - a.n
                : a.n - b.n;
            }
            return b.totalSpend - a.totalSpend;
          });

          // Apply search to firms
          const firmFiltered = conSearch
            ? firmSorted.filter((f) =>
              f.display.toLowerCase().includes(
                conSearch.toLowerCase()
              )
            )
            : firmSorted;

          // Compute totals
          const workingLeague = conViewMode ===
            "department" ? deptFiltered : firmFiltered;
          const totalDepts = conViewMode ===
            "department"
            ? deptFiltered.length
            : new Set(workingLeague
              .flatMap((d) => d.depts || [])).size;
          const totalContracts = workingLeague
            .reduce((s, d) => s + d.n, 0);
          const totalSpend = workingLeague
            .reduce((s, d) => s + d.totalSpend, 0);
          const totalFirms = conViewMode ===
            "department"
            ? new Set(deptFiltered
              .flatMap((d) => d.topFirms
                .map((f) => f.name))).size
            : firmFiltered.length;

          // Get unique categories and routes
          const allCats = new Set(
            consultancyRaw.map((c) =>
              c.contractCategory)
          );
          const allRoutes = new Set(
            consultancyRaw.map((c) =>
              c.procurementRoute)
          );

          return (
            <div>
              <PageHeader
                eyebrow={"Waste & Projects \u203A Consultancy Spend"}
                title="Consultancy Dependency Rankings"
                description={
                  "Ranked by consultant dependency " +
                  "score. Departments with high " +
                  "concentration among few firms, " +
                  "large average contract sizes, " +
                  "or high spending relative to " +
                  "staff score highest."
                }
              />

              <QuickViewBar
                presets={LEAGUE_CON_PRESETS}
                active={conLeagueQuickView}
                onSelect={
                  handleLeagueConQuickView
                }
              />

              <SummaryStrip metrics={[
                {
                  label: conViewMode ===
                    "department"
                    ? "Departments"
                    : "Firms",
                  value: totalDepts
                },
                {
                  label: "Contracts",
                  value: totalContracts
                },
                {
                  label: "Total Spend",
                  value: fmtCon(totalSpend)
                },
                {
                  label: conViewMode ===
                    "department"
                    ? "Top Firms"
                    : "Departments",
                  value: totalFirms
                }
              ]} />

              <FilterBar
                search={{
                  value: conSearch,
                  onChange: setConSearch,
                  placeholder:
                    conViewMode === "department"
                      ? "Search departments"
                      : "Search firms"
                }}
                filters={[
                  {
                    value: conCatFilter,
                    onChange: setConCatFilter,
                    options: [
                      { value: "",
                        label: "All Categories" },
                      ...[...allCats].sort().map(
                        (c) => ({
                          value: c, label: c
                        })
                      )
                    ]
                  },
                  {
                    value: conRouteFilter,
                    onChange: setConRouteFilter,
                    options: [
                      { value: "",
                        label: "All Routes" },
                      ...[...allRoutes].sort().map(
                        (r) => ({
                          value: r, label: r
                        })
                      )
                    ]
                  }
                ]}
                hasActiveFilters={
                  conSearch !== "" ||
                  conCatFilter !== "" ||
                  conRouteFilter !== ""
                }
                onClear={() => {
                  setConSearch("");
                  setConCatFilter("");
                  setConRouteFilter("");
                  setConLeagueQuickView(null);
                }}
              >
                {/* View mode toggle */}
                <div className={
                  "flex gap-1 border " +
                  "border-gray-800 rounded"
                }>
                  {[
                    { id: "department",
                      label: "By Department" },
                    { id: "firm",
                      label: "By Firm" }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        setConViewMode(m.id)
                      }
                      className={
                        "text-[9px] uppercase " +
                        "tracking-[0.1em] " +
                        "px-3 py-1.5 transition " +
                        (conViewMode === m.id
                          ? "bg-white/[0.08] " +
                            "text-white " +
                            "border-r " +
                            "border-gray-800"
                          : "text-gray-600 " +
                            "hover:text-gray-400")
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </FilterBar>

              <MethodologyNote
                title={
                  "Consultant Dependency Score"
                }
              >
                35% concentration (top 3 firms
                % share) + 25% spend per
                employee + 25% average contract
                size + 15% contract count. All
                normalised to 0{"\u2013"}100. Higher
                = more dependent on consultants.
              </MethodologyNote>

              {/* Department View */}
              {conViewMode === "department" && (
                <DataTableShell
                  columns={[
                    { key: "rank", label: "#",
                      span: 1 },
                    { key: "dept",
                      label: "Department",
                      span: 2 },
                    { key: "depScore",
                      label: "Dep. Score",
                      span: 1, align: "right",
                      sortable: true },
                    { key: "spend",
                      label: "Spend",
                      span: 1, align: "right",
                      sortable: true },
                    { key: "spendEmp",
                      label: "$/Emp",
                      span: 1, align: "right",
                      sortable: true },
                    { key: "contracts",
                      label: "Contracts",
                      span: 1, align: "right",
                      sortable: true },
                    { key: "avgSize",
                      label: "Avg Size",
                      span: 1, align: "right" },
                    { key: "topFirms",
                      label: "Top Firms",
                      span: 2, align: "right" },
                    { key: "concentration",
                      label: "Concentration",
                      span: 2, align: "right",
                      sortable: true }
                  ]}
                  sortBy={conSortBy}
                  sortDir={conSortDir}
                  onSort={(id) => {
                    if (conSortBy === id) {
                      setConSortDir((d) =>
                        d === "desc"
                          ? "asc" : "desc"
                      );
                    } else {
                      setConSortBy(id);
                      setConSortDir("desc");
                    }
                  }}
                  count={deptFiltered.length}
                  emptyMessage={
                    "No departments match " +
                    "your search"
                  }
                  totals={[
                    { span: 3, content:
                      "Subtotal",
                      className:
                        "uppercase " +
                        "tracking-[0.1em] " +
                        "text-[9px]" },
                    { span: 1, content: "\u2014",
                      align: "right" },
                    { span: 1, align: "right",
                      content:
                        fmtCon(totalSpend),
                      bold: true },
                    { span: 1, content: "\u2014",
                      align: "right" },
                    { span: 1, align: "right",
                      content: totalContracts,
                      bold: true },
                    { span: 5, content: "" }
                  ]}
                >
                  {deptFiltered.map((d, rank) => (
                    <div key={d.dept}>
                      <button
                        onClick={() =>
                          setConExpanded(
                            conExpanded === d.dept
                              ? null : d.dept
                          )
                        }
                        className={
                          "w-full min-w-[640px] grid grid-cols-12 " +
                          "gap-2 px-4 py-3 " +
                          "border-b border-gray-800/30 " +
                          "text-left " +
                          "hover:bg-white/[0.02] " +
                          "transition-colors " +
                          "items-center text-sm " +
                          (conExpanded === d.dept
                            ? "bg-white/[0.02]" : "")
                        }
                      >
                        <div className={
                          "col-span-1 " +
                          "text-gray-600 font-mono"
                        }>
                          {rank + 1}
                        </div>
                        <div className={
                          "col-span-2 " +
                          "font-semibold text-gray-200 " +
                          "truncate"
                        }>
                          {d.dept}
                        </div>
                        <div className={
                          "col-span-1 text-right"
                        }>
                          <span className={
                            "font-black font-mono " +
                            (d.depScore >= 60
                              ? "text-red-500"
                              : d.depScore >= 35
                                ? "text-amber-500"
                                : "text-gray-400")
                          }>
                            {d.depScore}
                          </span>
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-500 " +
                          "font-mono"
                        }>
                          {fmtCon(d.totalSpend)}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs font-mono " +
                          (d.spendPerEmployee
                            ? "text-gray-400"
                            : "text-gray-700")
                        }>
                          {d.spendPerEmployee
                            ? fmtCon(
                              d.spendPerEmployee
                            )
                            : "\u2014"}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-400 " +
                          "font-mono"
                        }>
                          {d.n}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-500 " +
                          "font-mono"
                        }>
                          {fmtCon(d.avgSize)}
                        </div>
                        <div className={
                          "col-span-2 text-right " +
                          "text-xs text-gray-400 " +
                          "font-mono truncate"
                        }>
                          {d.topFirms
                            .slice(0, 2)
                            .map((f) => f.name)
                            .join(", ")}
                        </div>
                        <div className={
                          "col-span-2 text-right"
                        }>
                          <div className={
                            "flex items-center " +
                            "justify-end gap-2"
                          }>
                            <div className={
                              "w-12 h-1.5 " +
                              "bg-gray-800 rounded " +
                              "overflow-hidden"
                            }>
                              <div
                                className={
                                  "h-full rounded " +
                                  (d.concentration
                                    >= 75
                                    ? "bg-red-500"
                                    : d.concentration
                                      >= 50
                                      ? "bg-amber-500"
                                      : "bg-gray-500")
                                }
                                style={{
                                  width: Math.min(
                                    d.concentration,
                                    100
                                  ) + "%"
                                }}
                              />
                            </div>
                            <span className={
                              "text-xs " +
                              "font-mono " +
                              (d.concentration >= 75
                                ? "text-red-400"
                                : "text-gray-400")
                            }>
                              {d.concentration
                                .toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {conExpanded === d.dept && (
                        <div className={
                          "px-4 py-5 " +
                          "border-b border-gray-800/30 " +
                          "bg-gray-950/50"
                        }>
                          <div className={
                            "grid grid-cols-1 " +
                            "md:grid-cols-3 gap-6 " +
                            "mb-5"
                          }>
                            <div className={
                              "border-l-2 " +
                              "border-gray-700 pl-3"
                            }>
                              <div className={
                                "text-[9px] " +
                                "uppercase " +
                                "tracking-[0.15em] " +
                                "text-gray-600 " +
                                "font-mono"
                              }>
                                Top 3 Firms
                              </div>
                              <div className={
                                "text-lg font-black " +
                                "text-white mt-2 " +
                                "space-y-1"
                              }>
                                {d.topFirms
                                  .slice(0, 3)
                                  .map((f, i) => (
                                    <div
                                      key={i}
                                      className={
                                        "text-sm"
                                      }
                                    >
                                      {i + 1}. {f.name}
                                      {" "}
                                      <span
                                        className={
                                          "text-xs " +
                                          "text-gray-500 " +
                                          "block"
                                        }
                                      >
                                        {fmtCon(
                                          f.spend
                                        )}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                            <div className={
                              "border-l-2 " +
                              "border-gray-700 pl-3"
                            }>
                              <div className={
                                "text-[9px] " +
                                "uppercase " +
                                "tracking-[0.15em] " +
                                "text-gray-600 " +
                                "font-mono"
                              }>
                                Categories
                              </div>
                              <div className={
                                "text-sm " +
                                "text-gray-300 " +
                                "mt-2 space-y-1"
                              }>
                                {Object.entries(
                                  d.catBreakdown
                                )
                                  .sort((a, b) =>
                                    b[1] - a[1]
                                  )
                                  .slice(0, 3)
                                  .map(([cat, v]) => (
                                    <div
                                      key={cat}
                                      className={
                                        "flex " +
                                        "justify-between"
                                      }
                                    >
                                      <span>
                                        {cat}
                                      </span>
                                      <span
                                        className={
                                          "text-xs " +
                                          "text-gray-500"
                                        }
                                      >
                                        {fmtCon(v)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                            <div className={
                              "border-l-2 " +
                              "border-gray-700 pl-3"
                            }>
                              <div className={
                                "text-[9px] " +
                                "uppercase " +
                                "tracking-[0.15em] " +
                                "text-gray-600 " +
                                "font-mono"
                              }>
                                Routes
                              </div>
                              <div className={
                                "text-sm " +
                                "text-gray-300 " +
                                "mt-2 space-y-1"
                              }>
                                {Object.entries(
                                  d.routeBreakdown
                                )
                                  .sort((a, b) =>
                                    b[1] - a[1]
                                  )
                                  .slice(0, 3)
                                  .map(([route, c]) => (
                                    <div
                                      key={route}
                                      className={
                                        "flex " +
                                        "justify-between"
                                      }
                                    >
                                      <span>
                                        {route}
                                      </span>
                                      <span
                                        className={
                                          "text-xs " +
                                          "text-gray-500"
                                        }
                                      >
                                        ({c})
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                          <div className={
                            "text-[9px] uppercase " +
                            "tracking-[0.2em] " +
                            "text-gray-600 " +
                            "font-mono mb-2"
                          }>
                            Top Contracts
                          </div>
                          <div className={
                            "space-y-2"
                          }>
                            {d.contracts
                              .slice(0, 5)
                              .map((c, i) => (
                                <div
                                  key={i}
                                  className={
                                    "flex " +
                                    "items-center " +
                                    "justify-between " +
                                    "py-1.5 border-b " +
                                    "border-gray-800/20"
                                  }
                                >
                                  <div>
                                    <div
                                      className={
                                        "text-sm " +
                                        "text-gray-300"
                                      }
                                    >
                                      {c.contractTitle
                                        .slice(0, 40)}
                                    </div>
                                    <div
                                      className={
                                        "text-[10px] " +
                                        "text-gray-600 " +
                                        "font-mono"
                                      }
                                    >
                                      {c.normalizedCompanyName
                                        || c.companyName}
                                    </div>
                                  </div>
                                  <div
                                    className={
                                      "text-xs " +
                                      "font-mono " +
                                      "text-gray-400"
                                    }
                                  >
                                    {fmtCon(
                                      c.contractValue
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </DataTableShell>
              )}

              {/* Firm View */}
              {conViewMode === "firm" && (
                <DataTableShell
                  columns={[
                    { key: "rank", label: "#",
                      span: 1 },
                    { key: "firm", label: "Firm",
                      span: 3 },
                    { key: "type", label: "Type",
                      span: 1 },
                    { key: "spend",
                      label: "Spend",
                      span: 1, align: "right",
                      sortable: true },
                    { key: "contracts",
                      label: "Contracts",
                      span: 1, align: "right",
                      sortable: true },
                    { key: "avgSize",
                      label: "Avg Size",
                      span: 1, align: "right" },
                    { key: "depts",
                      label: "Depts",
                      span: 1, align: "right" },
                    { key: "topContract",
                      label: "Top Contract",
                      span: 3, align: "right" }
                  ]}
                  sortBy={conSortBy}
                  sortDir={conSortDir}
                  onSort={(id) => {
                    if (conSortBy === id) {
                      setConSortDir((d) =>
                        d === "desc"
                          ? "asc" : "desc"
                      );
                    } else {
                      setConSortBy(id);
                      setConSortDir("desc");
                    }
                  }}
                  count={firmFiltered.length}
                  emptyMessage={
                    "No firms match your search"
                  }
                  totals={[
                    { span: 4, content:
                      "Subtotal",
                      className:
                        "uppercase " +
                        "tracking-[0.1em] " +
                        "text-[9px]" },
                    { span: 1, content: "" },
                    { span: 1, align: "right",
                      content:
                        fmtCon(totalSpend),
                      bold: true },
                    { span: 1, align: "right",
                      content: totalContracts,
                      bold: true },
                    { span: 5, content: "" }
                  ]}
                >
                  {firmFiltered.map((f, rank) => (
                    <div key={f.firm}>
                      <button
                        onClick={() =>
                          setConExpanded(
                            conExpanded === f.firm
                              ? null : f.firm
                          )
                        }
                        className={
                          "w-full min-w-[640px] " +
                          "grid grid-cols-12 " +
                          "gap-2 px-4 py-3 " +
                          "border-b border-gray-800/30 " +
                          "text-left " +
                          "hover:bg-white/[0.02] " +
                          "transition-colors " +
                          "items-center text-sm " +
                          (conExpanded === f.firm
                            ? "bg-white/[0.02]" : "")
                        }
                      >
                        <div className={
                          "col-span-1 " +
                          "text-gray-600 font-mono"
                        }>
                          {rank + 1}
                        </div>
                        <div className={
                          "col-span-3 " +
                          "font-semibold text-gray-200"
                        }>
                          {f.display}
                        </div>
                        <div className={
                          "col-span-1 " +
                          "text-xs text-gray-500 " +
                          "font-mono"
                        }>
                          {f.type}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-500 " +
                          "font-mono"
                        }>
                          {fmtCon(f.totalSpend)}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-400 " +
                          "font-mono"
                        }>
                          {f.n}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-500 " +
                          "font-mono"
                        }>
                          {fmtCon(f.avgSize)}
                        </div>
                        <div className={
                          "col-span-1 text-right " +
                          "text-xs text-gray-400 " +
                          "font-mono"
                        }>
                          {f.deptCount}
                        </div>
                        <div className={
                          "col-span-3 text-right " +
                          "text-xs text-gray-400 " +
                          "font-mono truncate"
                        }>
                          {f.topContracts[0]
                            ? fmtCon(
                              f.topContracts[0]
                                .contractValue
                            )
                            : "\u2014"}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {conExpanded === f.firm && (
                        <div className={
                          "px-4 py-5 " +
                          "border-b border-gray-800/30 " +
                          "bg-gray-950/50"
                        }>
                          <div className={
                            "border-l-2 " +
                            "border-gray-700 pl-3 " +
                            "mb-5"
                          }>
                            <div className={
                              "text-[9px] " +
                              "uppercase " +
                              "tracking-[0.15em] " +
                              "text-gray-600 " +
                              "font-mono"
                            }>
                              Departments Served
                            </div>
                            <div className={
                              "text-sm " +
                              "text-gray-300 mt-2 " +
                              "space-y-1"
                            }>
                              {f.depts
                                .sort()
                                .map((d) => (
                                  <div key={d}>
                                    {d}
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div className={
                            "text-[9px] uppercase " +
                            "tracking-[0.2em] " +
                            "text-gray-600 " +
                            "font-mono mb-2"
                          }>
                            Top Contracts
                          </div>
                          <div className={
                            "space-y-2"
                          }>
                            {f.topContracts
                              .slice(0, 5)
                              .map((c, i) => (
                                <div
                                  key={i}
                                  className={
                                    "flex " +
                                    "items-center " +
                                    "justify-between " +
                                    "py-1.5 border-b " +
                                    "border-gray-800/20"
                                  }
                                >
                                  <div>
                                    <div
                                      className={
                                        "text-sm " +
                                        "text-gray-300"
                                      }
                                    >
                                      {c.contractTitle
                                        .slice(0, 40)}
                                    </div>
                                    <div
                                      className={
                                        "text-[10px] " +
                                        "text-gray-600 " +
                                        "font-mono"
                                      }
                                    >
                                      {c.department}
                                    </div>
                                  </div>
                                  <div
                                    className={
                                      "text-xs " +
                                      "font-mono " +
                                      "text-gray-400"
                                    }
                                  >
                                    {fmtCon(
                                      c.contractValue
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </DataTableShell>
              )}

              <SourcesFooter>
                GOV.UK Contracts Finder;
                Cabinet Office transparency data;
                departmental spending returns.
                <div className="mt-2 text-gray-700">
                  Firm names normalised to parent
                  company level where applicable.
                  Contract values as reported.
                  Scores derived mechanically from
                  formula above.
                </div>
              </SourcesFooter>
            </div>
          );
        })()}

      </main>

      {/* FOOTER */}
      <footer className={
        "border-t border-gray-800 mt-12"
      }>
        <div className={
          "max-w-7xl mx-auto px-4 py-6 " +
          "flex flex-wrap items-center " +
          "justify-between gap-4"
        }>
          <div>
            <a
              href="/about"
              className={
                "text-gray-500 text-[13px] " +
                "hover:text-gray-300 transition-colors " +
                "underline underline-offset-4 " +
                "decoration-gray-800 hover:decoration-gray-600"
              }
            >
              About Gracchus
            </a>
            <div className={
              "text-gray-600 text-xs mt-1 " +
              "leading-relaxed"
            }>
              Sources: NAO, GOV.UK, ONS, OECD,
              DWP, Cabinet Office, IPA.
            </div>
          </div>
          <div className="text-right">
            <div className={
              "flex items-center gap-2 " +
              "justify-end"
            }>
              <div className={
                "w-1.5 h-1.5 rounded-full " +
                "bg-emerald-500"
              } />
              <span className={
                "text-[11px] font-mono " +
                "text-gray-400 " +
                "tracking-wide"
              }>
                Data verified {refreshMeta.lastVerifiedMonth}
              </span>
            </div>
            <div className={
              "text-[10px] text-gray-700 " +
              "font-mono mt-1 " +
              "tracking-[0.1em]"
            }>
              Non-partisan. Source-backed.
            </div>
          </div>
        </div>
      </footer>

      {/* Source attribution strip */}
      {sourceProject &&
        sourceProject.sources &&
        sourceProject.sources.length > 0 &&
        !selectedProject && (
        <div className={
          "fixed bottom-0 left-0 right-0 " +
          "z-40 border-t border-gray-800/60 " +
          "bg-[#0a0a0a]/95 backdrop-blur-sm"
        }>
          <div className={
            "max-w-7xl mx-auto px-3 sm:px-6 " +
            "py-3 flex flex-col sm:flex-row " +
            "sm:items-center justify-between gap-2 sm:gap-4"
          }>
            <div className={
              "flex items-center gap-4 " +
              "min-w-0 flex-1"
            }>
              <div className={
                "flex-shrink-0 text-[9px] " +
                "uppercase tracking-[0.2em] " +
                "text-gray-600 font-mono"
              }>
                Source
              </div>
              <div className={
                "flex items-center gap-3 " +
                "min-w-0 flex-1"
              }>
                <div className={
                  "text-[12px] text-gray-400 " +
                  "font-mono truncate " +
                  "flex-shrink-0"
                }>
                  {sourceProject.name}
                </div>
                <div className={
                  "w-px h-3 bg-gray-800 " +
                  "flex-shrink-0"
                } />
                {sourceProject.sources.map(
                  (s, si) => (
                  <a
                    key={si}
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      "flex items-center " +
                      "gap-1 text-[11px] " +
                      "font-mono text-gray-500 " +
                      "hover:text-white " +
                      "transition-colors " +
                      "flex-shrink-0"
                    }
                  >
                    <ExternalLink size={9} />
                    {s.replace(
                      /^https?:\/\/(www\.)?/,
                      ""
                    ).split("/")[0]}
                  </a>
                ))}
                {sourceProject.lastUpdated && (
                  <span className={
                    "text-[9px] text-gray-700 " +
                    "font-mono flex-shrink-0"
                  }>
                    Updated{" "}
                    {sourceProject.lastUpdated}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() =>
                setSourceProject(null)
              }
              className={
                "text-gray-700 " +
                "hover:text-gray-400 " +
                "transition-colors " +
                "flex-shrink-0"
              }
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onNavigate={(viewId) => {
            setSelectedProject(null);
            setView(viewId);
          }}
        />
      )}
    </div>
  );
}
