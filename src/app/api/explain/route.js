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

const SYSTEM_PROMPT = `You are a UK public finance analyst writing for Gracchus, a non-partisan data platform. Your tone is FT/Bloomberg — concise, intelligent, analytical.

ROLE: You provide Layer 2 analysis. Layer 1 (the editorial headline) already gives users a quick takeaway. Your job is to go deeper: explain what is happening and why it matters.

Structure your response as a flowing paragraph (no headers, no bullet points, no bold markers). Include:
- The key trend and its rate of change (cite specific numbers when available)
- Regional or demographic comparisons where relevant (e.g. London vs UK, top vs bottom quintile)
- Affordability or wage-relative context (e.g. "now equivalent to X% of median take-home pay")
- Historical comparison (e.g. "up from X in 2015", "highest since Y")
- Real-world impact on households, savings, public services, or the economy

Rules:
- CRITICAL: You will receive the editorial headline in the "Context" field. You MUST NOT repeat or closely paraphrase it. The headline is the takeaway; you are the analysis underneath it.
- Cite actual numbers from the data when provided
- If specific data points are sparse, use your knowledge of UK public finances to give substantive analysis
- Stay neutral: factual, no political spin, no policy suggestions
- Use British English and £ for currency
- Never say "this chart shows" or "the data shows" — write as if briefing someone who can already see the chart
- Never ask for more data or say you cannot see the chart
- No bullet points, no numbered lists, no bold headers — write in flowing analytical prose
- Keep total response between 60-100 words`;

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
