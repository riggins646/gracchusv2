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
import { X, ArrowLeft, ExternalLink, Download, ChevronDown, SlidersHorizontal, AlertTriangle, Users } from "lucide-react";
import CiteChip from "./CiteChip";
import useDrawerFocus from "../lib/useDrawerFocus";
import individualConnectionsData from "../data/individual-connections.json";
import donationsAggregateData from "../data/political-donations.json";
/* 2026-04-26 — Money Map v2 Phase 4. Registered consultant lobbyists
   (Office of the Registrar of Consultant Lobbyists, 251 firms / 1,172
   unique declared clients) bundle into the MoneyMap chunk so the
   lobbyist canvas layer ships without an async fetch race. */
import lobbyistRecordsData from "../data/lobbyist-records.json";
import {
  matchClientToSupplier,
  buildSupplierIndex,
  lobbyistSlug,
  LOBBYIST_TYPE_LABEL,
  orclSearchUrl,
} from "../lib/lobbyist-aggregation";
/* 2026-04-26 — Money Map v2 Phase 3 follow-up. The per-record donations
   file used to be parsed inline here at module load (~6,819 records →
   ≈ 501 unique company donors). That aggregation is now in a shared util
   so Dashboard's cmd-K palette can search the same set without duplicating
   ~120 lines of normalisation + matcher logic. The bundle hit lives in the
   util's import of donations-records.json — landed in whichever chunk
   imports first. */
import {
  COMPANY_DONORS_FROM_RECORDS,
  donorPartyId,
  donorSlug,
  normaliseFirmName as _normaliseFirmName,
  buildOverlapMatcher,
  mergeDonorParties,
  pickDominantParty,
} from "../lib/donor-aggregation";

/* ---------- constants ---------- */
const TYPE_COLOUR = {
  supplier: "#94a3b8",
  buyer:    "#60a5fa",
  project:  "#a78bfa",
  /* v2 Phase 1 — people on the canvas. Amber to match the source-grade
     dot in the hero and the Stories card accent: the visual language
     across the surface is "amber means an editorially-curated entity
     of public interest, not a money flow". */
  person:        "#fbbf24",
  /* Adjacent firms (Greensill, BlackRock, Meta, JP Morgan etc.) appear
     as desaturated context — they're not Gracchus-tracked entities so
     they shouldn't read with the same weight as a real supplier. */
  adjacent_firm: "#525561",
  /* v2 Phase 2 — political parties on the canvas. Each party renders in
     its own canonical hex (see PARTY_DEFS); this entry is a fallback
     used only if a party node lands without a colour set on it. */
  party:         "#777777",
  /* v2 Phase 3 — political donors on the canvas. Neutral fallback;
     individual donor bubbles override at render time using DONOR_TYPE_COLOUR
     (companies = light slate, individuals = warm beige, trade unions =
     warm peach). The party-colour stroke around each donor signals their
     dominant recipient. */
  donor:         "#94a3b8",
  /* v2 Phase 4 — registered consultant lobbyists. Bright violet so the
     lobbyist ring reads distinctly against the project's softer violet
     (#a78bfa) — shape (hollow ring vs filled bubble) is the primary
     differentiator, hue is the secondary. The ring treatment + dashed
     edges signal "agent of access, not a money flow itself". */
  lobbyist:      "#c084fc",
};

/* v2 Phase 3 — donor visual treatment by donorStatus. Companies look
   institutional (slate); individuals warm (stone/beige); trade unions
   pop a little (peach) so the editorially-loud Unite/UNISON/GMB cluster
   reads at a glance. Anything else falls back to the neutral grey. */
const DONOR_TYPE_COLOUR = {
  Company:                          "#94a3b8",
  Individual:                       "#a8a29e",
  "Trade Union":                    "#fdba74",
  "Unincorporated Association":     "#cbd5e1",
  "Limited Liability Partnership":  "#94a3b8",
  "Friendly Society":               "#cbd5e1",
  Trust:                            "#cbd5e1",
  Other:                            "#9ca3af",
};

/* v2 Phase 2 — political party catalogue. Canonical id → display label,
   hex colour, and a one-sentence institutional descriptor used in the
   PartyDetail drawer. Hex colours follow each party's published brand
   guidance; greys are used for Independent and the catch-all "none"
   bucket (which isn't surfaced as a node — it suppresses the edge). */
const PARTY_DEFS = {
  conservative:        { label: "Conservative Party",                 short: "C",  color: "#0087DC", description: "Conservative Party — in government 2010-2024." },
  labour:              { label: "Labour Party",                       short: "L",  color: "#DC241F", description: "Labour Party — in government from July 2024." },
  "liberal-democrats": { label: "Liberal Democrats",                  short: "LD", color: "#FAA61A", description: "Liberal Democrats — in coalition government 2010-2015." },
  "reform-uk":         { label: "Reform UK",                          short: "R",  color: "#12B6CF", description: "Reform UK — populist right party founded as the Brexit Party in 2018." },
  snp:                 { label: "Scottish National Party",            short: "SNP",color: "#FFF95D", description: "Scottish National Party — governing party at Holyrood." },
  green:               { label: "Green Party",                        short: "G",  color: "#6AB023", description: "Green Party of England and Wales." },
  "plaid-cymru":       { label: "Plaid Cymru",                        short: "PC", color: "#005B54", description: "Plaid Cymru — Welsh nationalist party." },
  dup:                 { label: "Democratic Unionist Party",          short: "DUP",color: "#D46A4C", description: "Democratic Unionist Party — Northern Ireland unionist party." },
  "sinn-fein":         { label: "Sinn Féin",                          short: "SF", color: "#326760", description: "Sinn Féin — Irish republican party." },
  independent:         { label: "Independent",                        short: "I",  color: "#777777", description: "Independent — sitting without a party whip." },
};

const TIER_STYLE = {
  A: { dash: null,    opacity: 0.78, colour: "#e5e7eb", width: 1.6 },
  B: { dash: null,    opacity: 0.55, colour: "#b8b8c2", width: 1.3 },
  C: { dash: "5 4",   opacity: 0.60, colour: "#8a8a94", width: 1.2 },
  D: { dash: "1 3.5", opacity: 0.40, colour: "#7a7a84", width: 1.0 },
};

/* 2026-04-26 — Layers control (task #115). The canonical list of layer ids
   the reader can toggle via the floating Layers panel (desktop top-right)
   and the Layers section in the mobile Filters sheet. Order matters here:
   it determines panel row order. Node-kind ids match `node.kind` exactly
   so visibleNodes can do a Set.has(n.kind) check; edge-kind ids match
   either `edge.kind` (for the typed edges introduced in v2 phases 1-4)
   or a virtual id we apply at filter time (e.g. "award" comes from
   `edge.kind === "award"`). Default = all on so first paint shows the
   full v2 Phase 4 picture; the reader dials down. */
const LAYER_DEFS = [
  // Money flow group
  { id: "award",          group: "money",  scope: "edge", label: "Money-flow edges",
    kind: "edge",         swatchColor: "#b8b8c2", dashed: false },
  { id: "supplier",       group: "money",  scope: "node", label: "Suppliers",
    kind: "node",         swatchColor: "#94a3b8" },
  { id: "buyer",          group: "money",  scope: "node", label: "Buyers (departments)",
    kind: "node",         swatchColor: "#60a5fa" },
  { id: "project",        group: "money",  scope: "node", label: "Projects",
    kind: "node",         swatchColor: "#a78bfa" },
  // People + politics group
  { id: "person",         group: "people", scope: "node", label: "People",
    kind: "node",         swatchColor: "#fbbf24" },
  { id: "party",          group: "people", scope: "node", label: "Parties",
    kind: "node",         swatchColor: "#0087DC" },
  { id: "donor",          group: "people", scope: "node", label: "Donors",
    kind: "node",         swatchColor: "#94a3b8" },
  { id: "lobbyist",       group: "people", scope: "node", label: "Lobbyists",
    kind: "node",         swatchColor: "#c084fc" },
  { id: "adjacent_firm",  group: "people", scope: "node", label: "Adjacent firms",
    kind: "node",         swatchColor: "#525561" },
  // Relational-edge group
  { id: "person_party",     group: "edges", scope: "edge", label: "Person to party edges",
    kind: "edge",           swatchColor: "#0087DC", dashed: true },
  { id: "donor_party",      group: "edges", scope: "edge", label: "Donor to party edges",
    kind: "edge",           swatchColor: "#DC241F", dashed: false },
  { id: "lobbyist_client",  group: "edges", scope: "edge", label: "Lobbyist to client edges",
    kind: "edge",           swatchColor: "#c084fc", dashed: true },
  { id: "served_at",        group: "edges", scope: "edge", label: "Person served-at edges",
    kind: "edge",           swatchColor: "#fbbf24", dashed: true },
];
/* 2026-04-26 — Smart layer defaults (task #118).
   First-time visitor sees the BASE layer only: suppliers, buyers, projects
   and £-flow edges. v2 layers (people, parties, donors, lobbyists,
   adjacent firms + their relational edges) are one click away via the
   Layers panel — and via the new "Show all" preset toggle on the panel
   header. ~700 nodes-and-edges all-at-once was visually overwhelming
   for readers landing on /money-map cold. */
const DEFAULT_VISIBLE_LAYERS = [
  // Base layer — first-time visitor sees this
  "supplier", "buyer", "project",
  "award",  // £-flow edges
  // v2 layers default OFF — readers opt in via the panel
];
/* Canonical "everything on" set. Generated from LAYER_DEFS so adding a
   new layer row automatically extends ALL_LAYERS without a separate edit. */
const ALL_LAYERS = LAYER_DEFS.map((l) => l.id);

const WIDTH = 1200;
const HEIGHT = 720;

const CLUSTER_CX = { buyer: 520, supplier: 700, project: 600, person: 360, adjacent_firm: 820, party: 200, donor: 80, lobbyist: 880 };
const CLUSTER_CY = { buyer: 320, supplier: 380, project: 500, person: 200, adjacent_firm: 540, party: 130, donor: 360, lobbyist: 200 };

/* ---------- v2 Phase 1: people layer ----------
   Map common rolesHeld[] department strings onto the canonical buyer ids
   they ought to render an edge to. Anything not in this table is silently
   skipped (HM Treasury, House of Commons / Lords, 10 Downing Street, FCO,
   private-sector roles, etc. — they're either not tracked as Gracchus
   buyer nodes or they're not departments at all). The matcher is exact
   on the strings that appear in individual-connections.json and tolerant
   of the few common aliases. Keep keys lowercase for the comparator. */
const DEPT_TO_BUYER_ID = {
  "defra": "buyer-desnz",  // n/a — Defra not yet a tracked buyer; placeholder
  "department for environment, food and rural affairs": "buyer-desnz", // n/a
  "cabinet office": "buyer-cabinet-office",
  "cabinet office / crown commercial service": "buyer-cabinet-office",
  "dhsc": "buyer-department-of-health-and-social-care",
  "department of health and social care": "buyer-department-of-health-and-social-care",
  "ministry of defence": "buyer-ministry-of-defence",
  "mod": "buyer-ministry-of-defence",
  "home office": "buyer-home-office",
  "department for education": "buyer-department-for-education-delivering-through-the-education-an",
};
/* Defra is not on the tracked buyer list yet — entries above resolve to
   null at lookup time and are skipped. The map stays in the file for
   when the precompute starts emitting a Defra node so we don't have to
   rewire. */
const TRACKED_BUYER_IDS_FOR_DEPTS = new Set([
  "buyer-cabinet-office",
  "buyer-department-of-health-and-social-care",
  "buyer-ministry-of-defence",
  "buyer-home-office",
  "buyer-department-for-education-delivering-through-the-education-an",
]);

function deptToBuyerId(dept) {
  if (!dept) return null;
  const k = String(dept).toLowerCase().trim();
  const mapped = DEPT_TO_BUYER_ID[k];
  if (!mapped) return null;
  if (!TRACKED_BUYER_IDS_FOR_DEPTS.has(mapped)) return null;
  return mapped;
}

function adjacentSlug(name) {
  return "adjacent:" + String(name || "unnamed")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

/* =========================================================================
 *  v2 Phase 3 — donor layer prep (module scope, runs once on import)
 *
 *  Two source datasets feed this layer:
 *
 *    A) donations-records.json — the per-record EC dataset (6,819 records
 *       from 92,378 historic; recent and high-value first). Walked at
 *       module load to aggregate Company / LLP donors with REAL per-party
 *       £ splits + first/last accepted dates. This is the source of truth
 *       for supplier-overlap matching (≈ 501 unique companies; matching
 *       9 tracked suppliers as at 2026-04-26).
 *
 *    B) political-donations.json `topDonors` — the pre-aggregated top-100
 *       block. Used as the source for non-Company donor BUBBLES (trade
 *       unions, individuals) since the records aggregation only walks
 *       Company / LLP rows. Per-party splits here are approximated
 *       (aggregate carries party LIST, not £ per party).
 *
 *  Original Phase 3 (commit 8a09cab) ran only off (B) and surfaced ZERO
 *  overlaps — the top of the EC list is dominated by trade unions and HNW
 *  individuals, not government contractors. Switching the matcher to (A)
 *  surfaces the real Deloitte / William Cook / McAlpine / Canary Wharf /
 *  Heathrow / Imagination overlaps the dataset always contained but the
 *  pre-aggregate truncation hid.
 *
 *  Steps:
 *    1) Map party-name strings to canonical PARTY_DEFS ids
 *    2) Drop public-fund "donors" (Short Money / Electoral Commission
 *       statutory transfers — not voluntary giving)
 *    3) Aggregate Company / LLP donors from records, take all for matching
 *       (we want every overlap regardless of £); take top N by £ for
 *       standalone bubbles after excluding overlaps
 *    4) Top up bubble cap with top trade-union and individual donors from
 *       the topDonors block
 *    5) Detect supplier overlap (Companies House reg first, then
 *       normalised-name match, then token-overlap fallback for parented
 *       brands) — overlap donors collapse onto the supplier node rather
 *       than minting a separate donor bubble
 * ========================================================================= */

/* DONOR_PARTY_NAME_MAP, donorPartyId, _normaliseFirmName, donorSlug — all
   moved to ../lib/donor-aggregation.js (single source of truth, shared
   with Dashboard cmd-K). Imported at the top of this file. */

/* Mode-of donor types — picks the most common donorStatus across this
   donor's records (should be stable per donor). */
function _modeStatus(parties) {
  // pre-aggregate already gives us a single donor type per row, so this
  // is mainly defensive when we extend to full records.
  return null;
}

const DONOR_PUBLIC_FUND_TYPES = new Set([
  "Public Fund", "N/A", "Unknown", "Unidentifiable Donor",
  "Impermissible Donor", "Registered Political Party",
]);

const DONOR_TOP_N = 25;

/* _buildCompanyDonorAggFromRecords + COMPANY_OVERLAP_SCAN_CAP — moved to
   ../lib/donor-aggregation.js (exported as COMPANY_DONORS_FROM_RECORDS).
   Same logic, now also consumed by Dashboard's cmd-K palette. */

/* Build donor entries from the pre-aggregated topDonors block. Used for
   non-Company donor types (Individuals, Trade Unions, etc.) that the
   records-aggregated path doesn't walk. Per-party splits are still
   approximated here (the aggregate only carries the list of recipient
   parties, not £ per party) — the records-aggregated Company path is
   the only one with real splits. */
function _buildDonorListFromTopDonors(filterFn) {
  const aggTop = (donationsAggregateData && donationsAggregateData.topDonors) || [];
  const enriched = [];
  for (const d of aggTop) {
    if (!d || !d.name || !d.total) continue;
    if (DONOR_PUBLIC_FUND_TYPES.has(d.type || "")) continue;
    if (filterFn && !filterFn(d)) continue;
    const pmap = new Map();
    for (const pname of (d.parties || [])) {
      const pid = donorPartyId(pname);
      if (!pid) continue;
      pmap.set(pid, { partyId: pid, donationCount: 0, totalGBP: 0 });
    }
    if (pmap.size === 0) continue; // no canonical-party recipients
    const perParty = d.total / pmap.size;
    for (const v of pmap.values()) {
      v.totalGBP = perParty;
      v.donationCount = Math.max(1, Math.round((d.count || 1) / pmap.size));
    }
    enriched.push({
      key: donorSlug(d.name),
      name: d.name,
      totalGBP: d.total,
      donationCount: d.count || 0,
      donorStatus: d.type || "Unknown",
      companyReg: d.companyReg || "",
      firstDate: "",
      lastDate: "",
      parties: Array.from(pmap.values()).sort((a, b) => b.totalGBP - a.totalGBP),
      _normName: _normaliseFirmName(d.name),
    });
  }
  enriched.sort((a, b) => b.totalGBP - a.totalGBP);
  return enriched;
}

/* COMPANY_DONORS_FROM_RECORDS, buildOverlapMatcher, mergeDonorParties,
   pickDominantParty — all moved to ../lib/donor-aggregation.js (single
   source of truth, shared with Dashboard cmd-K). Imported at the top of
   this file. The COMPANY_OVERLAP_SCAN_CAP slice that used to wrap the
   array here is no longer applied — the util emits the full ≈ 501-entry
   set, well under any conceivable cap. */

/* Format helper for donor £ — donations are smaller than contracts, so we
   show £k for sub-£1m amounts to keep precision useful. */
function fmtGBPDonor(v) {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1e6) return `£${(v / 1e6).toFixed(1)}m`;
  if (v >= 1e3) return `£${Math.round(v / 1e3)}k`;
  return `£${Math.round(v)}`;
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
 *  MOBILE EXPLORER — 3-TAB SURFACE (Flows / Departments / Suppliers)
 * =========================================================================
 *  Task #100 — replaces the single "top suppliers list" fallback with a
 *  proper 3-tab explorer so the mobile Money Map has a reason to exist
 *  beyond "look at the top suppliers". A d3-force graph is cognitively
 *  hostile on a 375px viewport; readers get a lot more out of three
 *  ranked lists they can actually tap.
 *
 *  All three tabs hand off to the same drawer system via setSelection —
 *  no separate drawer machinery. Chips inside cards use stopPropagation
 *  so a reader can tap a supplier name inside a department card and
 *  land in the supplier drawer without opening the department drawer
 *  first.
 * ========================================================================= */

function MoneyMapFlowsTab({ flows, onSelectSupplier }) {
  if (!flows || flows.length === 0) {
    return (
      <div className="mm-explorer-empty">
        No money flows meet the £ threshold in current filters.
      </div>
    );
  }
  return (
    <div
      className="mm-explorer-list"
      role="tabpanel"
      id="mm-panel-flows"
      aria-labelledby="mm-tab-flows"
    >
      {flows.map((f) => (
        <button
          type="button"
          key={f.id}
          className="mm-flow-card"
          onClick={() => onSelectSupplier(f.supplierId)}
          aria-label={`${f.buyerLabel} to ${f.supplierLabel} · ${fmtGBP(f.totalGBP)} · open supplier details`}
        >
          <div className="mm-flow-card-main">
            <span className="mm-flow-dept">{f.buyerLabel}</span>
            <span className="mm-flow-arrow" aria-hidden="true">&rarr;</span>
            <span className="mm-flow-supplier">{f.supplierLabel}</span>
          </div>
          <div className="mm-flow-card-meta">
            <span className="mm-flow-amt">{fmtGBPOrUndisclosed(f.totalGBP)}</span>
            {f.projectCount > 0 && (
              <>
                <span className="mm-flow-sep" aria-hidden="true">&middot;</span>
                <span>{f.projectCount} project{f.projectCount === 1 ? "" : "s"}</span>
              </>
            )}
            {f.yearRange && (
              <>
                <span className="mm-flow-sep" aria-hidden="true">&middot;</span>
                <span>{f.yearRange}</span>
              </>
            )}
          </div>
          {f.department && (
            <div className="mm-flow-card-tag">{f.department}</div>
          )}
        </button>
      ))}
    </div>
  );
}

function MoneyMapDepartmentsTab({ departments, onSelectBuyer, onSelectSupplier, connectionsByBuyer }) {
  if (!departments || departments.length === 0) {
    return (
      <div className="mm-explorer-empty">
        No departments match the current filters.
      </div>
    );
  }
  return (
    <div
      className="mm-explorer-list"
      role="tabpanel"
      id="mm-panel-departments"
      aria-labelledby="mm-tab-departments"
    >
      {departments.map((d) => {
        const connCount = (connectionsByBuyer && connectionsByBuyer.get(d.id)) || 0;
        return (
        <div
          key={d.id}
          className="mm-dept-card"
          role="button"
          tabIndex={0}
          onClick={() => onSelectBuyer(d.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectBuyer(d.id);
            }
          }}
          aria-label={`${d.label} · ${fmtGBP(d.totalGBP)} · open department details`}
        >
          <div className="mm-dept-card-top">
            <span className="mm-dept-name">{d.label}</span>
            <span className="mm-dept-amt">{fmtGBPOrUndisclosed(d.totalGBP)}</span>
          </div>
          <div className="mm-dept-card-sub">
            {d.supplierCount} supplier{d.supplierCount === 1 ? "" : "s"}
            {d.projectCount > 0 && ` across ${d.projectCount} project${d.projectCount === 1 ? "" : "s"}`}
          </div>
          {connCount > 0 && (
            <div className="mm-story-badge" aria-label={`${connCount} connection stor${connCount === 1 ? "y" : "ies"}`}>
              <Users size={11} aria-hidden="true" />
              <span>{connCount} stor{connCount === 1 ? "y" : "ies"}</span>
            </div>
          )}
          {d.topSuppliers && d.topSuppliers.length > 0 && (
            <div className="mm-dept-chips">
              {d.topSuppliers.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="mm-inline-chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSupplier(s.id);
                  }}
                  aria-label={`View ${s.label} supplier details`}
                >
                  <span className="mm-chip-name">{s.label}</span>
                  <span className="mm-chip-amt">{fmtGBP(s.gbp)}</span>
                </button>
              ))}
              {d.supplierCount > 3 && (
                <span className="mm-inline-chip mm-inline-chip-more">
                  +{d.supplierCount - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function MoneyMapSuppliersTab({ suppliers, onSelectSupplier, onSelectBuyer, connectionsBySupplier }) {
  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="mm-explorer-empty">
        No suppliers meet the £ threshold in the current data.
      </div>
    );
  }
  return (
    <div
      className="mm-explorer-list"
      role="tabpanel"
      id="mm-panel-suppliers"
      aria-labelledby="mm-tab-suppliers"
    >
      {suppliers.map((s) => {
        const concentration = s.topBuyerShare || 0;
        const isConcentrated = concentration >= 0.7;
        const connCount = (connectionsBySupplier && connectionsBySupplier.get(s.id)) || 0;
        return (
          <div
            key={s.id}
            className="mm-supp-card"
            role="button"
            tabIndex={0}
            onClick={() => onSelectSupplier(s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectSupplier(s.id);
              }
            }}
            aria-label={`${s.label} · ${fmtGBP(s.totalGBP)} · open supplier details`}
          >
            <div className="mm-supp-card-top">
              <span className="mm-supp-name">{s.label}</span>
              <span className="mm-supp-amt">{fmtGBPOrUndisclosed(s.totalGBP)}</span>
            </div>
            <div className="mm-supp-card-sub">
              {s.projectCount > 0 && `${s.projectCount} project${s.projectCount === 1 ? "" : "s"} · `}
              {s.buyerCount} department{s.buyerCount === 1 ? "" : "s"}
            </div>
            {connCount > 0 && (
              <div className="mm-story-badge" aria-label={`${connCount} connection stor${connCount === 1 ? "y" : "ies"}`}>
                <Users size={11} aria-hidden="true" />
                <span>{connCount} stor{connCount === 1 ? "y" : "ies"}</span>
              </div>
            )}
            {s.topBuyers && s.topBuyers.length > 0 && (
              <div className="mm-supp-chips">
                {s.topBuyers.slice(0, 3).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="mm-inline-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBuyer(b.id);
                    }}
                    aria-label={`View ${b.label} department details`}
                  >
                    <span className="mm-chip-name">{b.label}</span>
                    <span className="mm-chip-amt">{fmtGBP(b.gbp)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className={"mm-supp-dep " + (isConcentrated ? "mm-supp-dep-hot" : "mm-supp-dep-cool")}>
              <span className="mm-supp-dep-dot" aria-hidden="true" />
              {isConcentrated && s.topBuyerLabel ? (
                <>
                  {Math.round(concentration * 100)}% dependent on {s.topBuyerLabel}
                </>
              ) : (
                <>Diversified across {s.buyerCount} dept{s.buyerCount === 1 ? "" : "s"}</>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
 *  MOBILE STORIES TAB (task #104)
 * =========================================================================
 *  Person-connection stories were buried inside individual supplier/buyer
 *  drawers (see ConnectedIndividuals). On mobile a reader rarely digs
 *  that deep on the first session — so Stories becomes the DEFAULT front-
 *  and-centre surface: large editorial cards, one per viewport, with the
 *  headline (person), summary, the regulator's own words as a blockquote,
 *  the £ figures, and a tappable pill that deep-links to the counterparty
 *  drawer. Source chips inherit the ConnectedIndividuals colour system so
 *  a reader who jumps between drawer + tab feels continuity.
 *
 *  Deliberate choices:
 *   - Vertical scroll (no carousel) — swipe conflicts are a mess on narrow
 *     viewports. Each card roughly fills the viewport.
 *   - Card chassis is a <button> so the whole surface is tappable; internal
 *     chip/link buttons use stopPropagation to avoid bubbling.
 *   - Regulator quote uses <blockquote> + <cite> for correct semantics.
 *   - Live-proceedings banner renders first in reading order.
 * ========================================================================= */

const CONN_EYEBROW = {
  paid_consultancy_during_office: "PAID CONSULTANCY",
  post_office_appointment: "REVOLVING DOOR",
  dual_role: "DUAL ROLE",
  family_employment: "FAMILY EMPLOYMENT",
  family_ownership: "SPOUSAL INTEREST",
  spousal_shareholding: "SPOUSAL INTEREST",
  donation_then_contract: "DONOR \u2192 CONTRACT",
  vip_lane_referral: "VIP LANE REFERRAL",
  shareholding: "SHAREHOLDING",
  appg_paid_chair: "APPG INTEREST",
  personal_connection_then_contract: "PERSONAL CONTRACT",
  outside_earnings_during_office: "OUTSIDE EARNINGS",
  spousal_political_role: "SPOUSAL POLITICAL ROLE",
  family_trust_arrangement: "FAMILY TRUST",
  cash_for_access: "CASH FOR ACCESS",
  donor_and_contractor: "DONOR-CONTRACTOR",
  other: "CONNECTION",
};

function MoneyMapStoriesTab({ connections, peopleById, onOpen, onOpenPerson }) {
  if (!connections || connections.length === 0) {
    return (
      <div
        className="mm-explorer-empty"
        role="tabpanel"
        id="mm-panel-stories"
        aria-labelledby="mm-tab-stories"
      >
        No connection stories yet.
      </div>
    );
  }
  return (
    <div
      className="mm-story-list"
      role="tabpanel"
      id="mm-panel-stories"
      aria-labelledby="mm-tab-stories"
    >
      {connections.map((c) => {
        const person = peopleById[c.personId];
        const eyebrowLabel = CONN_EYEBROW[c.connectionType] || "CONNECTION";
        const period = c.timeframe?.periodLabel || "";
        const eyebrow = period
          ? `${eyebrowLabel} \u00B7 ${period}`
          : eyebrowLabel;
        const finding = c.regulatoryFindings && c.regulatoryFindings[0];
        const cpId = c.counterparty?.id || null;
        const cpName = c.counterparty?.name || "";
        const hasTarget = !!cpId;
        const partyId = person && person.party && person.party !== "none" ? person.party : null;
        const partyDef = partyId ? PARTY_DEFS[partyId] : null;
        const isFirm = person && person.kind === "firm";
        const handleCardClick = () => {
          if (hasTarget) onOpen(cpId);
        };
        return (
          <article key={c.id} className="mm-story-card-wrap">
            <button
              type="button"
              className={"mm-story-card" + (hasTarget ? "" : " mm-story-card-inert")}
              onClick={handleCardClick}
              aria-label={person ? `Open details for ${person.name}` : "Open story"}
            >
              {c.liveProceedings && (
                <div className="mm-story-live" role="status">
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>LIVE PROCEEDINGS</span>
                </div>
              )}
              <div className="mm-story-body">
                <div className="mm-story-eyebrow-row">
                  <div className="mm-story-eyebrow">{eyebrow}</div>
                  {partyDef && (
                    <span
                      className="mm-story-party-badge"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen("party:" + partyId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpen("party:" + partyId);
                        }
                      }}
                      aria-label={`${partyDef.label} — open party profile`}
                      title={`${partyDef.label} — tap to open party profile`}
                    >
                      <span
                        className="mm-story-party-dot"
                        style={{ background: partyDef.color }}
                        aria-hidden="true"
                      />
                      <span className="mm-story-party-letter">{partyDef.short}</span>
                    </span>
                  )}
                </div>
                {person?.name && (
                  <h3 className="mm-story-name">
                    {person.name}
                    {isFirm && (
                      <span
                        className="mm-story-kind-pill"
                        title="Subject of this story is a firm, not an individual"
                        aria-label="Firm subject"
                      >
                        FIRM
                      </span>
                    )}
                  </h3>
                )}
                {onOpenPerson && person?.id && (
                  <button
                    type="button"
                    className="mm-story-person-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPerson("person:" + person.id);
                    }}
                    aria-label={`Open ${isFirm ? "firm" : "person"} profile for ${person.name}`}
                  >
                    {isFirm ? "View firm profile" : "View person profile"} &rarr;
                  </button>
                )}
                {c.summary && (
                  <p className="mm-story-summary">{c.summary}</p>
                )}
                {finding && (
                  <blockquote className="mm-story-quote">
                    <p className="mm-story-quote-text">
                      &ldquo;{finding.quotedText}&rdquo;
                    </p>
                    <cite className="mm-story-quote-cite">
                      &mdash; {finding.body}
                      {finding.date ? `, ${fmtDate(finding.date)}` : ""}
                    </cite>
                  </blockquote>
                )}
                {(c.financial?.personalIncomeDescription ||
                  c.financial?.relatedContractsDescription) && (
                  <dl className="mm-story-figures">
                    {c.financial?.personalIncomeDescription && (
                      <div className="mm-story-fig-row">
                        <dt>Personal</dt>
                        <dd>{c.financial.personalIncomeDescription}</dd>
                      </div>
                    )}
                    {c.financial?.relatedContractsDescription && (
                      <div className="mm-story-fig-row">
                        <dt>Contracts</dt>
                        <dd>{c.financial.relatedContractsDescription}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {cpName && (
                  <div className="mm-story-cp-row">
                    <span
                      className={"mm-story-cp-pill" + (hasTarget ? "" : " mm-story-cp-pill-inert")}
                      role={hasTarget ? "button" : undefined}
                      tabIndex={hasTarget ? 0 : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasTarget) onOpen(cpId);
                      }}
                      onKeyDown={(e) => {
                        if (!hasTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpen(cpId);
                        }
                      }}
                      aria-label={hasTarget ? `Open ${cpName}` : undefined}
                    >
                      <span className="mm-story-cp-arrow" aria-hidden="true">&rarr;</span>
                      <span className="mm-story-cp-name">{cpName}</span>
                    </span>
                  </div>
                )}
                {c.sources && c.sources.length > 0 && (
                  <div className="mm-story-sources">
                    {c.sources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={
                          "mm-story-src mm-story-src-" +
                          (s.tier === "primary"
                            ? "primary"
                            : s.tier === "news"
                            ? "news"
                            : "analysis")
                        }
                        title={s.publisher + (s.date ? ` \u00B7 ${s.date}` : "")}
                      >
                        {s.publisher}
                        <ExternalLink size={9} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </button>
          </article>
        );
      })}
      <div className="mm-story-footer" aria-hidden="true">
        &mdash;&mdash;&mdash; More stories under active research. &mdash;&mdash;&mdash;
      </div>
    </div>
  );
}

/* =========================================================================
 * MoneyMapStoriesStrip — DESKTOP (md+) horizontal-scrolling story feed
 * Sits above the Money Map canvas on desktop so the editorial hook is the
 * first thing a reader sees. Mobile has its own full-screen Stories tab.
 * Compact card: serif name text-2xl, 360px wide, 260px min-height.
 * Taps open the existing drawer via onOpen(counterpartyId).
 * ========================================================================= */
function MoneyMapStoriesStrip({ connections, peopleById, onOpen, onOpenPerson }) {
  if (!connections || connections.length === 0) return null;
  return (
    <section className="mm-story-strip-wrap" aria-label="Featured connection stories">
      <div className="mm-story-strip-header">
        <span className="mm-story-strip-eyebrow">
          Stories &middot; Who&rsquo;s connected to the money
        </span>
        <span className="mm-story-strip-count">
          {connections.length} live &middot; more under research &rarr;
        </span>
      </div>
      <div className="mm-story-strip-scroll">
        {connections.map((c) => {
          const person = peopleById[c.personId];
          const eyebrowLabel = CONN_EYEBROW[c.connectionType] || "CONNECTION";
          const period = c.timeframe?.periodLabel || "";
          const eyebrow = period
            ? `${eyebrowLabel} \u00B7 ${period}`
            : eyebrowLabel;
          const finding = c.regulatoryFindings && c.regulatoryFindings[0];
          const cpId = c.counterparty?.id || null;
          const cpName = c.counterparty?.name || "";
          const hasTarget = !!cpId;
          const partyId = person && person.party && person.party !== "none" ? person.party : null;
          const partyDef = partyId ? PARTY_DEFS[partyId] : null;
          const isFirm = person && person.kind === "firm";
          const fig = c.financial?.relatedContractsDescription
            || c.financial?.personalIncomeDescription
            || "";
          return (
            <button
              type="button"
              key={c.id}
              className={"mm-story-strip-card" + (hasTarget ? "" : " mm-story-strip-card-inert")}
              onClick={() => { if (hasTarget) onOpen(cpId); }}
              aria-label={person ? `Open details for ${person.name}` : "Open story"}
            >
              {c.liveProceedings && (
                <div className="mm-story-strip-live" role="status">
                  <AlertTriangle size={11} aria-hidden="true" />
                  <span>LIVE PROCEEDINGS</span>
                </div>
              )}
              <div className="mm-story-strip-eyebrow-row">
                <div className="mm-story-strip-eyebrow-card">{eyebrow}</div>
                {partyDef && (
                  <span
                    className="mm-story-party-badge"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen("party:" + partyId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen("party:" + partyId);
                      }
                    }}
                    aria-label={`${partyDef.label} — open party profile`}
                    title={`${partyDef.label} — tap to open party profile`}
                  >
                    <span
                      className="mm-story-party-dot"
                      style={{ background: partyDef.color }}
                      aria-hidden="true"
                    />
                    <span className="mm-story-party-letter">{partyDef.short}</span>
                  </span>
                )}
              </div>
              {person?.name && (
                <h3 className="mm-story-strip-name">
                  {person.name}
                  {isFirm && (
                    <span
                      className="mm-story-kind-pill"
                      title="Subject of this story is a firm, not an individual"
                      aria-label="Firm subject"
                    >
                      FIRM
                    </span>
                  )}
                </h3>
              )}
              {onOpenPerson && person?.id && (
                <button
                  type="button"
                  className="mm-story-person-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPerson("person:" + person.id);
                  }}
                  aria-label={`Open ${isFirm ? "firm" : "person"} profile for ${person.name}`}
                >
                  {isFirm ? "View firm profile" : "View person profile"} &rarr;
                </button>
              )}
              {c.summary && (
                <p className="mm-story-strip-summary">{c.summary}</p>
              )}
              {finding && (
                <blockquote className="mm-story-strip-quote">
                  &ldquo;{finding.quotedText}&rdquo;
                  <cite className="mm-story-strip-quote-cite">
                    &mdash; {finding.body}
                  </cite>
                </blockquote>
              )}
              {fig && (
                <div className="mm-story-strip-figures">{fig}</div>
              )}
              {cpName && (
                <span className="mm-story-strip-cp">
                  <span aria-hidden="true">&rarr;</span>
                  <span>{cpName}</span>
                </span>
              )}
              {c.sources && c.sources.length > 0 && (
                <div className="mm-story-strip-sources">
                  {c.sources.slice(0, 3).map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={
                        "mm-story-src mm-story-src-" +
                        (s.tier === "primary" ? "primary" : s.tier === "news" ? "news" : "analysis")
                      }
                      title={s.publisher + (s.date ? ` \u00B7 ${s.date}` : "")}
                    >
                      {s.publisher}
                      <ExternalLink size={9} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </button>
          );
        })}
        <div className="mm-story-strip-endcap" aria-hidden="true">
          More stories under active research.
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
 *  LayersPanel — task #115 (2026-04-26)
 *
 *  Reusable layer-toggle list. Renders both the floating desktop panel
 *  (top-right of the canvas) and the Layers section embedded inside the
 *  mobile Filters bottom sheet. Layout — header row with title and
 *  conditional "Reset" link, then one row per LAYER_DEFS entry with
 *  checkbox + colour swatch + label + count.
 *
 *  Swatch shape encodes scope: nodes render as a small filled disc, edges
 *  render as a short line (dashed for relational edge kinds). Visual
 *  vocabulary matches the canvas — the reader's eye learns one mapping.
 *
 *  Pure-presentation, no useState — all state lives in the host component.
 * ========================================================================= */
function LayersPanel({
  visibleLayers,
  toggleLayer,
  resetLayers,
  setAllLayers,
  layersAreDefault,
  layersAreAll,
  layerCounts,
  className = "",
  variant = "panel", // "panel" | "section"
}) {
  // Group LAYER_DEFS for divider rendering.
  const groups = useMemo(() => {
    const out = { money: [], people: [], edges: [] };
    for (const def of LAYER_DEFS) out[def.group].push(def);
    return out;
  }, []);
  const renderRow = (def) => {
    const checked = visibleLayers.has(def.id);
    const count = layerCounts?.[def.id] ?? 0;
    return (
      <label key={def.id} className="mm-layers-row">
        <input
          type="checkbox"
          className="mm-layers-checkbox"
          checked={checked}
          onChange={() => toggleLayer(def.id)}
          aria-label={`Toggle ${def.label} layer`}
        />
        <span className="mm-layers-swatch" aria-hidden="true">
          {def.scope === "node" ? (
            <svg width="14" height="10" viewBox="0 0 14 10">
              <circle cx="7" cy="5" r="4" fill={def.swatchColor} />
            </svg>
          ) : (
            <svg width="22" height="6" viewBox="0 0 22 6">
              <line
                x1="0" y1="3" x2="22" y2="3"
                stroke={def.swatchColor}
                strokeWidth="1.6"
                strokeDasharray={def.dashed ? "4 3" : null}
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
        <span className="mm-layers-label">{def.label}</span>
        <span className="mm-layers-count">{count.toLocaleString()}</span>
      </label>
    );
  };
  return (
    <div
      className={
        (variant === "panel" ? "mm-layers-panel " : "mm-layers-section ") +
        className
      }
      role="group"
      aria-label="Canvas layers"
    >
      <div className="mm-layers-head">
        <span className="mm-layers-title">Layers</span>
        {/* 2026-04-26 — task #118. Two-state preset toggle. "Base only"
            collapses to suppliers/buyers/projects + £-flow edges; "Show all"
            re-enables everything. Active state is whichever set the current
            visibleLayers matches; if it's neither, neither pill is highlit
            (custom selection). */}
        <span className="mm-layers-presets" role="group" aria-label="Layer preset">
          <button
            type="button"
            className={"mm-layers-preset" + (layersAreDefault ? " mm-layers-preset-active" : "")}
            onClick={resetLayers}
            title="Show only suppliers, buyers, projects and money-flow edges"
            aria-pressed={layersAreDefault}
          >
            Base only
          </button>
          <button
            type="button"
            className={"mm-layers-preset" + (layersAreAll ? " mm-layers-preset-active" : "")}
            onClick={setAllLayers}
            title="Show every layer — people, parties, donors, lobbyists, edges"
            aria-pressed={layersAreAll}
          >
            Show all
          </button>
        </span>
      </div>
      <div className="mm-layers-body">
        {groups.money.map(renderRow)}
        <div className="mm-layers-divider" aria-hidden="true" />
        {groups.people.map(renderRow)}
        <div className="mm-layers-divider" aria-hidden="true" />
        {groups.edges.map(renderRow)}
      </div>
    </div>
  );
}

function MoneyMapFiltersSheet({
  open, onClose,
  tierFilter, setTierFilter,
  minGBP, setMinGBP,
  query, setQuery,
  viewMode, lensSubjectNode, resetLens,
  // 2026-04-26 — task #115. Layers section appears inside the mobile
  // Filters bottom sheet so the same controls are reachable on mobile.
  visibleLayers, toggleLayer, resetLayers, setAllLayers,
  layersAreDefault, layersAreAll, layerCounts,
}) {
  const sheetRef = useDrawerFocus(onClose);
  if (!open) return null;
  return (
    <>
      <div
        className="mm-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Money Map filters"
        className="mm-sheet"
      >
        <div className="mm-sheet-handle" aria-hidden="true" />
        <div className="mm-sheet-head">
          <span className="mm-sheet-title">Filters</span>
          <button
            type="button"
            className="mm-sheet-close"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="mm-sheet-body">
          <div className="mm-sheet-group">
            <label className="mm-sheet-label" htmlFor="mm-sheet-search">Search</label>
            <div className="mm-sheet-search-wrap">
              <input
                id="mm-sheet-search"
                className="mm-sheet-search"
                type="text"
                placeholder={
                  viewMode === "lens"
                    ? "Narrow the ego network…"
                    : "Supplier, department or project…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="mm-sheet-search-clear"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          <div className="mm-sheet-group">
            <div className="mm-sheet-label">Evidence tier</div>
            <div className="mm-sheet-row">
              <button
                type="button"
                className={"mm-sheet-chip" + (tierFilter === "AB" ? " mm-sheet-chip-active" : "")}
                onClick={() => setTierFilter("AB")}
              >
                A + B
              </button>
              <button
                type="button"
                className={"mm-sheet-chip" + (tierFilter === "ABCD" ? " mm-sheet-chip-active" : "")}
                onClick={() => setTierFilter("ABCD")}
              >
                Include softer (C/D)
              </button>
            </div>
          </div>

          <div className="mm-sheet-group">
            <div className="mm-sheet-label">Min £ threshold</div>
            <div className="mm-sheet-row">
              {MIN_GBP_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  className={"mm-sheet-chip" + (minGBP === step ? " mm-sheet-chip-active" : "")}
                  onClick={() => setMinGBP(step)}
                >
                  {fmtGBP(step)}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "lens" && lensSubjectNode && (
            <div className="mm-sheet-group">
              <div className="mm-sheet-label">Lens subject</div>
              <div className="mm-sheet-lens">
                <span className="mm-sheet-lens-name">{lensSubjectNode.label}</span>
                <button
                  type="button"
                  className="mm-sheet-chip"
                  onClick={resetLens}
                >
                  Clear lens
                </button>
              </div>
            </div>
          )}

          {/* 2026-04-26 — task #115. Layers section, mirrors the desktop
              floating panel. Same checkbox + swatch + count pattern. */}
          {visibleLayers && (
            <div className="mm-sheet-group">
              <LayersPanel
                visibleLayers={visibleLayers}
                toggleLayer={toggleLayer}
                resetLayers={resetLayers}
                setAllLayers={setAllLayers}
                layersAreDefault={layersAreDefault}
                layersAreAll={layersAreAll}
                layerCounts={layerCounts}
                variant="section"
              />
            </div>
          )}
        </div>

        <div className="mm-sheet-foot">
          <button
            type="button"
            className="mm-sheet-apply"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </aside>
    </>
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
  /* 2026-04-26 — Layers control (task #115). Single source of truth for
     which node and edge kinds are rendered on the canvas. Replaces the
     standalone showDonors / showLobbyists toggles shipped in v2 Phase
     3 + Phase 4 — those become two of the layer rows in the new panel.
     Default = everything on; readers dial down via the Layers panel
     (desktop top-right) or the Layers section in the mobile Filters
     sheet. Hiding a node kind also hides any edge incident to it (see
     visibleEdges memo) so the canvas never carries orphan stubs. */
  const [visibleLayers, setVisibleLayers] = useState(
    () => new Set(DEFAULT_VISIBLE_LAYERS)
  );
  // Keep the old showDonors / showLobbyists naming where the existing
  // edge-augmentation logic reads them; derive both from the layer set
  // so the upstream code path doesn't need to learn about layers.
  const showDonors    = visibleLayers.has("donor");
  const showLobbyists = visibleLayers.has("lobbyist");
  const layersAreDefault = useMemo(
    () => visibleLayers.size === DEFAULT_VISIBLE_LAYERS.length &&
          DEFAULT_VISIBLE_LAYERS.every((id) => visibleLayers.has(id)),
    [visibleLayers]
  );
  const layersAreAll = useMemo(
    () => visibleLayers.size === ALL_LAYERS.length &&
          ALL_LAYERS.every((id) => visibleLayers.has(id)),
    [visibleLayers]
  );
  const toggleLayer = useCallback((id) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const resetLayers = useCallback(
    () => setVisibleLayers(new Set(DEFAULT_VISIBLE_LAYERS)),
    []
  );
  /* 2026-04-26 — "Show all" preset wired into the new toggle. */
  const setAllLayers = useCallback(
    () => setVisibleLayers(new Set(ALL_LAYERS)),
    []
  );
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

  /* ---------- mobile explorer state (task #100) ----------
     On mobile the "list" layoutMode now renders a 3-tab explorer
     (Flows / Departments / Suppliers) instead of the single
     top-suppliers list we had before. Default tab is Flows — it
     answers the question readers actually ask first ("what's the
     biggest money movement right now?"). Filter sheet is a bottom
     sheet so the tab bar stays uncluttered. */
  const [mobileTab, setMobileTab] = useState("stories");
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  /* ---------- v2 Phase 1: augment graph with people + their edges ----------
     We do NOT mutate money-map.json. Instead, derive extra nodes (one per
     person, plus synthetic adjacent_firm nodes for off-graph counterparties)
     and extra edges (person → counterparty + person → buyer-they-served-at)
     in-memory. The augmented set is merged into nodesById and the edge
     pipeline downstream so people materialise in lens, network, search,
     and the drawer.

     Edges produced here carry:
       - kind: "personConnection" | "served_at"
       - relational: true  (so the £-threshold filter knows to bypass them)
       - tier: "B"         (so the A+B evidence filter keeps them)
       - totalGBP: 0       (they're relationships, not money flows)
   */
  const peopleAugment = useMemo(() => {
    const people = (individualConnectionsData?.people || []);
    const conns  = (individualConnectionsData?.connections || []);
    const trackedNodeIds = new Set((data.nodes || []).map((n) => n.id));

    const extraNodes = [];
    const extraAwards = [];        // injected into edges.awards stream
    const personEdges = [];        // separate stream — fully relational
    const adjacentSeen = new Set();

    /* Find a person's "current/most-recent" department from rolesHeld[].
       Prefer end:null (currently held) over the latest end-date. */
    function currentDept(person) {
      const roles = person.rolesHeld || [];
      if (roles.length === 0) return null;
      const live = roles.find((r) => r && r.end == null);
      if (live && live.department) return live.department;
      // fall back to the role with the latest end date
      const sorted = roles.slice().sort((a, b) => {
        const ae = a.end || a.start || "";
        const be = b.end || b.start || "";
        return be.localeCompare(ae);
      });
      return sorted[0]?.department || null;
    }

    // 1) person nodes
    //    personKind preserves the underlying person record's kind ("person" |
    //    "firm") so the PersonDetail drawer + Stories cards can render the
    //    firm-subject treatment (FIRM pill badge, no rolesHeld table) while
    //    the canvas dispatcher continues to route on the canvas-level
    //    node.kind === "person".
    for (const p of people) {
      extraNodes.push({
        id: "person:" + p.id,
        kind: "person",
        personKind: p.kind || "person",
        label: p.name,
        value: 1,
        sources: [],
        department: currentDept(p),
        headline: p.headline,
        externalLinks: p.externalLinks || [],
        rolesHeld: p.rolesHeld || [],
        party: p.party || null,
      });
    }

    /* 1b) v2 Phase 2 — synthesise a party node for each unique non-"none"
        party value across the seeded people, plus a relational edge from
        each person to their party. Donor → party connections (e.g. Meller,
        Liddell) are deferred to Phase 3 — they'll come from the Electoral
        Commission record, not from a person being a party member.
        Independent and "none" are skipped (Independent has no edge target
        worth synthesising; "none" means civil servant / military / private). */
    const partiesUsed = new Set();
    for (const p of people) {
      if (!p.party) continue;
      if (p.party === "none") continue;
      if (!PARTY_DEFS[p.party]) continue;
      partiesUsed.add(p.party);
    }
    for (const partyId of partiesUsed) {
      const def = PARTY_DEFS[partyId];
      extraNodes.push({
        id: "party:" + partyId,
        kind: "party",
        label: def.label,
        color: def.color,
        partyShort: def.short,
        description: def.description,
        value: 1,
        sources: [],
        department: null,
      });
    }
    for (const p of people) {
      if (!p.party) continue;
      if (p.party === "none") continue;
      if (!PARTY_DEFS[p.party]) continue;
      personEdges.push({
        id: `edge-person-party-${p.id}-${p.party}`,
        kind: "person_party",
        s: "person:" + p.id,
        t: "party:" + p.party,
        totalGBP: 0,
        relational: true,
        tier: "B",
        scope: `Party affiliation: ${PARTY_DEFS[p.party].label}`,
        sources: [],
      });
    }

    // 2) connection edges (person → counterparty)
    for (const c of conns) {
      const personNodeId = "person:" + c.personId;
      const cp = c.counterparty || {};
      const baseEdge = {
        s: personNodeId,
        totalGBP: 0,
        relational: true,
        tier: "B",
        connectionId: c.id,
        sources: c.sources || [],
        scope: c.summary || "",
      };

      if ((cp.kind === "supplier" || cp.kind === "buyer") && cp.id && trackedNodeIds.has(cp.id)) {
        personEdges.push({
          ...baseEdge,
          id: `personEdge:${c.id}:cp`,
          kind: "personConnection",
          t: cp.id,
        });
      } else if (cp.kind === "adjacent_firm" || (cp.kind && cp.id && !trackedNodeIds.has(cp.id))) {
        // synth node for adjacent firms (and any counterparty whose id
        // isn't in money-map.json — defensive)
        const slug = adjacentSlug(cp.name || cp.id || "unknown");
        if (!adjacentSeen.has(slug)) {
          adjacentSeen.add(slug);
          extraNodes.push({
            id: slug,
            kind: "adjacent_firm",
            label: cp.name || "Adjacent firm",
            value: 0.5,
            sources: [],
            department: null,
            note: cp.note || null,
            dimmed: true,
          });
        }
        personEdges.push({
          ...baseEdge,
          id: `personEdge:${c.id}:cp`,
          kind: "personConnection",
          t: slug,
        });
      }

      // 3) "served at" edges per dept the person held a role in
      const seenForPerson = new Set();
      const person = people.find((pp) => pp.id === c.personId);
      if (person) {
        for (const role of (person.rolesHeld || [])) {
          const buyerId = deptToBuyerId(role.department);
          if (!buyerId) continue;
          if (!trackedNodeIds.has(buyerId)) continue;
          const key = personNodeId + "→" + buyerId;
          if (seenForPerson.has(key)) continue;
          seenForPerson.add(key);
          personEdges.push({
            id: `personEdge:${person.id}:served:${buyerId}`,
            kind: "served_at",
            s: personNodeId,
            t: buyerId,
            totalGBP: 0,
            relational: true,
            tier: "B",
            scope: role.title ? `Role: ${role.title}` : "Served at department",
            sources: [],
          });
        }
      }
    }

    // 3b) De-dupe served_at across multiple connection records for the
    //     same person — easier to do as a final pass than guard upfront.
    const seenIds = new Set();
    const dedupPersonEdges = [];
    for (const e of personEdges) {
      if (seenIds.has(e.id)) continue;
      seenIds.add(e.id);
      dedupPersonEdges.push(e);
    }

    return {
      nodes: extraNodes,
      edges: dedupPersonEdges,
      personIds: new Set(extraNodes.filter((n) => n.kind === "person").map((n) => n.id)),
      adjacentIds: new Set(extraNodes.filter((n) => n.kind === "adjacent_firm").map((n) => n.id)),
      partyIds: new Set(extraNodes.filter((n) => n.kind === "party").map((n) => n.id)),
    };
  }, [data.nodes]);

  /* ---------- v2 Phase 3: donor layer (records-aggregated, 2026-04-26) ----------
     This used to walk only the top-100 pre-aggregated donors (TOP_DONORS,
     since removed) which surfaced ZERO supplier overlaps because the top
     of the EC list is dominated by trade unions and HNW individuals, not
     government contractors. We now process the full 6,819-record set:

       Pass 1 — overlap detection (Company donors only)
         Walk the records-aggregated company set (≈ 501 unique donors,
         module-scoped as COMPANY_DONORS_FROM_RECORDS) through the
         matcher. Each match tags the existing supplier node with
         `isDonor`, `donorTotalGBP`, `donorParties` (REAL per-party £
         splits from records), `donorFirstDate`, `donorLastDate`, and
         `dominantPartyId`. Multiple donor-name spellings collapse onto
         one supplier (e.g. 3 William Cook entries → supplier-cook-defence-systems).

       Pass 2 — standalone donor bubbles
         Mint donor nodes for the top company donors that did NOT overlap
         any tracked supplier, plus the top trade-union and individual
         donors from the pre-aggregated topDonors block (the records
         aggregation only walks Company / LLP rows). Cap at DONOR_TOP_N
         so the canvas stays legible.

       Pass 3 — donor → party edges (gated ≥ £100k per pair)
         Both overlap-supplier nodes AND standalone donor nodes emit
         donor→party edges with the source endpoint set to whichever
         node carries the donation (supplier id for overlap, donor id
         otherwise).

     We do NOT mutate money-map.json — the supplier augmentation lives
     on a parallel map (`supplierDonorOverlay`) merged into nodesById
     downstream. */
  const donorAugment = useMemo(() => {
    const matcher = buildOverlapMatcher(data.nodes || []);
    const extraNodes = [];
    const donorEdges = [];
    const supplierDonorOverlay = new Map(); // supplierId -> overlay obj
    const allDonors = [];                   // for filter / drawer use
    const overlapSupplierIds = new Set();   // suppliers already covered by an overlap-merged donor

    // Helper — emit donor→party edges for a single donor entry.
    function emitDonorEdges(d, sourceId, isOverlap) {
      for (const pp of d.parties) {
        if (!pp || !pp.partyId) continue;
        if ((pp.totalGBP || 0) < 100_000) continue;
        const partyId = "party:" + pp.partyId;
        donorEdges.push({
          id: `edge-donor-party-${isOverlap ? "sup-" + sourceId : d.key}-${pp.partyId}`,
          kind: "donor_party",
          s: sourceId,
          t: partyId,
          totalGBP: pp.totalGBP,
          donationCount: pp.donationCount,
          relational: false, // it IS a money flow — Phase 3 thesis
          tier: "B",
          scope: `Political donation: ${PARTY_DEFS[pp.partyId]?.label || pp.partyId}`,
          sources: [],
          value: pp.totalGBP,
          partyId: pp.partyId,
          fromOverlapSupplier: !!isOverlap,
        });
      }
    }

    /* ---- Pass 1: Company-donor → supplier overlap detection
       Walk EVERY records-aggregated company donor through the matcher.
       Donor-edge emission is gated by sourceId per supplier: we collect
       all overlap entries onto the supplier overlay and emit one
       deduped set of edges per supplier at the end of Pass 1, so that
       multiple donor spellings (e.g. "William Cook Holdings Limited"
       + "William Cook Ltd" + "William Cook Holdings Ltd" → all map to
       supplier-cook-defence-systems) collapse onto a single supplier
       node and a single set of party edges with summed £. */
    for (const d of COMPANY_DONORS_FROM_RECORDS) {
      const overlap = matcher(d);
      if (!overlap) continue;
      overlapSupplierIds.add(overlap.supplierId);
      const donorEntry = {
        ...d,
        supplierOverlap: { ...overlap, matched: true },
      };
      allDonors.push(donorEntry);
      const prev = supplierDonorOverlay.get(overlap.supplierId) || {
        isDonor: true,
        donorTotalGBP: 0,
        donorParties: [],
        donationCount: 0,
        donorEntries: [],
        donorFirstDate: "",
        donorLastDate: "",
      };
      prev.isDonor = true;
      prev.donorTotalGBP += d.totalGBP;
      prev.donationCount += d.donationCount;
      prev.donorParties = mergeDonorParties(prev.donorParties, d.parties);
      prev.dominantPartyId = pickDominantParty(prev.donorParties);
      prev.donorEntries.push(donorEntry);
      if (d.firstDate && (!prev.donorFirstDate || d.firstDate < prev.donorFirstDate)) prev.donorFirstDate = d.firstDate;
      if (d.lastDate  && (!prev.donorLastDate  || d.lastDate  > prev.donorLastDate))  prev.donorLastDate  = d.lastDate;
      supplierDonorOverlay.set(overlap.supplierId, prev);
    }

    // Emit edges for each overlap-supplier from the merged overlay.
    for (const [supplierId, overlay] of supplierDonorOverlay.entries()) {
      emitDonorEdges(
        { key: supplierId, parties: overlay.donorParties },
        supplierId,
        true
      );
    }

    /* ---- Pass 2a: standalone Company donor bubbles (records-sourced)
       Top company donors by £ that did NOT overlap any tracked supplier.
       These mint fresh donor nodes — they're the canvas's "political
       money entering the system that doesn't connect to a tracked
       contractor" layer. */
    const COMPANY_BUBBLE_CAP = 12;
    let companyBubbles = 0;
    for (const d of COMPANY_DONORS_FROM_RECORDS) {
      if (companyBubbles >= COMPANY_BUBBLE_CAP) break;
      if (overlapSupplierIds.has(matcher(d)?.supplierId)) continue; // already collapsed onto a supplier
      if (matcher(d)) continue; // belt + braces — overlap entries should be skipped
      if (!d.parties || d.parties.length === 0) continue;
      const donorEntry = {
        ...d,
        supplierOverlap: { matched: false },
      };
      allDonors.push(donorEntry);
      const sourceId = "donor:" + d.key;
      const dominantParty = d.parties[0] ? d.parties[0].partyId : null;
      const r = Math.max(4, Math.min(14, Math.sqrt(d.totalGBP / 1e6) * 2));
      extraNodes.push({
        id: sourceId,
        kind: "donor",
        label: d.name,
        value: d.totalGBP,
        donorStatus: d.donorStatus,
        companyReg: d.companyReg,
        totalGBP: d.totalGBP,
        donationCount: d.donationCount,
        parties: d.parties,
        dominantPartyId: dominantParty,
        firstDate: d.firstDate,
        lastDate: d.lastDate,
        fixedRadius: r,
        sources: [],
      });
      emitDonorEdges(d, sourceId, false);
      companyBubbles++;
    }

    /* ---- Pass 2b: standalone non-Company donor bubbles (topDonors-sourced)
       Trade unions, individuals, etc. Pulled from the pre-aggregated
       block since the records-aggregated path only walks Company / LLP
       rows. Per-party splits are still approximated here (the aggregate
       only carries the recipient-party LIST, not £ per party). */
    const NON_COMPANY_TYPES = [
      { type: "Trade Union",                   cap: 6 },
      { type: "Individual",                    cap: 6 },
      { type: "Unincorporated Association",    cap: 1 },
    ];
    for (const slot of NON_COMPANY_TYPES) {
      const matching = _buildDonorListFromTopDonors((d) => (d.type || "") === slot.type);
      let added = 0;
      for (const d of matching) {
        if (added >= slot.cap) break;
        if (extraNodes.length + supplierDonorOverlay.size >= DONOR_TOP_N + 5) break;
        const donorEntry = {
          ...d,
          supplierOverlap: { matched: false },
        };
        allDonors.push(donorEntry);
        const sourceId = "donor:" + d.key;
        const dominantParty = d.parties[0] ? d.parties[0].partyId : null;
        const r = Math.max(4, Math.min(14, Math.sqrt(d.totalGBP / 1e6) * 2));
        extraNodes.push({
          id: sourceId,
          kind: "donor",
          label: d.name,
          value: d.totalGBP,
          donorStatus: d.donorStatus,
          companyReg: d.companyReg,
          totalGBP: d.totalGBP,
          donationCount: d.donationCount,
          parties: d.parties,
          dominantPartyId: dominantParty,
          fixedRadius: r,
          sources: [],
        });
        emitDonorEdges(d, sourceId, false);
        added++;
      }
    }

    return {
      nodes: extraNodes,
      edges: donorEdges,
      supplierOverlay: supplierDonorOverlay,
      donorIds: new Set(extraNodes.map((n) => n.id)),
      donors: allDonors,
    };
  }, [data.nodes]);

  /* ---------- v2 Phase 4: lobbyist layer (ORCL register, 2026-04-26) ----------
     Walk the 251-firm ORCL register, match each firm's declared client
     roster against the tracked-supplier index, and mint a node + edges
     for every lobbyist whose client list contains ≥1 tracked supplier.

     Sizing decisions:
       - Skip firms with <5 declared clients. Below that threshold the
         match signal is too noisy — every cluster of micro-agencies
         would muscle onto the canvas without real editorial weight.
       - Cap at 25 lobbyist nodes total, sorted by # of matched suppliers
         descending. The canvas has a budget for new layers; 25 is
         enough to make the access pattern visible without crowding the
         supplier cluster.

     The matcher (lib/lobbyist-aggregation.js) is much stricter than the
     donor matcher — see the file header for why. Confidence tier is
     surfaced on each edge so the canvas can dim "fuzzy" ties. */
  const lobbyistAugment = useMemo(() => {
    const lobbyists = (lobbyistRecordsData?.lobbyists || []);
    const supplierIndex = buildSupplierIndex(data.nodes || []);
    const enriched = [];
    for (const l of lobbyists) {
      if ((l.cl || 0) < 5) continue;
      const matches = [];
      for (const client of (l.cls || [])) {
        const m = matchClientToSupplier(client, supplierIndex);
        if (m) matches.push({ client, ...m });
      }
      if (matches.length === 0) continue;
      enriched.push({
        firm: l,
        slug: lobbyistSlug(l.n),
        matches,
      });
    }
    enriched.sort((a, b) => b.matches.length - a.matches.length);
    const TOP_N = 25;
    const top = enriched.slice(0, TOP_N);

    const extraNodes = [];
    const lobbyistEdges = [];
    for (const e of top) {
      const id = "lobbyist:" + e.slug;
      const matchedSupplierIds = new Set();
      for (const m of e.matches) matchedSupplierIds.add(m.id);
      extraNodes.push({
        id,
        kind: "lobbyist",
        label: e.firm.n,
        value: 1,
        lobbyistType: e.firm.t,
        registrationDate: e.firm.d,
        totalClients: e.firm.cl || (e.firm.cls || []).length,
        allClients: e.firm.cls || [],
        matchedClients: e.matches,
        matchedSupplierCount: matchedSupplierIds.size,
        sources: [],
      });
      // Dedupe by supplier id — multiple matched-client rows can point
      // at the same tracked supplier (e.g. "BT" + "BT plc"). One edge
      // per (lobbyist, supplier) pair keeps the canvas legible.
      const seenEdgeKey = new Set();
      for (const m of e.matches) {
        const edgeKey = id + "→" + m.id;
        if (seenEdgeKey.has(edgeKey)) continue;
        seenEdgeKey.add(edgeKey);
        lobbyistEdges.push({
          id: `edge-lobby-${e.slug}-${m.id}`,
          kind: "lobbyist_client",
          s: id,
          t: m.id,
          totalGBP: 0,
          relational: true, // bypass £-threshold filter (same as person edges)
          tier: "B",
          confidence: m.confidence,
          method: m.method,
          client: m.client,
          scope: `Declared client: ${m.client}`,
          sources: [],
        });
      }
    }

    return {
      nodes: extraNodes,
      edges: lobbyistEdges,
      lobbyistIds: new Set(extraNodes.map((n) => n.id)),
    };
  }, [data.nodes]);

  const nodesById = useMemo(() => {
    const m = new Map();
    for (const n of data.nodes) {
      // If this supplier got tagged as a donor, copy the existing node
      // and stitch the donor overlay onto the copy (don't mutate the
      // imported data!).
      const overlay = donorAugment.supplierOverlay.get(n.id);
      if (overlay) {
        m.set(n.id, { ...n, ...overlay });
      } else {
        m.set(n.id, n);
      }
    }
    for (const n of peopleAugment.nodes) m.set(n.id, n);
    for (const n of donorAugment.nodes) m.set(n.id, n);
    for (const n of lobbyistAugment.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes, peopleAugment.nodes, donorAugment.nodes, donorAugment.supplierOverlay, lobbyistAugment.nodes]);

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
    const gbpBySBuyer = new Map(); // supplierId -> Map(buyerId -> gbp)
    const awards = (data.edges && data.edges.awards) ? data.edges.awards : [];
    for (const e of awards) {
      if (!e || e.kind !== "award") continue;
      const s = e.s, t = e.t;
      if (typeof s !== "string" || typeof t !== "string") continue;
      if (!s.startsWith("buyer-") || !t.startsWith("supplier-")) continue;
      if (!projByS.has(t)) projByS.set(t, new Set());
      if (!buyersByS.has(t)) buyersByS.set(t, new Set());
      if (!deptsByS.has(t)) deptsByS.set(t, new Set());
      if (!gbpBySBuyer.has(t)) gbpBySBuyer.set(t, new Map());
      for (const pid of (e.projectIds || [])) projByS.get(t).add(pid);
      buyersByS.get(t).add(s);
      const buyer = nodesById.get(s);
      if (buyer && buyer.department) deptsByS.get(t).add(buyer.department);
      const gbpMap = gbpBySBuyer.get(t);
      gbpMap.set(s, (gbpMap.get(s) || 0) + (e.totalGBP || 0));
    }
    const out = [];
    for (const n of (data.nodes || [])) {
      if (n.kind !== "supplier") continue;
      if (!(n.value > 0)) continue;
      // Top-3 buyers by £, for inline chips + concentration
      const gbpMap = gbpBySBuyer.get(n.id) || new Map();
      const sortedBuyers = Array.from(gbpMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([bid, gbp]) => {
          const bNode = nodesById.get(bid);
          return { id: bid, label: bNode ? bNode.label : bid, gbp };
        });
      const totalBuyerGBP = sortedBuyers.reduce((acc, b) => acc + (b.gbp || 0), 0);
      const topBuyerShare = totalBuyerGBP > 0 && sortedBuyers.length > 0
        ? (sortedBuyers[0].gbp / totalBuyerGBP)
        : 0;
      out.push({
        id: n.id,
        label: n.label,
        totalGBP: n.value,
        projectCount: (projByS.get(n.id) || new Set()).size,
        deptCount: (deptsByS.get(n.id) || new Set()).size,
        buyerCount: (buyersByS.get(n.id) || new Set()).size || n.buyerCount || 0,
        topBuyer: n.topBuyer?.label || (sortedBuyers[0]?.label || null),
        topBuyerLabel: sortedBuyers[0]?.label || null,
        topBuyerShare,
        topBuyers: sortedBuyers.slice(0, 3),
      });
    }
    out.sort((a, b) => b.totalGBP - a.totalGBP);
    return out.slice(0, 20);
  }, [data.edges, data.nodes, nodesById]);

  /* ---------- top departments derivation (task #100) ----------
     Aggregates award edges by source (buyer). Each dept row tracks
     total £, distinct supplier count, distinct project count, and
     the top 3 suppliers by £ for inline chips. */
  const topDepartments = useMemo(() => {
    const byBuyer = new Map(); // buyerId -> { gbp, suppliers:Map(tId->gbp), projects:Set }
    const awards = (data.edges && data.edges.awards) ? data.edges.awards : [];
    for (const e of awards) {
      if (!e || e.kind !== "award") continue;
      if (typeof e.s !== "string" || typeof e.t !== "string") continue;
      if (!e.s.startsWith("buyer-") || !e.t.startsWith("supplier-")) continue;
      if (!byBuyer.has(e.s)) {
        byBuyer.set(e.s, { gbp: 0, suppliers: new Map(), projects: new Set() });
      }
      const bucket = byBuyer.get(e.s);
      bucket.gbp += (e.totalGBP || 0);
      bucket.suppliers.set(e.t, (bucket.suppliers.get(e.t) || 0) + (e.totalGBP || 0));
      for (const pid of (e.projectIds || [])) bucket.projects.add(pid);
    }
    const out = [];
    for (const [buyerId, bucket] of byBuyer.entries()) {
      const n = nodesById.get(buyerId);
      if (!n) continue;
      const topSuppliersList = Array.from(bucket.suppliers.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([sid, gbp]) => {
          const sNode = nodesById.get(sid);
          return { id: sid, label: sNode ? sNode.label : sid, gbp };
        });
      out.push({
        id: buyerId,
        label: n.label,
        department: n.department || null,
        totalGBP: bucket.gbp || n.value || 0,
        supplierCount: bucket.suppliers.size,
        projectCount: bucket.projects.size,
        topSuppliers: topSuppliersList,
      });
    }
    out.sort((a, b) => (b.totalGBP || 0) - (a.totalGBP || 0));
    return out.slice(0, 20);
  }, [data.edges, nodesById]);

  /* ---------- top flows derivation (task #100) ----------
     Each entry is one (buyer → supplier) edge with rollup metadata:
     £ total, project count, year range extracted from source dates.
     The precompute already emits one award edge per (buyer, supplier)
     pair so we can use rows directly. If the data ever gets split
     per-contract we'd need to re-group here. */
  const topFlows = useMemo(() => {
    const awards = (data.edges && data.edges.awards) ? data.edges.awards : [];
    const out = [];
    for (const e of awards) {
      if (!e || e.kind !== "award") continue;
      const buyer = nodesById.get(e.s);
      const supplier = nodesById.get(e.t);
      if (!buyer || !supplier) continue;
      if (!(e.totalGBP > 0)) continue;
      // Year range from source dates (if any)
      const years = [];
      for (const src of (e.sources || [])) {
        if (src && src.date) {
          const y = parseInt(String(src.date).slice(0, 4), 10);
          if (!isNaN(y)) years.push(y);
        }
      }
      let yearRange = null;
      if (years.length > 0) {
        const lo = Math.min(...years);
        const hi = Math.max(...years);
        yearRange = lo === hi ? String(lo) : `${lo}–${hi}`;
      }
      out.push({
        id: e.id,
        buyerId: e.s,
        supplierId: e.t,
        buyerLabel: buyer.label,
        supplierLabel: supplier.label,
        department: buyer.department || null,
        totalGBP: e.totalGBP || 0,
        projectCount: (e.projectIds || []).length,
        yearRange,
      });
    }
    out.sort((a, b) => b.totalGBP - a.totalGBP);
    return out.slice(0, 30);
  }, [data.edges, nodesById]);

  /* ---------- active-filter badge count (task #100) ----------
     Tier A+B and Min £ 1m are defaults — any deviation counts as
     an active filter. Search string and non-default lens subject
     each contribute one too. Purely cosmetic: drives the "(N)"
     badge on the mobile Filters button.
     2026-04-26 (task #115): if the Layers state diverges from the
     defaults, count one extra (we don't itemise per-layer — single
     bump is enough signal that "the canvas is dialled down"). */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (tierFilter !== "AB") n += 1;
    if (minGBP !== 1_000_000) n += 1;
    if (query && query.trim().length > 0) n += 1;
    if (viewMode === "lens") {
      const defaultLens = (data.featuredIds && data.featuredIds[0]) || null;
      if (lensSubjectId && lensSubjectId !== defaultLens) n += 1;
    }
    if (!layersAreDefault) n += 1;
    return n;
  }, [tierFilter, minGBP, query, viewMode, lensSubjectId, data.featuredIds, layersAreDefault]);

  /* ---------- per-layer counts (task #115) ----------
     Right-aligned counts shown next to each layer row in the Layers
     panel. We count from the augmented full graph (data.nodes plus
     people / donor / lobbyist augments) rather than the currently
     visible subset — the count tells the reader "this layer carries
     N entities" not "N are on screen right now", which would loop
     confusingly when they toggle the layer off. Edges are counted
     against augmentation source arrays for the same reason. */
  const layerCounts = useMemo(() => {
    const c = {};
    for (const def of LAYER_DEFS) c[def.id] = 0;
    // Node kinds — base graph + augments. nodesById already merges all.
    for (const n of nodesById.values()) {
      if (c[n.kind] != null) c[n.kind] += 1;
    }
    // Edge kinds.
    for (const e of (data.edges?.awards || [])) {
      if (e && e.kind === "award") c.award += 1;
    }
    for (const e of (peopleAugment.edges || [])) {
      if (!e) continue;
      if (e.kind === "person_party")     c.person_party += 1;
      else if (e.kind === "served_at")   c.served_at += 1;
    }
    for (const e of (donorAugment.edges || [])) {
      if (e && e.kind === "donor_party") c.donor_party += 1;
    }
    for (const e of (lobbyistAugment.edges || [])) {
      if (e && e.kind === "lobbyist_client") c.lobbyist_client += 1;
    }
    return c;
  }, [nodesById, data.edges, peopleAugment.edges, donorAugment.edges, lobbyistAugment.edges]);

  /* ---------- individual-connection lookups (task #104) ----------
     Bundle the full connection list and its person index once, and
     derive two {counterpartyId -> count} maps so the Suppliers and
     Departments mobile tabs can show a "N stories" discovery badge
     without re-filtering the JSON per row. Adjacent-firm connections
     (no id) are not counted in either map — they only surface in the
     Stories tab itself. */
  const storyConnections = useMemo(() => {
    return (individualConnectionsData?.connections || []).slice();
  }, []);
  const storyPeopleById = useMemo(() => {
    const m = {};
    for (const p of (individualConnectionsData?.people || [])) m[p.id] = p;
    return m;
  }, []);
  const connectionsBySupplier = useMemo(() => {
    const m = new Map();
    for (const c of storyConnections) {
      if (c.counterparty?.kind === "supplier" && c.counterparty?.id) {
        m.set(c.counterparty.id, (m.get(c.counterparty.id) || 0) + 1);
      }
    }
    return m;
  }, [storyConnections]);
  const connectionsByBuyer = useMemo(() => {
    const m = new Map();
    for (const c of storyConnections) {
      if (c.counterparty?.kind === "buyer" && c.counterparty?.id) {
        m.set(c.counterparty.id, (m.get(c.counterparty.id) || 0) + 1);
      }
    }
    return m;
  }, [storyConnections]);

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

    /* Person edges are relational, not money flows — they always pass the
       Min £ chip filter (which is meaningful only for awards). They still
       respect the Tier A+B filter via tier:"B" being in `allowed`. */
    const allPersonEdges = (peopleAugment.edges || []).filter((e) => {
      if (!allowed.has(e.tier)) return false;
      return nodesById.has(e.s) && nodesById.has(e.t);
    });

    /* v2 Phase 3 — donor→party edges. They ARE money flows, but the
       Min-£ chip is calibrated for contracts (£1m default); donations are
       smaller. So we apply the chip's intent (only show edges meeting the
       reader's minimum interest threshold) but with a softer floor — the
       higher of (£100k, minGBP / 10). When donors are toggled off via the
       filter chip, we short-circuit to an empty set. */
    const allDonorEdges = !showDonors ? [] : (donorAugment.edges || []).filter((e) => {
      if (!allowed.has(e.tier)) return false;
      const floor = Math.max(100_000, minGBP / 10);
      if ((e.totalGBP || 0) < floor) return false;
      return nodesById.has(e.s) && nodesById.has(e.t);
    });

    /* v2 Phase 4 — lobbyist→supplier edges. Relational (NOT a money
       flow), so they ignore the £-threshold chip — same exemption that
       person edges and other connection edges already enjoy. They still
       respect the Tier A+B filter via tier:"B". */
    const allLobbyistEdges = !showLobbyists ? [] : (lobbyistAugment.edges || []).filter((e) => {
      if (!allowed.has(e.tier)) return false;
      return nodesById.has(e.s) && nodesById.has(e.t);
    });

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
      /* 2026-04-26 (task #118) — lens-mode ego-network walker uses the
         FULL donor / lobbyist edge set, ignoring the donor/lobbyist layer
         toggles. The visibleNodes/visibleEdges memos still apply the
         layer filter at render time, so the user can hide a kind via
         the panel without breaking the lens for a donor or lobbyist
         subject. Otherwise: lens on a donor → donor layer off → no
         neighbours found. */
      const allDonorEdgesForLens = (donorAugment.edges || []).filter((e) => {
        if (!allowed.has(e.tier)) return false;
        const floor = Math.max(100_000, minGBP / 10);
        if ((e.totalGBP || 0) < floor) return false;
        return nodesById.has(e.s) && nodesById.has(e.t);
      });
      const allLobbyistEdgesForLens = (lobbyistAugment.edges || []).filter((e) => {
        if (!allowed.has(e.tier)) return false;
        return nodesById.has(e.s) && nodesById.has(e.t);
      });
      const all = [...allAwards, ...allMembers, ...allPersonEdges, ...allDonorEdgesForLens, ...allLobbyistEdgesForLens];

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
      const personEdges = allPersonEdges.filter(
        (e) => nodeSet.has(e.s) && nodeSet.has(e.t)
      );
      const donorEdges = allDonorEdgesForLens.filter(
        (e) => nodeSet.has(e.s) && nodeSet.has(e.t)
      );
      const lobbyistEdges = allLobbyistEdgesForLens.filter(
        (e) => nodeSet.has(e.s) && nodeSet.has(e.t)
      );
      return {
        awards, projectMembers, personEdges, donorEdges, lobbyistEdges,
        reachable: nodeSet, hop1, subject: lensSubjectId,
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

    /* Person edges in NETWORK mode: include those whose counterparty
       (supplier or buyer) is on the current canvas, plus their served-at
       buyers if reachable. The corresponding person + adjacent_firm
       endpoints get pulled into `reachable` so the bubbles render.
       v2 Phase 2 — person→party edges are kept for any person already on
       the canvas; the party endpoint itself isn't anchored to a money
       flow so we can't gate on `reachable.has(party)`. */
    const personEdges = allPersonEdges.filter((e) => {
      const other = e.s.startsWith("person:") ? e.t : e.s;
      // person→party edges: keep if the person endpoint is reachable, OR
      // if any other person edge for the same person is already reachable.
      if (e.kind === "person_party") {
        return reachable.has(e.s) || reachable.has(e.t);
      }
      return reachable.has(other);
    });
    personEdges.forEach((e) => { reachable.add(e.s); reachable.add(e.t); });
    // Second pass: now that person endpoints might have been pulled in by
    // their counterparty edge, sweep party edges that match a now-reachable
    // person and weren't included on the first pass.
    for (const e of allPersonEdges) {
      if (e.kind !== "person_party") continue;
      if (personEdges.includes(e)) continue;
      if (reachable.has(e.s)) {
        personEdges.push(e);
        reachable.add(e.t);
      }
    }

    /* v2 Phase 3 — donor→party edges in NETWORK mode.
       Two cases:
        a) Donor is a fresh donor node (sourceId = "donor:..."): include if
           the party endpoint is on the canvas (party comes from people
           layer or from another donor edge). We pull the donor + party
           into reachable so both bubbles render even if they wouldn't be
           reached by the contract subgraph.
        b) Donor is a supplier-overlap (sourceId is a tracked supplier):
           include if the supplier is already reachable (i.e., the canvas
           shows it) — that's the editorial point of the overlay. */
    const donorEdges = [];
    // Pass 1: keep edges whose endpoints are already on canvas.
    for (const e of allDonorEdges) {
      const s = nodesById.get(e.s);
      if (!s) continue;
      if (s.kind === "supplier") {
        if (reachable.has(e.s)) {
          donorEdges.push(e);
          reachable.add(e.t); // pull the party in
        }
      } else {
        // Fresh donor node — include if the party endpoint is reachable
        // OR if there are no people on canvas at all (in which case we
        // anchor donors via the canvas-empty fallback below).
        if (reachable.has(e.t)) {
          donorEdges.push(e);
          reachable.add(e.s);
        }
      }
    }
    // Pass 2: when donors are toggled on, surface a curated baseline of
    // donor→party edges even if no person/supplier already pulled their
    // party in — otherwise donors would be invisible until the user opened
    // a person bubble. We seed by including the top 8 donor→party flows by
    // £ so the donor cluster always has something to read.
    if (showDonors) {
      const remaining = allDonorEdges
        .filter((e) => !donorEdges.includes(e))
        .sort((a, b) => (b.totalGBP || 0) - (a.totalGBP || 0));
      for (const e of remaining.slice(0, 8)) {
        donorEdges.push(e);
        reachable.add(e.s);
        reachable.add(e.t);
      }
    }

    /* v2 Phase 4 — lobbyist→supplier edges in NETWORK mode.
       Pass 1: include any edge whose tracked-supplier endpoint is already
       reachable from the awards subgraph (so a lobbyist that reps a
       supplier currently on canvas materialises alongside it).
       Pass 2: when lobbyists are toggled on, surface a curated baseline
       of the top 5 best-matched lobbyists (those with the highest
       matchedSupplierCount) so the cluster always has something to read
       even if no on-canvas supplier pulled them in. */
    const lobbyistEdges = [];
    for (const e of allLobbyistEdges) {
      if (reachable.has(e.t)) {
        lobbyistEdges.push(e);
        reachable.add(e.s);
      }
    }
    if (showLobbyists) {
      // Group remaining edges by lobbyist (source) and surface the top 5
      // lobbyists by # of supplier connections — keeps the cluster shape
      // legible without flooding the canvas.
      const byLobbyist = new Map();
      for (const e of allLobbyistEdges) {
        if (lobbyistEdges.includes(e)) continue;
        if (!byLobbyist.has(e.s)) byLobbyist.set(e.s, []);
        byLobbyist.get(e.s).push(e);
      }
      const sorted = Array.from(byLobbyist.entries())
        .sort((a, b) => b[1].length - a[1].length);
      for (const [, edges] of sorted.slice(0, 5)) {
        for (const e of edges) {
          lobbyistEdges.push(e);
          reachable.add(e.s);
          reachable.add(e.t);
        }
      }
    }

    return { awards, projectMembers, personEdges, donorEdges, lobbyistEdges, reachable, hop1: null, subject: null };
  }, [data.edges, tierFilter, minGBP, q, featuredSet, nodesById, viewMode, lensSubjectId, peopleAugment.edges, donorAugment.edges, lobbyistAugment.edges, showDonors, showLobbyists]);

  const visibleNodes = useMemo(() => {
    const arr = [];
    for (const id of filteredEdges.reachable) {
      const n = nodesById.get(id);
      if (!n) continue;
      // Layers control: drop nodes whose kind has been toggled off.
      if (!visibleLayers.has(n.kind)) continue;
      arr.push(n);
    }
    return arr;
  }, [filteredEdges.reachable, nodesById, visibleLayers]);

  const visibleEdges = useMemo(() => {
    const all = [
      ...filteredEdges.awards.map((e) => ({ ...e, _kind: "award" })),
      ...filteredEdges.projectMembers.map((e) => ({ ...e, _kind: "project" })),
      ...((filteredEdges.personEdges || []).map((e) => ({ ...e, _kind: "person" }))),
      ...((filteredEdges.donorEdges || []).map((e) => ({ ...e, _kind: "donor" }))),
      ...((filteredEdges.lobbyistEdges || []).map((e) => ({ ...e, _kind: "lobbyist" }))),
    ];
    // Layers control. Two passes:
    //  (a) per-edge layer toggle — match either e.kind (typed v2 edges)
    //      or e._kind === "award" (legacy money-flow edge).
    //  (b) drop edges incident to a node kind the reader has hidden, so
    //      the canvas doesn't carry orphan stubs that go to nowhere.
    return all.filter((e) => {
      // (a) per-edge-kind toggle
      if (e._kind === "award" && !visibleLayers.has("award")) return false;
      if (e.kind === "person_party"     && !visibleLayers.has("person_party")) return false;
      if (e.kind === "donor_party"      && !visibleLayers.has("donor_party"))  return false;
      if (e.kind === "lobbyist_client"  && !visibleLayers.has("lobbyist_client")) return false;
      if (e.kind === "served_at"        && !visibleLayers.has("served_at"))    return false;
      // (b) endpoint-kind gating
      const sId = typeof e.s === "string" ? e.s : e.s?.id;
      const tId = typeof e.t === "string" ? e.t : e.t?.id;
      const sNode = sId != null ? nodesById.get(sId) : null;
      const tNode = tId != null ? nodesById.get(tId) : null;
      if (sNode && !visibleLayers.has(sNode.kind)) return false;
      if (tNode && !visibleLayers.has(tNode.kind)) return false;
      return true;
    });
  }, [filteredEdges, visibleLayers, nodesById]);

  const selected = selection
    ? selection.kind === "node"
      ? { node: nodesById.get(selection.id), edge: null }
      : {
          node: null,
          edge:
            (data.edges?.awards || []).find((x) => x.id === selection.id) ||
            (data.edges?.projectMembers || []).find((x) => x.id === selection.id) ||
            (peopleAugment.edges || []).find((x) => x.id === selection.id) ||
            (donorAugment.edges || []).find((x) => x.id === selection.id) ||
            (lobbyistAugment.edges || []).find((x) => x.id === selection.id),
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

    /* ---------- size ----------
       Person + adjacent_firm bubbles use a smaller fixed radius so they
       read as "annotation, not entity" against the £-scaled supplier /
       buyer / project bubbles. */
    const maxValue = visibleNodes.reduce((m, n) => Math.max(m, n.value || 0), 1);
    const radius = scaleSqrt().domain([0, maxValue]).range([14, 72]);
    const nodeData = visibleNodes.map((n) => {
      let r;
      if (n.kind === "person") r = 11;
      else if (n.kind === "adjacent_firm") r = 9;
      else if (n.kind === "party") r = 13; // sized between adjacent (9) and person (11), nudged up slightly so the labelled disc reads as an institutional anchor rather than a footnote
      // v2 Phase 3 — donor bubbles use the precomputed fixedRadius so they
      // sit consistently small (donations are smaller than contracts; the
      // £-scaled supplier radius would oversize them). Range 4–14.
      else if (n.kind === "donor") r = n.fixedRadius || Math.max(4, Math.min(14, Math.sqrt((n.totalGBP || 0) / 1e6) * 2));
      // v2 Phase 4 — lobbyist nodes render as hollow rings at a fixed
      // radius. Slightly bigger than person bubbles because the ring's
      // hollow centre needs to read as deliberate, not as a tiny dot.
      else if (n.kind === "lobbyist") r = 10;
      else r = radius(Math.max(1, n.value || 1));
      return { ...n, r, type: n.kind };
    });
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

    /* ---------- edges ----------
       Person/relational edges get a distinct visual treatment: thinner,
       amber-tinted, dashed. They're not money flows, so the £-derived
       width formula doesn't apply. */
    const linkSel = edgeG.selectAll("line")
      .data(linkData, (d) => d.id)
      .enter().append("line")
        .attr("class", "mm-edge-line")
        .attr("stroke", (d) => {
          // v2 Phase 2 — person→party edges render in the party's own
          // colour so a reader can see clusters of amber person dots
          // pulled toward each coloured party disc.
          if (d.kind === "person_party") {
            const partyId = String(d.t || "").replace(/^party:/, "");
            return PARTY_DEFS[partyId]?.color || "#fbbf24";
          }
          // v2 Phase 3 — donor→party edges in party colour, slightly more
          // saturated than person→party so the money flow reads as primary.
          if (d.kind === "donor_party") {
            return PARTY_DEFS[d.partyId]?.color || "#94a3b8";
          }
          // v2 Phase 4 — lobbyist→supplier edges in violet, dashed.
          if (d.kind === "lobbyist_client") return TYPE_COLOUR.lobbyist;
          if (d._kind === "person") return "#fbbf24";
          return TIER_STYLE[d.tier]?.colour || "#8a8a94";
        })
        .attr("stroke-opacity", (d) => {
          if (d.kind === "person_party") return 0.35;
          if (d.kind === "donor_party") return 0.5;
          if (d.kind === "lobbyist_client") {
            // Lower opacity for fuzzy/medium-confidence matches —
            // visual humility about the match quality.
            return d.confidence === "medium" ? 0.25 : 0.4;
          }
          if (d._kind === "person") return 0.45;
          return TIER_STYLE[d.tier]?.opacity || 0.4;
        })
        .attr("stroke-width", (d) => {
          if (d.kind === "person_party") return 1;
          if (d.kind === "donor_party") {
            // Scales with donation £ but capped — keep donor edges
            // legible without dominating the contract subgraph.
            return Math.min(3.2, 1.5 + Math.sqrt((d.totalGBP || 0) / 1e7) * 0.6);
          }
          if (d.kind === "lobbyist_client") return 1;
          if (d._kind === "person") return 1.1;
          const base = TIER_STYLE[d.tier]?.width || 1;
          const amt = Math.min(5.5, 1 + Math.sqrt((d.totalGBP || 0) / 1e9) * 1.4);
          return base * amt;
        })
        .attr("stroke-dasharray", (d) => {
          if (d.kind === "person_party") return "3 4";
          // donor→party edges are real money flows — solid line, no dash.
          if (d.kind === "donor_party") return null;
          // Lobbyist→supplier edges are relationships, not money — dashed
          // to read as "access channel" rather than a contract flow.
          if (d.kind === "lobbyist_client") return "5 4";
          if (d._kind === "person") return "4 3";
          return TIER_STYLE[d.tier]?.dash;
        })
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
      .attr("fill", (d) => {
        if (d.type === "party") return d.color || "#777777";
        if (d.type === "donor") return DONOR_TYPE_COLOUR[d.donorStatus] || TYPE_COLOUR.donor;
        if (d.type === "lobbyist") return TYPE_COLOUR.lobbyist;
        return TYPE_COLOUR[d.type] || "#525561";
      })
      .attr("fill-opacity", (d) => {
        if (d.type === "adjacent_firm") return 0.04;
        if (viewMode === "lens" && d.id === lensSubjectId) return 0.20;
        if (d.type === "person") return 0.16;
        if (d.type === "party") return 0.12;
        if (d.type === "donor") return 0.10;
        // v2 Phase 4 — lobbyist halo is feather-light. The hollow ring
        // is the actual visual anchor; the halo just gives the bubble
        // a soft footprint when the canvas is busy.
        if (d.type === "lobbyist") return 0.07;
        return 0.08;
      })
      .attr("filter", "url(#mm-glow)");

    /* v2 Phase 3 — supplier-overlap ring. Where a tracked supplier is
       also on the donor list, paint a concentric ring in the dominant
       party's colour just outside the supplier bubble. Signals "this
       firm both held government contracts and donated to the party".
       2026-04-26 (task #118) — the ring is part of the supplier node's
       own appearance (it's metadata pinned to the supplier, not a
       donor-layer artefact), so we no longer gate on `showDonors`.
       That means the ring stays visible under the new "Base only"
       default — which is the whole editorial point of having it. */
    nodeSel
      .filter((d) => d.type === "supplier" && d.isDonor)
      .append("circle")
        .attr("class", "mm-supplier-donor-ring")
        .attr("r", (d) => d.r + 4)
        .attr("fill", "none")
        .attr("stroke", (d) => PARTY_DEFS[d.dominantPartyId]?.color || "#94a3b8")
        .attr("stroke-width", 2.2)
        .attr("stroke-opacity", 0.85)
        .attr("pointer-events", "none");

    // Main bubble. Nodes whose £ value is zero/undisclosed get a dashed
    // outer stroke — same visual language as Tier C/D edges — so readers
    // can see at-a-glance which bubbles don't yet have a public £ figure.
    // Non-undisclosed bubbles keep the solid hairline stroke.
    //
    // v2 Phase 1 — Person nodes get an amber ring + solid amber inner dot
    // (rendered below) and a stronger outline to read distinctly from
    // money-flow bubbles. Adjacent-firm nodes get a dashed outline + low
    // opacity so they read as "context, not first-class entity".
    nodeSel.append("circle")
      .attr("class", "mm-main-bubble")
      .attr("r", (d) => d.r)
      // v2 Phase 2 — party nodes paint a solid disc in the canonical
      // party colour (no radial gradient). Avoids minting a per-party
      // gradient def at render time and keeps the disc reading as an
      // institutional flag rather than a money bubble.
      .attr("fill", (d) => {
        if (d.type === "party") return d.color || "#777777";
        // v2 Phase 3 — donor nodes paint a flat fill in their type colour.
        // No radial gradient: keeps the donor cluster reading as a quieter
        // "annotation" layer rather than competing with money bubbles.
        if (d.type === "donor") return DONOR_TYPE_COLOUR[d.donorStatus] || TYPE_COLOUR.donor;
        // v2 Phase 4 — lobbyist nodes are HOLLOW rings. The ring shape
        // (no fill) signals "agent of access, not a money flow itself".
        if (d.type === "lobbyist") return "none";
        return `url(#mm-grad-${d.type})`;
      })
      .attr("opacity", (d) => {
        if (d.type === "adjacent_firm") return 0.55;
        if (d.type === "donor") return 0.92;
        return 1;
      })
      .attr("stroke", (d) => {
        if (d.type === "person") return "#fbbf24";
        if (d.type === "adjacent_firm") return "rgba(180,180,190,0.6)";
        if (d.type === "party") {
          // 1.4× darker for definition against the dark background
          const c = d3color(d.color || "#777777");
          return c ? c.darker(1.4).formatHex() : "#444";
        }
        // v2 Phase 3 — donor stroke = dominant funded party colour. So a
        // donor that gives mostly to Conservatives gets a Conservative-blue
        // ring, etc. Visually couples donor to party.
        if (d.type === "donor") {
          return PARTY_DEFS[d.dominantPartyId]?.color || "rgba(255,255,255,0.4)";
        }
        // v2 Phase 4 — lobbyist ring stroke = violet. Solid 1.6px.
        if (d.type === "lobbyist") return TYPE_COLOUR.lobbyist;
        return isUndisclosed(d.value)
          ? "rgba(245,245,245,0.55)"
          : d3color(TYPE_COLOUR[d.type] || "#525561").brighter(0.4).formatHex();
      })
      .attr("stroke-opacity", (d) => {
        if (d.type === "person") return 0.95;
        if (d.type === "adjacent_firm") return 0.6;
        if (d.type === "party") return 0.95;
        if (d.type === "donor") return 0.95;
        if (d.type === "lobbyist") return 0.85;
        return isUndisclosed(d.value) ? 0.85 : 0.5;
      })
      .attr("stroke-width", (d) => {
        if (d.type === "person") return 1.8;
        if (d.type === "party") return 1;
        if (d.type === "donor") return 1.6;
        if (d.type === "lobbyist") return 1.6;
        return isUndisclosed(d.value) ? 1.2 : 1;
      })
      .attr("stroke-dasharray", (d) => {
        if (d.type === "person") return null;
        if (d.type === "party") return null;
        if (d.type === "donor") return null;
        if (d.type === "lobbyist") return null;
        if (d.type === "adjacent_firm") return "3 3";
        return isUndisclosed(d.value) ? "3 3" : null;
      });

    // Person inner dot — the "ringed amber" treatment that makes a person
    // bubble read as a person at a glance even at low zoom levels. Skipped
    // for non-person kinds so existing supplier/buyer/project bubbles look
    // unchanged.
    nodeSel
      .filter((d) => d.type === "person")
      .append("circle")
        .attr("class", "mm-person-dot")
        .attr("r", (d) => Math.max(3, d.r * 0.35))
        .attr("fill", "#fbbf24")
        .attr("fill-opacity", 0.9)
        .attr("pointer-events", "none");

    // Native hover tooltip — the cheapest UX win on this canvas. Gives
    // "BAE Systems · supplier · £3.2bn · 14 relationships" on hover
    // without a click, which massively speeds up graph exploration.
    nodeSel.append("title").text((d) => {
      const kind =
        d.type === "buyer" ? "department" :
        d.type === "person" ? "person" :
        d.type === "adjacent_firm" ? "adjacent firm" :
        d.type === "party" ? "political party" :
        d.type === "donor" ? `donor · ${d.donorStatus || "unknown"}` :
        d.type === "lobbyist" ? "registered consultant lobbyist" :
        d.type;
      if (d.type === "lobbyist") {
        const typeLbl = LOBBYIST_TYPE_LABEL[d.lobbyistType] || "lobbyist";
        return `${d.label}\nLOBBYIST · ${typeLbl} · ${d.totalClients} declared client${d.totalClients === 1 ? "" : "s"} · ${d.matchedSupplierCount} match tracked supplier${d.matchedSupplierCount === 1 ? "" : "s"}` +
               `\n(click for details)`;
      }
      if (d.type === "party") {
        const members = (peopleAugment.edges || [])
          .filter((e) => e.kind === "person_party" && e.t === d.id).length;
        const donorLines = (donorAugment.edges || [])
          .filter((e) => e.kind === "donor_party" && e.t === d.id).length;
        return `${d.label}\n${kind} · ${members} person${members === 1 ? "" : "s"} · ${donorLines} top donor${donorLines === 1 ? "" : "s"}` +
               (d.description ? `\n${d.description}` : "") +
               `\n(click for details)`;
      }
      if (d.type === "donor") {
        const partyList = (d.parties || []).map((p) => `${PARTY_DEFS[p.partyId]?.short || p.partyId}: ${fmtGBPDonor(p.totalGBP)}`).join(", ");
        return `${d.label}\nDONOR · ${kind} · ${fmtGBP(d.totalGBP)} declared political giving · ${d.donationCount} donations` +
               (partyList ? `\n${partyList}` : "") +
               `\n(click for details)`;
      }
      if (d.type === "person" || d.type === "adjacent_firm") {
        const rels = (peopleAugment.edges || [])
          .filter((e) => e.s === d.id || e.t === d.id).length;
        const head = d.type === "person" ? (d.headline || "") : (d.note || "");
        return `${d.label}\n${kind} · ${rels} relationship${rels === 1 ? "" : "s"}` +
               (head ? `\n${head}` : "") +
               `\n(click for details)`;
      }
      const connections = (data.edges?.awards || [])
        .concat(data.edges?.projectMembers || [])
        .filter((e) => e.s === d.id || e.t === d.id).length;
      const moneyLine = isUndisclosed(d.value)
        ? "£ undisclosed"
        : fmtGBP(d.value) + " in window";
      // v2 Phase 3 — supplier-overlay donors get a "DONOR" badge in the
      // hover line so the secondary status is legible without opening the
      // drawer. Total declared giving inlined for fast triage.
      // 2026-04-26 (task #118) — decoupled from the donor layer: the badge
      // describes the supplier itself, not the donor cluster, so it stays
      // visible whether or not the donor layer is on.
      const donorBadge = d.isDonor
        ? `\nALSO POLITICAL DONOR · ${fmtGBP(d.donorTotalGBP)} declared giving`
        : "";
      return `${d.label}\n${kind} · ${moneyLine} · ${connections} relationship${connections === 1 ? "" : "s"}${donorBadge}\n(click for details)`;
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
      // v2 Phase 2 — party labels render at normal weight so they sit
      // quietly behind the editorial subjects (people, suppliers).
      .style("font-weight", (d) => {
        if (d.type === "party") return 400;
        return d.r >= 40 ? 600 : 500;
      })
      .style("font-size", (d) => d.r >= 40 ? "12.5px" : "11px")
      .style("fill", (d) => {
        if (d.type === "party") return "rgba(244,244,245,0.7)";
        // v2 Phase 4 — lobbyist labels run slightly desaturated so the
        // ring + label read as "annotation layer", not first-class money.
        if (d.type === "lobbyist") return "rgba(244,244,245,0.82)";
        return "#f4f4f5";
      })
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
      .text((d) => {
        if (d.type === "party") return "party";
        if (d.type === "donor") return `donor · ${fmtGBPDonor(d.totalGBP)}`;
        if (d.type === "lobbyist") return `lobbyist · ${d.matchedSupplierCount}/${d.totalClients}`;
        return d.value > 0 ? fmtGBP(d.value) : d.type;
      });

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
  }, [visibleNodes, visibleEdges, viewMode, lensSubjectId, showDonors, showLobbyists]);

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
      (peopleAugment.edges || []).forEach((e) => {
        if (e.s === selection.id) neighbourIds.add(e.t);
        if (e.t === selection.id) neighbourIds.add(e.s);
      });
      (donorAugment.edges || []).forEach((e) => {
        if (e.s === selection.id) neighbourIds.add(e.t);
        if (e.t === selection.id) neighbourIds.add(e.s);
      });
      (lobbyistAugment.edges || []).forEach((e) => {
        if (e.s === selection.id) neighbourIds.add(e.t);
        if (e.t === selection.id) neighbourIds.add(e.s);
      });
    } else {
      const edge =
        (data.edges?.awards || []).find((x) => x.id === selection.id) ||
        (data.edges?.projectMembers || []).find((x) => x.id === selection.id) ||
        (peopleAugment.edges || []).find((x) => x.id === selection.id) ||
        (donorAugment.edges || []).find((x) => x.id === selection.id) ||
        (lobbyistAugment.edges || []).find((x) => x.id === selection.id);
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
          An edge between two entities means we found a named public document linking them &mdash; it does not imply any party acted improperly.{" "}
          <b>Amber nodes are people; coloured dots are political parties; neutral nodes are political donors; violet rings are registered consultant lobbyists tied to their declared clients.</b>{" "}
          Where a tracked supplier has also donated to a party, the supplier bubble carries a coloured ring in the party&rsquo;s colour. The lobbyist register covers consultant lobbyists only &mdash; in-house lobbyists and informal access are outside the public record. See Stories for the evidence trail behind named individuals.
        </div>
      </section>

      {/* Desktop-only Stories strip — surfaces the editorial hook above
          the canvas. Mobile has its own full-screen Stories tab inside
          the 3-tab Explorer and must NOT also render this strip. */}
      <div className="hidden md:block">
        <MoneyMapStoriesStrip
          connections={storyConnections}
          peopleById={storyPeopleById}
          onOpen={(id) => setSelection({ kind: "node", id })}
          onOpenPerson={(id) => setSelection({ kind: "node", id })}
        />
      </div>

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
              {/* 2026-04-26 (task #118) — extended for v2 Phases 1-4 node
                  kinds. Lens subjects can now be people, parties, donors,
                  lobbyists or adjacent firms. */}
              {lensSubjectNode.kind === "buyer"         ? "dept"     :
               lensSubjectNode.kind === "supplier"      ? "supplier" :
               lensSubjectNode.kind === "project"       ? "project"  :
               lensSubjectNode.kind === "person"        ? "person"   :
               lensSubjectNode.kind === "party"         ? "party"    :
               lensSubjectNode.kind === "donor"         ? "donor"    :
               lensSubjectNode.kind === "lobbyist"      ? "lobbyist" :
               lensSubjectNode.kind === "adjacent_firm" ? "firm"     : ""}
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
        {/* 2026-04-26 — task #115. The standalone Donors / Lobbyists
            chips were retired here in favour of the floating Layers
            panel (desktop top-right of the canvas) and the Layers
            section in the mobile Filters bottom sheet. Single source
            of truth for "what's visible on the canvas right now". */}
        <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>
          {visibleNodes.length} nodes · {visibleEdges.length} edges
        </span>
      </section>

      {/* ==================================================
          LAYOUT TOGGLE — audit rec #98 / task #100
          Default: canvas on desktop, mobile-explorer at <md.
          On mobile we no longer expose "canvas" — d3-force
          graphs don't work on 375px viewports. Desktop keeps
          the optional list toggle for readers who prefer rows
          over bubbles.
          ================================================== */}
      <section className="mm-filters mm-filters-layout mm-filters-layout-desktop">
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
            className="mm-layout-toggle"
            onClick={() => setLayoutMode("list")}
            aria-label="Show top-suppliers list instead of canvas"
          >
            Show list view &rarr;
          </button>
        )}
      </section>

      {/* ==================================================
          MOBILE EXPLORER — task #100
          3-tab surface replacing the old top-suppliers list.
          Only rendered in list mode; desktop list mode (when a
          user manually toggles canvas → list above) still uses
          the legacy MoneyMapMobileList since these card layouts
          assume a single narrow column.
          ================================================== */}
      {layoutMode === "list" ? (
        <>
          <section className="mm-explorer mm-explorer-mobile" aria-label="Money Explorer">
            <div className="mm-explorer-header">
              <button
                type="button"
                className="mm-filters-btn"
                onClick={() => setFiltersOpen(true)}
                aria-label={`Open filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="mm-filters-badge">{activeFilterCount}</span>
                )}
              </button>
              <span className="mm-explorer-title">Money Explorer</span>
            </div>
            <div
              className="mm-tabbar"
              role="tablist"
              aria-label="Money Explorer views"
              onKeyDown={(e) => {
                const order = ["stories", "flows", "departments", "suppliers"];
                const idx = order.indexOf(mobileTab);
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setMobileTab(order[(idx + 1) % order.length]);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setMobileTab(order[(idx - 1 + order.length) % order.length]);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setMobileTab(order[0]);
                } else if (e.key === "End") {
                  e.preventDefault();
                  setMobileTab(order[order.length - 1]);
                }
              }}
            >
              <button
                type="button"
                id="mm-tab-stories"
                role="tab"
                aria-selected={mobileTab === "stories"}
                aria-controls="mm-panel-stories"
                tabIndex={mobileTab === "stories" ? 0 : -1}
                className={"mm-tab" + (mobileTab === "stories" ? " mm-tab-active" : "")}
                onClick={() => setMobileTab("stories")}
              >
                Stories
              </button>
              <button
                type="button"
                id="mm-tab-flows"
                role="tab"
                aria-selected={mobileTab === "flows"}
                aria-controls="mm-panel-flows"
                tabIndex={mobileTab === "flows" ? 0 : -1}
                className={"mm-tab" + (mobileTab === "flows" ? " mm-tab-active" : "")}
                onClick={() => setMobileTab("flows")}
              >
                Flows
              </button>
              <button
                type="button"
                id="mm-tab-departments"
                role="tab"
                aria-selected={mobileTab === "departments"}
                aria-controls="mm-panel-departments"
                tabIndex={mobileTab === "departments" ? 0 : -1}
                className={"mm-tab" + (mobileTab === "departments" ? " mm-tab-active" : "")}
                onClick={() => setMobileTab("departments")}
              >
                Departments
              </button>
              <button
                type="button"
                id="mm-tab-suppliers"
                role="tab"
                aria-selected={mobileTab === "suppliers"}
                aria-controls="mm-panel-suppliers"
                tabIndex={mobileTab === "suppliers" ? 0 : -1}
                className={"mm-tab" + (mobileTab === "suppliers" ? " mm-tab-active" : "")}
                onClick={() => setMobileTab("suppliers")}
              >
                Suppliers
              </button>
            </div>

            {mobileTab === "stories" && (
              <MoneyMapStoriesTab
                connections={storyConnections}
                peopleById={storyPeopleById}
                onOpen={(id) => setSelection({ kind: "node", id })}
                onOpenPerson={(id) => setSelection({ kind: "node", id })}
              />
            )}
            {mobileTab === "flows" && (
              <MoneyMapFlowsTab
                flows={topFlows}
                onSelectSupplier={(id) => setSelection({ kind: "node", id })}
              />
            )}
            {mobileTab === "departments" && (
              <MoneyMapDepartmentsTab
                departments={topDepartments}
                onSelectBuyer={(id) => setSelection({ kind: "node", id })}
                onSelectSupplier={(id) => setSelection({ kind: "node", id })}
                connectionsByBuyer={connectionsByBuyer}
              />
            )}
            {mobileTab === "suppliers" && (
              <MoneyMapSuppliersTab
                suppliers={topSuppliers}
                onSelectSupplier={(id) => setSelection({ kind: "node", id })}
                onSelectBuyer={(id) => setSelection({ kind: "node", id })}
                connectionsBySupplier={connectionsBySupplier}
              />
            )}
          </section>

          {/* Desktop-only fallback: MoneyMapMobileList kept for users who
              manually toggle canvas → list at ≥md. Mobile hides this
              via CSS so only one list renders per viewport. */}
          <div className="mm-explorer-desktop-fallback">
            <MoneyMapMobileList
              rows={topSuppliers}
              onSelectSupplier={(id) => setSelection({ kind: "node", id })}
            />
          </div>

          <MoneyMapFiltersSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            tierFilter={tierFilter}
            setTierFilter={setTierFilter}
            minGBP={minGBP}
            setMinGBP={setMinGBP}
            query={query}
            setQuery={setQuery}
            viewMode={viewMode}
            lensSubjectNode={lensSubjectNode}
            resetLens={resetLens}
            visibleLayers={visibleLayers}
            toggleLayer={toggleLayer}
            resetLayers={resetLayers}
            setAllLayers={setAllLayers}
            layersAreDefault={layersAreDefault}
            layersAreAll={layersAreAll}
            layerCounts={layerCounts}
          />
        </>
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

          {/* Top-right (below export): floating Layers panel. Lets the
              reader toggle visibility of each node kind / edge kind on
              the canvas. Replaces the standalone Donors / Lobbyists
              chips that lived in the toolbar. Hidden on mobile — mobile
              uses the Layers section in the Filters bottom sheet. */}
          <LayersPanel
            visibleLayers={visibleLayers}
            toggleLayer={toggleLayer}
            resetLayers={resetLayers}
            setAllLayers={setAllLayers}
            layersAreDefault={layersAreDefault}
            layersAreAll={layersAreAll}
            layerCounts={layerCounts}
            className="mm-layers-panel-desktop"
          />

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
            <LegendRow colour={TYPE_COLOUR.person}>Person · relational</LegendRow>
            <LegendRow colour={PARTY_DEFS.conservative.color}>Party · political</LegendRow>
            <LegendRow colour={DONOR_TYPE_COLOUR.Company}>Donor · political (top 25)</LegendRow>
          </div>

          <div className="mm-legend-group">
            <div className="mm-rail-h">Evidence tier</div>
            <TierLegend tier="A">Tier A — direct financial flow</TierLegend>
            <TierLegend tier="B">Tier B — transparency return</TierLegend>
            <TierLegend tier="C">Tier C — declared interest</TierLegend>
            <TierLegend tier="D" faint>Tier D — circumstantial (opt-in)</TierLegend>
            <div className="mm-legend-row" style={{ opacity: 0.85 }}>
              <span className="mm-legend-line">
                <svg width="26" height="6">
                  <line x1="0" y1="3" x2="26" y2="3" stroke="#fbbf24" strokeWidth="1.4" strokeDasharray="4 3" />
                </svg>
              </span>
              Amber dashed — person → counterparty
            </div>
            <div className="mm-legend-row" style={{ opacity: 0.85 }}>
              <span className="mm-legend-line">
                <svg width="26" height="6">
                  <line x1="0" y1="3" x2="26" y2="3" stroke={PARTY_DEFS.conservative.color} strokeWidth="1" strokeDasharray="3 4" />
                </svg>
              </span>
              Coloured dashed — person → party
            </div>
            {/* v2 Phase 3 — donor → party edge legend */}
            <div className="mm-legend-row" style={{ opacity: 0.85 }}>
              <span className="mm-legend-line">
                <svg width="26" height="6">
                  <line x1="0" y1="3" x2="26" y2="3" stroke={PARTY_DEFS.conservative.color} strokeWidth="2" />
                </svg>
              </span>
              Coloured solid — donor → party (£ given)
            </div>
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
              <LegendRow colour={TYPE_COLOUR.person}>Person</LegendRow>
              <LegendRow colour={PARTY_DEFS.conservative.color}>Party</LegendRow>
              <LegendRow colour={DONOR_TYPE_COLOUR.Company}>Donor</LegendRow>
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
          onOpenNode={(id) => setSelection({ kind: "node", id })}
          personEdges={peopleAugment.edges}
          donorEdges={donorAugment.edges}
          storyConnections={storyConnections}
          storyPeopleById={storyPeopleById}
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

/* =========================================================================
 *  PersonDetail — drawer for a person bubble.
 *  Re-uses MoneyMapStoriesTab to render that person's connection cards
 *  (so the cards look identical to the Stories strip). Adds a roles table
 *  + external links. Closes on Escape via the shared drawer ref.
 * ========================================================================= */
function PersonDetail({
  drawerRef,
  node,
  connections,
  peopleById,
  onClose,
  onOpen,
}) {
  const roles = node.rolesHeld || [];
  const links = node.externalLinks || [];
  const isFirm = node.personKind === "firm";
  // For firm subjects with a single donor-contractor connection, surface the
  // detail paragraphs as a "Pattern" section in place of the rolesHeld table
  // (firms have no rolesHeld) so the drawer leads with the editorial framing
  // before the cards repeat it.
  const patternConn = isFirm && connections.length > 0 ? connections[0] : null;
  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${isFirm ? "Firm" : "Person"} profile: ${node.label}`}
      className="mm-drawer mm-drawer-open mm-drawer-person"
    >
      <div className="mm-d-head">
        <button className="mm-d-close" aria-label="Close drawer" onClick={onClose}>x</button>
        <div className="mm-eyebrow-row">
          <span className="mm-eyebrow">{isFirm ? "Firm" : "Person"}</span>
          <span className="mm-tier-badge mm-tier-A" style={{ background: "#3b2a06", color: "#fbbf24", borderColor: "#7a5b15" }}>
            {connections.length} connection{connections.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mm-entity-name" style={{ fontFamily: "var(--mm-serif)" }}>
          {node.label}
          {isFirm && (
            <span className="mm-story-kind-pill" style={{ marginLeft: 8, verticalAlign: "middle" }}>
              FIRM
            </span>
          )}
        </div>
        {node.headline && (
          <div className="mm-entity-sub" style={{ marginTop: 6 }}>
            {node.headline}
          </div>
        )}
      </div>
      <div className="mm-d-body">
        {!isFirm && roles.length > 0 && (
          <>
            <div className="mm-d-section-h">Roles held</div>
            <div className="mm-person-roles">
              {roles.map((r, i) => {
                const period = (r.start || "?") + " - " + (r.end || "present");
                return (
                  <div key={i} className="mm-person-role-row">
                    <div className="mm-person-role-title">{r.title}</div>
                    <div className="mm-person-role-meta">
                      {r.department || ""}
                      <span className="mm-person-role-period"> {period}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {patternConn && patternConn.detail && (
          <>
            <div className="mm-d-section-h">Pattern</div>
            <div className="mm-person-pattern" style={{ fontSize: 15, lineHeight: 1.55, color: "#cbd5e1" }}>
              {patternConn.detail.split("\n\n").map((para, i) => (
                <p key={i} style={{ marginBottom: 10 }}>{para}</p>
              ))}
            </div>
          </>
        )}

        <div className="mm-d-section-h" style={{ marginTop: 18 }}>
          Connections {connections.length > 0 ? `(${connections.length})` : ""}
        </div>
        {connections.length === 0 ? (
          <div style={{ fontSize: 15, color: "#6b7280" }}>
            No connection records yet for this person.
          </div>
        ) : (
          <MoneyMapStoriesTab
            connections={connections}
            peopleById={peopleById}
            onOpen={onOpen}
          />
        )}

        {links.length > 0 && (
          <>
            <div className="mm-d-section-h" style={{ marginTop: 14 }}>External links</div>
            <ul className="mm-person-links">
              {links.map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label}
                    <ExternalLink size={11} aria-hidden="true" style={{ marginLeft: 4, display: "inline-block", verticalAlign: "-1px" }} />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

/* =========================================================================
 *  PartyDetail — drawer for a political-party node.
 *  v2 Phase 2. Lists the people on this canvas affiliated with the party,
 *  a connection-type breakdown across those people, and a live-proceedings
 *  summary. Wired through the same drawer dispatcher as PersonDetail.
 *  Donor → party connections are deferred to Phase 3 — this drawer is for
 *  party-of-affiliation only.
 * ========================================================================= */
function PartyDetail({
  drawerRef,
  node,
  partyId,
  peopleById,
  connections,
  donorEdges,
  nodesById,
  onClose,
  onOpen,
}) {
  // People in this party — derived from the storyPeopleById map (not just
  // people who happen to have a connection record this session, but every
  // person record carrying the party id).
  const peopleInParty = Object.values(peopleById || {}).filter(
    (p) => p && p.party === partyId
  );
  const peopleIdSet = new Set(peopleInParty.map((p) => p.id));

  // Connection records belonging to those people
  const myConns = (connections || []).filter((c) => peopleIdSet.has(c.personId));

  // Connection-type breakdown
  const typeCounts = myConns.reduce((acc, c) => {
    const k = c.connectionType || "other";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const typeRows = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({
      key: k,
      label: CONN_EYEBROW[k] || "CONNECTION",
      count: n,
    }));

  // Live proceedings — distinct people whose connections include any
  // record with liveProceedings: true.
  const livePeopleIds = new Set(
    myConns.filter((c) => c.liveProceedings).map((c) => c.personId)
  );
  const livePeople = peopleInParty.filter((p) => livePeopleIds.has(p.id));

  const partyColor = node.color || "#777777";

  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Party profile: ${node.label}`}
      className="mm-drawer mm-drawer-open mm-drawer-party"
      style={{ "--mm-party-accent": partyColor }}
    >
      <div className="mm-d-head" style={{ borderLeft: `2px solid ${partyColor}`, paddingLeft: 14 }}>
        <button className="mm-d-close" aria-label="Close drawer" onClick={onClose}>x</button>
        <div className="mm-eyebrow-row">
          <span className="mm-eyebrow">Political party</span>
          <span
            className="mm-tier-badge"
            style={{ background: "rgba(255,255,255,0.04)", color: partyColor, borderColor: partyColor + "55", border: "1px solid" }}
          >
            {peopleInParty.length} on canvas
          </span>
        </div>
        <div
          className="mm-entity-name"
          style={{ fontFamily: "var(--mm-serif)", color: partyColor }}
        >
          {node.label}
        </div>
        {node.description && (
          <div className="mm-entity-sub" style={{ marginTop: 6 }}>
            {node.description}
          </div>
        )}
      </div>
      <div className="mm-d-body">
        <div className="mm-d-section-h">
          People connected on this canvas ({peopleInParty.length})
        </div>
        {peopleInParty.length === 0 ? (
          <div style={{ fontSize: 15, color: "#6b7280" }}>
            No people from this party are on the current canvas.
          </div>
        ) : (
          <div className="mm-party-people">
            {peopleInParty.map((p) => (
              <div key={p.id} className="mm-party-person-row">
                <div className="mm-party-person-name">{p.name}</div>
                {p.headline && (
                  <div className="mm-party-person-headline">{p.headline}</div>
                )}
                <button
                  type="button"
                  className="mm-party-person-link"
                  onClick={() => onOpen("person:" + p.id)}
                  aria-label={`Open person profile for ${p.name}`}
                >
                  View profile &rarr;
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mm-d-section-h" style={{ marginTop: 18 }}>
          Connection summary
        </div>
        {typeRows.length === 0 ? (
          <div style={{ fontSize: 15, color: "#6b7280" }}>
            No connection records yet for these people.
          </div>
        ) : (
          <div className="mm-party-types">
            {typeRows.map((r) => (
              <div key={r.key} className="mm-party-type-row">
                <span className="mm-party-type-count">{r.count}</span>
                <span className="mm-party-type-label">{r.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mm-d-section-h" style={{ marginTop: 18 }}>
          Live proceedings ({livePeople.length})
        </div>
        {livePeople.length === 0 ? (
          <div style={{ fontSize: 15, color: "#6b7280" }}>
            No live regulatory or court proceedings against this party&rsquo;s people in the current dataset.
          </div>
        ) : (
          <div className="mm-party-live">
            {livePeople.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mm-party-live-row"
                onClick={() => onOpen("person:" + p.id)}
                aria-label={`Open profile for ${p.name} (live proceedings)`}
              >
                <AlertTriangle size={12} aria-hidden="true" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* v2 Phase 3 — donors who funded this party (top edges by £) */}
        {(() => {
          const partyEdges = (donorEdges || [])
            .filter((e) => e.t === node.id)
            .sort((a, b) => (b.totalGBP || 0) - (a.totalGBP || 0));
          if (partyEdges.length === 0) return null;
          return (
            <>
              <div className="mm-d-section-h" style={{ marginTop: 18 }}>
                Top donors to this party ({partyEdges.length})
              </div>
              <div className="mm-donor-recipients">
                {partyEdges.slice(0, 12).map((e) => {
                  const src = nodesById?.get?.(e.s);
                  const label = src?.label || e.s;
                  const isOverlay = src?.kind === "supplier";
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="mm-donor-recipient"
                      onClick={() => onOpen(e.s)}
                      aria-label={`Open donor profile for ${label}`}
                      style={{ borderLeft: `3px solid ${node.color || "#777"}` }}
                    >
                      <span className="mm-donor-recipient-name">
                        {label}
                        {isOverlay ? " · also a tracked supplier" : ""}
                      </span>
                      <span className="mm-donor-recipient-amt">{fmtGBP(e.totalGBP)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
    </aside>
  );
}

/* =========================================================================
 *  DonorDetail — drawer for a political-donor node (v2 Phase 3).
 *  Surfaces:
 *    - Donor name + donorStatus (Company / Individual / Trade Union)
 *    - Total declared political giving + donation count + first/last date
 *    - Per-party breakdown table with £ + count
 *    - Cross-reference to government contracts: explicit "no tracked
 *      contracts" line if no overlap, OR a link to the supplier node if
 *      there IS one (kept here for completeness — overlap donors normally
 *      collapse onto the supplier bubble itself, but the negative case
 *      still needs to be explicitly visible).
 * ========================================================================= */
function DonorDetail({
  drawerRef,
  node,
  donorEdges,
  onClose,
  onOpenNode,
}) {
  const dominant = node.dominantPartyId || (node.parties && node.parties[0] && node.parties[0].partyId);
  const accent = PARTY_DEFS[dominant]?.color || "#94a3b8";
  const typeColour = DONOR_TYPE_COLOUR[node.donorStatus] || TYPE_COLOUR.donor;
  // Donor → party edges originating at this donor — used to show donation
  // count alongside the per-party breakdown.
  const myEdges = (donorEdges || []).filter((e) => e.s === node.id);

  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Donor profile: ${node.label}`}
      className="mm-drawer mm-drawer-open mm-drawer-donor"
      style={{ "--mm-donor-accent": accent }}
    >
      <div className="mm-d-head" style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 14 }}>
        <button className="mm-d-close" aria-label="Close drawer" onClick={onClose}>x</button>
        <div className="mm-eyebrow-row">
          <span className="mm-eyebrow">Political donor</span>
          <span
            className="mm-tier-badge"
            style={{ background: "rgba(255,255,255,0.04)", color: typeColour, borderColor: typeColour + "55", border: "1px solid" }}
          >
            {node.donorStatus || "Unknown"}
          </span>
        </div>
        <div
          className="mm-entity-name"
          style={{ fontFamily: "var(--mm-serif)", color: typeColour }}
        >
          {node.label}
        </div>
        <div className="mm-entity-sub" style={{ marginTop: 6 }}>
          {node.companyReg ? (
            <>Companies House <b>#{node.companyReg}</b> &middot; </>
          ) : null}
          Total declared political giving:{" "}
          <b>{fmtGBP(node.totalGBP)}</b>
          {" "}across <b>{node.donationCount}</b> donation{node.donationCount === 1 ? "" : "s"}
          {" "}({(node.parties || []).length} part{(node.parties || []).length === 1 ? "y" : "ies"} funded).
          {node.firstDate && node.lastDate ? (
            <> First donation {fmtDate(node.firstDate)}, most recent {fmtDate(node.lastDate)}.</>
          ) : null}
        </div>
      </div>
      <div className="mm-d-body">
        <div className="mm-d-section-h">Recipients · by total £</div>
        {(node.parties || []).length === 0 ? (
          <div style={{ fontSize: 15, color: "#6b7280" }}>
            No canonical-party recipients in dataset.
          </div>
        ) : (
          <div className="mm-donor-recipients">
            {(node.parties || []).map((p) => {
              const def = PARTY_DEFS[p.partyId];
              const partyEdge = myEdges.find((e) => e.partyId === p.partyId);
              return (
                <button
                  key={p.partyId}
                  type="button"
                  className="mm-donor-recipient"
                  onClick={() => onOpenNode("party:" + p.partyId)}
                  aria-label={`Open party profile for ${def?.label || p.partyId}`}
                  style={{ borderLeft: `3px solid ${def?.color || "#777"}` }}
                >
                  <span className="mm-donor-recipient-name">{def?.label || p.partyId}</span>
                  <span className="mm-donor-recipient-amt">{fmtGBP(p.totalGBP)}</span>
                  <span className="mm-donor-recipient-count">
                    {p.donationCount} donation{p.donationCount === 1 ? "" : "s"}
                    {partyEdge ? "" : " · below £100k threshold"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mm-d-section-h">Government contracts</div>
        <div className="mm-donor-contracts-empty">
          No tracked government contracts found in Gracchus&rsquo;s tracker dataset for this donor.
          Donor / supplier overlap is detected by Companies House registration first, then by
          normalised company-name match. If you believe this donor should be linked to a tracked
          supplier, please flag it via the Editorial Standards page.
        </div>

        <div className="mm-donor-foot">
          {node.donorStatus === "Company" || node.donorStatus === "Limited Liability Partnership" ? (
            <>Per-party £ totals are aggregated directly from the Electoral Commission per-record dataset
              ({node.donationCount} donation{node.donationCount === 1 ? "" : "s"} for this donor).
              The dataset bundles 6,819 records in the current build out of 92,378 historic total &mdash;
              recent and high-value entries first.</>
          ) : (
            <>Per-party £ allocation is approximated &mdash; the EC aggregate carries the recipient-party
              list per donor but not the per-party split for this donor type. Exact splits will land when
              the records aggregation is extended beyond Company / LLP donors.</>
          )}
        </div>
      </div>
    </aside>
  );
}

/* =========================================================================
 *  LobbyistDetail — drawer for a registered consultant lobbyist node
 *  (v2 Phase 4). Surfaces:
 *    - Firm name + ORCL type label (Consultant lobbyist / In-house / etc)
 *    - Registration date
 *    - Total declared client count vs # of matched tracked suppliers
 *    - Tracked-supplier clients list with confidence badge, taps open the
 *      SupplierDetail drawer
 *    - Collapsible "Other declared clients" list for the wider roster
 *      (no links — these aren't in Gracchus's tracked set)
 *    - External link to the ORCL register search for this firm
 * ========================================================================= */
function LobbyistDetail({
  drawerRef,
  node,
  onClose,
  onOpenNode,
}) {
  const accent = TYPE_COLOUR.lobbyist;
  const typeLbl = LOBBYIST_TYPE_LABEL[node.lobbyistType] || "Lobbyist";
  // Slice the tracked-supplier matches out and de-dupe by supplier id (the
  // raw matches list can carry "BT" + "BT plc" both pointing at supplier-bt;
  // we want one card per distinct tracked-supplier id, but keep all the
  // declared-client strings rolled up so the reader sees how the firm
  // referred to that supplier in their declaration).
  const matchedById = new Map();
  for (const m of (node.matchedClients || [])) {
    if (!matchedById.has(m.id)) {
      matchedById.set(m.id, { ...m, clients: [m.client] });
    } else {
      const cur = matchedById.get(m.id);
      if (!cur.clients.includes(m.client)) cur.clients.push(m.client);
      // Promote confidence — high beats medium if multiple aliases match.
      if (m.confidence === "high" && cur.confidence !== "high") cur.confidence = "high";
    }
  }
  const matchedRows = Array.from(matchedById.values());
  // Other declared clients = all declared clients NOT in the matched set.
  const matchedClientNames = new Set();
  for (const m of (node.matchedClients || [])) matchedClientNames.add(m.client);
  const otherClients = (node.allClients || []).filter((c) => !matchedClientNames.has(c));
  const [otherOpen, setOtherOpen] = useState(false);
  const orclUrl = orclSearchUrl(node.label);

  return (
    <aside
      ref={drawerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Lobbyist profile: ${node.label}`}
      className="mm-drawer mm-drawer-open mm-drawer-lobbyist"
      style={{ "--mm-lobby-accent": accent }}
    >
      <div className="mm-d-head" style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 14 }}>
        <button className="mm-d-close" aria-label="Close drawer" onClick={onClose}>x</button>
        <div className="mm-eyebrow-row">
          <span className="mm-eyebrow">Registered consultant lobbyist</span>
          <span
            className="mm-tier-badge"
            style={{ background: "rgba(255,255,255,0.04)", color: accent, borderColor: accent + "55", border: "1px solid" }}
          >
            {typeLbl}
          </span>
        </div>
        <div
          className="mm-entity-name"
          style={{ fontFamily: "var(--mm-serif)", color: accent }}
        >
          {node.label}
        </div>
        <div className="mm-entity-sub" style={{ marginTop: 6 }}>
          {node.registrationDate ? (
            <>Registered with ORCL {fmtDate(node.registrationDate)} &middot; </>
          ) : null}
          <b>{node.totalClients}</b> client{node.totalClients === 1 ? "" : "s"} declared
          {" · "}
          <b style={{ color: accent }}>{matchedRows.length}</b>{" "}
          match tracked Gracchus supplier{matchedRows.length === 1 ? "" : "s"}.
        </div>
      </div>
      <div className="mm-d-body">
        <div className="mm-d-section-h">Tracked-supplier clients</div>
        {matchedRows.length === 0 ? (
          <div style={{ fontSize: 15, color: "#6b7280" }}>
            No tracked suppliers in this firm&rsquo;s declared client list.
          </div>
        ) : (
          <div className="mm-donor-recipients">
            {matchedRows.map((m) => (
              <button
                key={m.id}
                type="button"
                className="mm-donor-recipient"
                onClick={() => onOpenNode(m.id)}
                aria-label={`Open supplier profile for ${m.label}`}
                style={{ borderLeft: `3px solid ${accent}` }}
              >
                <span className="mm-donor-recipient-name">{m.label}</span>
                <span
                  className="mm-donor-recipient-amt"
                  style={{
                    color: m.confidence === "high" ? "#bbf7d0" : "#fde68a",
                    fontFamily: "var(--mm-mono)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                  title={m.confidence === "high"
                    ? "Exact normalised name match"
                    : "Token-overlap match — read as suggestive, not definitive"}
                >
                  {m.confidence === "high" ? "Exact" : "Fuzzy"}
                </span>
                <span className="mm-donor-recipient-count">
                  Declared as: {m.clients.join(" · ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {otherClients.length > 0 && (
          <>
            <div className="mm-d-section-h">
              Other declared clients ({otherClients.length})
            </div>
            <button
              type="button"
              onClick={() => setOtherOpen((v) => !v)}
              style={{
                fontSize: 13,
                color: "#9ca3af",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 4,
                padding: "6px 10px",
                cursor: "pointer",
                marginBottom: 8,
              }}
              aria-expanded={otherOpen}
            >
              {otherOpen ? "Hide" : "Show"} the other {otherClients.length} declared client{otherClients.length === 1 ? "" : "s"}
            </button>
            {otherOpen && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  fontSize: 11.5,
                  color: "#9ca3af",
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                {otherClients.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "3px 8px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 3,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mm-d-section-h">Source</div>
        <div className="mm-donor-foot">
          Office of the Registrar of Consultant Lobbyists (ORCL).
          The register only covers <i>consultant</i> lobbying &mdash; in-house
          lobbyists and informal access remain outside the public record.
          Confidence badges reflect Gracchus&rsquo;s name-matching rigour: <b>Exact</b>
          means the declared client name normalised to the same string as a
          tracked supplier&rsquo;s canonical name; <b>Fuzzy</b> means a token-overlap
          match that still cleared a stricter bar than the donor matcher uses.
        </div>
        <a
          href={orclUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mm-d-focus-cta"
          style={{
            display: "inline-block",
            marginTop: 10,
            background: "rgba(192, 132, 252, 0.08)",
            borderColor: "rgba(192, 132, 252, 0.4)",
            color: accent,
            textDecoration: "none",
          }}
        >
          Open ORCL register entry &rarr;
        </a>
      </div>
    </aside>
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
  onOpenNode,
  personEdges,
  donorEdges,
  storyConnections,
  storyPeopleById,
}) {
  const drawerRef = useDrawerFocus(onClose);
  const node = selection.node;
  const edge = selection.edge;

  /* v2 Phase 1 — when the selection is a Person node, render PersonDetail
     instead of the standard money-map drawer. Re-uses the Stories card
     component for the connection panel so the editorial pattern matches
     what the reader sees in the Stories strip / tab. */
  if (node && node.kind === "person") {
    const personId = node.id.replace(/^person:/, "");
    const myConns = (storyConnections || []).filter((c) => c.personId === personId);
    return (
      <PersonDetail
        drawerRef={drawerRef}
        node={node}
        connections={myConns}
        peopleById={storyPeopleById || {}}
        onClose={onClose}
        onOpen={onOpenNode || (() => {})}
      />
    );
  }

  /* v2 Phase 2 — Party node selection routes to a PartyDetail drawer.
     Computes the people in the party from the storyPeopleById map, the
     connection-type breakdown across those people, and the live
     proceedings tally. Uses the same drawer chassis as PersonDetail so
     the editorial pattern (eyebrow + accent border + sectioned body)
     stays consistent. */
  if (node && node.kind === "party") {
    const partyId = node.id.replace(/^party:/, "");
    return (
      <PartyDetail
        drawerRef={drawerRef}
        node={node}
        partyId={partyId}
        peopleById={storyPeopleById || {}}
        connections={storyConnections || []}
        donorEdges={donorEdges || []}
        nodesById={nodesById}
        onClose={onClose}
        onOpen={onOpenNode || (() => {})}
      />
    );
  }

  /* v2 Phase 3 — Donor node selection routes to DonorDetail. */
  if (node && node.kind === "donor") {
    return (
      <DonorDetail
        drawerRef={drawerRef}
        node={node}
        donorEdges={donorEdges || []}
        onClose={onClose}
        onOpenNode={onOpenNode || (() => {})}
      />
    );
  }

  /* v2 Phase 4 — Lobbyist node selection routes to LobbyistDetail. */
  if (node && node.kind === "lobbyist") {
    return (
      <LobbyistDetail
        drawerRef={drawerRef}
        node={node}
        onClose={onClose}
        onOpenNode={onOpenNode || (() => {})}
      />
    );
  }

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
          {/* v2 Phase 3 — donor badge in supplier head when this supplier
              is also on the top-25 donor list. Editorial signal that this
              firm both held government contracts and donated to a party. */}
          {node.kind === "supplier" && node.isDonor && (
            <div
              className="mm-d-donor-badge"
              style={{
                marginTop: 8,
                padding: "6px 10px",
                fontSize: 11.5,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${PARTY_DEFS[node.dominantPartyId]?.color || "#94a3b8"}55`,
                borderLeft: `3px solid ${PARTY_DEFS[node.dominantPartyId]?.color || "#94a3b8"}`,
                color: PARTY_DEFS[node.dominantPartyId]?.color || "#94a3b8",
                fontFamily: "var(--mm-mono)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Donor · {fmtGBP(node.donorTotalGBP)} declared political giving
            </div>
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

          {/* v2 Phase 3 — Political giving section, only when this supplier
              is also on the donor list. Lists per-party totals, donation
              counts, and links across to each party's drawer. The supplier
              bubble + donor profile collapse to one node by design — this
              section makes the dual status legible without a second drawer. */}
          {node.kind === "supplier" && node.isDonor && (
            <>
              <div className="mm-d-section-h">Political giving</div>
              <div style={{ fontSize: 15, color: "#9ca3af", marginBottom: 8, lineHeight: 1.55 }}>
                This tracked supplier also appears on the political-donor record (Electoral Commission).
                Total declared giving:{" "}
                <b style={{ color: "#e5e7eb" }}>{fmtGBP(node.donorTotalGBP)}</b>
                {" "}across {node.donationCount} donation{node.donationCount === 1 ? "" : "s"}
                {node.donorFirstDate && node.donorLastDate
                  ? <> &middot; first donation {fmtDate(node.donorFirstDate)}, most recent {fmtDate(node.donorLastDate)}</>
                  : null}
                .
              </div>
              <div className="mm-donor-recipients">
                {(node.donorParties || []).map((p) => {
                  const def = PARTY_DEFS[p.partyId];
                  return (
                    <button
                      key={p.partyId}
                      type="button"
                      className="mm-donor-recipient"
                      onClick={() => onOpenNode("party:" + p.partyId)}
                      aria-label={`Open party profile for ${def?.label || p.partyId}`}
                      style={{ borderLeft: `3px solid ${def?.color || "#777"}` }}
                    >
                      <span className="mm-donor-recipient-name">{def?.label || p.partyId}</span>
                      <span className="mm-donor-recipient-amt">{fmtGBP(p.totalGBP)}</span>
                      <span className="mm-donor-recipient-count">
                        {p.donationCount} donation{p.donationCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mm-d-section-h">Relationships · sorted by £</div>
          {incoming.length === 0 && (
            <div style={{ fontSize: 15, color: "#6b7280" }}>
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
          <div style={{ fontSize: 15, color: "#e5e7eb", lineHeight: 1.55 }}>
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
            <div style={{ fontSize: 15, color: "#6b7280" }}>
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
        font-size: 15px; line-height: 1.55; color: var(--mm-fg-dim);
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
        font-size: 13px; color: var(--mm-fg);
        max-width: 460px;
      }
      .mm-focus-pill-label {
        font-family: var(--mm-mono); font-size: 10px;
        color: var(--mm-fg-mute); text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .mm-focus-pill-name {
        font-family: var(--mm-serif); font-size: 15px;
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
        color: var(--mm-fg); font-family: var(--mm-sans); font-size: 15px;
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
        color: var(--mm-fg-dim); font-size: 13px; cursor: pointer;
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
        font-family: var(--mm-serif); font-size: 19px;
        line-height: 1.3; margin: 7px 0 8px; color: #f4f4f5;
      }
      .mm-card-metric {
        font-family: var(--mm-mono); font-size: 12px; color: var(--mm-fg-dim);
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
        padding: 5px 0; font-size: 13px; color: var(--mm-fg-dim);
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
        font-size: 13px;
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
        font-size: 22px; margin: 0 0 14px; color: #f4f4f5;
      }
      .mm-rank-row {
        display: grid; grid-template-columns: 28px 1fr auto auto;
        gap: 14px; align-items: baseline;
        padding: 11px 0; border-bottom: 1px dashed var(--mm-border);
        font-size: 15px; cursor: pointer;
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
        font-size: 17px; color: var(--mm-fg-dim); line-height: 1.55;
        max-width: 820px; margin: 0 0 18px 0;
      }
      .mm-feature-empty {
        font-size: 15px; color: var(--mm-fg-mute); padding: 14px 0;
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
        color: var(--mm-fg); font-size: 15px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .mm-ro-score {
        font-family: var(--mm-mono); font-size: 16px; font-weight: 500;
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
        font-size: 15px; line-height: 1.55; color: var(--mm-fg-dim); background: #0a0a0e;
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
        font-family: var(--mm-serif); font-size: 28px;
        color: #f4f4f5; margin: 2px 0 8px;
        letter-spacing: -0.01em; line-height: 1.1;
      }
      .mm-entity-sub {
        font-family: var(--mm-mono); font-size: 13px; color: var(--mm-fg-mute);
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

      /* v2 Phase 1 — PersonDetail drawer styles */
      .mm-drawer-person .mm-d-head {
        border-left: 2px solid #fbbf24;
        padding-left: 14px;
      }
      .mm-person-roles {
        display: flex; flex-direction: column; gap: 6px;
      }
      .mm-person-role-row {
        padding: 8px 10px;
        background: #0a0a0d;
        border: 1px solid var(--mm-border);
        border-radius: 4px;
      }
      .mm-person-role-title {
        font-size: 15px; color: var(--mm-fg);
      }
      .mm-person-role-meta {
        margin-top: 2px;
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute);
      }
      .mm-person-role-period {
        margin-left: 8px; opacity: 0.85;
      }
      .mm-person-links {
        list-style: none; padding: 0; margin: 0;
        display: flex; flex-direction: column; gap: 6px;
      }
      .mm-person-links a {
        font-size: 13px; color: #fbbf24; text-decoration: none;
        display: inline-flex; align-items: center;
      }
      .mm-person-links a:hover { text-decoration: underline; }

      /* v2 Phase 2 — PartyDetail drawer + Stories party-badge */
      .mm-drawer-party .mm-d-head {
        /* per-party accent applied inline via --mm-party-accent */
      }
      .mm-party-people {
        display: flex; flex-direction: column; gap: 8px;
      }
      .mm-party-person-row {
        padding: 9px 11px;
        background: #0a0a0d;
        border: 1px solid var(--mm-border);
        border-radius: 4px;
      }
      .mm-party-person-name {
        font-size: 15px; color: var(--mm-fg); font-weight: 500;
      }
      .mm-party-person-headline {
        margin-top: 3px;
        font-size: 13px; color: var(--mm-fg-mute); line-height: 1.45;
      }
      .mm-party-person-link {
        display: inline-block; margin-top: 6px;
        font-family: var(--mm-mono); font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: var(--mm-party-accent, #fbbf24);
        background: transparent;
        border: 1px dashed rgba(255,255,255,0.18);
        border-radius: 999px;
        padding: 3px 9px;
        cursor: pointer;
      }
      .mm-party-person-link:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.4);
      }
      .mm-party-types {
        display: flex; flex-direction: column; gap: 4px;
      }
      .mm-party-type-row {
        display: flex; align-items: baseline; gap: 10px;
        padding: 6px 0;
        border-bottom: 1px dotted var(--mm-border);
      }
      .mm-party-type-count {
        font-family: var(--mm-mono); font-size: 15px;
        color: #f4f4f5; min-width: 24px;
      }
      .mm-party-type-label {
        font-family: var(--mm-mono); font-size: 11px;
        color: var(--mm-fg-mute); letter-spacing: 0.08em;
      }
      .mm-party-live {
        display: flex; flex-direction: column; gap: 5px;
      }
      .mm-party-live-row {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 9px;
        background: rgba(220,38,38,0.06);
        border: 1px solid rgba(220,38,38,0.25);
        color: #fca5a5;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        text-align: left;
      }
      .mm-party-live-row:hover {
        background: rgba(220,38,38,0.12);
        border-color: rgba(220,38,38,0.45);
      }
      .mm-party-foot {
        margin-top: 18px;
        padding: 10px 12px;
        font-size: 13px; color: var(--mm-fg-mute);
        background: rgba(255,255,255,0.02);
        border: 1px dashed var(--mm-border);
        border-radius: 4px;
        line-height: 1.5;
      }

      /* v2 Phase 3 — DonorDetail drawer + supplier-overlay treatment */
      .mm-drawer-donor .mm-d-head {
        /* per-donor accent applied inline via --mm-donor-accent */
      }
      .mm-donor-recipients {
        display: flex; flex-direction: column; gap: 6px;
      }
      .mm-donor-recipient {
        display: grid;
        grid-template-columns: 1fr auto;
        column-gap: 14px;
        padding: 9px 11px;
        background: #0a0a0d;
        border: 1px solid var(--mm-border);
        border-left: 3px solid #777;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
      }
      .mm-donor-recipient:hover {
        background: rgba(255,255,255,0.04);
        border-color: var(--mm-border-2);
      }
      .mm-donor-recipient-name {
        font-size: 15px; color: var(--mm-fg);
      }
      .mm-donor-recipient-amt {
        font-family: var(--mm-mono);
        font-size: 15px; color: #f4f4f5; font-weight: 500;
        text-align: right;
      }
      .mm-donor-recipient-count {
        grid-column: 1 / -1;
        margin-top: 3px;
        font-family: var(--mm-mono);
        font-size: 10.5px; color: var(--mm-fg-mute);
        letter-spacing: 0.04em;
      }
      .mm-donor-contracts-empty {
        padding: 10px 12px;
        font-size: 15px; color: var(--mm-fg-dim);
        background: rgba(255,255,255,0.02);
        border-left: 2px solid var(--mm-border-2);
        line-height: 1.55;
      }
      .mm-donor-foot {
        margin-top: 18px;
        padding: 10px 12px;
        font-size: 13px; color: var(--mm-fg-mute);
        background: rgba(255,255,255,0.02);
        border: 1px dashed var(--mm-border);
        border-radius: 4px;
        line-height: 1.5;
      }

      /* Stories card party badge — small dot + letter that opens PartyDetail. */
      .mm-story-eyebrow-row,
      .mm-story-strip-eyebrow-row {
        display: flex; align-items: center; gap: 8px;
        flex-wrap: wrap;
      }
      .mm-story-party-badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 6px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 999px;
        cursor: pointer;
        font-family: var(--mm-mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.75);
        line-height: 1;
      }
      .mm-story-party-badge:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.25);
      }
      .mm-story-party-dot {
        width: 7px; height: 7px; border-radius: 50%;
        display: inline-block;
      }
      .mm-story-party-letter {
        text-transform: uppercase;
      }

      /* FIRM pill badge — sits inline next to the serif name on Stories
         cards when the subject of the story is a company rather than an
         individual political figure. Mirrors the party-dot/live-proceedings
         convention so readers can scan the surface and instantly tell whether
         a card is about a person or a firm. */
      .mm-story-kind-pill {
        display: inline-block;
        margin-left: 8px;
        padding: 2px 6px;
        background: rgba(125, 211, 252, 0.10);
        border: 1px solid rgba(125, 211, 252, 0.35);
        border-radius: 4px;
        color: #7dd3fc;
        font-family: var(--mm-mono);
        font-size: 10px;
        letter-spacing: 0.12em;
        line-height: 1;
        text-transform: uppercase;
        vertical-align: middle;
        font-weight: 600;
      }

      /* Per-card "View person profile" link surfaced inside Stories cards */
      .mm-story-person-link {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 6px;
        font-family: var(--mm-mono); font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: #fbbf24; background: transparent;
        border: 1px dashed rgba(251,191,36,0.35);
        border-radius: 999px;
        padding: 3px 9px;
        cursor: pointer;
      }
      .mm-story-person-link:hover {
        background: rgba(251,191,36,0.08);
        border-color: rgba(251,191,36,0.6);
      }

      .mm-score-row {
        display: grid; grid-template-columns: 1fr auto;
        padding: 11px 0; border-bottom: 1px solid var(--mm-border);
        align-items: baseline;
      }
      .mm-score-k { font-size: 15px; color: var(--mm-fg); }
      .mm-score-v {
        font-family: var(--mm-mono); font-size: 15px;
        color: #f4f4f5; font-weight: 500;
      }
      .mm-score-hint {
        font-size: 13px; color: var(--mm-fg-mute);
        grid-column: 1 / -1; margin-top: 3px; line-height: 1.45;
      }
      .mm-edge-item {
        padding: 13px 0; border-bottom: 1px solid var(--mm-border);
        display: grid; grid-template-columns: 1fr auto; gap: 4px 10px;
      }
      .mm-edge-title { font-size: 15px; color: var(--mm-fg); }
      .mm-edge-amount {
        font-family: var(--mm-mono); font-size: 15px;
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
        font-size: 15px; color: var(--mm-fg-dim); line-height: 1.55;
      }
      .mm-why-undisclosed-body ul {
        margin: 6px 0 0 0; padding-left: 18px;
      }
      .mm-why-undisclosed-body li { margin: 3px 0; }
      .mm-why-undisclosed-foot {
        margin-top: 8px; font-size: 12px; color: var(--mm-fg-mute);
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
        font-family: var(--mm-sans); font-size: 13px; font-weight: 500;
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

      /* ============================================================
         Layers panel — task #115 (2026-04-26).
         Floating panel top-right of the canvas; hidden on mobile
         (mobile renders the same control as a section inside the
         Filters bottom sheet via .mm-layers-section).
         ============================================================ */
      .mm-layers-panel {
        position: absolute;
        top: 56px;            /* sits below the PNG export button */
        right: 14px;
        width: 240px;
        z-index: 4;
        background: rgba(11, 12, 16, 0.92);
        border: 1px solid var(--mm-border);
        border-radius: 12px;
        padding: 14px;
        backdrop-filter: blur(8px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        font-family: var(--mm-mono);
        color: var(--mm-fg-dim);
      }
      /* Mobile hide for the desktop floating variant. The mobile
         experience uses the .mm-layers-section variant inside the
         Filters bottom sheet instead. */
      @media (max-width: 767px) {
        .mm-layers-panel-desktop { display: none; }
      }
      .mm-layers-section {
        font-family: var(--mm-mono);
        color: var(--mm-fg-dim);
      }
      .mm-layers-head {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--mm-border);
      }
      .mm-layers-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--mm-fg-mute);
      }
      .mm-layers-reset {
        background: none;
        border: none;
        color: #93c5fd;
        font-family: var(--mm-mono);
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        cursor: pointer;
        padding: 0;
      }
      .mm-layers-reset:hover { color: #bfdbfe; text-decoration: underline; }
      .mm-layers-reset:focus-visible {
        outline: 2px solid #93c5fd;
        outline-offset: 2px;
      }
      /* 2026-04-26 (task #118) — Base-only / Show-all preset toggle.
         Compact mono uppercase pills, one tone darker than the panel
         background; active state lifts to the existing amber accent
         used elsewhere on the surface so the highlit pill reads as
         "you are here". */
      .mm-layers-presets {
        display: inline-flex;
        gap: 0;
        background: rgba(0,0,0,0.35);
        border: 1px solid var(--mm-border);
        border-radius: 4px;
        overflow: hidden;
      }
      .mm-layers-preset {
        background: transparent;
        border: none;
        color: var(--mm-fg-mute);
        font-family: var(--mm-mono);
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 3px 7px;
        cursor: pointer;
        line-height: 1.2;
      }
      .mm-layers-preset + .mm-layers-preset {
        border-left: 1px solid var(--mm-border);
      }
      .mm-layers-preset:hover { color: #fbbf24; }
      .mm-layers-preset-active {
        background: rgba(251,191,36,0.16);
        color: #fbbf24;
      }
      .mm-layers-preset:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: -2px;
      }
      .mm-layers-body {
        display: flex; flex-direction: column; gap: 2px;
      }
      .mm-layers-row {
        display: flex; align-items: center; gap: 8px;
        padding: 4px 2px;
        font-size: 12px;
        color: var(--mm-fg);
        cursor: pointer;
        border-radius: 4px;
      }
      .mm-layers-row:hover { background: rgba(255,255,255,0.03); }
      .mm-layers-checkbox {
        appearance: none;
        width: 13px; height: 13px;
        border: 1px solid var(--mm-border-2);
        border-radius: 3px;
        background: rgba(0,0,0,0.4);
        cursor: pointer;
        position: relative;
        flex-shrink: 0;
      }
      .mm-layers-checkbox:checked {
        background: #3b82f6;
        border-color: #3b82f6;
      }
      .mm-layers-checkbox:checked::after {
        content: '';
        position: absolute;
        left: 3px; top: 0px;
        width: 4px; height: 8px;
        border: solid #fff;
        border-width: 0 1.5px 1.5px 0;
        transform: rotate(45deg);
      }
      .mm-layers-checkbox:focus-visible {
        outline: 2px solid #93c5fd; outline-offset: 1px;
      }
      .mm-layers-swatch {
        display: inline-flex;
        align-items: center; justify-content: center;
        width: 22px; flex-shrink: 0;
      }
      .mm-layers-label {
        flex: 1; min-width: 0;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mm-layers-count {
        font-variant-numeric: tabular-nums;
        font-size: 10.5px;
        color: var(--mm-fg-mute);
        flex-shrink: 0;
      }
      .mm-layers-divider {
        height: 1px;
        margin: 6px 0;
        background: var(--mm-border);
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
        font-family: var(--mm-serif); font-size: 19px;
        color: #f4f4f5; line-height: 1.45; margin: 0 0 16px;
      }
      .mm-canvas-empty-actions {
        display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
      }
      .mm-canvas-empty-btn {
        background: #15151c;
        border: 1px solid var(--mm-border-2);
        color: var(--mm-fg);
        font-family: var(--mm-sans); font-size: 13px;
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
        font-size: 12.5px; padding: 4px 8px; border-radius: 4px;
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
          font-size: 15px;
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
      /* Task #100 — desktop-only layout toggle. Canvas is not a mobile
         experience (d3-force on 375px is hostile) so we hide the whole
         toggle on mobile and route readers to the tabbed explorer. */
      @media (max-width: 767px) {
        .mm-filters-layout-desktop { display: none; }
      }
      /* The legacy MoneyMapMobileList is still used as the fallback on
         desktop when a user manually flips to list mode. On mobile the
         new explorer supersedes it. */
      @media (max-width: 767px) {
        .mm-explorer-desktop-fallback { display: none; }
      }

      /* ----------------------------------------------------
         Task #100 — mobile 3-tab Explorer
         ---------------------------------------------------- */
      .mm-explorer {
        max-width: 1440px; margin: 0 auto;
        background: var(--mm-bg);
      }
      .mm-explorer-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px;
        padding: 12px 16px 10px;
        border-bottom: 1px solid var(--mm-border);
      }
      .mm-explorer-title {
        font-family: var(--mm-mono);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--mm-fg-mute);
      }
      .mm-filters-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 12px; min-height: 40px;
        background: var(--mm-bg-2); border: 1px solid var(--mm-border-2);
        border-radius: 999px;
        color: var(--mm-fg); font-size: 15px;
        font-family: var(--mm-sans);
        cursor: pointer;
        transition: border-color 120ms, background 120ms;
      }
      .mm-filters-btn:hover,
      .mm-filters-btn:focus-visible {
        border-color: #4a4a56;
        background: #15151c;
      }
      .mm-filters-btn:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 2px;
      }
      .mm-filters-badge {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 5px;
        border-radius: 999px;
        background: #fbbf24; color: #111;
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
      }
      .mm-tabbar {
        display: flex; align-items: stretch;
        border-bottom: 1px solid var(--mm-border);
        background: rgba(6,6,8,0.96);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        position: sticky;
        top: 0;
        z-index: 30;
      }
      .mm-tab {
        flex: 1 1 0;
        min-height: 48px;
        background: transparent;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--mm-fg-dim);
        font-family: var(--mm-sans);
        font-size: 15px;
        font-weight: 500;
        letter-spacing: 0.01em;
        cursor: pointer;
        transition: color 120ms, border-color 120ms;
      }
      .mm-tab:hover { color: var(--mm-fg); }
      .mm-tab-active {
        color: var(--mm-fg);
        border-bottom-color: #fbbf24;
        font-weight: 600;
      }
      .mm-tab:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: -2px;
      }

      .mm-explorer-list {
        padding: 8px 0 28px;
      }
      .mm-explorer-empty {
        padding: 40px 20px;
        color: var(--mm-fg-dim);
        font-size: 15px;
        text-align: center;
      }

      /* Flows tab — cards */
      .mm-flow-card {
        display: block; width: 100%;
        text-align: left;
        padding: 12px 16px;
        min-height: 72px;
        background: transparent;
        border: 0;
        border-bottom: 1px solid var(--mm-border);
        color: inherit;
        cursor: pointer;
        transition: background-color 120ms;
      }
      .mm-flow-card:hover,
      .mm-flow-card:focus-visible {
        background: rgba(251, 191, 36, 0.04);
      }
      .mm-flow-card:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: -2px;
      }
      .mm-flow-card-main {
        display: flex; align-items: baseline; flex-wrap: wrap;
        gap: 6px;
        line-height: 1.35;
      }
      .mm-flow-dept {
        font-family: var(--mm-mono);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--mm-fg-mute);
      }
      .mm-flow-arrow {
        color: var(--mm-fg-mute);
        font-size: 15px;
        margin: 0 2px;
      }
      .mm-flow-supplier {
        font-size: 19px;
        font-weight: 600;
        color: var(--mm-fg);
      }
      .mm-flow-card-meta {
        margin-top: 4px;
        display: flex; align-items: baseline; flex-wrap: wrap;
        gap: 4px;
        font-size: 15px;
        color: #9ca3af;
      }
      .mm-flow-amt {
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        color: var(--mm-fg);
        font-weight: 500;
      }
      .mm-flow-sep { color: var(--mm-fg-mute); }
      .mm-flow-card-tag {
        margin-top: 6px;
        display: inline-block;
        font-family: var(--mm-mono);
        font-size: 10.5px;
        color: var(--mm-fg-mute);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 3px 7px;
        border: 1px solid var(--mm-border);
        border-radius: 3px;
      }

      /* Departments + Suppliers — shared card chassis */
      .mm-dept-card,
      .mm-supp-card {
        display: block;
        padding: 14px 16px;
        min-height: 96px;
        border-bottom: 1px solid var(--mm-border);
        cursor: pointer;
        transition: background-color 120ms;
      }
      .mm-dept-card:hover,
      .mm-dept-card:focus-visible,
      .mm-supp-card:hover,
      .mm-supp-card:focus-visible {
        background: rgba(251, 191, 36, 0.04);
      }
      .mm-dept-card:focus-visible,
      .mm-supp-card:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: -2px;
      }
      .mm-dept-card-top,
      .mm-supp-card-top {
        display: flex; align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .mm-dept-name,
      .mm-supp-name {
        font-size: 19px;
        font-weight: 600;
        color: var(--mm-fg);
        line-height: 1.3;
      }
      .mm-dept-amt,
      .mm-supp-amt {
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        font-size: 17px;
        color: var(--mm-fg);
        white-space: nowrap;
        font-weight: 500;
      }
      .mm-dept-card-sub,
      .mm-supp-card-sub {
        margin-top: 4px;
        font-size: 15px;
        color: #9ca3af;
        line-height: 1.45;
      }

      /* Inline supplier / buyer chips inside cards */
      .mm-dept-chips,
      .mm-supp-chips {
        margin-top: 10px;
        display: flex; flex-wrap: wrap; gap: 6px;
      }
      .mm-inline-chip {
        display: inline-flex; align-items: baseline; gap: 6px;
        padding: 5px 10px;
        border: 1px solid var(--mm-border-2);
        border-radius: 999px;
        background: #0b0b0f;
        color: var(--mm-fg);
        font-size: 13px;
        font-family: var(--mm-sans);
        cursor: pointer;
        max-width: 100%;
        transition: border-color 120ms, background 120ms;
      }
      .mm-inline-chip:hover,
      .mm-inline-chip:focus-visible {
        border-color: #4a4a56;
        background: #15151c;
      }
      .mm-inline-chip:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 1px;
      }
      .mm-inline-chip-more {
        color: var(--mm-fg-mute);
        cursor: default;
      }
      .mm-chip-name {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 180px;
      }
      .mm-chip-amt {
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        color: var(--mm-fg-dim);
        font-size: 11.5px;
      }

      /* Supplier dependency indicator */
      .mm-supp-dep {
        margin-top: 10px;
        display: flex; align-items: center; gap: 7px;
        font-size: 13px;
      }
      .mm-supp-dep-dot {
        display: inline-block;
        width: 8px; height: 8px; border-radius: 50%;
      }
      .mm-supp-dep-hot { color: #fca5a5; }
      .mm-supp-dep-hot .mm-supp-dep-dot {
        background: #ef4444;
        box-shadow: 0 0 6px rgba(239,68,68,0.6);
      }
      .mm-supp-dep-cool { color: var(--mm-fg-mute); }
      .mm-supp-dep-cool .mm-supp-dep-dot {
        background: #4a4a56;
      }

      /* ----------------------------------------------------
         Task #100 — filter bottom sheet
         ---------------------------------------------------- */
      .mm-sheet-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        z-index: 49;
      }
      .mm-sheet {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        max-height: 80vh;
        overflow-y: auto;
        background: var(--mm-panel);
        border-top: 1px solid var(--mm-border);
        border-radius: 16px 16px 0 0;
        box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
        padding: 8px 0 0;
        z-index: 50;
        color: var(--mm-fg);
      }
      .mm-sheet-handle {
        width: 40px; height: 4px;
        margin: 4px auto 10px;
        border-radius: 2px;
        background: var(--mm-border-2);
      }
      .mm-sheet-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 18px 10px;
        border-bottom: 1px solid var(--mm-border);
      }
      .mm-sheet-title {
        font-family: var(--mm-serif);
        font-size: 20px;
        color: var(--mm-fg);
      }
      .mm-sheet-close {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 36px;
        background: transparent;
        border: 1px solid var(--mm-border);
        border-radius: 999px;
        color: var(--mm-fg-dim);
        cursor: pointer;
      }
      .mm-sheet-close:hover,
      .mm-sheet-close:focus-visible {
        color: var(--mm-fg); border-color: var(--mm-border-2);
      }
      .mm-sheet-body {
        padding: 14px 18px 8px;
      }
      .mm-sheet-group { margin-bottom: 18px; }
      .mm-sheet-label {
        display: block;
        font-family: var(--mm-mono);
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--mm-fg-mute);
        margin-bottom: 8px;
      }
      .mm-sheet-search-wrap {
        position: relative;
        display: flex; align-items: center;
      }
      .mm-sheet-search {
        flex: 1 1 auto;
        width: 100%;
        min-height: 44px;
        padding: 10px 36px 10px 12px;
        background: var(--mm-bg-2);
        border: 1px solid var(--mm-border-2);
        border-radius: 8px;
        color: var(--mm-fg);
        font-size: 15px;
        font-family: var(--mm-sans);
      }
      .mm-sheet-search:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 1px;
        border-color: #4a4a56;
      }
      .mm-sheet-search-clear {
        position: absolute;
        right: 6px; top: 50%;
        transform: translateY(-50%);
        background: transparent; border: 0;
        color: var(--mm-fg-mute);
        font-size: 18px;
        width: 28px; height: 28px;
        cursor: pointer;
      }
      .mm-sheet-row {
        display: flex; flex-wrap: wrap; gap: 8px;
      }
      .mm-sheet-chip {
        display: inline-flex; align-items: center;
        padding: 8px 14px;
        min-height: 40px;
        background: var(--mm-bg-2);
        border: 1px solid var(--mm-border-2);
        border-radius: 999px;
        color: var(--mm-fg-dim);
        font-size: 15px;
        font-family: var(--mm-sans);
        cursor: pointer;
        font-variant-numeric: tabular-nums;
        transition: all 120ms;
      }
      .mm-sheet-chip:hover,
      .mm-sheet-chip:focus-visible {
        border-color: #4a4a56;
        color: var(--mm-fg);
      }
      .mm-sheet-chip:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 1px;
      }
      .mm-sheet-chip-active {
        background: #15151c;
        border-color: #fbbf24;
        color: var(--mm-fg);
      }
      .mm-sheet-lens {
        display: flex; align-items: center; gap: 10px;
        flex-wrap: wrap;
      }
      .mm-sheet-lens-name {
        font-family: var(--mm-serif);
        font-size: 16px;
        color: var(--mm-fg);
      }
      .mm-sheet-foot {
        position: sticky; bottom: 0;
        padding: 12px 18px 16px;
        background: var(--mm-panel);
        border-top: 1px solid var(--mm-border);
      }
      .mm-sheet-apply {
        width: 100%;
        min-height: 44px;
        background: #fbbf24;
        border: 0;
        border-radius: 8px;
        color: #111;
        font-family: var(--mm-sans);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
      }
      .mm-sheet-apply:hover,
      .mm-sheet-apply:focus-visible {
        background: #fcd34d;
      }
      .mm-sheet-apply:focus-visible {
        outline: 2px solid #111;
        outline-offset: 2px;
      }
      .mm-mobile-list {
        padding: 12px 8px 20px;
      }
      .mm-mobile-list-empty {
        padding: 32px 16px;
        color: var(--mm-fg-dim);
        font-size: 15px;
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
        font-size: 17px;
        font-weight: 600;
        color: var(--mm-fg);
        line-height: 1.25;
      }
      .mm-mobile-list-amount {
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        font-size: 17px;
        color: var(--mm-fg);
        white-space: nowrap;
      }
      .mm-mobile-list-sub {
        margin-top: 4px;
        font-size: 15px;
        color: #9ca3af;
        line-height: 1.45;
      }

      /* ----------------------------------------------------
         Task #104 — Stories tab (editorial-weight cards)
         ---------------------------------------------------- */
      .mm-story-list {
        padding: 0 0 28px;
        background:
          radial-gradient(1200px 400px at 10% -10%, rgba(251, 191, 36, 0.04), transparent 60%),
          var(--mm-bg);
      }
      .mm-story-card-wrap {
        padding: 14px 14px 0;
      }
      .mm-story-card-wrap:last-of-type { padding-bottom: 6px; }
      .mm-story-card {
        display: block; width: 100%;
        text-align: left;
        background: linear-gradient(180deg, #0a0a0f 0%, #060608 100%);
        border: 1px solid var(--mm-border-2);
        border-radius: 12px;
        padding: 0;
        color: inherit;
        cursor: pointer;
        min-height: 60vh;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.02);
        transition: border-color 140ms, transform 140ms;
      }
      .mm-story-card:hover {
        border-color: #3a3a46;
      }
      .mm-story-card:active {
        transform: translateY(1px);
      }
      .mm-story-card:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 2px;
      }
      .mm-story-card-inert { cursor: default; }
      .mm-story-card-inert:active { transform: none; }

      .mm-story-live {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 16px;
        background: rgba(251, 191, 36, 0.10);
        border-bottom: 1px solid rgba(251, 191, 36, 0.25);
        color: #fbbf24;
        font-family: var(--mm-mono);
        font-size: 10.5px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-weight: 600;
      }
      .mm-story-body {
        padding: 22px 20px 24px;
      }
      .mm-story-eyebrow {
        font-family: var(--mm-mono);
        font-size: 10.5px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--mm-fg-mute);
        margin-bottom: 14px;
      }
      .mm-story-name {
        font-family: var(--mm-serif);
        font-size: 32px;
        line-height: 1.1;
        font-weight: 500;
        color: #f8fafc;
        margin: 0 0 14px;
        letter-spacing: -0.005em;
      }
      .mm-story-summary {
        font-size: 17px;
        line-height: 1.6;
        color: #d8dbe3;
        margin: 0 0 18px;
      }
      .mm-story-quote {
        margin: 0 0 18px;
        padding: 12px 14px;
        border-left: 3px solid #fbbf24;
        background: rgba(251, 191, 36, 0.05);
        border-radius: 0 6px 6px 0;
      }
      .mm-story-quote-text {
        font-family: var(--mm-serif);
        font-size: 17px;
        line-height: 1.5;
        color: #e5e7eb;
        font-style: italic;
        margin: 0 0 6px;
      }
      .mm-story-quote-cite {
        display: block;
        font-family: var(--mm-mono);
        font-size: 11px;
        color: #9ca3af;
        letter-spacing: 0.04em;
        font-style: normal;
      }
      .mm-story-figures {
        margin: 0 0 16px;
        padding: 10px 12px;
        background: rgba(0,0,0,0.35);
        border: 1px solid var(--mm-border);
        border-radius: 6px;
      }
      .mm-story-fig-row {
        display: flex; align-items: baseline; gap: 10px;
        font-size: 13px;
        line-height: 1.55;
      }
      .mm-story-fig-row + .mm-story-fig-row { margin-top: 2px; }
      .mm-story-fig-row dt {
        font-family: var(--mm-mono);
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--mm-fg-mute);
        min-width: 64px;
      }
      .mm-story-fig-row dd {
        margin: 0;
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        color: #d8dbe3;
      }
      .mm-story-cp-row {
        margin: 0 0 18px;
      }
      .mm-story-cp-pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 14px 8px 12px;
        min-height: 40px;
        max-width: 100%;
        background: #0f0f15;
        border: 1px solid #3a3a46;
        border-radius: 999px;
        color: var(--mm-fg);
        font-size: 15px;
        font-family: var(--mm-sans);
        cursor: pointer;
        transition: border-color 120ms, background 120ms;
      }
      .mm-story-cp-pill:hover {
        border-color: #fbbf24;
        background: #15151c;
      }
      .mm-story-cp-pill:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 2px;
      }
      .mm-story-cp-pill-inert { cursor: default; }
      .mm-story-cp-arrow {
        color: #fbbf24;
        font-weight: 600;
      }
      .mm-story-cp-name {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 240px;
      }
      .mm-story-sources {
        display: flex; flex-wrap: wrap; gap: 6px;
        padding-top: 14px;
        border-top: 1px solid var(--mm-border);
      }
      .mm-story-src {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid var(--mm-border-2);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family: var(--mm-sans);
        font-weight: 500;
        text-decoration: none;
        transition: background 120ms, border-color 120ms;
      }
      .mm-story-src-primary {
        border-color: rgba(16, 185, 129, 0.4);
        background: rgba(16, 185, 129, 0.06);
        color: #6ee7b7;
      }
      .mm-story-src-primary:hover {
        background: rgba(16, 185, 129, 0.12);
      }
      .mm-story-src-news {
        border-color: var(--mm-border-2);
        background: rgba(255,255,255,0.02);
        color: #d1d5db;
      }
      .mm-story-src-news:hover {
        background: rgba(255,255,255,0.06);
      }
      .mm-story-src-analysis {
        border-color: rgba(167, 139, 250, 0.35);
        background: rgba(167, 139, 250, 0.05);
        color: #c4b5fd;
      }
      .mm-story-src-analysis:hover {
        background: rgba(167, 139, 250, 0.12);
      }
      .mm-story-src:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 1px;
      }

      .mm-story-footer {
        margin-top: 20px;
        padding: 10px 16px;
        text-align: center;
        font-family: var(--mm-mono);
        font-size: 11px;
        letter-spacing: 0.08em;
        color: var(--mm-fg-mute);
      }

      /* Story discovery badge on Suppliers + Departments cards */
      .mm-story-badge {
        display: inline-flex; align-items: center; gap: 5px;
        margin-top: 8px;
        padding: 3px 8px;
        border: 1px solid rgba(251, 191, 36, 0.35);
        background: rgba(251, 191, 36, 0.06);
        border-radius: 999px;
        color: #fbbf24;
        font-family: var(--mm-mono);
        font-size: 10.5px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 500;
      }

      /* =========================================================
         Desktop Stories strip — horizontal scroll above the canvas
         ========================================================= */
      .mm-story-strip-wrap {
        padding: 18px 0 10px 0;
        border-bottom: 1px solid var(--mm-border);
        margin-bottom: 12px;
      }
      .mm-story-strip-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 0 4px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .mm-story-strip-eyebrow {
        font-family: var(--mm-mono);
        font-size: 10.5px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #e5e7eb;
      }
      .mm-story-strip-count {
        font-family: var(--mm-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        color: var(--mm-fg-mute);
      }
      .mm-story-strip-scroll {
        display: flex;
        gap: 14px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scroll-padding-left: 4px;
        padding: 4px 4px 12px 4px;
        scrollbar-width: thin;
      }
      .mm-story-strip-scroll::-webkit-scrollbar {
        height: 6px;
      }
      .mm-story-strip-scroll::-webkit-scrollbar-thumb {
        background: var(--mm-border);
        border-radius: 3px;
      }
      .mm-story-strip-card {
        flex: 0 0 360px;
        scroll-snap-align: start;
        min-height: 260px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px;
        border: 1px solid var(--mm-border);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(20,22,28,0.85), rgba(11,12,16,0.92));
        color: inherit;
        text-align: left;
        font: inherit;
        cursor: pointer;
        transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
      }
      .mm-story-strip-card:hover {
        border-color: rgba(251, 191, 36, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      }
      .mm-story-strip-card:focus-visible {
        outline: 2px solid #fbbf24;
        outline-offset: 2px;
      }
      .mm-story-strip-card-inert {
        cursor: default;
      }
      .mm-story-strip-card-inert:hover {
        transform: none;
        box-shadow: none;
        border-color: var(--mm-border);
      }
      .mm-story-strip-live {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border: 1px solid rgba(245, 158, 11, 0.5);
        background: rgba(245, 158, 11, 0.08);
        color: #fbbf24;
        border-radius: 4px;
        font-family: var(--mm-mono);
        font-size: 10px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        width: fit-content;
      }
      .mm-story-strip-eyebrow-card {
        font-family: var(--mm-mono);
        font-size: 10px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--mm-fg-mute);
      }
      .mm-story-strip-name {
        font-family: var(--mm-serif);
        font-size: 24px;
        font-weight: 500;
        color: #fff;
        letter-spacing: -0.01em;
        line-height: 1.1;
        margin: 0;
      }
      .mm-story-strip-summary {
        font-size: 15px;
        line-height: 1.55;
        color: #d8dbe3;
        margin: 0;
      }
      .mm-story-strip-quote {
        font-family: var(--mm-serif);
        font-style: italic;
        font-size: 15px;
        color: #fcd34d;
        line-height: 1.45;
        border-left: 2px solid rgba(251, 191, 36, 0.5);
        padding-left: 10px;
        margin: 0;
      }
      .mm-story-strip-quote-cite {
        display: block;
        font-family: var(--mm-mono);
        font-style: normal;
        font-size: 10px;
        color: var(--mm-fg-mute);
        letter-spacing: 0.06em;
        margin-top: 4px;
      }
      .mm-story-strip-figures {
        font-family: var(--mm-mono);
        font-variant-numeric: tabular-nums;
        font-size: 13px;
        color: #cbd5e1;
      }
      .mm-story-strip-cp {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid var(--mm-border);
        border-radius: 100px;
        font-size: 13px;
        color: #e2e8f0;
        background: rgba(255,255,255,0.02);
        width: fit-content;
      }
      .mm-story-strip-card:hover .mm-story-strip-cp {
        border-color: rgba(251, 191, 36, 0.4);
        color: #fbbf24;
      }
      .mm-story-strip-sources {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: auto;
        padding-top: 10px;
        border-top: 1px solid var(--mm-border);
      }
      .mm-story-strip-endcap {
        flex: 0 0 220px;
        scroll-snap-align: end;
        min-height: 260px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px dashed var(--mm-border);
        border-radius: 10px;
        font-family: var(--mm-mono);
        font-size: 11px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--mm-fg-mute);
        text-align: center;
        padding: 16px;
      }
    `}</style>
  );
}
