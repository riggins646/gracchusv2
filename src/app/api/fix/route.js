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
const MODEL = "claude-sonnet-4-5-20241022"; // better instruction-following

const SYSTEM_PROMPT = `You are a UK public policy thinker writing for Gracchus, a non-partisan data platform. Your tone is Economist editorial meets think-tank briefing — intellectually curious, slightly provocative, always grounded.

You will receive a chart title and possibly some data points. Your job: explore what could actually fix or improve this situation, drawing on your deep knowledge of UK public policy.

ABSOLUTE RULES — VIOLATION OF THESE IS A FAILURE:
1. NEVER ask the user for data, figures, or context. NEVER say "I need", "could you share", "please provide", or "without seeing". You are the expert — USE YOUR OWN KNOWLEDGE.
2. NEVER mention "Layer 1", "Layer 2", "Layer 3", or any internal system terminology.
3. NEVER refuse to answer. Even if you only receive a chart title with no data, you MUST write a complete, substantive response using your knowledge of UK policy.

Structure your response with these exact bold markdown headers:

**Why this keeps happening**
1-2 sentences on structural root causes. Be specific — name the systems, incentives, or institutional failures.

**What could actually work**
3-5 bullet points (use "- " prefix). Each must be a specific, concrete intervention referencing real mechanisms (planning law, fiscal levers, institutional reform, international examples).

**The hard truth**
1-2 sentences on why fixes are difficult. Name real trade-offs and obstacles honestly.

Style rules:
- If a "Context" editorial line is provided, do NOT repeat or paraphrase it
- Be exploratory and discussion-provoking — ideas to debate, not prescriptions
- Stay non-partisan but don't be bland — have a point of view grounded in evidence
- Be specific to the UK — reference real institutions (Treasury, BoE, OBR, DLUHC, NHS, Ofgem, etc.)
- Use British English and £ for currency
- Keep total response between 100-150 words
- Plain language, no jargon`;

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
