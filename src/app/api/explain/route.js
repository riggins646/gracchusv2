/**
 * POST /api/explain
 *
 * Cache-first AI endpoint.
 *
 * 1. Resolve chartId from the payload
 * 2. Check Vercel Blob for pre-generated content
 * 3. If blob hit → return instantly (X-Cache: HIT)
 * 4. If blob miss → live Claude call (rate-limited), save to blob, return
 *
 * The daily cron /api/generate-ai pre-populates the blob store.
 * This endpoint only calls Claude as a fallback for:
 *   - New charts not yet in the registry
 *   - First request before the first cron run
 *   - Edge cases where the blob write failed
 *
 * Rate limits (live fallback only):
 *   - 3 req / min / IP
 *   - 15 req / hour / IP
 *   - Kill switch via AI_LIVE_ENABLED env var
 *   - Input size capped at 2000 chars
 *   - Output capped at 300 tokens
 */

import { list } from "@vercel/blob";
import { put } from "@vercel/blob";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/session-token";
import {
  blobPath,
  resolveChartId,
  buildUserMessage,
  EXPLAIN_SYSTEM_PROMPT,
} from "@/lib/ai-registry";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5";

// ── Rate-limit config (only applies to live fallback) ───────────────
const RATE_PER_MIN = 3;
const RATE_PER_HOUR = 15;
const MAX_INPUT_LENGTH = 2000;

// ── Blob read helper ────────────────────────────────────────────────
async function readBlob(path) {
  try {
    const { blobs } = await list({ prefix: path, limit: 1 });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Blob write helper ───────────────────────────────────────────────
async function writeBlob(path, data) {
  try {
    await put(path, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch (e) {
    console.error("[explain] Blob write failed:", e.message);
  }
}

export async function POST(request) {
  try {
    // ── Session token verification (bot protection) ─────────────
    const token = request.headers.get("x-session-token");
    if (!token || !(await verifyToken(token))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Origin check (CSRF protection) ──────────────────────────
    const origin = request.headers.get("origin");
    const ALLOWED_ORIGINS = ["https://gracchus.ai", "https://www.gracchus.ai"];
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // ── 1. Validate input ─────────────────────────────────────────
    const title = typeof body?.title === "string" ? body.title : "";
    const label = typeof body?.label === "string" ? body.label : "";
    const data  = typeof body?.data  === "string" ? body.data  : "";
    const editorial = typeof body?.editorial === "string" ? body.editorial : "";
    const clientChartId = typeof body?.chartId === "string" ? body.chartId : "";

    if (!data && !title) {
      return Response.json({ error: "Bad request" }, { status: 400 });
    }

    // ── 2. Resolve chartId and check blob cache ───────────────────
    const chartId = clientChartId || resolveChartId({ title, chartId: clientChartId });

    if (chartId) {
      const cached = await readBlob(blobPath(chartId, "explain"));
      if (cached?.text) {
        return Response.json(
          { explanation: cached.text, generatedAt: cached.generatedAt },
          { headers: { "X-Cache": "HIT", "Cache-Control": "public, s-maxage=3600" } }
        );
      }
    }

    // ── 3. Live fallback — rate limit first ───────────────────────

    // Kill switch
    if (process.env.AI_LIVE_ENABLED === "false") {
      return Response.json(
        { error: "AI features are temporarily paused" },
        { status: 503 }
      );
    }

    const ip = getClientIp(request);

    // Per-minute limit
    const rlMin = rateLimit(`explain:min:${ip}`, RATE_PER_MIN, 60_000);
    if (!rlMin.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rlMin.resetAt - Date.now()) / 1000)),
        },
      });
    }

    // Per-hour limit
    const rlHour = rateLimit(`explain:hr:${ip}`, RATE_PER_HOUR, 3_600_000);
    if (!rlHour.allowed) {
      return new Response(JSON.stringify({ error: "Hourly limit reached" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rlHour.resetAt - Date.now()) / 1000)),
        },
      });
    }

    // Input size cap
    const totalLength = title.length + label.length + data.length + editorial.length;
    if (totalLength > MAX_INPUT_LENGTH) {
      return Response.json({ error: "Bad request" }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      return Response.json({ error: "Service unavailable" }, { status: 503 });
    }

    // ── 4. Call Claude ────────────────────────────────────────────
    const userMessage = buildUserMessage({ title, label, data, editorial });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: EXPLAIN_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[explain] Anthropic error:", res.status);
      return Response.json({ error: "AI service temporarily unavailable" }, { status: 502 });
    }

    const result = await res.json();
    const explanation = result.content?.[0]?.text || "Unable to generate explanation.";

    // ── 5. Save to blob so future requests are cached ─────────────
    if (chartId) {
      const record = {
        chartId,
        mode: "explain",
        title,
        label: label || null,
        text: explanation,
        model: MODEL,
        promptVersion: "2026-04-11",
        generatedAt: new Date().toISOString(),
        dataVersion: new Date().toISOString().slice(0, 10),
        status: "ok",
        source: "live-fallback",
      };
      // Don't await — let it write in the background
      writeBlob(blobPath(chartId, "explain"), record);
    }

    return Response.json(
      { explanation },
      { headers: { "X-Cache": "MISS" } }
    );
  } catch (e) {
    if (e.name === "AbortError") {
      console.error("[explain] Request timed out");
      return Response.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[explain] Error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
