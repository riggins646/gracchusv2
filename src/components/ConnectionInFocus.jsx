"use client";

/* =========================================================================
 *  ConnectionInFocus — homepage strip for the connection-stories catalogue
 * =========================================================================
 *  Surfaces 3 of the 25 records in src/data/individual-connections.json
 *  above the fold on the overview view, so first-time visitors meet the
 *  Money Map v2 editorial work without having to navigate to /money-map.
 *
 *  Curation rule (deterministic, ISO-week-of-year — same picker pattern
 *  as Story of the Week so the day-of-year arithmetic is consistent):
 *
 *    Slot 1   regulator-finding case
 *             filter: c.regulatoryFindings && length > 0
 *
 *    Slot 2   live-proceedings case
 *             filter: c.liveProceedings === true
 *
 *    Slot 3   pattern case — prefer connectionType === "donor_and_contractor",
 *             fall back to remaining records not already picked.
 *
 *  Each pool uses (weekIdx % pool.length) so as the catalogue grows the
 *  rotation gets richer naturally; same reader sees the same 3 in a
 *  given week; no randomness, no caching surprises.
 *
 *  Tap on a card routes to view="moneymap" with ?lens=person:<personId>
 *  in the URL — MoneyMap.readUrlState() picks up `lens` on mount and
 *  opens the canvas focused on that node. (We re-use the existing lens
 *  deeplink rather than introduce a new `focus` param so this surface
 *  ships without changes inside MoneyMap.jsx.)
 * ========================================================================= */

import { useMemo } from "react";
import connData from "../data/individual-connections.json";

const CONN_TYPE_LABEL = {
  post_office_appointment: "Post-office appointment",
  dual_role: "Dual role",
  paid_consultancy_during_office: "Paid consultancy during office",
  family_employment: "Family employment",
  family_ownership: "Family ownership",
  donation_then_contract: "Donation \u2192 contract",
  vip_lane_referral: "VIP lane referral",
  spousal_shareholding: "Spousal shareholding",
  shareholding: "Shareholding",
  appg_paid_chair: "APPG paid chair",
  personal_connection_then_contract: "Personal connection \u2192 contract",
  outside_earnings_during_office: "Outside earnings during office",
  spousal_political_role: "Spousal political role",
  family_trust_arrangement: "Family trust arrangement",
  cash_for_access: "Cash for access",
  donor_and_contractor: "Donor and contractor",
  other: "Connection of interest",
};

const PARTY_DOT = {
  conservative: "#0087DC",
  labour: "#E4003B",
  libdem: "#FAA61A",
  "lib-dem": "#FAA61A",
  reform: "#12B6CF",
  green: "#6AB023",
  snp: "#FDF38E",
  none: null,
};

/* Match the existing ISO-week picker used by Story of the Week
   (Dashboard.jsx, line ~8424). day-of-year / 7 keeps every reader on
   the same pick for the same calendar week without timezone surprises. */
function currentWeekIdx() {
  const now = new Date();
  const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now - jan1) / (1000 * 60 * 60 * 24));
  return Math.floor(dayOfYear / 7);
}

/* Headline figure for the card. Prefer a regulator's quoted finding
   (the most editorially powerful), fall back to the contracts-£
   description (the structural finding), else the personal-income
   description, else null. Trimmed to keep the card scannable. */
function pickKeyFigure(c) {
  const finding = c.regulatoryFindings && c.regulatoryFindings[0];
  if (finding && finding.quotedText) {
    const t = finding.quotedText.trim();
    if (t.length > 140) return "\u201C" + t.slice(0, 137).trim() + "\u2026\u201D";
    return "\u201C" + t + "\u201D";
  }
  if (c.financial && c.financial.relatedContractsDescription) {
    return c.financial.relatedContractsDescription;
  }
  if (c.financial && c.financial.personalIncomeDescription) {
    return c.financial.personalIncomeDescription;
  }
  return null;
}

export default function ConnectionInFocus({ onOpenMoneyMap }) {
  const peopleById = useMemo(() => {
    const m = {};
    for (const p of (connData.people || [])) m[p.id] = p;
    return m;
  }, []);

  const picks = useMemo(() => {
    const all = connData.connections || [];
    const w = currentWeekIdx();

    const regulatorPool = all.filter(
      (c) => Array.isArray(c.regulatoryFindings) && c.regulatoryFindings.length > 0,
    );
    const livePool = all.filter((c) => c.liveProceedings === true);

    const slot1 = regulatorPool.length ? regulatorPool[w % regulatorPool.length] : null;
    const slot2 = livePool.length ? livePool[w % livePool.length] : null;

    const taken = new Set([slot1?.id, slot2?.id].filter(Boolean));
    const donorPool = all.filter(
      (c) => c.connectionType === "donor_and_contractor" && !taken.has(c.id),
    );
    const fallbackPool = all.filter((c) => !taken.has(c.id));
    const patternPool = donorPool.length ? donorPool : fallbackPool;
    const slot3 = patternPool.length ? patternPool[w % patternPool.length] : null;

    return [slot1, slot2, slot3].filter(Boolean);
  }, []);

  if (picks.length === 0) return null;

  const total = (connData.connections || []).length;

  /* Navigation: deep-link to the Money Map's lens for that person.
     If onOpenMoneyMap is provided (Dashboard passes setView), we update
     the URL search before flipping the view so MoneyMap.readUrlState()
     sees the lens param on mount. */
  const goToPerson = (personId) => {
    if (typeof window !== "undefined") {
      try {
        const lensId = "person:" + personId;
        const u = new URL(window.location.href);
        u.searchParams.set("view", "lens");
        u.searchParams.set("lens", lensId);
        window.history.replaceState(null, "", u.pathname + "?" + u.searchParams.toString());
      } catch { /* nav still works without the deeplink */ }
    }
    if (typeof onOpenMoneyMap === "function") onOpenMoneyMap();
  };

  return (
    <div className={
      "mb-10 -mx-3 sm:-mx-6 " +
      "border-t border-b border-gray-800/80 " +
      "bg-gradient-to-b from-gray-950 to-black"
    }>
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-8 sm:py-10">
        {/* Header row — eyebrow + sub */}
        <div className="mb-6">
          <div className={
            "text-[11px] font-mono tracking-[0.25em] " +
            "text-ember-400/90 uppercase mb-2 " +
            "flex items-center gap-3"
          }>
            <span className="inline-block h-px w-8 bg-ember-500/70" />
            Connections &middot; Who&rsquo;s behind the numbers
          </div>
          <h2 className={
            "font-serif text-2xl sm:text-3xl " +
            "font-medium tracking-[-0.01em] " +
            "text-gray-50 max-w-3xl"
          }>
            Three of the {total} connection stories Gracchus is tracking this week.
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl">
            Named individuals and firms whose private interests cross
            tracked UK government contracts &mdash; rotated weekly,
            sourced to the regulator or court record.
          </p>
        </div>

        {/* Three cards — 1 col mobile, 3 cols desktop. Cards inherit the
            same border/bg/padding tokens as the Money Map preview strip
            directly below for visual continuity. */}
        <div className={
          "grid grid-cols-1 md:grid-cols-3 gap-3"
        }>
          {picks.map((c) => {
            const person = peopleById[c.personId];
            const personName = person?.name || c.personId;
            const isFirm = person?.kind === "firm";
            const partyDot = person && person.party && person.party !== "none"
              ? PARTY_DOT[person.party] || null
              : null;
            const keyFigure = pickKeyFigure(c);
            const eyebrow = CONN_TYPE_LABEL[c.connectionType] || "Connection of interest";
            return (
              <button
                key={c.id}
                onClick={() => goToPerson(c.personId)}
                className={
                  "border border-gray-800/60 " +
                  "hover:border-ember-500/50 " +
                  "bg-black/40 hover:bg-black/70 " +
                  "p-5 text-left transition group " +
                  "flex flex-col gap-3 min-h-[260px]"
                }
                aria-label={`Open ${personName} in the Money Map`}
              >
                {/* Eyebrow row: connection-type label + chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={
                    "text-[10px] font-mono tracking-[0.18em] " +
                    "uppercase text-gray-500 " +
                    "group-hover:text-ember-400/90 transition-colors"
                  }>
                    {eyebrow}
                  </span>
                  {isFirm ? (
                    <span className={
                      "text-[9px] font-mono tracking-[0.14em] " +
                      "uppercase px-1.5 py-0.5 " +
                      "border border-gray-700 text-gray-300 " +
                      "rounded-sm"
                    }>
                      Firm
                    </span>
                  ) : null}
                  {c.liveProceedings ? (
                    <span className={
                      "inline-flex items-center gap-1 " +
                      "text-[9px] font-mono tracking-[0.14em] " +
                      "uppercase text-amber-400"
                    }>
                      <span className={
                        "inline-block w-1.5 h-1.5 rounded-full " +
                        "bg-amber-400 animate-pulse"
                      } />
                      Live proceedings
                    </span>
                  ) : null}
                </div>

                {/* Subject — serif, name */}
                <div className="flex items-baseline gap-2 flex-wrap">
                  {partyDot ? (
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ background: partyDot }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <h3 className={
                    "font-serif text-2xl text-gray-50 " +
                    "leading-tight tracking-[-0.01em]"
                  }>
                    {personName}
                  </h3>
                </div>

                {/* Headline — the hook */}
                <p className={
                  "text-sm text-gray-300 leading-snug"
                }>
                  {c.summary}
                </p>

                {/* Key figure — pinned to the bottom */}
                {keyFigure ? (
                  <div className={
                    "mt-auto text-[11px] text-gray-500 " +
                    "leading-snug border-t border-gray-800/60 pt-3"
                  }>
                    {keyFigure}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Footer link — view all */}
        <div className="mt-5 text-right">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                try {
                  const u = new URL(window.location.href);
                  u.searchParams.delete("lens");
                  u.searchParams.delete("view");
                  window.history.replaceState(
                    null,
                    "",
                    u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : ""),
                  );
                } catch { /* nav still works */ }
              }
              if (typeof onOpenMoneyMap === "function") onOpenMoneyMap();
            }}
            className={
              "text-xs font-mono tracking-wider uppercase " +
              "text-gray-500 hover:text-ember-400 transition"
            }
          >
            View all {total} stories &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
