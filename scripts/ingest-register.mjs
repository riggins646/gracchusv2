#!/usr/bin/env node
/**
 * UK Register of Members' Financial Interests ingester
 * =====================================================
 *
 * Pulls the Register of Members' Financial Interests directly from
 * Parliament's official Interests API (https://interests-api.parliament.uk),
 * snapshots each fortnightly edition to disk, diffs against the previous
 * snapshot, recomputes the headline aggregates in src/data/mp-interests.json,
 * and emits a markdown triage report flagging entries worth promoting into
 * src/data/individual-connections.json.
 *
 * Usage:
 *   node scripts/ingest-register.mjs                  # latest edition vs. previous
 *   node scripts/ingest-register.mjs --register 798   # specific register id
 *   node scripts/ingest-register.mjs --since 2026-03  # all editions on/after that month
 *   node scripts/ingest-register.mjs --dry-run        # no writes
 *
 * Outputs:
 *   src/data/register/snapshots/{registerId}-{YYYY-MM-DD}.json
 *   src/data/register/diffs/{registerId}-{YYYY-MM-DD}.md
 *   src/data/register/triage/{registerId}-{YYYY-MM-DD}.json
 *   src/data/register/index.json
 *   src/data/mp-interests.json (aggregate stats refreshed)
 *
 * Exit codes: 0 success; 1 fatal error.
 *
 * No npm dependencies — uses only Node 18+ built-ins (fetch, fs, path).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "src", "data");
const REGISTER_DIR = path.join(DATA_DIR, "register");
const SNAPSHOT_DIR = path.join(REGISTER_DIR, "snapshots");
const DIFF_DIR = path.join(REGISTER_DIR, "diffs");
const TRIAGE_DIR = path.join(REGISTER_DIR, "triage");
const INDEX_PATH = path.join(REGISTER_DIR, "index.json");
const MP_INTERESTS_PATH = path.join(DATA_DIR, "mp-interests.json");

const API_BASE = "https://interests-api.parliament.uk/api/v1";
const PAGE_SIZE = 20; // API hard limit
const REQUEST_DELAY_MS = 120; // be polite — ~8 req/s ceiling
const USER_AGENT = "Gracchus/RegisterIngester (https://gracchus.ai contact@gracchus.ai)";

// Triage thresholds — see triage() for the rules.
const TRIAGE = {
  GIFT_VALUE_GBP: 500,        // single registrable gift above this → flag
  LATE_REGISTRATION_DAYS: 28, // > 28 days between event date and registration → flag
  EMPLOYMENT_VALUE_GBP: 5000, // single payment above this → flag (high-value second job)
};

// Tracked Gracchus departments / suppliers — entries that mention these in
// donor/employer fields are higher-priority triage. Keep this list small and
// drawn from the canonical Gracchus IDs; expand as the curated set grows.
const TRACKED_KEYWORDS = [
  "palantir", "serco", "capita", "atos", "fujitsu", "mitie", "g4s",
  "deloitte", "kpmg", "pwc", "ernst", "ey ", "accenture",
  "bae", "babcock", "rolls-royce", "qinetiq", "leonardo",
  "balfour beatty", "kier", "skanska", "laing o'rourke", "mcalpine",
  "thales", "lockheed", "boeing", "raytheon",
  "meta", "facebook", "google", "amazon", "microsoft",
  "infosys", "ibm",
  "uber", "airbnb",
  "betting and gaming council", "tobacco",
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--register") args.registerId = parseInt(argv[++i], 10);
    else if (a === "--since") args.since = argv[++i];
    else if (a === "--latest-only") args.latestOnly = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

function printHelp() {
  console.log(
    `Usage: node scripts/ingest-register.mjs [OPTIONS]\n` +
      `\n` +
      `  --register <id>   Ingest a specific register edition (e.g. 798)\n` +
      `  --since <YYYY-MM> Ingest every edition published on or after this month\n` +
      `  --latest-only     Ingest only the most recent edition (default behaviour)\n` +
      `  --dry-run         Fetch and parse but do not write files\n` +
      `  --help            Show this message\n`
  );
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

async function getJson(url, attempt = 1) {
  await sleep(REQUEST_DELAY_MS);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 4) throw new Error(`API ${res.status} after retries: ${url}`);
    await sleep(1000 * attempt);
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

async function listRegisters() {
  // The Registers endpoint paginates too — fetch all pages.
  const all = [];
  let skip = 0;
  while (true) {
    const url = `${API_BASE}/Registers?Skip=${skip}&Take=${PAGE_SIZE}`;
    const page = await getJson(url);
    const items = page.items || [];
    all.push(...items);
    if (skip + items.length >= page.totalResults) break;
    if (items.length === 0) break;
    skip += items.length;
  }
  // Sort newest first
  all.sort((a, b) => (b.publishedDate || "").localeCompare(a.publishedDate || ""));
  return all;
}

async function fetchAllInterests(registerId) {
  const all = [];
  let skip = 0;
  // The API caps Take at 20 — see swagger spec.
  while (true) {
    const url =
      `${API_BASE}/Interests` +
      `?RegisterId=${registerId}` +
      `&Take=${PAGE_SIZE}` +
      `&Skip=${skip}` +
      `&SortOrder=CategoryAscending`;
    const page = await getJson(url);
    const items = page.items || [];
    all.push(...items);
    if (items.length === 0) break;
    if (skip + items.length >= page.totalResults) break;
    skip += items.length;
    if (skip % 200 === 0) {
      process.stdout.write(`  fetched ${skip}/${page.totalResults}…\r`);
    }
  }
  process.stdout.write(`  fetched ${all.length} interests\n`);
  return all;
}

// ---------------------------------------------------------------------------
// Snapshot model
// ---------------------------------------------------------------------------

/**
 * Convert one PublishedInterest from the API into a stable, comparable record.
 * The `fields` array is normalised into a flat name→value map so diffs are
 * tractable.
 */
function normaliseInterest(raw) {
  const fields = {};
  for (const f of raw.fields || []) {
    if (!f?.name) continue;
    if (f.value !== undefined && f.value !== null) {
      fields[f.name] = f.value;
    }
  }
  // Deterministic identity for diffing — Parliament's interest IDs persist
  // across editions for the same declaration, so prefer that. Fall back to
  // a content hash when an entry is somehow missing an ID.
  const id =
    raw.id != null
      ? `interest:${raw.id}`
      : `hash:${hashString(JSON.stringify({ s: raw.summary, m: raw.member?.id, c: raw.category?.id, fields }))}`;
  return {
    id,
    summary: raw.summary || "",
    categoryId: raw.category?.id ?? null,
    categoryNumber: raw.category?.number ?? null,
    categoryName: raw.category?.name ?? null,
    memberId: raw.member?.id ?? null,
    memberName: raw.member?.nameDisplayAs ?? null,
    memberConstituency: raw.member?.memberFrom ?? null,
    memberParty: raw.member?.party ?? null,
    registrationDate: raw.registrationDate ?? null,
    publishedDate: raw.publishedDate ?? null,
    updatedDates: raw.updatedDates ?? [],
    parentInterestId: raw.parentInterestId ?? null,
    rectified: !!raw.rectified,
    rectifiedDetails: raw.rectifiedDetails ?? null,
    fields,
  };
}

// FNV-1a 32-bit, plenty for diff identity stability.
function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function buildSnapshot(register, interests) {
  return {
    metadata: {
      registerId: register.id,
      publishedDate: register.publishedDate,
      type: register.type || "Commons",
      sourceUrl: `https://interests-api.parliament.uk/api/v1/Registers/${register.id}`,
      fetchedAt: new Date().toISOString(),
      totalInterests: interests.length,
    },
    interests: interests.map(normaliseInterest),
  };
}

function snapshotPath(register) {
  return path.join(SNAPSHOT_DIR, `${register.id}-${register.publishedDate}.json`);
}

async function loadSnapshotByRegisterId(id) {
  try {
    const files = await fs.readdir(SNAPSHOT_DIR);
    const match = files.find((f) => f.startsWith(`${id}-`));
    if (!match) return null;
    return JSON.parse(await fs.readFile(path.join(SNAPSHOT_DIR, match), "utf8"));
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/**
 * Diff returns added / removed / rectified / changed_fields entries.
 *
 * - added: interest id present in current but not previous
 * - removed: interest id present in previous but not current (rare; usually corrections)
 * - rectified: rectified flag flipped to true in current
 * - field_changes: same id, different fields (corrections)
 */
function diffSnapshots(current, previous) {
  const prevById = new Map((previous?.interests ?? []).map((i) => [i.id, i]));
  const currById = new Map(current.interests.map((i) => [i.id, i]));

  const added = [];
  const rectifiedNow = [];
  const fieldChanges = [];
  for (const [id, c] of currById) {
    const p = prevById.get(id);
    if (!p) { added.push(c); continue; }
    if (c.rectified && !p.rectified) rectifiedNow.push(c);
    if (JSON.stringify(c.fields) !== JSON.stringify(p.fields) ||
        c.summary !== p.summary) {
      fieldChanges.push({ before: p, after: c });
    }
  }
  const removed = [];
  for (const [id, p] of prevById) {
    if (!currById.has(id)) removed.push(p);
  }

  return { added, removed, rectifiedNow, fieldChanges };
}

// ---------------------------------------------------------------------------
// Aggregates → mp-interests.json refresh
// ---------------------------------------------------------------------------

const PARTY_NORMALISE = {
  "Labour": "Labour",
  "Labour (Co-op)": "Labour (Co-op)",
  "Conservative": "Conservative",
  "Liberal Democrat": "Liberal Democrat",
  "Scottish National Party": "Scottish National Party",
  "Reform UK": "Reform UK",
  "Green Party": "Green Party",
  "Plaid Cymru": "Plaid Cymru",
  "Independent": "Independent",
};

function moneyFromField(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  // Strip currency symbols, commas, "approximately", parentheses
  const s = String(value).replace(/[£$,()]|approximate|approx\.?|approx/gi, "").trim();
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function pickGiftValue(fields) {
  // Categories 3, 4, 5 (gifts/visits) — common field names: "Value", "Estimated value"
  for (const k of ["Value", "Estimated value", "Estimated Value", "Value of gift", "Value of benefit"]) {
    if (fields[k] != null) {
      const v = moneyFromField(fields[k]);
      if (v != null) return v;
    }
  }
  return null;
}

function pickPaymentValue(fields) {
  for (const k of ["Payment received", "Amount", "Value", "Value of payment", "Payment"]) {
    if (fields[k] != null) {
      const v = moneyFromField(fields[k]);
      if (v != null) return v;
    }
  }
  return null;
}

function computeAggregates(snapshot) {
  // Build a per-MP map first.
  const perMp = new Map();
  const ensure = (id, name, party, constituency) => {
    if (!perMp.has(id)) perMp.set(id, {
      id, name, party, constituency,
      employmentEarnings: 0, gifts: 0, donations: 0,
      visitsValue: 0, shareholdingsCount: 0, employmentCount: 0,
      giftItems: 0, lateCount: 0,
    });
    return perMp.get(id);
  };

  for (const i of snapshot.interests) {
    if (i.memberId == null) continue;
    const m = ensure(i.memberId, i.memberName, i.memberParty, i.memberConstituency);
    const cat = String(i.categoryNumber || "");
    if (cat.startsWith("1")) {
      const v = pickPaymentValue(i.fields);
      if (v != null) m.employmentEarnings += v;
      m.employmentCount += 1;
    } else if (cat.startsWith("2")) {
      const v = pickPaymentValue(i.fields);
      if (v != null) m.donations += v;
    } else if (cat.startsWith("3") || cat.startsWith("5")) {
      const v = pickGiftValue(i.fields);
      if (v != null) m.gifts += v;
      m.giftItems += 1;
    } else if (cat.startsWith("4")) {
      const v = pickGiftValue(i.fields);
      if (v != null) m.visitsValue += v;
    } else if (cat.startsWith("7")) {
      m.shareholdingsCount += 1;
    }
    if (i.rectified) m.lateCount += 1;
  }

  // Per-party totals
  const byParty = new Map();
  for (const m of perMp.values()) {
    const party = PARTY_NORMALISE[m.party] || m.party || "Unknown";
    const b = byParty.get(party) || { name: party, count: 0, oi: 0, gi: 0, dn: 0 };
    b.count += 1;
    b.oi += m.employmentEarnings;
    b.gi += m.gifts + m.visitsValue;
    b.dn += m.donations;
    byParty.set(party, b);
  }

  // Top earners (by employment earnings during this register's window)
  const topEarners = [...perMp.values()]
    .filter((m) => m.employmentEarnings > 0)
    .sort((a, b) => b.employmentEarnings - a.employmentEarnings)
    .slice(0, 25)
    .map((m) => ({
      mp: m.name, party: m.party, constituency: m.constituency,
      outsideIncome: Math.round(m.employmentEarnings),
      paidRoles: m.employmentCount,
    }));

  return {
    perMp: Object.fromEntries([...perMp].map(([k, v]) => [k, v])),
    byParty: [...byParty.values()].sort((a, b) => b.count - a.count),
    topEarners,
    totalMps: perMp.size,
    totalInterests: snapshot.interests.length,
  };
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function findTrackedMatch(interest) {
  const haystack = [
    interest.summary,
    ...Object.values(interest.fields || {}).map((v) => String(v ?? "")),
  ].join(" | ").toLowerCase();
  return TRACKED_KEYWORDS.find((kw) => haystack.includes(kw)) || null;
}

function triage(diff) {
  const candidates = [];
  for (const i of diff.added) {
    const reasons = [];
    const cat = String(i.categoryNumber || "");

    // High-value gifts/visits
    if (cat.startsWith("3") || cat.startsWith("4") || cat.startsWith("5")) {
      const v = pickGiftValue(i.fields);
      if (v != null && v >= TRIAGE.GIFT_VALUE_GBP) {
        reasons.push(`gift/visit value £${v.toLocaleString()} >= £${TRIAGE.GIFT_VALUE_GBP}`);
      }
    }

    // High-value paid roles
    if (cat.startsWith("1")) {
      const v = pickPaymentValue(i.fields);
      if (v != null && v >= TRIAGE.EMPLOYMENT_VALUE_GBP) {
        reasons.push(`employment payment £${v.toLocaleString()} >= £${TRIAGE.EMPLOYMENT_VALUE_GBP}`);
      } else {
        reasons.push("new paid role registered");
      }
    }

    // Shareholdings
    if (cat.startsWith("7")) reasons.push("new shareholding declared");

    // Family employed/lobbying (categories 9, 10)
    if (cat.startsWith("9")) reasons.push("family member employed / paid from parliamentary expenses");
    if (cat.startsWith("10")) reasons.push("family member engaged in lobbying");

    // Late registration
    const eventDateGuess = i.fields["Date received"] || i.fields["Date of receipt"] ||
                           i.fields["Date payment received"] || i.fields["Date of visit"];
    if (eventDateGuess) {
      const days = daysBetween(eventDateGuess, i.registrationDate);
      if (days != null && days > TRIAGE.LATE_REGISTRATION_DAYS) {
        reasons.push(`registered ${days} days after event (> ${TRIAGE.LATE_REGISTRATION_DAYS}d threshold)`);
      }
    }

    // Tracked-keyword match
    const tracked = findTrackedMatch(i);
    if (tracked) reasons.push(`mentions tracked keyword: "${tracked}"`);

    // Rectified flag from API
    if (i.rectified) reasons.push(`rectified entry${i.rectifiedDetails ? `: "${i.rectifiedDetails}"` : ""}`);

    if (reasons.length > 0) {
      candidates.push({
        memberId: i.memberId,
        memberName: i.memberName,
        memberParty: i.memberParty,
        memberConstituency: i.memberConstituency,
        category: `${i.categoryNumber} ${i.categoryName}`,
        summary: i.summary,
        registrationDate: i.registrationDate,
        publishedDate: i.publishedDate,
        rectified: i.rectified,
        fields: i.fields,
        reasons,
        interestId: i.id,
      });
    }
  }
  // Newly-rectified entries always make the list
  for (const i of diff.rectifiedNow) {
    candidates.push({
      memberId: i.memberId,
      memberName: i.memberName,
      memberParty: i.memberParty,
      memberConstituency: i.memberConstituency,
      category: `${i.categoryNumber} ${i.categoryName}`,
      summary: i.summary,
      registrationDate: i.registrationDate,
      publishedDate: i.publishedDate,
      rectified: true,
      rectifiedDetails: i.rectifiedDetails,
      fields: i.fields,
      reasons: [`rectified flag flipped to true in this edition${i.rectifiedDetails ? `: "${i.rectifiedDetails}"` : ""}`],
      interestId: i.id,
    });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

async function writeJson(p, obj, dryRun) {
  if (dryRun) { console.log(`[dry-run] would write ${p}`); return; }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function writeText(p, text, dryRun) {
  if (dryRun) { console.log(`[dry-run] would write ${p}`); return; }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text, "utf8");
}

function renderDiffMarkdown(register, diff, candidates) {
  const lines = [];
  lines.push(`# Register diff — edition ${register.id} (${register.publishedDate})`);
  lines.push("");
  lines.push(`Source: https://interests-api.parliament.uk/api/v1/Registers/${register.id}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- New entries since previous edition: **${diff.added.length}**`);
  lines.push(`- Entries removed since previous edition: **${diff.removed.length}**`);
  lines.push(`- Newly-rectified (late) entries: **${diff.rectifiedNow.length}**`);
  lines.push(`- Field-level corrections: **${diff.fieldChanges.length}**`);
  lines.push(`- Triage candidates flagged: **${candidates.length}**`);
  lines.push("");
  lines.push("## Triage candidates");
  lines.push("");
  if (candidates.length === 0) {
    lines.push("_None this edition._");
  } else {
    for (const c of candidates) {
      lines.push(`### ${c.memberName} (${c.memberParty || "?"}, ${c.memberConstituency || "?"}) — ${c.category}`);
      lines.push("");
      if (c.summary) lines.push(`_${c.summary}_`);
      lines.push("");
      for (const r of c.reasons) lines.push(`- ${r}`);
      lines.push("");
      const fieldKeys = Object.keys(c.fields || {});
      if (fieldKeys.length) {
        lines.push(`<details><summary>Registered fields</summary>\n`);
        for (const k of fieldKeys) lines.push(`- **${k}:** ${c.fields[k]}`);
        lines.push(`\n</details>`);
        lines.push("");
      }
      lines.push(`Registered: ${c.registrationDate || "—"} · Published: ${c.publishedDate || "—"} · Interest ID: \`${c.interestId}\``);
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// mp-interests.json refresh
// ---------------------------------------------------------------------------

async function refreshMpInterests(snapshot, aggregates, dryRun) {
  let existing = {};
  try { existing = JSON.parse(await fs.readFile(MP_INTERESTS_PATH, "utf8")); } catch {}

  // Preserve hand-curated sections (q1_2026, contextSentences, expenses,
  // verifiedTopItemsNote) and only refresh fields we've recomputed.
  const merged = {
    ...existing,
    metadata: {
      ...(existing.metadata || {}),
      title: existing?.metadata?.title || "MPs' Financial Interests, Gifts & Expenses",
      lastUpdated: new Date().toISOString().slice(0, 10),
      sourceUrl: `https://interests-api.parliament.uk/api/v1/Registers/${snapshot.metadata.registerId}`,
      sourceName: "Register of Members' Financial Interests (Parliament Interests API)",
      lastRegisterId: snapshot.metadata.registerId,
      lastRegisterPublishedDate: snapshot.metadata.publishedDate,
    },
    byParty: aggregates.byParty,
    topEarners: {
      ...((existing && existing.topEarners) || {}),
      currentEdition: aggregates.topEarners,
    },
    aggregateStats: {
      ...(existing.aggregateStats || {}),
      lastUpdated: new Date().toISOString().slice(0, 10),
      mpsRegistered: aggregates.totalMps,
      totalInterests: aggregates.totalInterests,
      sourceUrl: `https://interests-api.parliament.uk/api/v1/Interests?RegisterId=${snapshot.metadata.registerId}`,
      sourceName: "Parliament Interests API",
      methodologyNote:
        "Aggregates derived from Parliament's Interests API. byParty totals computed from Categories 1 (oi), 3+4+5 (gi), 2 (dn). topEarners.currentEdition is for the latest register edition only.",
    },
  };
  await writeJson(MP_INTERESTS_PATH, merged, dryRun);
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

async function loadIndex() {
  try { return JSON.parse(await fs.readFile(INDEX_PATH, "utf8")); }
  catch { return { editions: [] }; }
}

async function saveIndex(idx, dryRun) {
  await writeJson(INDEX_PATH, idx, dryRun);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function processRegister(register, opts, allRegistersOldestFirst) {
  console.log(`\n━━━ Register ${register.id} (${register.publishedDate}) ━━━`);
  const interests = await fetchAllInterests(register.id);
  const snapshot = buildSnapshot(register, interests);

  // Find the immediately-prior register for diffing
  const idx = allRegistersOldestFirst.findIndex((r) => r.id === register.id);
  const prevRegister = idx > 0 ? allRegistersOldestFirst[idx - 1] : null;
  const previousSnapshot = prevRegister ? await loadSnapshotByRegisterId(prevRegister.id) : null;

  const diff = diffSnapshots(snapshot, previousSnapshot);
  const candidates = triage(diff);

  console.log(
    `  ▸ added=${diff.added.length} removed=${diff.removed.length} ` +
    `rectified=${diff.rectifiedNow.length} fieldChanges=${diff.fieldChanges.length} ` +
    `triage=${candidates.length}`
  );

  // Write artifacts
  await writeJson(snapshotPath(register), snapshot, opts.dryRun);
  const stem = `${register.id}-${register.publishedDate}`;
  await writeText(path.join(DIFF_DIR, `${stem}.md`), renderDiffMarkdown(register, diff, candidates), opts.dryRun);
  await writeJson(path.join(TRIAGE_DIR, `${stem}.json`), { register, candidates }, opts.dryRun);

  return { snapshot, diff, candidates };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { printHelp(); return; }

  console.log("Discovering registers via Parliament Interests API…");
  const registersDesc = await listRegisters();
  console.log(`  ${registersDesc.length} editions known.`);

  // Decide which to process
  let toProcess;
  if (opts.registerId) {
    const r = registersDesc.find((x) => x.id === opts.registerId);
    if (!r) throw new Error(`Register ${opts.registerId} not found`);
    toProcess = [r];
  } else if (opts.since) {
    toProcess = registersDesc.filter((r) => (r.publishedDate || "") >= opts.since);
    if (toProcess.length === 0) throw new Error(`No registers since ${opts.since}`);
  } else {
    toProcess = [registersDesc[0]]; // latest
  }

  // Process oldest-first so each diff has its predecessor available on disk
  toProcess = toProcess.slice().sort((a, b) => (a.publishedDate || "").localeCompare(b.publishedDate || ""));
  const allOldestFirst = registersDesc.slice().reverse();

  const idx = await loadIndex();
  const indexed = new Set(idx.editions.map((e) => e.id));

  let lastResult = null;
  for (const r of toProcess) {
    if (indexed.has(r.id) && !opts.registerId && !opts.dryRun) {
      console.log(`  skipping ${r.id} (${r.publishedDate}) — already in index`);
      continue;
    }
    lastResult = await processRegister(r, opts, allOldestFirst);
    idx.editions = [
      ...idx.editions.filter((e) => e.id !== r.id),
      {
        id: r.id, publishedDate: r.publishedDate,
        interests: lastResult.snapshot.metadata.totalInterests,
        addedSincePrevious: lastResult.diff.added.length,
        triageCandidates: lastResult.candidates.length,
        ingestedAt: new Date().toISOString(),
      },
    ].sort((a, b) => (b.publishedDate || "").localeCompare(a.publishedDate || ""));
  }
  await saveIndex(idx, opts.dryRun);

  // Refresh mp-interests.json from the most recent snapshot we touched
  if (lastResult) {
    const aggregates = computeAggregates(lastResult.snapshot);
    await refreshMpInterests(lastResult.snapshot, aggregates, opts.dryRun);
    console.log(`\nmp-interests.json refreshed against register ${lastResult.snapshot.metadata.registerId}.`);
  } else {
    console.log("\nNo new editions to process; mp-interests.json untouched.");
  }
}

// Only auto-run when invoked directly; allow `import` for unit testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("FATAL:", err.message);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });
}

// Exports for testing
export {
  normaliseInterest, buildSnapshot, diffSnapshots, computeAggregates,
  triage, pickGiftValue, pickPaymentValue, moneyFromField,
};
