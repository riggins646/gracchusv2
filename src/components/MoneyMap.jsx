"use client";

/* =========================================================================
 *  MoneyMap.jsx — Gracchus Money Map (MVP)
 *
 *  Money-only, 3 entity types (buyer / supplier / project), contract-award
 *  edges, and 3 scores (buyer-concentration HHI, supplier-dependence,
 *  repeat-win rate). Curated default of ~30 featured nodes shown on first
 *  load; user can widen to Tier A+B or include softer links (Tier C/D) via
 *  the filter chips.
 *
 *  Rendering approach: d3-force simulation in an SVG, with d3-zoom on an
 *  outer <g> for smooth pan/zoom. Bubbles are radial-gradient filled for
 *  spherical depth. The physics never fully settles (alphaTarget is kept
 *  at 0.003) so nodes drift gently like Bubblemaps. React owns the shell
 *  (filters, rails, drawer) and d3 owns the canvas (nodes, edges, zoom).
 *
 *  The render path is designed so React renders the container once and
 *  d3 manages bubble attributes directly — avoids reconciliation per tick.
 * ========================================================================= */

import {
  useEffect, useMemo, useRef, useState, useCallback
} from "react";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, forceCenter } from "d3-force";
import { scaleSqrt } from "d3-scale";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { drag as d3drag } from "d3-drag";
import { color as d3color } from "d3-color";
import "d3-transition"; // side-effect — attaches .transition() to selections
import { X, ArrowLeft, ExternalLink, Download, ChevronDown } from "lucide-react";
import CiteChip from "./CiteChip";
import useDrawerFocus from "../lib/useDrawerFocus";

/* ---------- constants ---------- */
const TYPE_COLOUR = {
  supplier: "#94a3b8",
  buyer:    "#60a5fa",
  project:  "#a78bfa",
};

const TIER_STYLE = {
  A: { dash: null,    opacity: 0.78, colour: "#e5e7eb", width: 1.6 },
  B: { dash: null,    opacity: 0.55, colour: "#b8b8c2", width: 1.3 },
  C: { dash: "5 4",   opacity: 0.60, colour: "#8a8a94", width: 1.2 },
  D: { dash: "1 3.5", opacity: 0.40, colour: "#7a7a84", width: 1.0 },
};

const WIDTH = 1200;
const HEIGHT = 720;

const CLUSTER_CX = { buyer: 520, supplier: 700, project: 600 };
const CLUSTER_CY = { buyer: 320, supplier: 380, project: 500 };

/* Min-£ filter steps. Exposed as a constant so the cycler chip and the
   (future) URL deeplink parser agree on the allowed set. */
const MIN_GBP_STEPS = [100_000, 1_000_000, 10_000_000, 100_000_000];

/* HHI bands — US DoJ / FTC horizontal merger guidelines convention:
     < 0.15  = unconcentrated / competitive
     0.15 – 0.25 = moderately concentrated
     > 0.25  = highly concentrated.
   We render a small qualitative pill next to the HHI figure in the
   drawer so non-specialists can interpret the number without clicking
   through to Methodology. */
function hhiBand(v) {
  if (v == null || !isFinite(v)) return null;
  if (v < 0.15) return { label: "Competitive",   tone: "good",  hint: "HHI < 0.15 — unconcentrated market." };
  if (v < 0.25) return { label: "Moderate",      tone: "warn",  hint: "HHI 0.15–0.25 — moderately concentrated." };
  return                 { label: "Concentrated", tone: "bad",   hint: "HHI > 0.25 — highly concentrated. One buyer/supplier dominates." };
}

/* Single-buyer dependence bands. Supplier dependence is the share of a
   supplier's £ that came from its single largest public buyer. We treat
   >= 80% as captive, 50–80% as reliant, and below that as diversified. */
function dependenceBand(v) {
  if (v == null || !isFinite(v)) return null;
  if (v >= 0.8) return { label: "Captive",     tone: "bad",  hint: "≥ 80% of £ from one buyer. High risk of political capture." };
  if (v >= 0.5) return { label: "Reliant",     tone: "warn", hint: "50–80% of £ from one buyer. Vulnerable to procurement changes." };
  return                 { label: "Diversified", tone: "good", hint: "< 50% from any one buyer. Healthy buyer spread." };
}

/* ---------- URL deeplink helpers ----------
   Money Map is mounted from Dashboard at pathname `/money-map`. Rather
   than reach for Next's useSearchParams (which needs a Suspense wrapper
   in app-router) we use the plain URLSearchParams API + history.replaceState
   so editors can share a link like
   `/money-map?view=lens&lens=supplier-bae-systems&tier=AB&min=1000000&q=hs2`
   and land on that exact subgraph. */
function readUrlState() {
  if (typeof window === "undefined") return {};
  try {
    const p = new URLSearchParams(window.location.search);
    const out = {};
    const v = p.get("view");
    if (v === "lens" || v === "network") out.view = v;
    const lens = p.get("lens"); if (lens) out.lens = lens;
    const tier = p.get("tier"); if (tier === "AB" || tier === "ABCD") out.tier = tier;
    const min  = p.get("min");  if (min && !isNaN(+min)) out.min = +min;
    const q    = p.get("q");    if (q) out.q = q;
    return out;
  } catch { return {}; }
}
function writeUrlState({ view, lens, tier, min, q }) {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams();
    if (view && view !== "lens")    p.set("view", view);
    if (lens)                       p.set("lens", lens);
    if (tier && tier !== "AB")      p.set("tier", tier);
    if (min  && min !== 1_000_000)  p.set("min", String(min));
    if (q)                          p.set("q", q);
    const qs = p.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "");
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  } catch { /* no-op — URL writing is a nice-to-have */ }
}

/* ---------- formatting helpers ---------- */
function fmtGBP(v) {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1e9) return `£${(v / 1e9).toFixed(1)}bn`;
  if (v >= 1e6) return `£${(v / 1e6).toFixed(0)}m`;
  if (v >= 1e3) return `£${(v / 1e3).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}

/* Amount formatter for context where zero almost always means
   "we have a named source for the relationship but no public £
   figure" rather than a real zero. This is the truthful label for
   project-member edges, framework call-offs, and redacted award
   notices — which is most of the £0s you see in our data.

   See the "Why undisclosed?" note in the drawer for the four
   causes and what it would take to pry each loose. */
function fmtGBPOrUndisclosed(v) {
  if (v == null || !isFinite(v) || v === 0) return "Undisclosed";
  return fmtGBP(v);
}
function isUndisclosed(v) {
  return v == null || !isFinite(v) || v === 0;
}
function fmtPct(p) {
  if (p == null || !isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}
function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch { return iso; }
}

/* =========================================================================
 *  MOBILE LIST VIEW (audit rec #98)
 * =========================================================================
 *  At <md, a force-directed graph is cognitively hostile on a 375px
 *  viewport — tap targets are tiny, the canvas fights the page scroll,
 *  and readers can't tell which bubble links to which. This component
 *  replaces the canvas with a top-20 suppliers list: supplier name,
 *  total £, project/department count, top buyer. Tapping a row opens
 *  the same SupplierDetail drawer as a canvas bubble click.
 * ========================================================================= */
function MoneyMapMobileList({ rows, onSelectSupplier }) {
  if (!rows || rows.length === 0) {
    return (
      <section className="mm-mobile-list mm-mobile-list-empty">
        No suppliers meet the £ threshold in the current data.
      </section>
    );
  }
  return (
    <section className="mm-mobile-list" aria-label="Top suppliers list">
      <div className="mm-mobile-list-h">
        Top suppliers by total £{" "}
        <span className="mm-mobile-list-hint">
          tap a row for supplier details
        </span>
      </div>
      {rows.map((r) => {
        const secondary = [];
        if (r.projectCount > 0) {
          secondary.push(
            `${r.projectCount} project${r.projectCount === 1 ? "" : "s"}`
          );
        }
        if (r.deptCount > 0) {
          secondary.push(
            `${r.deptCount} department${r.deptCount === 1 ? "" : "s"}`
          );
        } else if (r.buyerCount > 0) {
          secondary.push(
            `${r.buyerCount} buyer${r.buyerCount === 1 ? "" : "s"}`
          );
        }
        if (r.topBuyer) secondary.push(`${r.topBuyer} top buyer`);
        return (
          <button
            type="button"
            key={r.id}
            className="mm-mobile-list-row"
            onClick={() => onSelectSupplier(r.id)}
          >
            <div className="mm-mobile-list-row-top">
              <span className="mm-mobile-list-name">{r.label}</span>
              <span className="mm-mobile-list-amount">
                {fmtGBP(r.totalGBP)}
              </span>
            </div>
            {secondary.length > 0 && (
              <div className="mm-mobile-list-sub">
                {secondary.join(" · ")}
              </div>
            )}
          </button>
        );
      })}
    </section>
  );
}

/* =========================================================================
 *  MAIN COMPONENT
 * ========================================================================= */

export default function MoneyMap({
  data,
  onBack,
  // 2026-04-20 — bubble node clicks up to Dashboard so supplier and project
  // selections open the global SupplierDetail / ProjectDetail drawers.
  // Both are optional; absence preserves the in-Money-Map drawer behaviour.
  onOpenSupplierProfile,
  onOpenProjectProfile,
  onOpenBuyerProfile,
}) {
  /* ---------- view modes ----------
     "lens"    — ego-network view: pick one entity, show only its 1–2 hop
                 neighbourhood. Good for answering "who is connected to X?"
                 and surfacing quiet repeat-offender patterns. Default on
                 first load because the "firehose" network view was too
                 hectic for this use.
     "network" — the firehose: curated featured entities + their award
                 edges. Good for "show me the scale of the thing."

     First-paint state is seeded from `?view=…&lens=…&tier=…&min=…&q=…`
     so shared links land on the exact subgraph. We read the URL in a
     useState initialiser so the first render is correct — but only on
     the client. The useEffect below catches SSR hydration and re-seeds
     if the initial render was server-side. */
  const urlInit = useMemo(() => readUrlState(), []);
  const [viewMode, setViewMode] = useState(() => urlInit.view || "lens");
  const [lensSubjectId, setLensSubjectId] = useState(() => {
    // Default subject: the URL's lens= (if it resolves to a real node)
    // or the first curated featured id. featuredIds is sorted by
    // editorial priority in the precompute step, so [0] is a reasonable
    // landing entity.
    if (urlInit.lens && data.nodes?.some((n) => n.id === urlInit.lens)) return urlInit.lens;
    return (data.featuredIds && data.featuredIds[0]) ||
           (data.nodes && data.nodes[0] && data.nodes[0].id) ||
           null;
  });

  const [tierFilter, setTierFilter] = useState(() => urlInit.tier || "AB"); // "AB" | "ABCD"
  const [minGBP, setMinGBP] = useState(() =>
    MIN_GBP_STEPS.includes(urlInit.min) ? urlInit.min : 1_000_000
  );
  const [query, setQuery] = useState(() => urlInit.q || "");
  const [selection, setSelection] = useState(null);   // { kind, id } | null

  /* ---------- mobile layout mode (audit rec #98) ----------
     At <md (767px and below), the force-directed graph is cognitively
     hostile — tap targets are tiny, gestures collide with the page
     scroll, and a reader can't tell which bubble connects to which.
     Default to a top-suppliers LIST view on those widths; desktop
     default stays "canvas". The layout mode is orthogonal to
     viewMode (lens/network) — a reader can still toggle lens-vs-
     network while inside the list view, since the list is derived
     from the same edge set.
     SSR-safe: matchMedia only runs on the client, so we seed
     "canvas" initially and re-seed in a useEffect after mount. */
  const [layoutMode, setLayoutMode] = useState("canvas");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setLayoutMode("list");
    }
  }, []);

  /* Body scroll-lock while the drawer is open so mobile users don't get
     the background scrolling behind the overlay. No-op on desktop. */
  useEffect(() => {
    if (!selection) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [selection]);

  /* Sync state → URL on any change. Uses replaceState so we don't
     pollute the browser's Back/Forward stack while a user tweaks
     filters — they can still press Back to leave the Money Map. */
  useEffect(() => {
    writeUrlState({ view: viewMode, lens: lensSubjectId, tier: tierFilter, min: minGBP, q: query });
  }, [viewMode, lensSubjectId, tierFilter, minGBP, query]);

  // ---------- derived ----------
  const nodesById = useMemo(() => {
    const m = new Map();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  const featuredSet = useMemo(
    () => new Set(data.featuredIds || []),
    [data.featuredIds]
  );

  const lensSubjectNode = viewMode === "lens" && lensSubjectId
    ? nodesById.get(lensSubjectId)
    : null;

  /* ---------- top suppliers derivation (audit rec #98) ----------
     For the mobile list view, precompute the top 20 suppliers by
     total £ along with project count, department count, and their
     top buyer. Derived from award edges (kind=award, s=buyer,
     t=supplier) so it naturally stays in sync with the dataset and
     doesn't need its own precompute step. */
  const topSuppliers = useMemo(() => {
    const projByS = new Map();   // supplierId -> Set(projectId)
    const buyersByS = new Map(); // supplierId -> Set(buyerId)
    const deptsByS = new Map();  // supplierId -> Set(deptName)
    for (const e of (data.edges || [])) {
      if (!e || e.kind !== "award") continue;
      const s = e.s, t = e.t;
      if (typeof s !== "string" || typeof t !== "string") continue;
      if (!s.startsWith("buyer-") || !t.startsWith("supplier-")) continue;
      if (!projByS.has(t)) projByS.set(t, new Set());
      if (!buyersByS.has(t)) buyersByS.set(t, new Set());
      if (!deptsByS.has(t)) deptsByS.set(t, new Set());
      for (const pid of (e.projectIds || [])) projByS.get(t).add(pid);
      buyersByS.get(t).add(s);
      const buyer = nodesById.get(s);
      if (buyer && buyer.department) deptsByS.get(t).add(buyer.department);
    }
    const out = [];
    for (const n of (data.nodes || [])) {
      if (n.kind !== "supplier") continue;
      if (!(n.value > 0)) continue;
      out.push({
        id: n.id,
        label: n.label,
        totalGBP: n.value,
        projectCount: (projByS.get(n.id) || new Set()).size,
        deptCount: (deptsByS.get(n.id) || new Set()).size,
        buyerCount: (buyersByS.get(n.id) || new Set()).size || n.buyerCount || 0,
        topBuyer: n.topBuyer?.label || null,
      });
    }
    out.sort((a, b) => b.totalGBP - a.totalGBP);
    return out.slice(0, 20);
  }, [data.edges, data.nodes, nodesById]);

  /* ---------- rotating Story Cards ----------
     Same pattern as Story of the Week on the home page: take the full
     editorial pool, anchor a rotation on ISO-week-of-year so every
     reader globally sees the same curated slice this week, and show
     the first SHOW_N after the rotation offset. Keeps the rail alive
     for returning readers without requiring the data team to re-author
     cards every week. */
  const rotatedStoryCards = useMemo(() => {
    const pool = Array.isArray(data.storyCards) ? data.storyCards.slice() : [];
    if (pool.length <= 4) return pool;
    const SHOW_N = 4;
    const now = new Date();
    const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((now - jan1) / (1000 * 60 * 60 * 24));
    const weekIdx = Math.floor(dayOfYear / 7);
    const start = ((weekIdx % pool.length) + pool.length) % pool.length;
    // Wrap around the pool so every reader gets SHOW_N cards even near the end.
    return Array.from({ length: SHOW_N }, (_, i) => pool[(start + i) % pool.length]);
  }, [data.storyCards]);

  /* Which edges are visible given view mode + tier + £ filters.

     In LENS mode, we do a 2-hop BFS from the lens subject across both
     award and project-member edges, then filter edges to those whose
     endpoints both survived the BFS. This gives the "ego network" — the
     subject + all its contract relationships + the other departments /
     projects those suppliers also work with. The second hop is what makes
     repeat-offender patterns visible (supplier X works for HS2 *and*
     Hinkley *and* Crossrail all show up together).

     In NETWORK mode, we use the featured-anchored filter from v1. */
  const q = query.trim().toLowerCase();
  const filteredEdges = useMemo(() => {
    const allowed = tierFilter === "AB"
      ? new Set(["A", "B"])
      : new Set(["A", "B", "C", "D"]);

    /* ---------------- LENS mode ---------------- */
    if (viewMode === "lens" && lensSubjectId && nodesById.has(lensSubjectId)) {
      const allAwards = (data.edges?.awards || []).filter((e) => {
        if (!allowed.has(e.tier)) return false;
        if ((e.totalGBP || 0) < minGBP) return false;
        return nodesById.has(e.s) && nodesById.has(e.t);
      });
      const allMembers = (data.edges?.projectMembers || []).filter((e) => {
        if (!allowed.has(e.tier)) return false;
        return nodesById.has(e.s) && nodesById.has(e.t);
      });
      const all = [...allAwards, ...allMembers];

      // Hop 1 — direct neighbours of the subject
      const hop1 = new Set([lensSubjectId]);
      for (const e of all) {
        if (e.s === lensSubjectId) hop1.add(e.t);
        if (e.t === lensSubjectId) hop1.add(e.s);
      }
      // Hop 2 — neighbours of neighbours
      const hop2 = new Set(hop1);
      for (const e of all) {
        if (hop1.has(e.s)) hop2.add(e.t);
        if (hop1.has(e.t)) hop2.add(e.s);
      }

      // Apply free-text query as a *narrowing* filter on hop-2 only —
      // hop-1 always stays so the subject's immediate ring is intact.
      let nodeSet = hop2;
      if (q) {
        nodeSet = new Set(hop1);
        for (const id of hop2) {
          if (hop1.has(id)) continue;
          const n = nodesById.get(id);
          if (n && (n.label || "").toLowerCase().includes(q)) nodeSet.add(id);
        }
      }

      const awards = allAwards.filter(
        (e) => nodeSet.has(e.s) && nodeSet.has(e.t)
      );
      const projectMembers = allMembers.filter(
        (e) => nodeSet.has(e.s) && nodeSet.has(e.t)
      );
      return {
        awards, projectMembers, reachable: nodeSet,
        hop1, subject: lensSubjectId,
      };
    }

    /* ---------------- NETWORK mode (v1) ---------------- */
    const awards = (data.edges?.awards || []).filter((e) => {
      if (!allowed.has(e.tier)) return false;
      if ((e.totalGBP || 0) < minGBP) return false;
      const s = nodesById.get(e.s);
      const t = nodesById.get(e.t);
      if (!s || !t) return false;
      if (q) {
        const hit = (s.label || "").toLowerCase().includes(q) ||
                    (t.label || "").toLowerCase().includes(q);
        if (!hit) return false;
      } else {
        if (!featuredSet.has(e.s) && !featuredSet.has(e.t)) return false;
      }
      return true;
    });

    // Project-membership edges: keep if both endpoints are already reachable
    // from the awards subgraph. They don't carry £ but give visual grouping.
    const reachable = new Set();
    awards.forEach((e) => { reachable.add(e.s); reachable.add(e.t); });

    const projectMembers = (data.edges?.projectMembers || []).filter((e) => {
      if (!allowed.has(e.tier)) return false;
      // Include project edge if its supplier is already on screen, OR
      // project is in featured set.
      return reachable.has(e.t) || featuredSet.has(e.s) || featuredSet.has(e.t);
    });

    // Promote featured projects whose supplier appears in awards
    projectMembers.forEach((e) => { reachable.add(e.s); reachable.add(e.t); });

    return { awards, projectMembers, reachable, hop1: null, subject: null };
  }, [data.edges, tierFilter, minGBP, q, featuredSet, nodesById, viewMode, lensSubjectId]);

  const visibleNodes = useMemo(() => {
    const arr = [];
    for (const id of filteredEdges.reachable) {
      const n = nodesById.get(id);
      if (n) arr.push(n);
    }
    return arr;
  }, [filteredEdges.reachable, nodesById]);

  const visibleEdges = useMemo(() => {
    return [
      ...filteredEdges.awards.map((e) => ({ ...e, _kind: "award" })),
      ...filteredEdges.projectMembers.map((e) => ({ ...e, _kind: "project" })),
    ];
  }, [filteredEdges]);

  const selected = selection
    ? selection.kind === "node"
      ? { node: nodesById.get(selection.id), edge: null }
      : {
          node: null,
          edge:
            (data.edges?.awards || []).find((x) => x.id === selection.id) ||
            (data.edges?.projectMembers || []).find((x) => x.id === selection.id),
        }
    : null;

  // ---------- canvas ----------
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const zoomRef = useRef(null);
  const runIdRef = useRef(0);

  /* Full canvas rebuild. Runs whenever visible nodes/edges change (which
     happens when filters change). We do a clean teardown + rebuild rather
     than try to do d3 general-update-pattern merges — the node sets are
     small enough (<100 typically) that a full rebuild is fine and keeps
     the code readable. */
  useEffect(() => {
    if (!svgRef.current) return;
    const runId = ++runIdRef.current;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

    /* ---------- defs (gradients + glow) ---------- */
    const defs = svg.append("defs");
    Object.entries(TYPE_COLOUR).forEach(([kind, hex]) => {
      const c = d3color(hex);
      const lighter = c.brighter(0.9).formatHex();
      const darker  = c.darker(1.4).formatHex();
      const g = defs.append("radialGradient")
        .attr("id", `mm-grad-${kind}`)
        .attr("cx", "35%").attr("cy", "32%").attr("r", "70%");
      g.append("stop").attr("offset", "0%").attr("stop-color", lighter).attr("stop-opacity", 0.95);
      g.append("stop").attr("offset", "45%").attr("stop-color", hex).attr("stop-opacity", 0.9);
      g.append("stop").attr("offset", "100%").attr("stop-color", darker).attr("stop-opacity", 1);
    });
    const glow = defs.append("filter").attr("id", "mm-glow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const fe = glow.append("feMerge");
    fe.append("feMergeNode").attr("in", "blur");
    fe.append("feMergeNode").attr("in", "SourceGraphic");

    /* ---------- layers ---------- */
    const root = svg.append("g").attr("class", "mm-root");
    const edgeG  = root.append("g").attr("class", "mm-edges");
    const nodeG  = root.append("g").attr("class", "mm-nodes");
    const labelG = root.append("g").attr("class", "mm-labels");

    /* ---------- size ---------- */
    const maxValue = visibleNodes.reduce((m, n) => Math.max(m, n.value || 0), 1);
    const radius = scaleSqrt().domain([0, maxValue]).range([14, 72]);
    const nodeData = visibleNodes.map((n) => ({
      ...n,
      r: radius(Math.max(1, n.value || 1)),
      type: n.kind,
    }));
    const nodeIdSet = new Set(nodeData.map((n) => n.id));

    const linkData = visibleEdges
      .filter((e) => nodeIdSet.has(e.s) && nodeIdSet.has(e.t))
      .map((e) => ({
        ...e,
        source: e.s,
        target: e.t,
      }));

    /* ---------- simulation ---------- */
    const sim = forceSimulation(nodeData)
      .force("link",
        forceLink(linkData).id((d) => d.id)
          .distance((l) => 90 + (l.source.r || 30) + (l.target.r || 30))
          .strength(0.16)
      )
      .force("charge", forceManyBody().strength((d) => -90 - d.r * 3))
      .force("collide", forceCollide().radius((d) => d.r + 4).strength(0.9).iterations(2))
      .force("x", forceX((d) => CLUSTER_CX[d.type] || WIDTH / 2).strength(0.025))
      .force("y", forceY((d) => CLUSTER_CY[d.type] || HEIGHT / 2).strength(0.035))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2).strength(0.03))
      .alphaDecay(0.008)
      .alphaMin(0.0008)
      .velocityDecay(0.35);
    simRef.current = sim;

    /* ---------- edges ---------- */
    const linkSel = edgeG.selectAll("line")
      .data(linkData, (d) => d.id)
      .enter().append("line")
        .attr("class", "mm-edge-line")
        .attr("stroke", (d) => TIER_STYLE[d.tier]?.colour || "#8a8a94")
        .attr("stroke-opacity", (d) => TIER_STYLE[d.tier]?.opacity || 0.4)
        .attr("stroke-width", (d) => {
          const base = TIER_STYLE[d.tier]?.width || 1;
          const amt = Math.min(5.5, 1 + Math.sqrt((d.totalGBP || 0) / 1e9) * 1.4);
          return base * amt;
        })
        .attr("stroke-dasharray", (d) => TIER_STYLE[d.tier]?.dash)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "stroke")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          setSelection({ kind: "edge", id: d.id });
        });

    /* ---------- nodes ---------- */
    const nodeSel = nodeG.selectAll("g.mm-bubble")
      .data(nodeData, (d) => d.id)
      .enter().append("g")
        .attr("class", "mm-bubble")
        .style("cursor", "pointer")
        .call(
          d3drag()
            .on("start", (e, d) => {
              if (!e.active) sim.alphaTarget(0.25).restart();
              d.fx = d.x; d.fy = d.y;
            })
            .on("drag", (e, d) => {
              d.fx = e.x; d.fy = e.y;
            })
            .on("end", (e, d) => {
              if (!e.active) sim.alphaTarget(0.003);
              d.fx = null; d.fy = null;
            })
        )
        .on("click", (event, d) => {
          event.stopPropagation();
          setSelection({ kind: "node", id: d.id });
        });

    // Focus ring — only for the lens subject. Drawn underneath the halo so
    // it reads as a subtle editorial highlight rather than a hard border.
    nodeSel
      .filter((d) => viewMode === "lens" && d.id === lensSubjectId)
      .append("circle")
        .attr("class", "mm-focus-ring")
        .attr("r", (d) => d.r + 22)
        .attr("fill", "none")
        .attr("stroke", "#f4f4f5")
        .attr("stroke-opacity", 0.55)
        .attr("stroke-width", 1.4)
        .attr("stroke-dasharray", "3 4")
        .attr("pointer-events", "none");

    // Outer soft halo — lens subject gets a brighter halo to read as "anchor"
    nodeSel.append("circle")
      .attr("class", "mm-halo")
      .attr("r", (d) => d.r + 10)
      .attr("fill", (d) => TYPE_COLOUR[d.type])
      .attr("fill-opacity", (d) =>
        viewMode === "lens" && d.id === lensSubjectId ? 0.20 : 0.08
      )
      .attr("filter", "url(#mm-glow)");

    // Main bubble. Nodes whose £ value is zero/undisclosed get a dashed
    // outer stroke — same visual language as Tier C/D edges — so readers
    // can see at-a-glance which bubbles don't yet have a public £ figure.
    // Non-undisclosed bubbles keep the solid hairline stroke.
    nodeSel.append("circle")
      .attr("class", "mm-main-bubble")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => `url(#mm-grad-${d.type})`)
      .attr("stroke", (d) =>
        isUndisclosed(d.value)
          ? "rgba(245,245,245,0.55)"
          : d3color(TYPE_COLOUR[d.type]).brighter(0.4).formatHex()
      )
      .attr("stroke-opacity", (d) => isUndisclosed(d.value) ? 0.85 : 0.5)
      .attr("stroke-width", (d) => isUndisclosed(d.value) ? 1.2 : 1)
      .attr("stroke-dasharray", (d) => isUndisclosed(d.value) ? "3 3" : null);

    // Native hover tooltip — the cheapest UX win on this canvas. Gives
    // "BAE Systems · supplier · £3.2bn · 14 relationships" on hover
    // without a click, which massively speeds up graph exploration.
    nodeSel.append("title").text((d) => {
      const kind = d.type === "buyer" ? "department" : d.type;
      const connections = (data.edges?.awards || [])
        .concat(data.edges?.projectMembers || [])
        .filter((e) => e.s === d.id || e.t === d.id).length;
      const moneyLine = isUndisclosed(d.value)
        ? "£ undisclosed"
        : fmtGBP(d.value) + " in window";
      return `${d.label}\n${kind} · ${moneyLine} · ${connections} relationship${connections === 1 ? "" : "s"}\n(click for details)`;
    });

    // Glossy inner highlight for sphere effect
    nodeSel.append("ellipse")
      .attr("class", "mm-gloss")
      .attr("cx", (d) => -d.r * 0.25)
      .attr("cy", (d) => -d.r * 0.35)
      .attr("rx", (d) => d.r * 0.45)
      .attr("ry", (d) => d.r * 0.25)
      .attr("fill", "rgba(255,255,255,0.18)")
      .attr("pointer-events", "none")
      .style("filter", "blur(3px)");

    /* ---------- labels ---------- */
    const labelSel = labelG.selectAll("g.mm-lbl")
      .data(nodeData, (d) => d.id)
      .enter().append("g")
        .attr("class", "mm-lbl")
        .attr("pointer-events", "none");

    labelSel.append("text")
      .attr("class", (d) => "mm-node-label " + (d.r >= 40 ? "big inside" : "small"))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.r >= 40 ? "0.1em" : (d.r + 14))
      .style("font-family", "'IBM Plex Sans', system-ui, sans-serif")
      .style("font-weight", (d) => d.r >= 40 ? 600 : 500)
      .style("font-size", (d) => d.r >= 40 ? "12.5px" : "11px")
      .style("fill", "#f4f4f5")
      .style("paint-order", "stroke fill")
      .style("stroke", "rgba(5,5,7,0.9)")
      .style("stroke-width", (d) => d.r >= 40 ? "2.5px" : "3px")
      .style("stroke-linejoin", "round")
      .text((d) => shortLabel(d));

    labelSel.append("text")
      .attr("class", "mm-node-sublabel")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.r >= 40 ? "1.3em" : (d.r + 26))
      .style("font-family", "'IBM Plex Mono', ui-monospace, monospace")
      .style("font-size", "10px")
      .style("fill", "rgba(255,255,255,0.55)")
      .style("paint-order", "stroke fill")
      .style("stroke", "rgba(5,5,7,0.85)")
      .style("stroke-width", "2.5px")
      .text((d) => d.value > 0 ? fmtGBP(d.value) : d.type);

    /* ---------- tick ---------- */
    sim.on("tick", () => {
      if (runIdRef.current !== runId) return;
      linkSel
        .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      labelSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    /* Keep sim gently alive so bubbles drift like Bubblemaps */
    sim.on("end", () => {
      if (runIdRef.current !== runId) return;
      sim.alphaTarget(0.003).restart();
    });

    /* ---------- zoom ---------- */
    const zoomBeh = d3zoom()
      .scaleExtent([0.4, 3.5])
      .on("zoom", (e) => {
        root.attr("transform", e.transform);
        const k = e.transform.k;
        labelG.selectAll(".mm-node-sublabel").attr("opacity", k < 0.75 ? 0 : 1);
        labelG.selectAll(".mm-node-label.small").attr("opacity", k < 0.6 ? 0 : 1);
      });
    svg.call(zoomBeh);
    svg.on("dblclick.zoom", null);
    zoomRef.current = zoomBeh;

    // Click empty canvas to clear selection highlight
    svg.on("click", () => {
      setSelection(null);
      nodeSel.attr("opacity", 1);
      labelSel.attr("opacity", 1);
      linkSel.attr("stroke-opacity", (d) => TIER_STYLE[d.tier]?.opacity || 0.4);
    });

    // Initial fit
    svg.transition().duration(400).call(zoomBeh.transform, zoomIdentity.translate(0, 0).scale(0.95));

    return () => {
      sim.stop();
    };
  }, [visibleNodes, visibleEdges, viewMode, lensSubjectId]);

  /* When selection changes, highlight neighbourhood */
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    if (!selection) {
      svg.selectAll(".mm-bubble").attr("opacity", 1);
      svg.selectAll(".mm-lbl").attr("opacity", 1);
      svg.selectAll(".mm-edge-line").attr("stroke-opacity", (d) => TIER_STYLE[d.tier]?.opacity || 0.4);
      return;
    }
    const neighbourIds = new Set();
    if (selection.kind === "node") {
      neighbourIds.add(selection.id);
      (data.edges?.awards || []).forEach((e) => {
        if (e.s === selection.id) neighbourIds.add(e.t);
        if (e.t === selection.id) neighbourIds.add(e.s);
      });
      (data.edges?.projectMembers || []).forEach((e) => {
        if (e.s === selection.id) neighbourIds.add(e.t);
        if (e.t === selection.id) neighbourIds.add(e.s);
      });
    } else {
      const edge =
        (data.edges?.awards || []).find((x) => x.id === selection.id) ||
        (data.edges?.projectMembers || []).find((x) => x.id === selection.id);
      if (edge) { neighbourIds.add(edge.s); neighbourIds.add(edge.t); }
    }
    svg.selectAll(".mm-bubble").attr("opacity", function(d) { return neighbourIds.has(d.id) ? 1 : 0.18; });
    svg.selectAll(".mm-lbl").attr("opacity", function(d) { return neighbourIds.has(d.id) ? 1 : 0.18; });
    svg.selectAll(".mm-edge-line").attr("stroke-opacity", function(d) {
      if (selection.kind === "edge") {
        return d.id === selection.id ? 1 : 0.06;
      }
      return (d.s === selection.id || d.t === selection.id) ? 1 : 0.06;
    });
  }, [selection, data.edges]);

  /* Close drawer on Escape */
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- story-card click → pan/zoom to node + open drawer ---------- */
  const focusNode = useCallback((id) => {
    setSelection({ kind: "node", id });
    // Pan/zoom — positions may not be available yet on first render, so
    // wait a tick.
    setTimeout(() => {
      if (!svgRef.current || !zoomRef.current) return;
      const sim = simRef.current;
      if (!sim) return;
      const n = sim.nodes().find((x) => x.id === id);
      if (!n || n.x == null) return;
      const scale = 1.35;
      const tx = WIDTH / 2 - n.x * scale;
      const ty = HEIGHT / 2 - n.y * scale;
      select(svgRef.current).transition().duration(520)
        .call(zoomRef.current.transform, zoomIdentity.translate(tx, ty).scale(scale));
    }, 50);
  }, []);

  /* ---------- set lens subject ----------
     Switches to lens mode and re-anchors the ego network on the given
     entity. Used by the drawer's "Focus on this" button and by clicking
     any left-rail card or ranking row. Keeps the drawer open on the new
     subject so the user can immediately read its scores / contracts. */
  const setLens = useCallback((id) => {
    if (!id) return;
    setLensSubjectId(id);
    setViewMode("lens");
    setSelection({ kind: "node", id });
  }, []);

  /* Reset the lens to the first curated featured entity. Surfaced as
     the "↺ home" button next to the focus pill. */
  const resetLens = useCallback(() => {
    const fallback = (data.featuredIds && data.featuredIds[0]) ||
                     (data.nodes && data.nodes[0] && data.nodes[0].id) ||
                     null;
    if (fallback) {
      setLensSubjectId(fallback);
      setSelection(null);
    }
  }, [data.featuredIds, data.nodes]);

  /* ---------- export current view as PNG ----------
     Rasterises the live SVG at 2× resolution so editors can drop the
     figure into a publication without losing fidelity. We clone the SVG,
     inject a matching dark-background rect (the wrapper's gradient is
     CSS-only and won't serialise), serialise with XMLSerializer, and
     draw onto a canvas before triggering a download. Dynamic nodes like
     `<title>` are kept — they don't render but don't hurt either. */
  const exportPNG = useCallback(() => {
    if (typeof window === "undefined") return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    try {
      const clone = svgEl.cloneNode(true);
      clone.setAttribute("width", String(WIDTH));
      clone.setAttribute("height", String(HEIGHT));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
      bg.setAttribute("width", String(WIDTH)); bg.setAttribute("height", String(HEIGHT));
      bg.setAttribute("fill", "#060608");
      clone.insertBefore(bg, clone.firstChild);

      const xml = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const scale = 2;
        c.width = WIDTH * scale;
        c.height = HEIGHT * scale;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#060608";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((blob) => {
          if (!blob) return;
          const outUrl = URL.createObjectURL(blob);
          const slugSubject =
            viewMode === "lens" && lensSubjectNode
              ? String(lensSubjectNode.label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
              : "network";
          const a = document.createElement("a");
          a.href = outUrl;
          a.download = `money-map-${slugSubject}-${new Date().toISOString().slice(0,10)}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(outUrl), 2000);
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn("[money-map] PNG export failed at image load");
      };
      img.src = url;
    } catch (e) {
      console.warn("[money-map] PNG export failed:", e);
    }
  }, [viewMode, lensSubjectNode]);

  /* ---------- render ---------- */
  return (
    <div className="mm-root-container -mx-3 sm:-mx-6 -mt-4 sm:-mt-8 min-h-[900px] bg-[#060608] text-[#e5e7eb]">
      <MoneyMapStyles />

      {/* Hero — styled to match the site-wide <PageHeader>
          component in Dashboard.jsx so the Money Map reads as
          part of the publication rather than a separate app. */}
      <section className="mm-hero">
        {onBack && (
          <button
            onClick={onBack}
            className={
              "text-[10px] uppercase " +
              "tracking-[0.2em] font-mono " +
              "text-gray-600 mb-2 flex " +
              "items-center gap-1 " +
              "hover:text-gray-400 " +
              "transition-colors"
            }
          >
            <ArrowLeft size={12} /> Back to overview
          </button>
        )}
        {!onBack && (
          <div className={
            "text-[10px] uppercase " +
            "tracking-[0.2em] font-mono " +
            "text-gray-600 mb-2"
          }>
            Flagship &middot; Money Map
          </div>
        )}
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className={
            "text-3xl md:text-4xl font-serif " +
            "font-medium text-white " +
            "leading-[1.1] tracking-[-0.01em]"
          }>
            Follow the money.
          </h2>
          <span className={
            "inline-flex items-center gap-1 px-2 py-0.5 " +
            "rounded text-[9px] font-mono uppercase " +
            "tracking-wider bg-gray-800/60 text-gray-500 " +
            "border border-gray-800/40 self-center"
          }>
            Updated {fmtDate(data.generatedAt)}
          </span>
          <span className={
            "inline-flex items-center gap-1 px-2 py-0.5 " +
            "rounded text-[9px] font-mono uppercase " +
            "tracking-wider bg-gray-800/60 text-gray-500 " +
            "border border-gray-800/40 self-center"
          }>
            Window {data.window?.from}&ndash;{data.window?.to}
          </span>
          {data.grade?.letter && (
            <span
              title="Overall source grade \u2014 see methodology"
              className={
                "inline-flex items-center gap-1.5 px-2 py-0.5 " +
                "rounded-full text-[9px] font-mono uppercase " +
                "tracking-wider bg-gray-800/60 text-gray-300 " +
                "border border-gray-800/40 self-center"
              }
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#fbbf24",
                  boxShadow: "0 0 6px rgba(251,191,36,0.6)"
                }}
              />
              Source grade&nbsp;
              <b className="text-gray-100">
                {data.grade.letter}
              </b>
              {data.grade.score != null && (
                <> &middot; {data.grade.score.toFixed(2)}</>
              )}
            </span>
          )}
        </div>
        <p className={
          "text-gray-400 text-[15px] mt-3 " +
          "leading-relaxed max-w-[820px]"
        }>
          Contracts, contractors, and the public buyers behind
          them &mdash; every edge tied to a named source.
        </p>
        <div className="mm-disclaimer">
          <b>Lines show sourced relationships, not wrongdoing.</b>{" "}
          An edge between two entities means we found a named public document linking them &mdash; it does not imply any party acted improperly.
        </div>
      </section>

      {/* Mode toggle — Lens (ego network) vs Network (firehose) */}
      <section className="mm-filters mm-filters-modes">
        <span className="mm-mode-label">View</span>
        <Chip
          active={viewMode === "lens"}
          onClick={() => setViewMode("lens")}
          title="Focus on one entity and its 1–2 hop connections"
        >
          Lens
        </Chip>
        <Chip
          active={viewMode === "network"}
          onClick={() => setViewMode("network")}
          title="Show the full featured subgraph"
        >
          Network
        </Chip>

        {viewMode === "lens" && lensSubjectNode && (
          <span className="mm-focus-pill" title="Current lens subject">
            <span className="mm-focus-pill-label">Focus</span>
            <span className="mm-focus-pill-name">{lensSubjectNode.label}</span>
            <span className="mm-focus-pill-kind">
              {lensSubjectNode.kind === "buyer"    ? "dept"     :
               lensSubjectNode.kind === "supplier" ? "supplier" :
               lensSubjectNode.kind === "project"  ? "project"  : ""}
            </span>
            <button
              className="mm-focus-pill-reset"
              onClick={resetLens}
              aria-label="Reset lens to default"
              title="Reset to featured entity"
            >
              ↺
            </button>
          </span>
        )}

        <span className="mm-filters-hint">
          {viewMode === "lens"
            ? "Click any bubble, rail card or ranking row to re-center the lens."
            : "Hectic? Switch to Lens to focus on one entity."}
        </span>
      </section>

      {/* Filters */}
      <section className="mm-filters">
        <label className="mm-search">
          <span style={{ color: "#6b7280", fontFamily: "var(--mm-mono)", fontSize: 11.5 }}>search</span>
          <input
            placeholder={
              viewMode === "lens"
                ? "Narrow the ego network…"
                : "Search a supplier, department or project…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear" className="mm-search-clear">×</button>
          )}
        </label>
        <Chip active>Window: {data.window?.from} – {data.window?.to}</Chip>
        <Chip
          active={tierFilter === "AB"}
          onClick={() => setTierFilter("AB")}
        >
          Evidence: A + B
        </Chip>
        <Chip
          active={tierFilter === "ABCD"}
          onClick={() => setTierFilter("ABCD")}
          title="Include declared interests and historical overlap"
        >
          Include softer (C/D)
        </Chip>
        <Chip
          active
          title={`Click to cycle minimum edge value · currently showing only flows ≥ ${fmtGBP(minGBP)}. Next: ${fmtGBP(MIN_GBP_STEPS[(MIN_GBP_STEPS.indexOf(minGBP) + 1) % MIN_GBP_STEPS.length])}`}
          onClick={() => {
            const idx = MIN_GBP_STEPS.indexOf(minGBP);
            setMinGBP(MIN_GBP_STEPS[(idx + 1) % MIN_GBP_STEPS.length]);
          }}
        >
          Min £: {fmtGBP(minGBP)} <span className="mm-chip-cycle" aria-hidden="true">⇵</span>
        </Chip>
        <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>
          {visibleNodes.length} nodes · {visibleEdges.length} edges
        </span>
      </section>

      {/* ==================================================
          LAYOUT TOGGLE — audit rec #98
          Default: canvas on desktop, list at <md. Readers can
          always cross over ("Show canvas view →" / "Show list
          view →"). Button wording flips to match current state.
          ================================================== */}
      <section className="mm-filters mm-filters-layout">
        {layoutMode === "list" ? (
          <button
            type="button"
            className="mm-layout-toggle"
            onClick={() => setLayoutMode("canvas")}
          >
            Show canvas view &rarr;
          </button>
        ) : (
          <button
            type="button"
            className="mm-layout-toggle mm-layout-toggle-mobile"
            onClick={() => setLayoutMode("list")}
            aria-label="Show top-suppliers list instead of canvas"
          >
            Show list view &rarr;
          </button>
        )}
      </section>

      {layoutMode === "list" ? (
        <MoneyMapMobileList
          rows={topSuppliers}
          onSelectSupplier={(id) => setSelection({ kind: "node", id })}
        />
      ) : null}

      {/* Main grid */}
      <section
        className="mm-main"
        style={layoutMode === "list" ? { display: "none" } : undefined}
      >
        {/* LEFT — story cards (desktop rail) */}
        <aside className="mm-col mm-col-left">
          <div className="mm-rail-h">Story cards · this week</div>
          {rotatedStoryCards.map((s, i) => (
            <button
              type="button"
              key={i}
              className="mm-card"
              onClick={() => {
                if (!s.entityId) return;
                if (viewMode === "lens") setLens(s.entityId);
                else focusNode(s.entityId);
              }}
            >
              <div className="mm-card-label">{s.label}</div>
              <div className="mm-card-headline">{s.headline}</div>
              <div className="mm-card-metric">{s.metric}</div>
            </button>
          ))}
          <div className="mm-known-unknowns">
            <h4>Known unknowns</h4>
            MP declared-interest edges and lobbying links are planned for Phase 2.
            Subcontractor chains are not shown — only prime contracts and named consortium members.
          </div>
        </aside>

        {/* CENTER — canvas */}
        <div className="mm-canvas-wrap">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="mm-cy"
            role="img"
            aria-label={
              viewMode === "lens" && lensSubjectNode
                ? `Money-flow graph focused on ${lensSubjectNode.label}: ${visibleNodes.length - 1} connected entities, ${visibleEdges.length} relationships. Use the rankings below or the search box to navigate; keyboard users can Tab into the Repeat Offenders table for accessible rows.`
                : `Money-flow graph: ${visibleNodes.length} entities and ${visibleEdges.length} relationships across buyers, suppliers and projects. Use the rankings below or the search box to navigate; keyboard users can Tab into the Repeat Offenders table for accessible rows.`
            }
          >
            <title>
              {viewMode === "lens" && lensSubjectNode
                ? `Money Map · Lens on ${lensSubjectNode.label}`
                : "Money Map · Network view"}
            </title>
            <desc>
              Interactive force-directed graph. Bubbles represent buyers,
              suppliers, and projects sized by £ in the current window.
              Edges represent sourced relationships coloured by evidence
              tier. A dashed outer ring marks entities with undisclosed £.
            </desc>
          </svg>

          {/* Top-left: live view summary pill */}
          <div className="mm-canvas-overlay">
            <span className="mm-pill">
              {viewMode === "lens" && lensSubjectNode
                ? `Lens · ${lensSubjectNode.label} · ${visibleNodes.length - 1} connections`
                : `${visibleNodes.length} nodes · ${visibleEdges.length} edges`}
              {" · "}tier {tierFilter === "AB" ? "A + B" : "A + B + C + D"}
            </span>
          </div>

          {/* Top-right: export-as-PNG. Rasterises the current SVG at 2x
              so editors can drop the figure straight into a publication. */}
          <div className="mm-canvas-actions">
            <button
              type="button"
              className="mm-canvas-action"
              onClick={exportPNG}
              title="Download the current view as a PNG for editorial reuse"
              aria-label="Download the current Money Map view as PNG"
            >
              <Download size={12} style={{ marginRight: 6 }} aria-hidden="true" />
              PNG
            </button>
          </div>

          {/* Bottom-right: user guidance hint */}
          <div className="mm-canvas-hint">
            {viewMode === "lens"
              ? "scroll to zoom · drag to pan · click any bubble to re-focus"
              : "scroll to zoom · drag to pan · click any bubble"}
          </div>

          {/* Empty-state overlay when filters zero out the graph. Matches
              the drawer empty-state pattern — terse message + a clear
              "reset" action so the reader never sees a blank canvas and
              wonders if the app has broken. */}
          {visibleNodes.length === 0 && (
            <div className="mm-canvas-empty" role="status" aria-live="polite">
              <div className="mm-canvas-empty-inner">
                <div className="mm-canvas-empty-eyebrow">No results</div>
                <div className="mm-canvas-empty-body">
                  {query
                    ? `Nothing matches "${query}" at these filters.`
                    : "No entities match the current tier / £ thresholds."}
                </div>
                <div className="mm-canvas-empty-actions">
                  <button
                    type="button"
                    className="mm-canvas-empty-btn"
                    onClick={() => { setQuery(""); setTierFilter("ABCD"); setMinGBP(100_000); }}
                  >
                    Reset filters
                  </button>
                  {tierFilter === "AB" && (
                    <button
                      type="button"
                      className="mm-canvas-empty-btn"
                      onClick={() => setTierFilter("ABCD")}
                    >
                      Include softer (C/D)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — legend + meta */}
        <aside className="mm-col mm-col-right">
          <div className="mm-legend-group">
            <div className="mm-rail-h">Entity type</div>
            <LegendRow colour={TYPE_COLOUR.supplier}>Supplier</LegendRow>
            <LegendRow colour={TYPE_COLOUR.buyer}>Department · buyer</LegendRow>
            <LegendRow colour={TYPE_COLOUR.project}>Project</LegendRow>
          </div>

          <div className="mm-legend-group">
            <div className="mm-rail-h">Evidence tier</div>
            <TierLegend tier="A">Tier A — direct financial flow</TierLegend>
            <TierLegend tier="B">Tier B — transparency return</TierLegend>
            <TierLegend tier="C">Tier C — declared interest</TierLegend>
            <TierLegend tier="D" faint>Tier D — circumstantial (opt-in)</TierLegend>
          </div>

          <div className="mm-legend-group">
            <div className="mm-rail-h">This view</div>
            <MetaRow k="Nodes" v={visibleNodes.length} />
            <MetaRow k="Edges" v={visibleEdges.length} />
            <MetaRow k="Source grade" v={`${data.grade?.letter} · ${data.grade?.score?.toFixed(2)}`} />
            <MetaRow k="Tier A sources" v={data.grade?.tierCounts?.A ?? "—"} />
            <MetaRow k="Tier B sources" v={data.grade?.tierCounts?.B ?? "—"} />
          </div>
        </aside>
      </section>

      {/* Mobile rails — collapsible accordions.
          Below 960px the desktop left/right rails are hidden; this
          block replaces them with three <details> disclosures so
          phone/tablet readers keep access to Story Cards, the legend,
          and "This view" meta. Default-open on Story Cards only so the
          first scroll shows something substantial. */}
      <section className="mm-mobile-rails" aria-label="Money Map rails (mobile)">
        <details className="mm-mobile-det" open>
          <summary className="mm-mobile-sum">
            <span>Story cards · this week</span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="mm-mobile-body">
            {rotatedStoryCards.map((s, i) => (
              <button
                type="button"
                key={i}
                className="mm-card"
                onClick={() => {
                  if (!s.entityId) return;
                  if (viewMode === "lens") setLens(s.entityId);
                  else focusNode(s.entityId);
                }}
              >
                <div className="mm-card-label">{s.label}</div>
                <div className="mm-card-headline">{s.headline}</div>
                <div className="mm-card-metric">{s.metric}</div>
              </button>
            ))}
          </div>
        </details>

        <details className="mm-mobile-det">
          <summary className="mm-mobile-sum">
            <span>Legend · entity + evidence tier</span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="mm-mobile-body mm-mobile-legend-grid">
            <div className="mm-legend-group">
              <div className="mm-rail-h">Entity type</div>
              <LegendRow colour={TYPE_COLOUR.supplier}>Supplier</LegendRow>
              <LegendRow colour={TYPE_COLOUR.buyer}>Department · buyer</LegendRow>
              <LegendRow colour={TYPE_COLOUR.project}>Project</LegendRow>
            </div>
            <div className="mm-legend-group">
              <div className="mm-rail-h">Evidence tier</div>
              <TierLegend tier="A">Tier A — direct financial flow</TierLegend>
              <TierLegend tier="B">Tier B — transparency return</TierLegend>
              <TierLegend tier="C">Tier C — declared interest</TierLegend>
              <TierLegend tier="D" faint>Tier D — circumstantial (opt-in)</TierLegend>
            </div>
          </div>
        </details>

        <details className="mm-mobile-det">
          <summary className="mm-mobile-sum">
            <span>This view · stats</span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="mm-mobile-body">
            <MetaRow k="Nodes" v={visibleNodes.length} />
            <MetaRow k="Edges" v={visibleEdges.length} />
            <MetaRow k="Source grade" v={`${data.grade?.letter} · ${data.grade?.score?.toFixed(2)}`} />
            <MetaRow k="Tier A sources" v={data.grade?.tierCounts?.A ?? "—"} />
            <MetaRow k="Tier B sources" v={data.grade?.tierCounts?.B ?? "—"} />
          </div>
        </details>
      </section>

      {/* Repeat offenders — full-width feature ranking */}
      <section className="mm-below mm-below-feature">
        <div className="mm-below-full">
          <h3 className="mm-feature-h">
            Repeat offenders
            <span className="mm-eyebrow" style={{ marginLeft: 10, fontSize: 10 }}>
              cartel-risk score · multi-buyer × repeat-win × £ × tier
            </span>
          </h3>
          <p className="mm-feature-sub">
            Firms that keep winning across multiple departments, often at rates far above their fair market share.
            Score combines how many distinct buyers they serve, how many contracts they've accumulated, their strongest
            repeat-win rate on any single buyer pair, £ flowing outside their top buyer, and a tier-confidence penalty.
            Click any row to lens on that supplier, or use the arrow to open the full supplier profile.
          </p>
          <div className="mm-ro-grid">
            {(data.rankings?.topRepeatOffenders || []).slice(0, 12).map((r, i) => {
              const onRowKey = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  viewMode === "lens" ? setLens(r.id) : focusNode(r.id);
                }
              };
              return (
                <div
                  key={r.id}
                  className="mm-ro-row"
                  onClick={() => viewMode === "lens" ? setLens(r.id) : focusNode(r.id)}
                  onKeyDown={onRowKey}
                  role="button"
                  tabIndex={0}
                  title={`Score ${r.score.toFixed(2)} · ${r.buyerCount} buyers · ${r.awardCount} awards · max repeat-win ${r.maxRepeatWinRate}×`}
                >
                  <span className="mm-ro-rank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mm-ro-name">{r.label}</span>
                  <span className="mm-ro-score" aria-label="Cartel-risk score">
                    {r.score.toFixed(1)}
                  </span>
                  <span className="mm-ro-bits">
                    <span className="mm-ro-bit" title="Distinct public buyers">{r.buyerCount}×buyers</span>
                    <span className="mm-ro-bit" title="Total award count">{r.awardCount}×awards</span>
                    {r.maxRepeatWinRate >= 2 && (
                      <span className="mm-ro-bit mm-ro-bit-hot" title="Max repeat-win rate on any buyer pair (× expected)">
                        {r.maxRepeatWinRate.toFixed(1)}× expected
                      </span>
                    )}
                    <span className="mm-ro-bit mm-ro-bit-gbp" title="Total £ across all buyers in window">
                      {fmtGBPOrUndisclosed(r.totalGBP)}
                    </span>
                  </span>
                  {onOpenSupplierProfile && (
                    <button
                      type="button"
                      className="mm-ro-profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSupplierProfile(r.id, r.label);
                      }}
                      title={`Open ${r.label} — full supplier profile`}
                      aria-label={`Open ${r.label} supplier profile`}
                    >
                      →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {(data.rankings?.topRepeatOffenders || []).length === 0 && (
            <div className="mm-feature-empty">
              No suppliers meet the repeat-offender threshold in current data.
            </div>
          )}
        </div>
      </section>

      {/* Rankings below the fold */}
      <section className="mm-below">
        <div className="mm-below-left">
          <h3>Most concentrated buyers <span className="mm-eyebrow" style={{ marginLeft: 10, fontSize: 10 }}>by HHI · {data.window?.from}–{data.window?.to}</span></h3>
          {(data.rankings?.topBuyersByHHI || []).slice(0, 8).map((b, i) => {
            const band = hhiBand(b.hhi);
            const onKey = (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                viewMode === "lens" ? setLens(b.id) : focusNode(b.id);
              }
            };
            return (
              <div
                key={b.id}
                className="mm-rank-row"
                onClick={() => viewMode === "lens" ? setLens(b.id) : focusNode(b.id)}
                onKeyDown={onKey}
                role="button"
                tabIndex={0}
              >
                <span className="mm-rank-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="mm-rank-name">{b.label}</span>
                <span className="mm-rank-val">
                  HHI {b.hhi.toFixed(2)}
                  {band && <span className={`mm-band-pill mm-band-${band.tone}`} title={band.hint}>{band.label}</span>}
                </span>
                <span className="mm-rank-meta">{b.supplierCount} suppliers · {fmtGBP(b.totalGBP)}</span>
              </div>
            );
          })}
        </div>
        <div className="mm-below-right">
          <h3>Most dependent suppliers <span className="mm-eyebrow" style={{ marginLeft: 10, fontSize: 10 }}>single-buyer concentration</span></h3>
          {(data.rankings?.topDependentSuppliers || []).slice(0, 8).map((s, i) => {
            const band = dependenceBand(s.dependence);
            const onKey = (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                viewMode === "lens" ? setLens(s.id) : focusNode(s.id);
              }
            };
            return (
              <div
                key={s.id}
                className="mm-rank-row"
                onClick={() => viewMode === "lens" ? setLens(s.id) : focusNode(s.id)}
                onKeyDown={onKey}
                role="button"
                tabIndex={0}
              >
                <span className="mm-rank-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="mm-rank-name">{s.label}</span>
                <span className="mm-rank-val">
                  {fmtPct(s.dependence)}
                  {band && <span className={`mm-band-pill mm-band-${band.tone}`} title={band.hint}>{band.label}</span>}
                </span>
                <span className="mm-rank-meta">{s.topBuyer} · {fmtGBP(s.totalGBP)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mm-footer">
        <span>Data as of {fmtDate(data.generatedAt)}</span>
        <span>Methodology · Every edge cites at least one named public document.</span>
        <span style={{ color: "#e5e7eb" }}>Gracchus · <span style={{ color: "#6b7280" }}>cite responsibly</span></span>
      </footer>

      {/* Drawer */}
      {selected && (selected.node || selected.edge) && (
        <Drawer
          selection={selected}
          nodesById={nodesById}
          allEdges={data.edges}
          viewMode={viewMode}
          lensSubjectId={lensSubjectId}
          onFocus={setLens}
          onClose={() => setSelection(null)}
          onOpenSupplierProfile={onOpenSupplierProfile}
          onOpenProjectProfile={onOpenProjectProfile}
          onOpenBuyerProfile={onOpenBuyerProfile}
        />
      )}
    </div>
  );
}

/* =========================================================================
 *  SUBCOMPONENTS
 * ========================================================================= */

function Chip({ active, children, onClick, title }) {
  return (
    <span
      className={"mm-chip" + (active ? " mm-chip-active" : "")}
      onClick={onClick}
      title={title}
      role={onClick ? "button" : undefined}
    >
      {children}
    </span>
  );
}

function LegendRow({ colour, children }) {
  return (
    <div className="mm-legend-row">
      <span
        className="mm-legend-swatch"
        style={{ background: colour, color: colour }}
      />
      {children}
    </div>
  );
}

function TierLegend({ tier, children, faint }) {
  const style = TIER_STYLE[tier];
  return (
    <div className="mm-legend-row" style={{ opacity: faint ? 0.6 : 1 }}>
      <span className="mm-legend-line">
        <svg width="26" height="6">
          <line
            x1="0" y1="3" x2="26" y2="3"
            stroke={style.colour}
            strokeWidth={style.width + 0.6}
            strokeDasharray={style.dash || undefined}
          />
        </svg>
      </span>
      {children}
    </div>
  );
}

function MetaRow({ k, v }) {
  return (
    <div className="mm-meta-stat">
      <span className="mm-k">{k}</span>
      <span className="mm-v">{v}</span>
    </div>
  );
}

function Drawer({
  selection,
  nodesById,
  allEdges,
  viewMode,
  lensSubjectId,
  onFocus,
  onClose,
  onOpenSupplierProfile,
  onOpenProjectProfile,
  onOpenBuyerProfile,
}) {
  const drawerRef = useDrawerFocus(onClose);
  const node = selection.node;
  const edge = selection.edge;

  if (node) {
    const isSubject = viewMode === "lens" && lensSubjectId === node.id;
    const showFocusCTA = onFocus && !isSubject; // offer Focus unless we're already focused on this
    const incoming = [
      ...(allEdges?.awards || []).filter((e) => e.s === node.id || e.t === node.id),
      ...(allEdges?.projectMembers || []).filter((e) => e.s === node.id || e.t === node.id),
    ].sort((a, b) => (b.totalGBP || 0) - (a.totalGBP || 0));

    const tierCounts = incoming.reduce((acc, e) => {
      acc[e.tier] = (acc[e.tier] || 0) + 1;
      return acc;
    }, {});

    const kindLabel = {
      buyer: "Department · public buyer",
      supplier: "Supplier",
      project: "Project",
    }[node.kind] || node.kind;

    return (
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${kindLabel}: ${node.label}`}
        className="mm-drawer mm-drawer-open"
      >
        <div className="mm-d-head">
          <button className="mm-d-close" aria-label="Close drawer" onClick={onClose}>×</button>
          <div className="mm-eyebrow-row">
            <span className="mm-eyebrow">{kindLabel}</span>
            <span className={`mm-tier-badge mm-tier-A`}>
              {Object.entries(tierCounts).map(([t, n]) => `Tier ${t} · ${n}`).join(" · ") || "No sources"}
            </span>
          </div>
          <div className="mm-entity-name">{node.label}</div>
          <div className="mm-entity-sub">
            {node.department ? node.department + " · " : ""}
            Total £ in window:{" "}
            <span className="group inline-flex items-baseline">
              <b>{fmtGBPOrUndisclosed(node.value)}</b>
              <CiteChip
                citation={
                  `${node.label} — total £ observed in current Money Map window: ` +
                  `${fmtGBPOrUndisclosed(node.value)}. money-map.json. Gracchus, ` +
                  `accessed ${new Date().toISOString().slice(0,10)}.`
                }
              />
            </span>
          </div>
          {isSubject && (
            <div className="mm-d-focus-chip mm-d-focus-chip-active">
              <span className="mm-d-focus-dot" /> Lens subject
            </div>
          )}
          {showFocusCTA && (
            <button
              className="mm-d-focus-cta"
              onClick={() => onFocus(node.id)}
              title="Re-center the lens on this entity"
            >
              ↗ Focus lens on this
            </button>
          )}
          {/* 2026-04-20 — cross-link to the global Supplier / Project drawer.
               Closes the Money Map drawer first so the two don't stack. */}
          {node.kind === "supplier" && onOpenSupplierProfile && (
            <button
              className="mm-d-focus-cta"
              style={{ marginTop: 6, background: "#0f2a1a", borderColor: "#1f5a3a", color: "#86efac" }}
              onClick={() => {
                onClose();
                onOpenSupplierProfile(node.id, node.label);
              }}
              title="Open the full supplier profile"
            >
              → Open supplier profile
            </button>
          )}
          {node.kind === "project" && onOpenProjectProfile && (
            <button
              className="mm-d-focus-cta"
              style={{ marginTop: 6, background: "#0f2a1a", borderColor: "#1f5a3a", color: "#86efac" }}
              onClick={() => {
                onClose();
                const pidNum = parseInt(
                  String(node.id).replace(/^project-/, ""),
                  10
                );
                onOpenProjectProfile(pidNum, node.label);
              }}
              title="Open the full project dossier"
            >
              → Open project dossier
            </button>
          )}
          {node.kind === "buyer" && onOpenBuyerProfile && (
            <button
              className="mm-d-focus-cta"
              style={{ marginTop: 6, background: "#0f2a1a", borderColor: "#1f5a3a", color: "#86efac" }}
              onClick={() => {
                onClose();
                onOpenBuyerProfile(node.id, node.label);
              }}
              title="Open the full buyer profile"
            >
              → Open buyer profile
            </button>
          )}
        </div>
        <div className="mm-d-body">
          <div className="mm-d-section-h">Scores · current window</div>
          <DrawerScores node={node} />

          <div className="mm-d-section-h">Relationships · sorted by £</div>
          {incoming.length === 0 && (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              No direct money-edges in current data. Widen the window or include softer links to see more.
            </div>
          )}
          {incoming.slice(0, 40).map((e) => {
            const otherId = e.s === node.id ? e.t : e.s;
            const other = nodesById.get(otherId);
            const canJump = onFocus && viewMode === "lens" && other;
            return (
              <div
                className={"mm-edge-item" + (canJump ? " mm-edge-item-jumpable" : "")}
                key={e.id}
                onClick={canJump ? () => onFocus(otherId) : undefined}
                role={canJump ? "button" : undefined}
                title={canJump ? `Jump lens to ${other.label}` : undefined}
              >
                <div className="mm-edge-title">
                  {other ? other.label : otherId}
                  {canJump && <span className="mm-edge-jump">↗</span>}
                </div>
                <div
                  className={
                    "mm-edge-amount" +
                    (isUndisclosed(e.totalGBP) ? " mm-edge-amount-undisclosed" : "")
                  }
                  title={isUndisclosed(e.totalGBP)
                    ? "No per-contract £ figure in public sources yet — see 'Why undisclosed?' below."
                    : undefined}
                >
                  {fmtGBPOrUndisclosed(e.totalGBP)}
                </div>
                <div className="mm-edge-meta">
                  <span className={`mm-tier-badge mm-tier-${e.tier}`}>Tier {e.tier}</span>
                  {e.scope && <span>{trunc(e.scope, 80)}</span>}
                  {e._kind === "project" && e.groupName && <span>· {trunc(e.groupName, 48)}</span>}
                  {e.count > 1 && <span>· {e.count} contracts</span>}
                  {e.sources && e.sources[0] && (
                    <>
                      <span>·</span>
                      <a
                        className="mm-edge-doc"
                        href={e.sources[0].url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(evt) => evt.stopPropagation()}
                      >
                        {trunc(e.sources[0].title || e.sources[0].type || "source", 40)}
                        <ExternalLink size={10} style={{ marginLeft: 4, display: "inline" }} />
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {incoming.some((e) => isUndisclosed(e.totalGBP)) && (
            <div className="mm-why-undisclosed">
              <div className="mm-why-undisclosed-h">Why "Undisclosed"?</div>
              <div className="mm-why-undisclosed-body">
                Some relationships confirm the money moved without a per-line £ figure on public record yet. Typical reasons:
                <ul>
                  <li><b>Consortium / project-member roles</b> — the prime or joint venture is paid; the named member's share isn't individually disclosed.</li>
                  <li><b>Framework call-offs</b> — a place on a framework is public, but individual call-off values often aren't, or are redacted.</li>
                  <li><b>Redacted award values</b> — OCDS / Contracts Finder releases sometimes omit the value field or mark it commercially sensitive.</li>
                  <li><b>Transparency-return aggregation</b> — departmental £25k+ returns can be rolled up above the supplier-line granularity we need.</li>
                </ul>
                <div className="mm-why-undisclosed-foot">
                  We show "Undisclosed" rather than £0 to avoid implying zero money changed hands. Recovery routes — Companies House filings, FOI, Major Project Reports — are on our backlog.
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  if (edge) {
    const s = nodesById.get(edge.s);
    const t = nodesById.get(edge.t);
    return (
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Edge Tier ${edge.tier}: ${s?.label || edge.s} to ${t?.label || edge.t}`}
        className="mm-drawer mm-drawer-open"
      >
        <div className="mm-d-head">
          <button className="mm-d-close" aria-label="Close drawer" onClick={onClose}>×</button>
          <div className="mm-eyebrow-row">
            <span className="mm-eyebrow">Edge · Tier {edge.tier}</span>
            <span className={`mm-tier-badge mm-tier-${edge.tier}`}>Tier {edge.tier}</span>
          </div>
          <div className="mm-entity-name">
            {s?.label || edge.s} → {t?.label || edge.t}
          </div>
          <div className="mm-entity-sub">
            {fmtGBPOrUndisclosed(edge.totalGBP)}{edge.count > 1 ? ` · ${edge.count} contracts` : ""}
          </div>
        </div>
        <div className="mm-d-body">
          <div className="mm-d-section-h">Scope</div>
          <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.5 }}>
            {edge.scope || edge.groupName || "Relationship confirmed by public record."}
          </div>

          <div className="mm-d-section-h">Sources · {edge.sources?.length || 0}</div>
          {(edge.sources || []).map((src, i) => (
            <div className="mm-edge-item" key={i}>
              <div className="mm-edge-title">{src.title || src.type || "Source"}</div>
              <div className="mm-edge-amount">
                <span className={`mm-tier-badge mm-tier-${src.grade || edge.tier}`}>
                  Tier {src.grade || edge.tier}
                </span>
              </div>
              <div className="mm-edge-meta">
                {src.publisher && <span>{src.publisher}</span>}
                {src.date && <span>· {fmtDate(src.date)}</span>}
                {src.url && (
                  <>
                    <span>·</span>
                    <a className="mm-edge-doc" href={src.url} target="_blank" rel="noreferrer">
                      open <ExternalLink size={10} style={{ marginLeft: 2, display: "inline" }} />
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
          {(!edge.sources || edge.sources.length === 0) && (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              No sources linked to this edge in current dataset.
            </div>
          )}
        </div>
      </aside>
    );
  }

  return null;
}

function DrawerScores({ node }) {
  const scores = node.scores || {};
  const today = new Date().toISOString().slice(0, 10);
  const cite = (finding) =>
    `${node.label} — ${finding}. money-map.json. Gracchus, accessed ${today}.`;
  const rows = [];
  if (node.kind === "buyer") {
    const hhiB = hhiBand(scores.buyerConcentrationHHI);
    rows.push({
      k: "Buyer concentration (HHI)",
      v: scores.buyerConcentrationHHI != null ? scores.buyerConcentrationHHI.toFixed(2) : "—",
      band: hhiB,
      hint: "Herfindahl-Hirschman Index across £-bearing suppliers. Higher = more concentrated. US DoJ guidelines: < 0.15 competitive · 0.15–0.25 moderate · > 0.25 concentrated.",
      citation: scores.buyerConcentrationHHI != null
        ? cite(`buyer concentration HHI ${scores.buyerConcentrationHHI.toFixed(2)} (${hhiB?.label || "ungraded"})`)
        : null,
    });
    rows.push({
      k: "Suppliers (total / £-bearing)",
      v: `${scores.supplierCount ?? "—"} / ${scores.supplierCountValued ?? "—"}`,
      hint: "Total counts all appearances; £-bearing only where a positive award amount is on record.",
      citation: scores.supplierCount != null
        ? cite(`${scores.supplierCount} suppliers (${scores.supplierCountValued ?? 0} £-bearing) in current window`)
        : null,
    });
    if (node.topSupplier) {
      rows.push({
        k: "Top supplier share",
        v: `${fmtPct(node.topSupplier.share)} · ${node.topSupplier.label}`,
        hint: `${fmtGBPOrUndisclosed(node.topSupplier.gbp)} of ${fmtGBPOrUndisclosed(scores.totalGBP)}.`,
        citation: cite(
          `top supplier ${node.topSupplier.label} at ${fmtPct(node.topSupplier.share)} ` +
          `(${fmtGBPOrUndisclosed(node.topSupplier.gbp)})`
        ),
      });
    }
  } else if (node.kind === "supplier") {
    const depB = dependenceBand(scores.supplierDependence);
    rows.push({
      k: "Supplier dependence",
      v: scores.supplierDependence != null ? fmtPct(scores.supplierDependence) : "—",
      band: depB,
      hint: "Share of this supplier's £ that came from its single largest buyer. < 50% diversified · 50–80% reliant · ≥ 80% captive (high political-capture risk).",
      citation: scores.supplierDependence != null
        ? cite(`single-buyer dependence ${fmtPct(scores.supplierDependence)} (${depB?.label || "ungraded"})`)
        : null,
    });
    rows.push({
      k: "Public buyers",
      v: scores.buyerCount ?? "—",
      hint: "Distinct public buyers observed in window.",
      citation: scores.buyerCount != null
        ? cite(`${scores.buyerCount} distinct public buyers in current window`)
        : null,
    });
    if (node.topBuyer) {
      rows.push({
        k: "Top buyer",
        v: `${node.topBuyer.label}`,
        hint: `${fmtGBPOrUndisclosed(node.topBuyer.gbp)} (${fmtPct(node.topBuyer.share)} of total).`,
        citation: cite(
          `top buyer ${node.topBuyer.label} at ${fmtGBPOrUndisclosed(node.topBuyer.gbp)} ` +
          `(${fmtPct(node.topBuyer.share)})`
        ),
      });
    }
  } else if (node.kind === "project") {
    rows.push({
      k: "Headline budget",
      v: fmtGBPOrUndisclosed(node.value),
      hint: `${node.department || "—"} · ${node.category || "—"} · ${node.status || "—"}`,
      citation: cite(`headline budget ${fmtGBPOrUndisclosed(node.value)}`),
    });
  }

  return (
    <>
      {rows.map((r, i) => (
        <div className="mm-score-row" key={i}>
          <div className="mm-score-k">{r.k}</div>
          <div className="mm-score-v">
            {r.citation ? (
              <span className="group inline-flex items-baseline">
                <span>{r.v}</span>
                {r.band && (
                  <span className={`mm-band-pill mm-band-${r.band.tone}`} title={r.band.hint}>
                    {r.band.label}
                  </span>
                )}
                <CiteChip citation={r.citation} />
              </span>
            ) : (
              <>
                {r.v}
                {r.band && (
                  <span className={`mm-band-pill mm-band-${r.band.tone}`} title={r.band.hint}>
                    {r.band.label}
                  </span>
                )}
              </>
            )}
          </div>
          {r.hint && <div className="mm-score-hint">{r.hint}</div>}
        </div>
      ))}
    </>
  );
}

/* ---------- utilities ---------- */

/** Shorten a label for use inside a bubble — strips trailing (parens)
 *  and long suffixes, and hard-limits to 24 chars with ellipsis. */
function shortLabel(n) {
  let s = n.label || "";
  s = s.replace(/\s*—.*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  // Also strip common legal suffixes for the *display* label only
  s = s.replace(/\s+(plc|Limited|Ltd\.?|Group plc|Group)\s*$/i, "").trim();
  if (s.length > 26) s = s.slice(0, 24).trim() + "…";
  return s || n.label || "";
}

function trunc(s, max) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/* =========================================================================
 *  STYLES — scoped via unique class prefixes (mm-*). Kept inline so the
 *  component is drop-in: no Tailwind config changes, no external stylesheet.
 * ========================================================================= */

function MoneyMapStyles() {
  return (
    <style>{`
      .mm-root-container {
        --mm-bg: #060608;
        --mm-bg-2: #0a0a0d;
        --mm-panel: #0f0f13;
        --mm-border: #1f1f26;
        --mm-border-2: #2a2a34;
        --mm-fg: #e5e7eb;
        --mm-fg-dim: #9ca3af;
        --mm-fg-mute: #6b7280;
        --mm-serif: 'IBM Plex Serif', Georgia, serif;
        --mm-sans:  'IBM Plex Sans', system-ui, -apple-system, sans-serif;
        --mm-mono:  'IBM Plex Mono', ui-monospace, Menlo, monospace;
        font-family: var(--mm-sans);
      }

      /* mm-topbar / mm-brand / mm-back / mm-grade styles removed —
         the hero now mirrors the site-wide <PageHeader> layout. */

      .mm-eyebrow {
        font-family: var(--mm-mono); font-size: 11px;
        letter-spacing: 0.14em; color: var(--mm-fg-mute);
        text-transform: uppercase;
      }
      .mm-hero {
        padding: 24px 32px 20px;
        max-width: 1440px; margin: 0 auto;
        border-bottom: 1px solid var(--mm-border);
      }
      .mm-disclaimer {
        margin-top: 18px; padding: 10px 14px;
        border-left: 2px solid var(--mm-border-2);
        font-size: 12.5px; color: var(--mm-fg-dim);
        background: #0a0a0d; max-width: 900px;
      }
      .mm-disclaimer b { color: var(--mm-fg); }

      .mm-filters {
        padding: 14px 32px;
        border-bottom: 1px solid var(--mm-border);
        display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
        max-width: 1440px; margin: 0 auto;
      }
      /* Sticky: the main filter row (search + tier + Min £) stays reachable
         while the user scrolls down to rankings. The mode row above is
         intentionally NOT sticky so we don't stack two bars. */
      .mm-filters:not(.mm-filters-modes) {
        position: sticky; top: 0; z-index: 30;
        background: rgba(6,6,8,0.92);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      .mm-filters-modes {
        padding-top: 14px; padding-bottom: 10px;
        border-bottom: 1px dashed var(--mm-border);
      }
      .mm-chip-cycle {
        font-family: var(--mm-mono); font-size: 10px;
        margin-left: 4px; opacity: 0.55;
        color: var(--mm-fg-mute);
      }
      .mm-mode-label {
        font-family: var(--mm-mono); font-size: 10.5px;
        color: var(--mm-fg-mute); text-transform: uppercase;
        letter-spacing: 0.16em; margin-right: 2px;
      }
      .mm-filters-hint {
        margin-left: auto;
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute); font-style: italic;
      }
      .mm-focus-pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 10px 6px 14px;
        border: 1px solid #3a3a46; border-radius: 999px;
        background: linear-gradient(90deg, rgba(96,165,250,0.10), rgba(167,139,250,0.10));
        box-shadow: 0 0 0 3px rgba(96,165,250,0.06);
        font-size: 12.5px; color: var(--mm-fg);
        max-width: 460px;
      }
      .mm-focus-pill-label {
        font-family: var(--mm-mono); font-size: 10px;
        color: var(--mm-fg-mute); text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .mm-focus-pill-name {
        font-family: var(--mm-serif); font-size: 13.5px;
        color: #f4f4f5; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; max-width: 280px;
      }
      .mm-focus-pill-kind {
        font-family: var(--mm-mono); font-size: 10px;
        color: var(--mm-fg-mute); padding: 2px 6px;
        border: 1px solid var(--mm-border-2); border-radius: 3px;
      }
      .mm-focus-pill-reset {
        background: transparent; border: 0; color: var(--mm-fg-mute);
        font-size: 14px; cursor: pointer; padding: 0 4px;
        border-radius: 3px; margin-left: 2px;
      }
      .mm-focus-pill-reset:hover {
        color: var(--mm-fg); background: rgba(255,255,255,0.05);
      }
      .mm-search {
        flex: 1 1 360px; max-width: 520px;
        display: flex; align-items: center; gap: 8px;
        border: 1px solid var(--mm-border-2); border-radius: 8px;
        background: #0b0b0f; padding: 9px 14px;
      }
      .mm-search input {
        flex: 1; background: transparent; border: 0; outline: 0;
        color: var(--mm-fg); font-family: var(--mm-sans); font-size: 14px;
      }
      .mm-search input::placeholder { color: #5a5a66; }
      .mm-search-clear {
        background: transparent; border: 0; color: var(--mm-fg-mute);
        font-size: 16px; cursor: pointer; padding: 0 4px;
      }
      .mm-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border: 1px solid var(--mm-border-2);
        border-radius: 999px; background: #0b0b0f;
        color: var(--mm-fg-dim); font-size: 12.5px; cursor: pointer;
        user-select: none; transition: all .15s;
      }
      .mm-chip:hover { border-color: #3a3a44; color: var(--mm-fg); }
      .mm-chip-active { border-color: #4a4a56; color: var(--mm-fg); background: #15151c; }

      .mm-main {
        display: grid;
        grid-template-columns: 300px 1fr 250px;
        max-width: 1440px; margin: 0 auto;
        border-bottom: 1px solid var(--mm-border);
      }
      .mm-col { min-height: 720px; }
      .mm-col-left  { border-right: 1px solid var(--mm-border); padding: 18px; }
      .mm-col-right { border-left: 1px solid var(--mm-border);  padding: 18px; }

      .mm-rail-h {
        font-family: var(--mm-mono); text-transform: uppercase;
        letter-spacing: 0.14em; font-size: 10.5px;
        color: var(--mm-fg-mute); margin: 0 0 12px;
      }

      .mm-card {
        border: 1px solid var(--mm-border); border-radius: 10px;
        padding: 14px; background: linear-gradient(180deg, #0e0e13, #0a0a0e);
        margin-bottom: 10px; cursor: pointer;
        transition: border-color .15s, transform .15s;
      }
      .mm-card:hover { border-color: #3a3a46; transform: translateY(-1px); }
      .mm-card-label {
        font-family: var(--mm-mono); font-size: 10px;
        color: var(--mm-fg-mute); text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .mm-card-headline {
        font-family: var(--mm-serif); font-size: 17px;
        line-height: 1.3; margin: 7px 0 8px; color: #f4f4f5;
      }
      .mm-card-metric {
        font-family: var(--mm-mono); font-size: 11.5px; color: var(--mm-fg-dim);
      }

      .mm-canvas-wrap {
        position: relative; min-height: 720px;
        background:
          radial-gradient(ellipse at 25% 30%, rgba(96,165,250,0.045) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 70%, rgba(167,139,250,0.035) 0%, transparent 55%),
          #050507;
        overflow: hidden;
      }
      .mm-cy { width: 100%; height: 720px; display: block; cursor: grab; }
      .mm-cy:active { cursor: grabbing; }
      .mm-canvas-wrap::before {
        content: ""; position: absolute; inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
        background-size: 60px 60px;
        pointer-events: none;
        mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
      }
      .mm-canvas-overlay {
        position: absolute; top: 14px; left: 18px;
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute); pointer-events: none; z-index: 3;
      }
      .mm-pill {
        display: inline-block;
        background: rgba(10,10,14,0.78);
        border: 1px solid var(--mm-border-2);
        border-radius: 999px; padding: 4px 12px;
        backdrop-filter: blur(6px);
      }
      .mm-canvas-hint {
        position: absolute; bottom: 16px; right: 18px;
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute);
        background: rgba(10,10,14,0.78);
        border: 1px solid var(--mm-border-2);
        border-radius: 5px; padding: 5px 10px;
        backdrop-filter: blur(6px); z-index: 3;
      }

      .mm-legend-group { margin-bottom: 20px; }
      .mm-legend-row {
        display: flex; align-items: center; gap: 10px;
        padding: 5px 0; font-size: 12.5px; color: var(--mm-fg-dim);
      }
      .mm-legend-swatch {
        width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
        box-shadow: 0 0 6px currentColor;
      }
      .mm-legend-line {
        flex-shrink: 0; width: 26px; display: inline-block;
      }
      .mm-meta-stat {
        display: flex; justify-content: space-between;
        padding: 6px 0; border-bottom: 1px dashed var(--mm-border);
        font-size: 12.5px;
      }
      .mm-k {
        color: var(--mm-fg-mute); font-family: var(--mm-mono);
        font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em;
      }
      .mm-v { color: var(--mm-fg); font-family: var(--mm-mono); font-size: 14px; }

      .mm-below {
        max-width: 1440px; margin: 0 auto;
        display: grid; grid-template-columns: 1fr 1fr;
        border-top: 1px solid var(--mm-border);
      }
      .mm-below > div { padding: 26px 32px; }
      .mm-below-left { border-right: 1px solid var(--mm-border); }
      .mm-below h3 {
        font-family: var(--mm-serif); font-weight: 500;
        font-size: 20px; margin: 0 0 14px; color: #f4f4f5;
      }
      .mm-rank-row {
        display: grid; grid-template-columns: 28px 1fr auto auto;
        gap: 14px; align-items: baseline;
        padding: 11px 0; border-bottom: 1px dashed var(--mm-border);
        font-size: 13px; cursor: pointer;
        transition: background .12s;
      }
      .mm-rank-row:hover { background: rgba(255,255,255,0.02); }
      .mm-rank-n    { font-family: var(--mm-mono); font-size: 13px; color: var(--mm-fg-mute); }
      .mm-rank-name { color: var(--mm-fg); }
      .mm-rank-val  { font-family: var(--mm-mono); color: #f4f4f5; }
      .mm-rank-meta { font-family: var(--mm-mono); font-size: 13px; color: var(--mm-fg-mute); }

      /* Repeat-offenders feature ranking */
      .mm-below-feature { grid-template-columns: 1fr; }
      .mm-below-full { padding: 28px 32px; }
      .mm-feature-h { margin-bottom: 6px !important; }
      .mm-feature-sub {
        font-size: 14px; color: var(--mm-fg-dim); line-height: 1.55;
        max-width: 820px; margin: 0 0 18px 0;
      }
      .mm-feature-empty {
        font-size: 12px; color: var(--mm-fg-mute); padding: 14px 0;
      }
      .mm-ro-grid { display: flex; flex-direction: column; }
      .mm-ro-row {
        display: grid;
        grid-template-columns: 32px minmax(220px, 1fr) 60px auto auto;
        gap: 16px; align-items: center;
        padding: 12px 6px; border-bottom: 1px dashed var(--mm-border);
        cursor: pointer; transition: background .12s;
      }
      .mm-ro-row:hover { background: rgba(147,197,253,0.03); }
      .mm-ro-rank {
        font-family: var(--mm-mono); font-size: 11px; color: var(--mm-fg-mute);
        text-align: right;
      }
      .mm-ro-name {
        color: var(--mm-fg); font-size: 13.5px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .mm-ro-score {
        font-family: var(--mm-mono); font-size: 15px; font-weight: 500;
        color: #fbbf24; text-align: right;
        padding: 3px 8px; border-radius: 4px;
        background: rgba(251,191,36,0.06);
        border: 1px solid rgba(251,191,36,0.2);
      }
      .mm-ro-bits {
        display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;
        font-family: var(--mm-mono); font-size: 11px;
      }
      .mm-ro-bit {
        color: var(--mm-fg-mute);
        padding: 2px 6px; border-radius: 3px;
        border: 1px solid var(--mm-border);
      }
      .mm-ro-bit-hot {
        color: #fb7185;
        border-color: rgba(251,113,133,0.3);
        background: rgba(251,113,133,0.05);
      }
      .mm-ro-bit-gbp {
        color: #f4f4f5;
        border-color: rgba(147,197,253,0.25);
        background: rgba(147,197,253,0.05);
      }
      @media (max-width: 900px) {
        .mm-ro-row {
          grid-template-columns: 28px 1fr auto auto;
        }
        .mm-ro-bits { grid-column: 1 / -1; justify-content: flex-start; }
      }

      .mm-footer {
        max-width: 1440px; margin: 0 auto;
        padding: 26px 32px 42px;
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute);
        display: flex; gap: 20px; justify-content: space-between;
        flex-wrap: wrap; border-top: 1px solid var(--mm-border);
      }

      .mm-known-unknowns {
        margin-top: 20px; padding: 11px 13px;
        border: 1px dashed var(--mm-border-2); border-radius: 7px;
        font-size: 12px; color: var(--mm-fg-dim); background: #0a0a0e;
      }
      .mm-known-unknowns h4 {
        font-family: var(--mm-mono); font-size: 10px;
        text-transform: uppercase; letter-spacing: 0.12em;
        color: var(--mm-fg-mute); margin: 0 0 6px; font-weight: 500;
      }

      /* Drawer */
      .mm-drawer {
        position: fixed; top: 0; right: 0; width: min(460px, 92vw);
        height: 100%;
        background: rgba(10,10,14,0.98);
        backdrop-filter: blur(16px);
        border-left: 1px solid var(--mm-border);
        transform: translateX(100%);
        transition: transform .25s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 60; display: flex; flex-direction: column;
        box-shadow: -24px 0 60px rgba(0,0,0,0.6);
      }
      .mm-drawer-open { transform: translateX(0); }
      .mm-d-head {
        padding: 22px 26px 20px;
        border-bottom: 1px solid var(--mm-border);
        position: relative;
      }
      .mm-d-close {
        position: absolute; top: 14px; right: 14px;
        width: 30px; height: 30px;
        background: transparent; border: 1px solid transparent;
        color: var(--mm-fg-mute); font-family: var(--mm-mono);
        font-size: 18px; cursor: pointer; border-radius: 4px;
      }
      .mm-d-close:hover { color: var(--mm-fg); border-color: var(--mm-border-2); }
      .mm-eyebrow-row {
        display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;
      }
      .mm-entity-name {
        font-family: var(--mm-serif); font-size: 26px;
        color: #f4f4f5; margin: 2px 0 8px;
        letter-spacing: -0.01em; line-height: 1.1;
      }
      .mm-entity-sub {
        font-family: var(--mm-mono); font-size: 11.5px; color: var(--mm-fg-mute);
      }
      .mm-entity-sub b { color: var(--mm-fg); }
      .mm-d-body {
        padding: 20px 26px; overflow-y: auto; flex: 1;
      }
      .mm-d-section-h {
        font-family: var(--mm-mono); text-transform: uppercase;
        letter-spacing: 0.14em; font-size: 10.5px;
        color: var(--mm-fg-mute); margin: 22px 0 10px;
      }
      .mm-d-section-h:first-child { margin-top: 0; }

      .mm-score-row {
        display: grid; grid-template-columns: 1fr auto;
        padding: 11px 0; border-bottom: 1px solid var(--mm-border);
        align-items: baseline;
      }
      .mm-score-k { font-size: 14px; color: var(--mm-fg); }
      .mm-score-v {
        font-family: var(--mm-mono); font-size: 14px;
        color: #f4f4f5; font-weight: 500;
      }
      .mm-score-hint {
        font-size: 11.5px; color: var(--mm-fg-mute);
        grid-column: 1 / -1; margin-top: 3px; line-height: 1.4;
      }
      .mm-edge-item {
        padding: 13px 0; border-bottom: 1px solid var(--mm-border);
        display: grid; grid-template-columns: 1fr auto; gap: 4px 10px;
      }
      .mm-edge-title { font-size: 14px; color: var(--mm-fg); }
      .mm-edge-amount {
        font-family: var(--mm-mono); font-size: 14px;
        color: #f4f4f5; text-align: right; font-weight: 500;
      }
      .mm-edge-amount-undisclosed {
        color: #9ca3af; font-style: italic; font-weight: 400;
        letter-spacing: 0.01em;
      }
      .mm-edge-amount-undisclosed::before {
        content: "≈ ";
        color: #6b7280; font-style: normal;
      }
      .mm-why-undisclosed {
        margin-top: 18px; padding: 12px 14px;
        border: 1px dashed rgba(156,163,175,0.3);
        border-radius: 6px;
        background: rgba(156,163,175,0.04);
      }
      .mm-why-undisclosed-h {
        font-family: var(--mm-mono); font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: #9ca3af; margin-bottom: 8px;
      }
      .mm-why-undisclosed-body {
        font-size: 14px; color: var(--mm-fg-dim); line-height: 1.55;
      }
      .mm-why-undisclosed-body ul {
        margin: 6px 0 0 0; padding-left: 18px;
      }
      .mm-why-undisclosed-body li { margin: 3px 0; }
      .mm-why-undisclosed-foot {
        margin-top: 8px; font-size: 11px; color: var(--mm-fg-mute);
      }
      .mm-edge-meta {
        grid-column: 1 / -1;
        display: flex; gap: 8px; align-items: center;
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute); flex-wrap: wrap;
      }
      .mm-tier-badge {
        padding: 2px 8px; border-radius: 3px;
        font-weight: 600; font-size: 10.5px;
        letter-spacing: 0.05em; font-family: var(--mm-mono);
      }
      .mm-tier-A { color: #34d399; border: 1px solid rgba(52,211,153,0.35); background: rgba(52,211,153,0.06); }
      .mm-tier-B { color: #93c5fd; border: 1px solid rgba(147,197,253,0.3);  background: rgba(147,197,253,0.05); }
      .mm-tier-C { color: #fbbf24; border: 1px solid rgba(251,191,36,0.3);   background: rgba(251,191,36,0.05); }
      .mm-tier-D { color: #9ca3af; border: 1px solid rgba(156,163,175,0.3); }
      .mm-edge-doc {
        color: var(--mm-fg-dim);
        text-decoration: underline;
        text-decoration-color: var(--mm-fg-mute);
        cursor: pointer;
      }
      .mm-edge-doc:hover { color: var(--mm-fg); }

      /* Lens: focus-chip + CTA inside the drawer head */
      .mm-d-focus-chip {
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 10px;
        padding: 4px 10px; border-radius: 999px;
        font-family: var(--mm-mono); font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: #93c5fd; border: 1px solid rgba(147,197,253,0.4);
        background: rgba(96,165,250,0.06);
      }
      .mm-d-focus-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: #93c5fd; box-shadow: 0 0 6px rgba(147,197,253,0.7);
      }
      .mm-d-focus-cta {
        display: inline-flex; align-items: center; gap: 8px;
        margin-top: 10px;
        background: linear-gradient(90deg, rgba(96,165,250,0.15), rgba(167,139,250,0.15));
        border: 1px solid rgba(147,197,253,0.35);
        color: var(--mm-fg);
        border-radius: 6px; padding: 7px 14px;
        font-family: var(--mm-sans); font-size: 12.5px; font-weight: 500;
        cursor: pointer; transition: all .15s;
      }
      .mm-d-focus-cta:hover {
        border-color: #93c5fd;
        background: linear-gradient(90deg, rgba(96,165,250,0.22), rgba(167,139,250,0.22));
        transform: translateY(-1px);
      }

      /* Jumpable relationship rows in Lens mode */
      .mm-edge-item-jumpable {
        cursor: pointer;
        padding-left: 6px; margin-left: -6px;
        border-radius: 4px;
        transition: background .12s, transform .12s;
      }
      .mm-edge-item-jumpable:hover {
        background: rgba(96,165,250,0.06);
      }
      .mm-edge-jump {
        margin-left: 8px; font-family: var(--mm-mono);
        font-size: 11px; color: #93c5fd; opacity: 0;
        transition: opacity .12s;
      }
      .mm-edge-item-jumpable:hover .mm-edge-jump { opacity: 0.95; }

      /* Canvas actions — top-right export button */
      .mm-canvas-actions {
        position: absolute; top: 12px; right: 14px;
        display: flex; gap: 6px; z-index: 4;
      }
      .mm-canvas-action {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(10,10,14,0.82);
        border: 1px solid var(--mm-border-2);
        color: var(--mm-fg-dim);
        font-family: var(--mm-mono); font-size: 11px;
        padding: 6px 10px; border-radius: 5px;
        cursor: pointer; backdrop-filter: blur(6px);
        transition: all .15s;
      }
      .mm-canvas-action:hover {
        border-color: #3a3a46; color: var(--mm-fg);
        background: rgba(15,15,20,0.92);
      }
      .mm-canvas-action:focus-visible {
        outline: 2px solid #93c5fd; outline-offset: 2px;
      }
      .mm-canvas-action[disabled] {
        opacity: 0.5; cursor: not-allowed;
      }

      /* Empty-canvas overlay — when filters hide every node */
      .mm-canvas-empty {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        z-index: 5;
        background:
          radial-gradient(ellipse at center, rgba(6,6,8,0.55) 0%, rgba(6,6,8,0.85) 70%);
        backdrop-filter: blur(2px);
      }
      .mm-canvas-empty-inner {
        max-width: 440px; padding: 22px 26px; text-align: center;
        border: 1px solid var(--mm-border-2); border-radius: 10px;
        background: rgba(10,10,14,0.92);
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      }
      .mm-canvas-empty-eyebrow {
        font-family: var(--mm-mono); font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.16em;
        color: var(--mm-fg-mute); margin-bottom: 10px;
      }
      .mm-canvas-empty-body {
        font-family: var(--mm-serif); font-size: 17px;
        color: #f4f4f5; line-height: 1.45; margin: 0 0 16px;
      }
      .mm-canvas-empty-actions {
        display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
      }
      .mm-canvas-empty-btn {
        background: #15151c;
        border: 1px solid var(--mm-border-2);
        color: var(--mm-fg);
        font-family: var(--mm-sans); font-size: 12.5px;
        padding: 7px 14px; border-radius: 6px; cursor: pointer;
        transition: all .15s;
      }
      .mm-canvas-empty-btn:hover {
        border-color: #4a4a56; background: #1d1d26;
      }
      .mm-canvas-empty-btn:focus-visible {
        outline: 2px solid #93c5fd; outline-offset: 2px;
      }

      /* Mobile rails — collapsible accordions for story cards / legend / stats */
      .mm-mobile-rails { display: none; } /* desktop: hidden */
      .mm-mobile-det {
        border-bottom: 1px solid var(--mm-border);
        background: #08080b;
      }
      .mm-mobile-det[open] { background: #0a0a0e; }
      .mm-mobile-sum {
        padding: 12px 20px; cursor: pointer;
        font-family: var(--mm-mono); font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: var(--mm-fg-dim); list-style: none;
        display: flex; align-items: center; justify-content: space-between;
      }
      .mm-mobile-sum::-webkit-details-marker { display: none; }
      .mm-mobile-sum::after {
        content: "+"; font-size: 16px; color: var(--mm-fg-mute);
        transition: transform .2s;
      }
      .mm-mobile-det[open] .mm-mobile-sum::after {
        content: "−";
      }
      .mm-mobile-body {
        padding: 6px 20px 18px;
      }
      .mm-mobile-legend-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;
      }

      /* Repeat-offenders → profile cross-link button */
      .mm-ro-profile {
        background: transparent; border: 1px solid var(--mm-border-2);
        color: var(--mm-fg-mute); font-family: var(--mm-mono);
        font-size: 12px; padding: 4px 8px; border-radius: 4px;
        cursor: pointer; transition: all .15s; justify-self: end;
      }
      .mm-ro-profile:hover {
        border-color: #93c5fd; color: #93c5fd;
        background: rgba(96,165,250,0.05);
      }
      .mm-ro-profile:focus-visible {
        outline: 2px solid #93c5fd; outline-offset: 2px;
      }

      /* Qualitative HHI / dependence band pill */
      .mm-band-pill {
        display: inline-flex; align-items: center;
        font-family: var(--mm-mono); font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.08em;
        padding: 2px 7px; border-radius: 3px;
        border: 1px solid var(--mm-border-2);
        color: var(--mm-fg-dim);
        margin-left: 8px;
      }
      .mm-band-good {
        color: #34d399;
        border-color: rgba(52,211,153,0.35);
        background: rgba(52,211,153,0.06);
      }
      .mm-band-warn {
        color: #fbbf24;
        border-color: rgba(251,191,36,0.3);
        background: rgba(251,191,36,0.05);
      }
      .mm-band-bad {
        color: #fb7185;
        border-color: rgba(251,113,133,0.3);
        background: rgba(251,113,133,0.05);
      }

      @media (max-width: 960px) {
        .mm-main, .mm-below { grid-template-columns: 1fr; }
        .mm-col-left, .mm-col-right { display: none; }
        .mm-cy { height: 480px; }
        .mm-canvas-wrap { min-height: 480px; }
        /* Sticky filter bar doesn't hog a mobile viewport — allow it to scroll with page */
        .mm-filters:not(.mm-filters-modes) { position: static; backdrop-filter: none; }
        /* Mobile rails visible, slotted between canvas and rankings */
        .mm-mobile-rails { display: block; border-top: 1px solid var(--mm-border); }
        .mm-canvas-actions { top: 8px; right: 8px; }
      }

      /* Sub-480px tightening: 44px tap targets on chips, smaller canvas,
         legend wraps, repeat-offender row stacks, drawer close enlarged. */
      @media (max-width: 480px) {
        .mm-chip, .mm-filters button, .mm-canvas-action, .mm-canvas-empty-btn {
          min-height: 44px;
          padding: 10px 14px;
          font-size: 14px;
        }
        .mm-cy { height: 360px; }
        .mm-canvas-wrap { min-height: 360px; }
        .mm-legend-row { flex-wrap: wrap; gap: 6px; }
        .mm-legend-line { font-size: 12px; }
        .mm-ro-row {
          grid-template-columns: 28px 1fr auto;
          row-gap: 4px;
        }
        .mm-ro-bits {
          grid-column: 2 / -1;
          font-size: 12px;
          justify-content: flex-start;
        }
        .mm-d-close { min-width: 44px; min-height: 44px; }
        .mm-drawer { width: min(92vw, 420px); }
      }

      /* ----------------------------------------------------
         Audit rec #98 — mobile list view (MoneyMapMobileList)
         ---------------------------------------------------- */
      .mm-filters-layout {
        justify-content: flex-end;
      }
      .mm-layout-toggle {
        padding: 8px 12px;
        min-height: 44px;
        font-family: var(--mm-mono);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--mm-fg-dim);
        background: transparent;
        border: 1px solid var(--mm-border);
        border-radius: 4px;
        cursor: pointer;
        transition: color 120ms, border-color 120ms;
      }
      .mm-layout-toggle:hover,
      .mm-layout-toggle:focus-visible {
        color: var(--mm-fg);
        border-color: var(--mm-border-2);
      }
      /* Desktop: the "show list view" toggle is a small convenience
         but not the default — hide it at ≥768px to keep the filter
         bar uncluttered for readers who want the canvas. */
      @media (min-width: 768px) {
        .mm-layout-toggle-mobile { display: none; }
      }
      .mm-mobile-list {
        padding: 12px 8px 20px;
      }
      .mm-mobile-list-empty {
        padding: 32px 16px;
        color: var(--mm-fg-dim);
        font-size: 14px;
        text-align: center;
      }
      .mm-mobile-list-h {
        font-family: var(--mm-mono);
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--mm-fg-dim);
        padding: 8px 8px 14px;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
      }
      .mm-mobile-list-hint {
        color: #6b7280;
        font-size: 10px;
        text-transform: none;
        letter-spacing: 0;
      }
      .mm-mobile-list-row {
        display: block;
        width: 100%;
        min-height: 64px;
        text-align: left;
        padding: 12px 12px;
        background: transparent;
        border: 0;
        border-bottom: 1px solid var(--mm-border);
        color: inherit;
        cursor: pointer;
        transition: background-color 120ms;
      }
      .mm-mobile-list-row:hover,
      .mm-mobile-list-row:focus-visible {
        background: rgba(251, 191, 36, 0.04);
      }
      .mm-mobile-list-row:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: -2px;
      }
      .mm-mobile-list-row-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .mm-mobile-list-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--mm-fg);
        line-height: 1.25;
      }
      .mm-mobile-list-amount {
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        font-size: 16px;
        color: var(--mm-fg);
        white-space: nowrap;
      }
      .mm-mobile-list-sub {
        margin-top: 4px;
        font-size: 13px;
        color: #9ca3af;
        line-height: 1.4;
      }
    `}</style>
  );
}
