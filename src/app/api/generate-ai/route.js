/**
 * GET /api/generate-ai
 *
 * Daily cron — runs at 04:15 UTC (15 min after data refresh).
 * Iterates through the chart registry, calls Claude once per chart
 * per mode (explain + fix), and writes results to Vercel Blob.
 *
 * ~50 Claude calls total per run. At Sonnet pricing (~300 tokens out × $15/M):
 *   50 calls × ~0.005 = ~$0.25/day = ~$7.50/month. Predictable.
 *
 * Features:
 *   - CRON_SECRET auth (same as other crons)
 *   - Kill switch via AI_LIVE_ENABLED env var
 *   - Writes a manifest.json with generation metadata
 *   - Continues on individual failures (logs errors, doesn't abort)
 *   - Respects maxDuration = 300s for Pro plans
 */

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  CHART_REGISTRY,
  EXPLAIN_SYSTEM_PROMPT,
  FIX_SYSTEM_PROMPT,
  blobPath,
  manifestPath,
  buildUserMessage,
} from "@/lib/ai-registry";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5";

// ── Auth ────────────────────────────────────────────────────────────
function isAuthorised(request) {
  if (process.env.NODE_ENV !== "production") return true;
  if (!process.env.CRON_SECRET) {
    console.error("[generate-ai] CRON_SECRET not set — blocking");
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Call Claude ─────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, maxTokens) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000); // 25s per call

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
    }

    const body = await res.json();
    return body.content?.[0]?.text || null;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ── Write result to blob ────────────────────────────────────────────
async function writeBlob(path, data) {
  return put(path, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

// ── Small delay between API calls to avoid rate limits ──────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main handler ────────────────────────────────────────────────────
async function handler(request) {
  const runStart = Date.now();
  console.log("[generate-ai] Starting batch generation…");

  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Kill switch — allows instant disable without redeploy
  if (process.env.AI_LIVE_ENABLED === "false") {
    console.log("[generate-ai] AI_LIVE_ENABLED=false — skipping generation");
    return NextResponse.json({ ok: true, skipped: true, reason: "kill-switch" });
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });
  }

  const results = [];
  let succeeded = 0;
  let failed = 0;

  for (const chart of CHART_REGISTRY) {
    const userMessage = buildUserMessage({
      title: chart.title,
      label: chart.label || "",
      data: chart.staticData || "",
      editorial: chart.editorial || "",
    });

    // Generate both modes for each chart
    for (const mode of ["explain", "fix"]) {
      const systemPrompt = mode === "explain" ? EXPLAIN_SYSTEM_PROMPT : FIX_SYSTEM_PROMPT;
      const maxTokens = mode === "explain" ? 300 : 400;
      const path = blobPath(chart.chartId, mode);

      try {
        const text = await callClaude(systemPrompt, userMessage, maxTokens);

        if (!text) {
          throw new Error("Empty response from Claude");
        }

        const record = {
          chartId: chart.chartId,
          mode,
          title: chart.title,
          label: chart.label || null,
          text,
          model: MODEL,
          promptVersion: "2026-04-11",
          generatedAt: new Date().toISOString(),
          dataVersion: new Date().toISOString().slice(0, 10),
          status: "ok",
        };

        await writeBlob(path, record);

        results.push({ chartId: chart.chartId, mode, status: "ok" });
        succeeded++;
        console.log(`[generate-ai] ✓ ${chart.chartId}/${mode}`);
      } catch (err) {
        results.push({
          chartId: chart.chartId,
          mode,
          status: "error",
          error: err.message,
        });
        failed++;
        console.error(`[generate-ai] ✗ ${chart.chartId}/${mode}: ${err.message}`);
      }

      // 500ms delay between calls — keeps us under Anthropic rate limits
      await sleep(500);
    }
  }

  // Write manifest — a single blob that records the generation state
  const manifest = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    promptVersion: "2026-04-11",
    totalCharts: CHART_REGISTRY.length,
    totalCalls: succeeded + failed,
    succeeded,
    failed,
    elapsedMs: Date.now() - runStart,
    results,
  };

  try {
    await writeBlob(manifestPath(), manifest);
    console.log("[generate-ai] Manifest written");
  } catch (err) {
    console.error("[generate-ai] Failed to write manifest:", err.message);
  }

  const elapsed = Date.now() - runStart;
  console.log(
    `[generate-ai] Done in ${(elapsed / 1000).toFixed(1)}s — ${succeeded} ok, ${failed} failed`
  );

  return NextResponse.json({
    ok: true,
    succeeded,
    failed,
    totalCharts: CHART_REGISTRY.length,
    elapsed: `${(elapsed / 1000).toFixed(1)}s`,
  });
}

export const GET = handler;
export const POST = handler;

// Allow up to 5 minutes — 50 calls × ~5s each + overhead
export const maxDuration = 300;
