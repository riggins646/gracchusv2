/**
 * MONITORING & ALERTING MODULE
 *
 * Reads the ingest log, computes per-dataset health metrics,
 * and provides alert-hook scaffolding.
 *
 * Produces:
 *   data/snapshots/pipeline-status.json  — machine-readable status
 *   stdout summary                       — human-readable console report
 *
 * Alert hooks:
 *   Slack webhook, email via sendmail, or any HTTP POST endpoint.
 *   Configure via ALERT_HOOKS env or pipeline config.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DATASET_REGISTRY } from "./dataset-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, "data", "snapshots");
const LOG_PATH = path.join(SNAPSHOTS_DIR, "ingest-log.jsonl");
const STATUS_PATH = path.join(SNAPSHOTS_DIR, "pipeline-status.json");

// ═══════════════════════════════════════════════════════════════════════
// STATUS TABLE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build a full pipeline status object from the ingest log.
 * One entry per dataset key, with health metrics.
 */
export function buildPipelineStatus() {
  const logEntries = readIngestLog();
  const byDataset = {};

  // Group log entries by dataset
  for (const entry of logEntries) {
    const key = entry.datasetKey;
    if (!byDataset[key]) byDataset[key] = [];
    byDataset[key].push(entry);
  }

  const status = {};

  for (const [key, config] of Object.entries(DATASET_REGISTRY)) {
    const entries = (byDataset[key] || []).sort((a, b) =>
      (b.fetchedAt || "").localeCompare(a.fetchedAt || "")
    );

    const lastSuccess = entries.find((e) => e.success);
    const lastAttempt = entries[0] || null;
    const recentEntries = entries.slice(0, 30);

    // Count consecutive failures from most recent
    let consecutiveFailures = 0;
    for (const e of recentEntries) {
      if (e.success) break;
      if (e.success === false) consecutiveFailures++;
    }

    // Staleness
    const staleness = computeStaleness(lastSuccess, config);

    // Success rate (last 30 runs)
    const attempted = recentEntries.filter((e) => e.success !== undefined);
    const successRate = attempted.length > 0
      ? attempted.filter((e) => e.success).length / attempted.length
      : null;

    // Validation issues
    const recentValidationIssues = recentEntries
      .filter((e) => e.validationResult && e.validationResult !== "pass")
      .slice(0, 5)
      .map((e) => ({
        at: e.fetchedAt,
        result: e.validationResult,
        notes: e.validationNotes,
      }));

    status[key] = {
      displayName: config.displayName,
      sourceType: config.recommendedSourceType || config.currentSourceType,
      cadence: config.refresh?.cadence || "manual",

      lastSuccessAt: lastSuccess?.fetchedAt || null,
      lastSuccessRecordCount: lastSuccess?.recordCount || null,
      lastAttemptAt: lastAttempt?.fetchedAt || null,
      lastAttemptSuccess: lastAttempt?.success ?? null,
      lastError: lastAttempt?.success === false ? lastAttempt.error : null,

      consecutiveFailures,
      successRate: successRate !== null ? Math.round(successRate * 100) : null,

      staleness: staleness.status,
      daysSinceUpdate: staleness.daysSince,
      staleWarningThreshold: config.staleness?.warningAfterDays || null,
      staleCriticalThreshold: config.staleness?.criticalAfterDays || null,

      recentValidationIssues,

      health: computeHealth(consecutiveFailures, staleness, successRate),
    };
  }

  return status;
}

function computeStaleness(lastSuccess, config) {
  if (!lastSuccess?.fetchedAt) return { status: "never_ingested", daysSince: null };

  const daysSince = Math.floor(
    (Date.now() - new Date(lastSuccess.fetchedAt).getTime()) / 86400000
  );
  const warn = config.staleness?.warningAfterDays || 90;
  const crit = config.staleness?.criticalAfterDays || 180;

  if (daysSince > crit) return { status: "critical", daysSince };
  if (daysSince > warn) return { status: "stale", daysSince };
  return { status: "fresh", daysSince };
}

function computeHealth(consecutiveFailures, staleness, successRate) {
  if (consecutiveFailures >= 5) return "red";
  if (staleness.status === "critical") return "red";
  if (consecutiveFailures >= 2) return "amber";
  if (staleness.status === "stale") return "amber";
  if (successRate !== null && successRate < 70) return "amber";
  if (staleness.status === "never_ingested") return "grey";
  return "green";
}

// ═══════════════════════════════════════════════════════════════════════
// CONSOLE REPORT
// ═══════════════════════════════════════════════════════════════════════

export function printStatusReport(status) {
  const icon = { green: "🟢", amber: "🟡", red: "🔴", grey: "⚪" };

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  SAVING BRITAIN — Pipeline Health Report`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(72)}\n`);

  const sorted = Object.entries(status).sort(
    (a, b) => healthOrder(a[1].health) - healthOrder(b[1].health)
  );

  for (const [key, s] of sorted) {
    const h = icon[s.health] || "❓";
    const stale = s.daysSinceUpdate !== null ? `${s.daysSinceUpdate}d ago` : "never";
    const fails = s.consecutiveFailures > 0 ? `  ⚠ ${s.consecutiveFailures} consecutive failures` : "";
    const rate = s.successRate !== null ? `  rate=${s.successRate}%` : "";

    console.log(
      `${h} ${s.displayName.padEnd(30)} ` +
      `last=${stale.padEnd(10)} ` +
      `${s.cadence.padEnd(10)}` +
      `${fails}${rate}`
    );

    if (s.lastError) {
      console.log(`   └─ error: ${s.lastError.slice(0, 100)}`);
    }
  }

  const counts = { green: 0, amber: 0, red: 0, grey: 0 };
  for (const s of Object.values(status)) counts[s.health] = (counts[s.health] || 0) + 1;

  console.log(`\n${"─".repeat(72)}`);
  console.log(`  🟢 Healthy: ${counts.green}  🟡 Warning: ${counts.amber}  🔴 Critical: ${counts.red}  ⚪ Inactive: ${counts.grey}`);
  console.log(`${"─".repeat(72)}\n`);
}

function healthOrder(h) {
  return { red: 0, amber: 1, grey: 2, green: 3 }[h] ?? 4;
}

// ═══════════════════════════════════════════════════════════════════════
// ALERT HOOKS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fire alerts for datasets in red/amber health.
 * Supports: Slack webhook, generic HTTP POST, console.
 */
export async function fireAlerts(status, opts = {}) {
  const alertable = Object.entries(status)
    .filter(([, s]) => s.health === "red" || (opts.includeAmber && s.health === "amber"))
    .map(([key, s]) => ({ key, ...s }));

  if (alertable.length === 0) {
    console.log("[monitor] No alerts to fire.");
    return { fired: 0 };
  }

  const message = formatAlertMessage(alertable);

  // ── Slack webhook ─────────────────────────────────────────────
  const slackUrl = opts.slackWebhookUrl || process.env.SLACK_PIPELINE_WEBHOOK;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      console.log("[monitor] Slack alert sent.");
    } catch (err) {
      console.error(`[monitor] Slack alert failed: ${err.message}`);
    }
  }

  // ── Generic HTTP POST ─────────────────────────────────────────
  const webhookUrl = opts.webhookUrl || process.env.PIPELINE_ALERT_WEBHOOK;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "gracchus-pipeline",
          timestamp: new Date().toISOString(),
          alerts: alertable,
        }),
      });
      console.log("[monitor] Webhook alert sent.");
    } catch (err) {
      console.error(`[monitor] Webhook alert failed: ${err.message}`);
    }
  }

  // ── Email via sendmail (if available) ─────────────────────────
  const emailTo = opts.alertEmail || process.env.PIPELINE_ALERT_EMAIL;
  if (emailTo) {
    try {
      const { execSync } = await import("child_process");
      const subject = `[Gracchus] Pipeline Alert: ${alertable.length} dataset(s) unhealthy`;
      execSync(
        `echo "${message.replace(/"/g, '\\"')}" | mail -s "${subject}" ${emailTo}`,
        { timeout: 10000 }
      );
      console.log(`[monitor] Email alert sent to ${emailTo}.`);
    } catch {
      // sendmail not available — silent fail
    }
  }

  // ── Always log to console ─────────────────────────────────────
  console.log(`[monitor] ${alertable.length} alert(s):\n${message}`);

  return { fired: alertable.length, message };
}

function formatAlertMessage(alertable) {
  const lines = [
    `🚨 *Gracchus Pipeline Alert* — ${new Date().toISOString().slice(0, 10)}`,
    `${alertable.length} dataset(s) need attention:`,
    "",
  ];

  for (const a of alertable) {
    const icon = a.health === "red" ? "🔴" : "🟡";
    lines.push(`${icon} *${a.displayName}*`);
    if (a.consecutiveFailures > 0) lines.push(`   ${a.consecutiveFailures} consecutive failures`);
    if (a.staleness !== "fresh") lines.push(`   staleness: ${a.staleness} (${a.daysSinceUpdate}d)`);
    if (a.lastError) lines.push(`   error: ${a.lastError.slice(0, 120)}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════

export function savePipelineStatus(status) {
  const payload = {
    generatedAt: new Date().toISOString(),
    datasets: status,
  };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(payload, null, 2));
  console.log(`[monitor] Status written: ${STATUS_PATH}`);
  return STATUS_PATH;
}

// ═══════════════════════════════════════════════════════════════════════
// LOG READER
// ═══════════════════════════════════════════════════════════════════════

function readIngestLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    return fs
      .readFileSync(LOG_PATH, "utf-8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const status = buildPipelineStatus();
  printStatusReport(status);
  savePipelineStatus(status);

  const args = process.argv.slice(2);
  if (args.includes("--alert")) {
    await fireAlerts(status, { includeAmber: args.includes("--include-amber") });
  }
}

if (process.argv[1]?.endsWith("monitor.mjs")) {
  main().catch(console.error);
}

export default { buildPipelineStatus, printStatusReport, savePipelineStatus, fireAlerts };
