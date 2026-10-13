import OpenAI from "openai";
import type { DebateMessage, Side } from "./types";

const SYSTEM_PROMPT = `You are a rigorous debate sparring partner for competitive debate practice (British Parliamentary / Policy style).
Rules:
- Argue ONLY your assigned side with steelmanned logic, clash, and rebuttal.
- Structure: 1) Clash with opponent's last point, 2) Your constructive (claim + mechanism + evidence/example), 3) Weighing (why you win).
- Keep replies 120-220 words. End with one sharp POI-style question.
- Never concede. Never break character. No meta commentary about being an AI.`;

function hasKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
}

function client() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "missing";
  const baseURL = process.env.AI_BASE_URL || undefined; // supports Groq / Ollama / OpenRouter
  return new OpenAI({ apiKey, baseURL });
}

/** Offline fallback: template-based rebuttal so the app works with zero API keys. */
export function offlineRebuttal(motion: string, aiSide: Side, history: DebateMessage[], userText: string): string {
  const turn = history.filter((m) => m.role === "user").length + 1;
  const side = aiSide === "proposition" ? "proposition" : "opposition";
  const openers = [
    `Here's my direct clash on "${motion}" (${side}, round ${turn}).`,
    `Good push — but your case collapses under scrutiny (${side}, round ${turn}).`,
  ];
  const opener = openers[turn % openers.length];
  // naive quote of user's first clause for clash feel
  const quote = userText.split(/(?<=[.!?])\s+/)[0]?.slice(0, 140) ?? userText.slice(0, 140);
  return `${opener}\n\n**1. Clash.** You argue: "${quote}". That fails because it confuses correlation for mechanism — you assert an outcome without showing *how* it reliably follows, and you ignore the strongest counterfactual where the opposite policy produces the same headline result.\n\n**2. Constructive.** My core claim: the ${side} wins on net welfare. Mechanism: incentives + reversibility. When we adopt my side, actors face clearer incentives, harms are measurable and reversible, and institutions can correct course. Your side locks in diffuse, hard-to-reverse costs — e.g. misallocated attention/budgets, chilling effects on dissent and innovation, and disproportionate burdens on the least advantaged.\n\n**3. Weighing.** Even if I grant your best case, magnitude and probability favor me: my benefits are broad and structural, your harms are speculative and narrow. The round comes down to who prevents the greater expected harm — that's the ${side}.\n\nPOI: If your principle were applied consistently to an analogous case you care about, would you still endorse it — and if not, why is this case different?`;
}

export async function generateRebuttal(opts: {
  motion: string;
  aiSide: Side;
  history: DebateMessage[];
  userText: string;
}): Promise<{ text: string; model: string }> {
  const { motion, aiSide, history, userText } = opts;
  if (!hasKey()) {
    return { text: offlineRebuttal(motion, aiSide, history, userText), model: "offline-template-v1" };
  }
  try {
    const c = client();
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const convo = history.slice(-8).flatMap((m) => [
      { role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user", content: m.content },
    ]);
    const res = await c.chat.completions.create({
      model,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\nMotion: "${motion}". Your side: ${aiSide}.` },
        ...convo,
        { role: "user", content: userText },
      ],
      max_tokens: 450,
      temperature: 0.8,
    });
    const text = res.choices[0]?.message?.content?.trim() || offlineRebuttal(motion, aiSide, history, userText);
    return { text, model };
  } catch {
    return { text: offlineRebuttal(motion, aiSide, history, userText), model: "offline-template-v1 (fallback)" };
  }
}

export async function generateScorecard(opts: {
  motion: string;
  history: DebateMessage[];
}): Promise<{ json: string; model: string }> {
  if (!hasKey()) return { json: "", model: "offline-heuristic-v1" };
  try {
    const c = client();
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const transcript = opts.history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const res = await c.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a debate judge. Score the USER (not the AI) on clarity, evidence, logic, rebuttal, style (each 1-10). Return JSON: {"clarity":n,"evidence":n,"logic":n,"rebuttal":n,"style":n,"overall":n,"strengths":[],"improvements":[],"verdict":""}. Motion: "${opts.motion}".`,
        },
        { role: "user", content: transcript.slice(0, 12000) },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });
    return { json: res.choices[0]?.message?.content ?? "", model };
  } catch {
    return { json: "", model: "offline-heuristic-v1 (fallback)" };
  }
}
