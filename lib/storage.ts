import type { DebateMessage, Scorecard, Side } from "./types";

export interface StoredSession {
  id: string;
  motion: string;
  userSide: Side;
  aiSide: Side;
  status: "active" | "finished";
  transcript: DebateMessage[];
  scorecard: Scorecard | null;
  updatedAt: string;
}

const KEY = "ace:debates:v1";

function safeParse(raw: string | null): StoredSession[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** All debates, newest first. */
export function loadHistory(): StoredSession[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(KEY)).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
}

/** Upsert one session, capped at 20 entries. */
export function saveSession(session: StoredSession): void {
  if (typeof localStorage === "undefined") return;
  const rest = safeParse(localStorage.getItem(KEY)).filter((s) => s.id !== session.id);
  localStorage.setItem(KEY, JSON.stringify([session, ...rest].slice(0, 20)));
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}
