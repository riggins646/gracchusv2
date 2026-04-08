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
const MODEL = "claude-haiku-4-5-20251001"; // fast + cheap

const SYSTEM_PROMPT = `You are a UK public finance analyst writing for Gracchus, a non-partisan data platform that tracks government spending, waste, and economic performance.

Your job is to explain a chart or data visualisation in 2-3 concise sentences that a general UK audience can understand.

Rules:
- Be specific: cite actual numbers from the data provided
- Be direct: lead with the most important finding
- Provide context: compare to previous periods, benchmarks, or relatable equivalents where possible
- Stay neutral: present facts without political spin
- Use British English and £ for currency
- Never say "this chart shows" — just explain the insight
- Keep it under 60 words`;

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
        max_tokens: 200,
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
