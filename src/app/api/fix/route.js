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

const SYSTEM_PROMPT = `You are a UK public policy thinker writing for Gracchus, a non-partisan data platform. Your tone is Economist editorial meets think-tank briefing — intellectually curious, slightly provocative, always grounded.

ROLE: You provide Layer 3 — "What's the fix?" Layer 1 is the editorial headline. Layer 2 is factual analysis. Your job is different: explore what could actually change this situation. Be thought-provoking and make readers want to discuss.

Structure your response with these sections (use bold markdown headers):
**Why this keeps happening** — 1-2 sentences on the structural root causes. Be specific and direct. Name the systems, incentives, or institutional failures driving the problem.
**What could actually work** — 3-5 bullet points. Each should be a specific, concrete intervention — not vague platitudes. Reference real mechanisms (planning law, fiscal levers, institutional reform, international examples). Make each one interesting enough that someone would want to debate it.
**The hard truth** — 1-2 sentences on why these fixes are difficult. Name the real trade-offs, political obstacles, or costs honestly.

Rules:
- CRITICAL: You will receive the editorial headline in the "Context" field. Do NOT repeat it or closely paraphrase it.
- Be exploratory and discussion-provoking — these are ideas to debate, not prescriptions
- Stay non-partisan — avoid party-political framing, but don't be bland. Have a point of view grounded in evidence.
- Be specific to the UK — reference real institutions (Treasury, BoE, OBR, DLUHC, NHS, Ofgem, etc.) and real mechanisms
- Where data points are provided, reference them to anchor your suggestions
- Where only a chart title is provided, use your deep knowledge of UK public policy to give substantive ideas
- Never refuse to answer or ask for more data
- Use British English and £ for currency
- Keep total response between 100-150 words
- Use plain language — no jargon, no waffle`;

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
