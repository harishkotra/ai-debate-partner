import { NextResponse } from "next/server";
import { detectFallacies } from "@/lib/fallacies";
import { generateRebuttal } from "@/lib/ai";
import type { DebateMessage, Side } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { motion, userText, history = [], userSide = "proposition" } = body as {
      motion: string;
      userText: string;
      history: DebateMessage[];
      userSide: Side;
    };
    if (!motion || !userText) {
      return NextResponse.json({ error: "motion and userText are required" }, { status: 400 });
    }
    const aiSide: Side = userSide === "proposition" ? "opposition" : "proposition";
    const userFallacies = detectFallacies(userText);
    const { text, model } = await generateRebuttal({ motion, aiSide, history, userText });
    const aiFallacies = detectFallacies(text);
    return NextResponse.json({ reply: text, model, aiSide, userFallacies, aiFallacies });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "debate generation failed" }, { status: 500 });
  }
}
