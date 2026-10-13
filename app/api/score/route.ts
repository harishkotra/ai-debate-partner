import { NextResponse } from "next/server";
import { generateScorecard } from "@/lib/ai";
import type { DebateMessage, Scorecard } from "@/lib/types";

function heuristic(history: DebateMessage[]): Scorecard {
  const userMsgs = history.filter((m) => m.role === "user");
  const words = userMsgs.reduce((n, m) => n + m.content.split(/\s+/).length, 0);
  const avgLen = userMsgs.length ? words / userMsgs.length : 0;
  const fallacyCount = userMsgs.reduce((n, m) => n + (m.fallacies?.length ?? 0), 0);
  const evidenceHits = userMsgs.reduce(
    (n, m) => n + (/statistic|study|data|percent|%|research|example|for instance|according to/i.test(m.content) ? 1 : 0),
    0
  );
  const clamp = (v: number) => Math.max(1, Math.min(10, Math.round(v)));
  const clarity = clamp(5 + (avgLen > 40 ? 2 : avgLen > 20 ? 1 : -1));
  const evidence = clamp(4 + evidenceHits * 1.5 - fallacyCount * 0.5);
  const logic = clamp(6 - fallacyCount * 0.8 + (userMsgs.length >= 3 ? 1 : 0));
  const rebuttal = clamp(4 + Math.min(4, userMsgs.length) + (userMsgs.some((m) => /however|but|flaw|fails|wrong|clash/i.test(m.content)) ? 1 : 0));
  const style = clamp(5 + (avgLen > 60 ? 1 : 0));
  const overall = Math.round((clarity + evidence + logic + rebuttal + style) / 5);
  return {
    clarity, evidence, logic, rebuttal, style, overall, fallacyCount,
    strengths: [
      userMsgs.length >= 3 ? `Sustained ${userMsgs.length}-turn engagement` : "Willingness to engage the motion",
      evidenceHits > 0 ? `Used evidence in ${evidenceHits} turn(s)` : "Clear position-taking",
    ],
    improvements: [
      fallacyCount > 0 ? `Fix ${fallacyCount} flagged fallacy/fallacies (see badges)` : "Add clash: quote the AI and rebut directly",
      evidenceHits < userMsgs.length ? "Add one statistic or concrete example per turn" : "Tighten weighing: why your impact matters most",
    ],
    verdict: overall >= 8 ? "Competition-ready. Sharp clash and weighing." : overall >= 6 ? "Solid sparring round — tighten evidence and rebuttal." : "Good start — focus on structure: claim → mechanism → evidence → weighing.",
  };
}

export async function POST(req: Request) {
  const { motion, history = [] } = (await req.json()) as { motion: string; history: DebateMessage[] };
  if (!motion) return NextResponse.json({ error: "motion required" }, { status: 400 });
  const base = heuristic(history);
  const { json, model } = await generateScorecard({ motion, history });
  if (json) {
    try {
      const ai = JSON.parse(json);
      return NextResponse.json({ scorecard: { ...base, ...ai, fallacyCount: base.fallacyCount }, model });
    } catch { /* fall through */ }
  }
  return NextResponse.json({ scorecard: base, model });
}
