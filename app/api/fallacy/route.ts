import { NextResponse } from "next/server";
import { detectFallacies } from "@/lib/fallacies";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  return NextResponse.json({ fallacies: detectFallacies(String(text)) });
}
