#!/usr/bin/env node
/**
 * UK All-Party Parliamentary Groups (APPGs) ingester
 * ===================================================
 *
 * Pulls the Register of All-Party Parliamentary Groups directly from
 * publications.parliament.uk, parses each group's officers, secretariat,
 * benefits, and corporate sponsors into a structured snapshot, diffs
 * against the previous snapshot, and emits a markdown triage report
 * flagging groups whose secretariat is a lobbying firm, sponsor lists
 * include tracked Gracchus suppliers, or officers overlap with the
 * existing curated individual-connections.json records.
 *
 * Why APPGs matter: the APPG register is the single biggest unmapped
 * vector of industry access to MPs and peers. Each group has officers
 * (parliamentarians) and registrable benefits (often industry money via
 * a paid secretariat, e.g. Big Innovation Centre paid by BT, Capgemini,
 * Deloitte, EY, etc. to run the All-Party Parliamentary Group on AI).
 * This ingester turns that into structured graph data.
 *
 * Usage:
 *   node scripts/ingest-appgs.mjs                         # latest edition
 *   node scripts/ingest-appgs.mjs --edition 251020        # specific edition (YYMMDD)
 *   node scripts/ingest-appgs.mjs --since 250101          # all editions on/after that date
 *   node scripts/ingest-appgs.mjs --dry-run               # no writes
 *
 * Outputs:
 *   src/data/appgs/snapshots/{YYMMDD}.json
 *   src/data/appgs/diffs/{YYMMDD}.md
 *   src/data/appgs/triage/{YYMMDD}.json
 *   src/data/appgs/index.json
 *
 * Source: publications.parliament.uk/pa/cm/cmallparty/{YYMMDD}/
 *         (HTML format; no API exposes secretariat / sponsors /
 *         registrable benefits, so we parse the official HTML)
 *
 * No npm dependencies — Node 18+ built-ins only.
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
const APPG_DIR = path.join(DATA_DIR, "appgs");
const SNAPSHOT_DIR = path.join(APPG_DIR, "snapshots");
const DIFF_DIR = path.join(APPG_DIR, "diffs");
const TRIAGE_DIR = path.join(APPG_DIR, "triage");
const INDEX_PATH = path.join(APPG_DIR, "index.json");
const INDIV_CONN_PATH = path.join(DATA_DIR, "individual-connections.json");

const PUBS_BASE = "https://publications.parliament.uk/pa/cm/cmallparty";
const REGISTER_HOME =
  "https://www.parliament.uk/mps-lords-and-offices/standards-and-financial-interests/parliamentary-commissioner-for-standards/registers-of-interests/register-of-all-party-party-parliamentary-groups/";

const REQUEST_DELAY_MS = 130;
const USER_AGENT = "Gracchus/AppgIngester (https://gracchus.ai contact@gracchus.ai)";

// Triage thresholds + heuristics ---------------------------------------------

// Known PR / lobbying / public-affairs firms that frequently act as paid
// APPG secretariats. A group whose secretariat matches any of these is a
// strong industry-access flag. Drawn from PRCA/CIPR membership lists and
// repeated appearance across the APPG register.
const KNOWN_LOBBYING_SECRETARIATS = [
  "policy connect",
  "connect communications",
  "connect group",
  "interel",
  "lexington communications",
  "lexington partners",
  "weber shandwick",
  "edelman",
  "fleishman",
  "hanover communications",
  "burson",
  "fipra",
  "fleishmanhillard",
  "iceni",
  "luther pendragon",
  "newington communications",
  "pagefield",
  "portland communications",
  "rud pedersen",
  "teneo",
  "tendo consulting",
  "wpi strategy",
  "wa communications",
  "westbourne communications",
  "whitehouse communications",
  "h/advisors",
  "atlas partners",
  "global counsel",
  "big innovation centre", // operates many tech-sector APPGs
  "industry forum",
];

// Industry / sector keywords used both as triage flags (a group in this
// category is high-priority for Money Map) and to match against sponsor
// names / secretariat / group purposes. Same list used in ingest-register.mjs
// — kept identical so the two ingesters surface the same supplier universe.
const TRACKED_KEYWORDS = [
  "palantir", "serco", "capita", "atos", "fujitsu", "mitie", "g4s",
  "deloitte", "kpmg", "pwc", "ernst", "ey ", "accenture",
  "bae", "babcock", "rolls-royce", "qinetiq", "leonardo",
  "balfour beatty", "kier", "skanska", "laing o'rourke", "mcalpine",
  "thales", "lockheed", "boeing", "raytheon",
  "meta", "facebook", "google", "amazon", "microsoft",
  "infosys", "ibm", "cognizant", "capgemini",
  "uber", "airbnb",
  "betting and gaming council", "tobacco", "altria", "philip morris",
  "shell", "bp ", "exxon", "centrica", "national grid",
  "novo nordisk", "pfizer", "astrazeneca", "gsk",
  "santander", "barclays", "hsbc", "lloyds",
  "bt group", "vodafone", "openreach",
];

// Subject categories whose presence in the group title signals a high-impact
// policy domain — these are the lenses that translate directly into Money
// Map quick-views.
const HIGH_IMPACT_SUBJECTS = [
  "artificial intelligence", "technology", "blockchain", "data",
  "defence", "security",
  "gambling", "betting", "alcohol", "tobacco",
  "energy", "oil", "gas", "nuclear",
  "pharmaceutical", "medicines", "health", "nhs",
  "financial", "banking", "insurance", "fintech",
  "media", "broadcasting", "press",
  "infrastructure", "construction", "rail", "aviation", "airports",
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--edition") args.edition = argv[++i];
    else if (a === "--since") args.since = argv[++i];
    else if (a === "--latest-only") args.latestOnly = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

function printHelp() {
  console.log(
    `Usage: node scripts/ingest-appgs.mjs [OPTIONS]\n\n` +
      `  --edition YYMMDD   Ingest a specific edition (e.g. 251020 = 20 Oct 2025)\n` +
      `  --since YYMMDD     Ingest every edition on or after this date\n` +
      `  --latest-only      Ingest only the most recent edition (default)\n` +
      `  --dry-run          Fetch and parse but do not write files\n` +
      `  --help             Show this message\n`
  );
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

async function getText(url, attempt = 1) {
  await sleep(REQUEST_DELAY_MS);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 4) throw new Error(`HTTP ${res.status} after retries: ${url}`);
    await sleep(1000 * attempt);
    return getText(url, attempt + 1);
  }
  if (res.status === 404) return null; // signal "not found" without throwing
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Edition discovery
// ---------------------------------------------------------------------------

async function discoverEditions() {
  // Fetch the public landing page; it lists "Registers published in YYYY"
  // sub-pages plus direct links to each edition's contents.htm.
  const html = await getText(REGISTER_HOME);
  if (!html) throw new Error("Could not load APPG register landing page");
  const matches = [...html.matchAll(/cmallparty\/(\d{6})\//g)];
  let editions = [...new Set(matches.map((m) => m[1]))];

  // Also walk the per-year index pages, which list older editions.
  const yearLinks = [...html.matchAll(/href="([^"]*registers-published-in-\d{4}[^"]*)"/g)]
    .map((m) => m[1]);
  for (const yl of yearLinks) {
    const url = yl.startsWith("http") ? yl : new URL(yl, REGISTER_HOME).toString();
    try {
      const sub = await getText(url);
      if (sub) {
        const subMatches = [...sub.matchAll(/cmallparty\/(\d{6})\//g)];
        for (const sm of subMatches) editions.push(sm[1]);
      }
    } catch { /* skip year page if it fails */ }
  }
  editions = [...new Set(editions)].sort();
  if (editions.length === 0) throw new Error("No APPG editions found");
  return editions;
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags inside a chunk while preserving text and decoding entities.
 * Used for the `<td><p>...</p></td>` cells throughout the register.
 */
function textOf(html) {
  if (!html) return "";
  return html
    .replace(/<\/?(p|br|span|a|strong|em|b|i)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the next link target (href) in a chunk of HTML, if any.
 * Used to extract secretariat URLs.
 */
function firstHref(html) {
  if (!html) return null;
  const m = html.match(/href="([^"]+)"/);
  return m ? m[1] : null;
}

/** Pull every email address out of a chunk. */
function findEmails(html) {
  const matches = [...(html || "").matchAll(/[\w.+-]+@[\w.-]+\.[\w.-]+/g)];
  return [...new Set(matches.map((m) => m[0]))];
}

/**
 * Extract every `<table class="basicTable">…</table>` block from a page.
 * The APPG schema uses one table per logical section.
 */
function extractTables(html) {
  const out = [];
  const re = /<table\s+class="basicTable"[^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** Within a table body, pull rows as arrays of cell-HTML. */
function extractRows(tableInner) {
  const rows = [];
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(tableInner)) !== null) {
    const cells = [];
    const cellRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let c;
    while ((c = cellRe.exec(m[1])) !== null) cells.push(c[1]);
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** Money band like "90,001-91,500" or "1500-3000" → { low, high }. */
function parseValueBand(bandText) {
  if (!bandText) return { low: null, high: null };
  const cleaned = bandText.replace(/[£,]/g, "").replace(/–/g, "-");
  const m = cleaned.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { low: parseInt(m[1], 10), high: parseInt(m[2], 10) };
  // Could also be a single value
  const single = cleaned.match(/\d+/);
  return { low: single ? parseInt(single[0], 10) : null, high: single ? parseInt(single[0], 10) : null };
}

/** UK date "21/10/2024" → ISO "2024-10-21"; passes through ISO unchanged; null on fail. */
function parseUkDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/**
 * The "Description" cell of a Benefits-In-Kind row often lists every
 * corporate funder of the secretariat in a single sentence:
 *   "X is paid by the following to act as the group's secretariat: A, B, C and D"
 * Extract the comma-separated tail and return the sponsor names.
 */
function extractSponsors(description) {
  if (!description) return [];
  // Common phrasings:
  //   "paid by the following: A, B, C and D"
  //   "from the following: A, B, C and D"
  //   "on behalf of: A, B, C"
  const m = description.match(
    /(?:paid by|funded by|on behalf of|from)\s+(?:the\s+)?(?:following[^:]*:|its members:)?\s*([^.;]+?)(?:\.|;|$)/i
  );
  const tail = (m ? m[1] : description);

  // Split on commas first so we preserve "Ernst & Young" / "M & Co" style
  // firm names (the ampersand is part of the name, not a list separator).
  const parts = tail.split(",").map((s) => s.trim()).filter(Boolean);

  // The final list item often joins with " and ": "A, B and C" → parts =
  // ["A", "B and C"]. Only split " and " on that LAST item — splitting it
  // everywhere would corrupt names like "Cameron McKenna Nabarro Olswang"
  // that legitimately contain "and".
  if (parts.length > 0) {
    const last = parts.pop();
    const lastSplit = last.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
    parts.push(...lastSplit);
  }

  return [...new Set(
    parts
      .filter((s) => s.length >= 2 && s.length <= 80)
      .filter((s) => !/^(an|the|this|that|its|their)$/i.test(s))
      .filter((s) => !/^to\s+act/i.test(s))
  )];
}

/**
 * Parse a single APPG page into a structured group record.
 */
function parseAppgPage(slug, html, editionDate) {
  const tables = extractTables(html);
  const group = {
    id: slug,
    title: null,
    purpose: null,
    category: null,
    url: `${PUBS_BASE}/${editionDate}/${slug}.htm`,
    officers: [],
    registeredContact: null,
    publicEnquiryPoint: null,
    secretariat: [],
    groupWebsite: null,
    agm: {},
    benefits: [],
    rawHtmlChars: html.length,
  };

  // --- Table 0: Title / Purpose / Category ----------------------------------
  if (tables[0]) {
    for (const row of extractRows(tables[0])) {
      if (row.length < 2) continue;
      const key = textOf(row[0]).toLowerCase();
      const val = textOf(row[1]);
      if (key === "title") group.title = val;
      else if (key === "purpose") group.purpose = val;
      else if (key === "category") group.category = val;
    }
  }

  // --- Table 1: Officers ----------------------------------------------------
  if (tables[1]) {
    const rows = extractRows(tables[1]);
    // Skip header rows (row 0 is "Officers" merged cell, row 1 is column headers)
    for (const row of rows.slice(2)) {
      if (row.length < 3) continue;
      group.officers.push({
        role: textOf(row[0]),
        name: textOf(row[1]),
        party: textOf(row[2]),
      });
    }
  }

  // --- Table 2: Contact Details (single cell, mixed paragraphs) -------------
  if (tables[2]) {
    const rows = extractRows(tables[2]);
    // Find the data row (row[0] is just the "Contact Details" header)
    const dataRow = rows.find((r) => r[0] && r[0].length > 100) || rows[1];
    if (dataRow && dataRow[0]) {
      const blob = dataRow[0];
      // Split on the labelled <strong>...</strong> sub-headings
      const sections = blob.split(/<p[^>]*><strong>([^<]+)<\/strong>/i).slice(1);
      for (let i = 0; i + 1 < sections.length; i += 2) {
        const label = sections[i].trim().toLowerCase().replace(/:$/, "");
        const body = sections[i + 1];
        const text = textOf(body);
        const url = firstHref(body);
        const emails = findEmails(body);
        if (label === "registered contact") {
          group.registeredContact = { text, emails };
        } else if (label === "public enquiry point") {
          group.publicEnquiryPoint = { text, emails };
        } else if (label === "secretariat") {
          // Extract the firm name (everything before "acts as the group's
          // secretariat" or before the URL).
          const firmMatch = text.match(/^(.+?)(?:\s+acts as|\s+act as|\s+is the group|\s+provide|\s+provides|\s*\.)/i);
          const firm = firmMatch ? firmMatch[1].trim() : text.split(".")[0].trim();
          group.secretariat.push({ name: firm, url, raw: text });
        } else if (label === "group's website" || label === "group website") {
          group.groupWebsite = url || text;
        }
      }
    }
  }

  // --- Table 3: AGM details -------------------------------------------------
  if (tables[3]) {
    for (const row of extractRows(tables[3])) {
      if (row.length < 2) continue;
      const key = textOf(row[0]).toLowerCase();
      const val = textOf(row[1]);
      if (key.startsWith("date of igm")) group.agm.lastIgmAgmDate = parseUkDate(val) || val;
      else if (key.startsWith("did the group approve")) group.agm.incomeStatementApproved = val;
      else if (key.startsWith("reporting year")) group.agm.reportingYear = val;
      else if (key.startsWith("next reporting deadline")) group.agm.nextReportingDeadline = parseUkDate(val) || val;
    }
  }

  // --- Tables 4+: Registrable benefits --------------------------------------
  // Layout: Table 4 = "Registrable benefits received by the group" header
  //         (often "None" if there are no benefits).
  //         Table 5+ = sub-tables per benefit type ("Benefits In Kind",
  //         "Income from Donations", "Trips funded by", etc.)
  for (let t = 4; t < tables.length; t++) {
    const rows = extractRows(tables[t]);
    if (!rows.length) continue;
    const firstCell = textOf(rows[0][0] || "");
    const isHeader = /registrable benefits received by the group/i.test(firstCell);
    if (isHeader) {
      // Check for "None" rather than a sub-table
      const second = rows[1] && textOf(rows[1][0] || "");
      if (second && /^none$/i.test(second)) break; // no benefits
      continue; // header only; benefits come in subsequent tables
    }

    // Otherwise this is a benefit sub-table.
    const benefitType = firstCell || "Benefit";
    // Identify column-header row (Source / Description / Value / Received / Registered)
    const headerRowIdx = rows.findIndex((r) =>
      r.some((c) => /^source$/i.test(textOf(c))) ||
      r.some((c) => /value/i.test(textOf(c)))
    );
    const headerRow = headerRowIdx >= 0 ? rows[headerRowIdx] : null;
    const headers = headerRow
      ? headerRow.map((c) => textOf(c).toLowerCase())
      : ["source", "description", "value", "received", "registered"];

    for (let r = (headerRowIdx >= 0 ? headerRowIdx + 1 : 1); r < rows.length; r++) {
      const cells = rows[r];
      if (!cells.length || cells.every((c) => !textOf(c))) continue;
      const get = (label) => {
        const idx = headers.findIndex((h) => h.includes(label));
        return idx >= 0 && cells[idx] ? textOf(cells[idx]) : null;
      };
      const description = get("description") || "";
      const valueText = get("value");
      const band = parseValueBand(valueText);
      const sponsors = extractSponsors(description);
      // Pull "From: dd/mm/yyyy / To: dd/mm/yyyy" out of description text
      const fromMatch = description.match(/From:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      const toMatch = description.match(/To:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      group.benefits.push({
        type: benefitType,
        source: get("source"),
        description,
        sponsors,
        valueBand: valueText,
        valueLowGBP: band.low,
        valueHighGBP: band.high,
        fromDate: fromMatch ? parseUkDate(fromMatch[1]) : null,
        toDate: toMatch ? parseUkDate(toMatch[1]) : null,
        receivedDate: parseUkDate(get("received")),
        registeredDate: parseUkDate(get("registered")),
      });
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// Edition processing
// ---------------------------------------------------------------------------

async function fetchContents(editionDate) {
  const url = `${PUBS_BASE}/${editionDate}/contents.htm`;
  const html = await getText(url);
  if (!html) throw new Error(`Edition ${editionDate} not found at ${url}`);
  // Extract all hrefs of form "slug.htm" (excluding contents/introduction/etc.)
  const matches = [...html.matchAll(/href="([a-z0-9-]+)\.htm"/gi)];
  const slugs = [...new Set(matches.map((m) => m[1]))]
    .filter((s) => !["contents", "introduction", "index"].includes(s));
  return { url, slugs };
}

async function fetchEdition(editionDate) {
  console.log(`\n━━━ APPG edition ${editionDate} ━━━`);
  const { url, slugs } = await fetchContents(editionDate);
  console.log(`  contents listed ${slugs.length} groups`);
  const groups = [];
  let n = 0;
  for (const slug of slugs) {
    n++;
    const groupUrl = `${PUBS_BASE}/${editionDate}/${slug}.htm`;
    const html = await getText(groupUrl);
    if (!html) { console.warn(`  ! ${slug} 404`); continue; }
    try {
      groups.push(parseAppgPage(slug, html, editionDate));
    } catch (e) {
      console.warn(`  ! parse failed for ${slug}: ${e.message}`);
    }
    if (n % 50 === 0) process.stdout.write(`  parsed ${n}/${slugs.length}…\r`);
  }
  process.stdout.write(`  parsed ${groups.length} groups${" ".repeat(20)}\n`);
  return {
    metadata: {
      editionId: editionDate,
      editionDate: editionDateToIso(editionDate),
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      totalGroups: groups.length,
    },
    groups,
  };
}

function editionDateToIso(yymmdd) {
  if (!/^\d{6}$/.test(yymmdd)) return yymmdd;
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

function indexById(arr) { return new Map(arr.map((g) => [g.id, g])); }

function diffSnapshots(current, previous) {
  const prev = previous ? indexById(previous.groups) : new Map();
  const curr = indexById(current.groups);
  const added = [];
  const removed = [];
  const officerChanges = []; // { groupId, joined: [...], left: [...] }
  const secretariatChanges = []; // { groupId, before: [...], after: [...] }
  const sponsorChanges = []; // { groupId, addedSponsors: [...], removedSponsors: [...] }
  for (const [id, c] of curr) {
    const p = prev.get(id);
    if (!p) { added.push(c); continue; }
    const oldOff = new Set((p.officers || []).map((o) => `${o.role}|${o.name}`));
    const newOff = new Set((c.officers || []).map((o) => `${o.role}|${o.name}`));
    const joined = [...newOff].filter((x) => !oldOff.has(x));
    const left = [...oldOff].filter((x) => !newOff.has(x));
    if (joined.length || left.length) officerChanges.push({ groupId: id, joined, left });
    const oldSec = (p.secretariat || []).map((s) => s.name).sort().join("|");
    const newSec = (c.secretariat || []).map((s) => s.name).sort().join("|");
    if (oldSec !== newSec) secretariatChanges.push({ groupId: id, before: p.secretariat || [], after: c.secretariat || [] });
    const oldSp = new Set((p.benefits || []).flatMap((b) => b.sponsors || []));
    const newSp = new Set((c.benefits || []).flatMap((b) => b.sponsors || []));
    const addedSp = [...newSp].filter((x) => !oldSp.has(x));
    const removedSp = [...oldSp].filter((x) => !newSp.has(x));
    if (addedSp.length || removedSp.length) sponsorChanges.push({ groupId: id, addedSponsors: addedSp, removedSponsors: removedSp });
  }
  for (const [id, p] of prev) if (!curr.has(id)) removed.push(p);
  return { added, removed, officerChanges, secretariatChanges, sponsorChanges };
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

async function loadCuratedPeople() {
  try {
    const d = JSON.parse(await fs.readFile(INDIV_CONN_PATH, "utf8"));
    const namesById = new Map();
    for (const p of (d.people || [])) {
      const norm = (p.name || "")
        .toLowerCase()
        .replace(/^(rt\.?\s+hon\.?\s+|sir\s+|dame\s+|lord\s+|lady\s+|baroness\s+|the\s+)/i, "")
        .replace(/\s+(mp|cmg|kcb|cbe|obe|kc)$/i, "")
        .trim();
      if (norm) namesById.set(p.id, norm);
    }
    return namesById;
  } catch { return new Map(); }
}

function normaliseName(n) {
  return (n || "")
    .toLowerCase()
    .replace(/^(rt\.?\s+hon\.?\s+|sir\s+|dame\s+|lord\s+|lady\s+|baroness\s+|the\s+|dr\s+|professor\s+|prof\s+)/i, "")
    .replace(/\s+(mp|cmg|kcb|cbe|obe|kc)$/i, "")
    .trim();
}

function triage(snapshot, curatedPeople) {
  const candidates = [];
  for (const g of snapshot.groups) {
    const reasons = [];

    // 1. Secretariat is a known PR / lobbying / public-affairs firm
    for (const sec of (g.secretariat || [])) {
      const lower = (sec.name || "").toLowerCase();
      if (KNOWN_LOBBYING_SECRETARIATS.some((k) => lower.includes(k))) {
        reasons.push(`secretariat is a known public-affairs firm: "${sec.name}"`);
      }
    }

    // 2. Tracked Gracchus suppliers appear as sponsors
    const allSponsors = (g.benefits || []).flatMap((b) => b.sponsors || []);
    const hayHaystack = [
      ...allSponsors,
      ...(g.secretariat || []).map((s) => s.name || ""),
      ...(g.benefits || []).map((b) => b.description || ""),
      g.purpose || "",
    ].join(" | ").toLowerCase();
    const trackedHits = TRACKED_KEYWORDS.filter((kw) => hayHaystack.includes(kw));
    if (trackedHits.length) {
      reasons.push(`mentions tracked keyword(s): ${trackedHits.slice(0, 5).map((k) => `"${k}"`).join(", ")}`);
    }

    // 3. High-impact subject (per HIGH_IMPACT_SUBJECTS) AND has industry sponsors
    const titleLower = (g.title || "").toLowerCase();
    const hitSubject = HIGH_IMPACT_SUBJECTS.find((s) => titleLower.includes(s));
    const totalUpper = (g.benefits || []).reduce((acc, b) => acc + (b.valueHighGBP || 0), 0);
    if (hitSubject && totalUpper > 0) {
      reasons.push(`high-impact subject ("${hitSubject}") with declared benefits up to £${totalUpper.toLocaleString()}/year`);
    }

    // 4. ≥ £30,000/year disclosed benefits regardless of category
    if (totalUpper >= 30000) {
      reasons.push(`total declared benefits up to £${totalUpper.toLocaleString()}/year`);
    }

    // 5. ≥ 5 sponsors named (industry-coalition pattern)
    const uniqSponsors = new Set(allSponsors.map((s) => s.toLowerCase()));
    if (uniqSponsors.size >= 5) {
      reasons.push(`${uniqSponsors.size} distinct sponsors via the secretariat`);
    }

    // 6. Officer overlap with existing curated individual-connections records
    const officerHits = [];
    for (const o of (g.officers || [])) {
      const norm = normaliseName(o.name);
      for (const [pid, pname] of curatedPeople) {
        if (pname === norm || (pname.length > 6 && norm.includes(pname)) || (norm.length > 6 && pname.includes(norm))) {
          officerHits.push({ personId: pid, personName: pname, officerRole: o.role });
        }
      }
    }
    if (officerHits.length) {
      reasons.push(
        `officer overlap with curated records: ${officerHits.map((h) => `${h.personName} (${h.officerRole})`).join("; ")}`
      );
    }

    if (reasons.length) {
      candidates.push({
        groupId: g.id,
        title: g.title,
        category: g.category,
        url: g.url,
        secretariat: g.secretariat,
        officers: g.officers,
        sponsors: [...uniqSponsors],
        totalDeclaredBenefitUpperGBP: totalUpper,
        reasons,
        officerHits,
      });
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Output
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

function renderDiffMarkdown(snapshot, diff, candidates) {
  const m = snapshot.metadata;
  const lines = [];
  lines.push(`# APPG diff — edition ${m.editionId} (${m.editionDate})`);
  lines.push("");
  lines.push(`Source: ${m.sourceUrl}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total groups in this edition: **${m.totalGroups}**`);
  lines.push(`- New groups since previous edition: **${diff.added.length}**`);
  lines.push(`- Disbanded groups since previous edition: **${diff.removed.length}**`);
  lines.push(`- Groups with officer changes: **${diff.officerChanges.length}**`);
  lines.push(`- Groups with secretariat changes: **${diff.secretariatChanges.length}**`);
  lines.push(`- Groups with sponsor list changes: **${diff.sponsorChanges.length}**`);
  lines.push(`- Triage candidates flagged: **${candidates.length}**`);
  lines.push("");

  if (diff.secretariatChanges.length) {
    lines.push("## Secretariat changes");
    lines.push("");
    for (const ch of diff.secretariatChanges) {
      const before = (ch.before || []).map((s) => s.name).join(", ") || "(none)";
      const after = (ch.after || []).map((s) => s.name).join(", ") || "(none)";
      lines.push(`- **${ch.groupId}**: ${before} → ${after}`);
    }
    lines.push("");
  }

  lines.push("## Triage candidates");
  lines.push("");
  if (!candidates.length) {
    lines.push("_None this edition._");
  } else {
    // Sort by upper-band benefit, descending
    const sorted = candidates.slice().sort((a, b) =>
      (b.totalDeclaredBenefitUpperGBP || 0) - (a.totalDeclaredBenefitUpperGBP || 0)
    );
    for (const c of sorted) {
      lines.push(`### ${c.title || c.groupId}  \`${c.groupId}\``);
      lines.push("");
      lines.push(`Category: ${c.category || "—"} · Source: ${c.url}`);
      lines.push("");
      for (const r of c.reasons) lines.push(`- ${r}`);
      lines.push("");
      if (c.secretariat?.length) {
        lines.push(`**Secretariat:** ${c.secretariat.map((s) => s.url ? `[${s.name}](${s.url})` : s.name).join(", ")}`);
      }
      if (c.sponsors?.length) {
        lines.push(`**Sponsors (${c.sponsors.length}):** ${c.sponsors.slice(0, 25).join(", ")}${c.sponsors.length > 25 ? ", …" : ""}`);
      }
      if (c.officers?.length) {
        lines.push(`**Officers:** ${c.officers.map((o) => `${o.name} (${o.role}, ${o.party})`).join("; ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

async function loadIndex() {
  try { return JSON.parse(await fs.readFile(INDEX_PATH, "utf8")); }
  catch { return { editions: [] }; }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { printHelp(); return; }

  console.log("Discovering APPG editions on parliament.uk…");
  const editionsAsc = await discoverEditions();
  console.log(`  ${editionsAsc.length} editions known. Latest: ${editionsAsc.at(-1)} (${editionDateToIso(editionsAsc.at(-1))})`);

  let toProcess;
  if (opts.edition) {
    if (!editionsAsc.includes(opts.edition)) {
      console.warn(`  warning: ${opts.edition} not in discovered list; will try anyway`);
    }
    toProcess = [opts.edition];
  } else if (opts.since) {
    toProcess = editionsAsc.filter((e) => e >= opts.since);
    if (!toProcess.length) throw new Error(`No editions on or after ${opts.since}`);
  } else {
    toProcess = [editionsAsc.at(-1)];
  }

  const idx = await loadIndex();
  const indexed = new Set(idx.editions.map((e) => e.id));
  const curatedPeople = await loadCuratedPeople();
  console.log(`  ${curatedPeople.size} curated people loaded for officer-overlap triage`);

  let lastResult = null;
  for (const edition of toProcess) {
    if (indexed.has(edition) && !opts.edition && !opts.dryRun) {
      console.log(`  skipping ${edition} — already in index`);
      continue;
    }
    const snapshot = await fetchEdition(edition);

    // Find prior snapshot for diffing
    const priorIdx = editionsAsc.findIndex((e) => e === edition);
    const prevEdition = priorIdx > 0 ? editionsAsc[priorIdx - 1] : null;
    let previous = null;
    if (prevEdition) {
      try {
        previous = JSON.parse(await fs.readFile(path.join(SNAPSHOT_DIR, `${prevEdition}.json`), "utf8"));
      } catch { /* no prior snapshot on disk */ }
    }
    const diff = diffSnapshots(snapshot, previous);
    const candidates = triage(snapshot, curatedPeople);

    console.log(
      `  ▸ groups=${snapshot.metadata.totalGroups} added=${diff.added.length} removed=${diff.removed.length} ` +
      `officerChanges=${diff.officerChanges.length} secretariatChanges=${diff.secretariatChanges.length} ` +
      `sponsorChanges=${diff.sponsorChanges.length} triage=${candidates.length}`
    );

    await writeJson(path.join(SNAPSHOT_DIR, `${edition}.json`), snapshot, opts.dryRun);
    await writeText(path.join(DIFF_DIR, `${edition}.md`), renderDiffMarkdown(snapshot, diff, candidates), opts.dryRun);
    await writeJson(path.join(TRIAGE_DIR, `${edition}.json`), { metadata: snapshot.metadata, candidates }, opts.dryRun);

    idx.editions = [
      ...idx.editions.filter((e) => e.id !== edition),
      {
        id: edition,
        editionDate: snapshot.metadata.editionDate,
        groups: snapshot.metadata.totalGroups,
        triageCandidates: candidates.length,
        ingestedAt: new Date().toISOString(),
      },
    ].sort((a, b) => (b.id || "").localeCompare(a.id || ""));
    lastResult = { snapshot, diff, candidates };
  }
  await writeJson(INDEX_PATH, idx, opts.dryRun);

  if (lastResult) {
    console.log(`\nDone. Latest edition: ${lastResult.snapshot.metadata.editionId} (${lastResult.snapshot.metadata.editionDate}).`);
  } else {
    console.log("\nNo new editions to process.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("FATAL:", err.message);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });
}

export {
  parseAppgPage, parseValueBand, parseUkDate, extractSponsors,
  diffSnapshots, triage, normaliseName,
};
