/**
 * POST /api/fix
 *
 * Cache-first AI endpoint — identical architecture to /api/explain
 * but returns policy fix suggestions instead of chart explanations.
 *
 * See /api/explain/route.js for full documentation of the pattern.
 */

import { list } from "@vercel/blob";
import { put } from "@vercel/blob";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  blobPath,
  resolveChartId,
  buildUserMessage,
  FIX_SYSTEM_PROMPT,
} from "@/lib/ai-registry";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5";

const RATE_PER_MIN = 3;
const RATE_PER_HOUR = 15;
const MAX_INPUT_LENGTH = 2000;

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

async function writeBlob(path, data) {
  try {
    await put(path, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch (e) {
    console.error("[fix] Blob write failed:", e.message);
  }
}

export async function POST(request) {
  try {
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

    // ── 2. Check blob cache ───────────────────────────────────────
    const chartId = clientChartId || resolveChartId({ title, chartId: clientChartId });

    if (chartId) {
      const cached = await readBlob(blobPath(chartId, "fix"));
      if (cached?.text) {
        return Response.json(
          { fix: cached.text, generatedAt: cached.generatedAt },
          { headers: { "X-Cache": "HIT", "Cache-Control": "public, s-maxage=3600" } }
        );
      }
    }

    // ── 3. Live fallback — rate limit ─────────────────────────────

    if (process.env.AI_LIVE_ENABLED === "false") {
      return Response.json(
        { error: "AI features are temporarily paused" },
        { status: 503 }
      );
    }

    const ip = getClientIp(request);

    const rlMin = rateLimit(`fix:min:${ip}`, RATE_PER_MIN, 60_000);
    if (!rlMin.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rlMin.resetAt - Date.now()) / 1000)),
        },
      });
    }

    const rlHour = rateLimit(`fix:hr:${ip}`, RATE_PER_HOUR, 3_600_000);
    if (!rlHour.allowed) {
      return new Response(JSON.stringify({ error: "Hourly limit reached" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rlHour.resetAt - Date.now()) / 1000)),
        },
      });
    }

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
        max_tokens: 400,
        system: FIX_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[fix] Anthropic error:", res.status);
      return Response.json({ error: "AI service temporarily unavailable" }, { status: 502 });
    }

    const result = await res.json();
    const fix = result.content?.[0]?.text || "Unable to generate suggestions.";

    // ── 5. Save to blob ───────────────────────────────────────────
    if (chartId) {
      const record = {
        chartId,
        mode: "fix",
        title,
        label: label || null,
        text: fix,
        model: MODEL,
        promptVersion: "2026-04-11",
        generatedAt: new Date().toISOString(),
        dataVersion: new Date().toISOString().slice(0, 10),
        status: "ok",
        source: "live-fallback",
      };
      writeBlob(blobPath(chartId, "fix"), record);
    }

    return Response.json(
      { fix },
      { headers: { "X-Cache": "MISS" } }
    );
  } catch (e) {
    if (e.name === "AbortError") {
      console.error("[fix] Request timed out");
      return Response.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[fix] Error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
