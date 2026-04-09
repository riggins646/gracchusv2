/**
 * POST /api/explain
 * Receives chart context (title, label, data summary) and returns an AI-generated
 * plain-English explanation using Anthropic Claude.
 *
 * Body: { title: string, label?: string, data: string, editorial?: string }
 * Returns: { explanation: string } or { error: string }
 */

export const runtime = "edge";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5"; // better instruction-following

const SYSTEM_PROMPT = `You are a UK public finance analyst writing for Gracchus, a non-partisan data platform. Your tone is FT/Bloomberg — concise, intelligent, analytical.

You will receive a chart title and possibly some data points. Your job: write a substantive analytical paragraph about this topic using your expertise in UK public finances.

ABSOLUTE RULES — VIOLATION OF THESE IS A FAILURE:
1. NEVER ask the user for data, figures, or context. NEVER say "I need", "could you share", "please provide", or "without seeing". You are the expert — USE YOUR OWN KNOWLEDGE.
2. NEVER mention "Layer 1", "Layer 2", "Layer 3", or any internal system terminology.
3. NEVER refuse to answer. Even if you only receive a chart title with no data, you MUST write a complete, substantive analysis using your knowledge.

Write a single flowing paragraph (60-100 words) that includes:
- The key trend and rate of change (use your knowledge if specific data not provided)
- Relevant comparisons (regional, international, or demographic)
- Affordability or wage-relative context where applicable
- Historical perspective
- Real-world impact on households, public services, or the economy

Style rules:
- If a "Context" editorial line is provided, do NOT repeat or paraphrase it
- No bullet points, no headers, no bold text — flowing prose only
- Use British English and £ for currency
- Write as if briefing someone who can already see the chart`;

export async function POST(request) {
  if (!ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "AI explanations not configured. Add ANTHROPIC_API_KEY to .env.local" },
      { status: 503 }
    );
  }

  try {
    const { title, label, data, editorial } = await request.json();

    if (!data && !title) {
      return Response.json({ error: "No chart data provided" }, { status: 400 });
    }

    const userMessage = [
      `Chart: ${title || "Untitled"}`,
      label ? `Section: ${label}` : "",
      editorial ? `Context: ${editorial}` : "",
      `Data: ${data}`,
    ]
      .filter(Boolean)
      .join("\n");

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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic API error:", res.status, err);
      return Response.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }

    const body = await res.json();
    const explanation =
      body.content?.[0]?.text || "Unable to generate explanation.";

    return Response.json({ explanation });
  } catch (e) {
    console.error("Explain API error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
