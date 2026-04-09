/**
 * POST /api/fix
 * Receives chart context and returns AI-generated ideas for possible solutions,
 * improvements, or policy levers. Non-partisan and exploratory in tone.
 *
 * Body: { title: string, label?: string, data: string, editorial?: string }
 * Returns: { fix: string } or { error: string }
 */

export const runtime = "edge";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a UK public policy analyst writing for Gracchus, a non-partisan data platform that tracks government spending, waste, and economic performance.

You have been asked: "What's the fix?" for a specific chart or data trend. Your job is to suggest possible causes and practical solutions in a thoughtful, exploratory way.

Structure your response as follows:
**Possible causes:** 1-2 sentences identifying likely root causes or structural drivers behind the trend.
**Potential fixes:** 3-5 concise bullet points, each a specific policy lever, structural improvement, or practical solution. Keep each bullet to one sentence.
**Trade-offs:** 1-2 sentences acknowledging key risks, costs, or political trade-offs.

Rules:
- Be thoughtful and exploratory — present ideas for discussion, not prescriptions
- Stay strictly non-partisan — avoid ideological framing or party-political language
- Be specific to the UK context — reference real institutions (Treasury, BoE, OBR, NHS, etc.) where relevant
- Where data points are provided, reference them to ground your suggestions
- Where only a chart title is provided, use your knowledge of UK public finances to give substantive, relevant suggestions
- Never refuse to answer or ask for more data — always provide useful ideas
- Use British English and £ for currency
- Keep the total response under 120 words
- Use plain language a general audience can understand`;

export async function POST(request) {
  if (!ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "AI features not configured. Add ANTHROPIC_API_KEY to .env.local" },
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
      data ? `Data: ${data}` : "",
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
        max_tokens: 400,
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
    const fix =
      body.content?.[0]?.text || "Unable to generate suggestions.";

    return Response.json({ fix });
  } catch (e) {
    console.error("Fix API error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
