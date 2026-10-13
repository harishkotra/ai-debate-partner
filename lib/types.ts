export type Side = "proposition" | "opposition";

export interface DebateMessage {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  turn: number;
  fallacies?: FallacyFlag[];
  createdAt: string;
}

export interface FallacyFlag {
  type: string;
  label: string;
  explanation: string;
  span?: string;
  severity: "low" | "medium" | "high";
}

export interface Scorecard {
  clarity: number;
  evidence: number;
  logic: number;
  rebuttal: number;
  style: number;
  overall: number;
  strengths: string[];
  improvements: string[];
  verdict: string;
  fallacyCount: number;
}

export interface DebateSession {
  id: string;
  motion: string;
  userSide: Side;
  aiSide: Side;
  status: "active" | "finished";
  createdAt: string;
}
