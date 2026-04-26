"use client";
import { useMemo } from "react";
import { AlertTriangle, ExternalLink, Scale, User } from "lucide-react";
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

export default function ConnectedIndividuals({ supplierId, buyerId, projectId, adjacentFirmName }) {
  const connections = useMemo(() => {
    if (!connData?.connections) return [];
    return connData.connections.filter((c) => {
      if (c.counterparty.kind === "supplier" && supplierId && c.counterparty.id === supplierId) return true;
      if (c.counterparty.kind === "buyer" && buyerId && c.counterparty.id === buyerId) return true;
      if (c.counterparty.kind === "project" && projectId && c.counterparty.id === projectId) return true;
      if (c.counterparty.kind === "adjacent_firm" && adjacentFirmName && c.counterparty.name === adjacentFirmName) return true;
      return false;
    });
  }, [supplierId, buyerId, projectId, adjacentFirmName]);

  const peopleById = useMemo(() => {
    const m = {};
    for (const p of connData.people || []) m[p.id] = p;
    return m;
  }, []);

  if (connections.length === 0) return null;

  return (
    <section className="mt-6 border-t border-gray-800 pt-5">
      <h3 className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
        <User size={12} />
        Connected individuals ({connections.length})
      </h3>
      <ul className="space-y-4">
        {connections.map((c) => {
          const person = peopleById[c.personId];
          return (
            <li key={c.id} className="border border-gray-800 rounded-lg bg-gray-900/40 p-4">
              {c.liveProceedings && (
                <div className="mb-3 flex items-start gap-2 p-2.5 rounded border border-amber-500/40 bg-amber-500/5 text-xs text-amber-300">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="uppercase tracking-wider text-[10px]">Live proceedings</strong> &mdash; this case is subject to ongoing legal or regulatory proceedings. Gracchus reports only findings already in the public record.
                  </span>
                </div>
              )}
              {/* person header. When the subject is a firm (kind === "firm"),
                  surface a small FIRM pill next to the serif name so the reader
                  knows the donor-contractor cards are about a company, not a
                  person. Mirrors the live-proceedings + party-dot conventions. */}
              <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                <h4 className="text-base font-serif text-white font-semibold inline-flex items-baseline gap-2">
                  {person?.name || "\u2014"}
                  {person?.kind === "firm" && (
                    <span
                      className="text-[9px] font-mono tracking-[0.12em] px-1.5 py-0.5 rounded border border-sky-400/40 bg-sky-400/10 text-sky-300 font-semibold uppercase"
                      title="Subject of this story is a firm, not an individual"
                      aria-label="Firm subject"
                    >
                      FIRM
                    </span>
                  )}
                </h4>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 border border-gray-700 rounded px-2 py-0.5">
                  {CONN_TYPE_LABEL[c.connectionType] || c.connectionType}
                </span>
              </div>
              {person?.headline && <p className="text-xs text-gray-500 mb-3">{person.headline}</p>}
              {/* timeframe */}
              <p className="text-xs text-gray-400 mb-2 font-mono tabular-nums">
                {c.timeframe?.periodLabel} &middot; {c.counterparty?.name}
              </p>
              {/* summary */}
              <p className="text-base text-gray-200 leading-relaxed mb-3">{c.summary}</p>
              {/* detail paragraphs */}
              {c.detail && (
                <div className="text-sm text-gray-300 leading-relaxed space-y-2 mb-3">
                  {c.detail.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
                </div>
              )}
              {/* financial summary */}
              {(c.financial?.relatedContractsDescription || c.financial?.personalIncomeDescription) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-3 p-2 rounded bg-black/30 border border-gray-800/60">
                  {c.financial.personalIncomeDescription && (
                    <span><span className="text-gray-500">Personal:</span> <span className="font-mono tabular-nums">{c.financial.personalIncomeDescription}</span></span>
                  )}
                  {c.financial.relatedContractsDescription && (
                    <span><span className="text-gray-500">Contracts:</span> <span className="font-mono tabular-nums">{c.financial.relatedContractsDescription}</span></span>
                  )}
                </div>
              )}
              {/* regulatory findings */}
              {c.regulatoryFindings?.length > 0 && (
                <div className="mb-3 space-y-2">
                  {c.regulatoryFindings.map((f, i) => (
                    <div key={i} className="text-xs p-2 rounded border-l-2 border-amber-500/60 bg-amber-500/5">
                      <div className="flex items-center gap-1.5 text-amber-400 font-medium mb-1">
                        <Scale size={11} />
                        <span>{f.body}</span>
                        <span className="text-gray-500 font-mono">&middot; {f.date}</span>
                      </div>
                      <p className="text-gray-300 italic">&ldquo;{f.quotedText}&rdquo;</p>
                      {f.outcome && <p className="text-gray-400 mt-1">{f.outcome}</p>}
                    </div>
                  ))}
                </div>
              )}
              {/* sources */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-800/60">
                {c.sources?.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors " +
                      (s.tier === "primary"
                        ? "border-emerald-600/40 bg-emerald-600/5 text-emerald-300 hover:bg-emerald-600/10"
                        : s.tier === "news"
                        ? "border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-800/70"
                        : "border-purple-600/30 bg-purple-600/5 text-purple-300 hover:bg-purple-600/10")
                    }
                    title={s.publisher + " \u00b7 " + (s.date || "")}
                  >
                    {s.publisher}
                    <ExternalLink size={9} />
                  </a>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
