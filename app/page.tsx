"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MOTIONS } from "@/lib/motions";
import { loadHistory, saveSession, type StoredSession } from "@/lib/storage";
import type { DebateMessage, FallacyFlag, Scorecard, Side } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

function FallacyBadges({ flags }: { flags?: FallacyFlag[] }) {
  if (!flags?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {flags.map((f, i) => (
        <span
          key={i}
          title={`${f.explanation}${f.span ? `\n\n"${f.span}"` : ""}`}
          className={`cursor-help rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            f.severity === "high"
              ? "border-red-500/50 bg-red-500/10 text-red-300"
              : f.severity === "medium"
              ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300"
          }`}
        >
          ⚠ {f.label}
        </span>
      ))}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-400">
        <span className="capitalize">{label}</span>
        <span className="font-semibold text-zinc-200">{value}/10</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-zinc-800">
        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [motion, setMotion] = useState(MOTIONS[0].motion);
  const [customMotion, setCustomMotion] = useState("");
  const [userSide, setUserSide] = useState<Side>("proposition");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("");
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [scoring, setScoring] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [history, setHistory] = useState<StoredSession[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const aiSide: Side = userSide === "proposition" ? "opposition" : "proposition";
  const turn = useMemo(() => messages.filter((m) => m.role === "user").length + 1, [messages]);

  useEffect(() => {
    setHistory(loadHistory());
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function persistSession(status: "active" | "finished", msgs: DebateMessage[], card: Scorecard | null = null) {
    const id = sessionId || uid();
    if (!sessionId) setSessionId(id);
    saveSession({ id, motion, userSide, aiSide, status, transcript: msgs, scorecard: card, updatedAt: new Date().toISOString() });
    setHistory(loadHistory());
  }

  function start(custom?: string) {
    const m = custom?.trim() || motion;
    if (!m) return;
    setMotion(m);
    setMessages([]);
    setScorecard(null);
    setStarted(true);
    setSessionId("");
    persistSession("active", []);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: DebateMessage = { id: uid(), role: "user", content: text, turn, createdAt: new Date().toISOString() };
    setInput("");
    setLoading(true);
    // optimistic: flag fallacies locally first (instant UX)
    let optimistic = [...messages, userMsg];
    try {
      const f = await fetch("/api/fallacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const { fallacies } = await f.json();
      userMsg.fallacies = fallacies;
      optimistic = [...messages, { ...userMsg }];
      setMessages(optimistic);
    } catch {
      setMessages(optimistic);
    }
    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motion, userText: text, history: messages, userSide }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // attach server fallacies to user msg
      const withFlags = optimistic.map((m) => (m.id === userMsg.id ? { ...m, fallacies: data.userFallacies ?? m.fallacies } : m));
      const aiMsg: DebateMessage = {
        id: uid(), role: "ai", content: data.reply, turn,
        fallacies: data.aiFallacies ?? [], createdAt: new Date().toISOString(),
      };
      const next = [...withFlags, aiMsg];
      setMessages(next);
      setModel(data.model);
      persistSession("active", next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setScoring(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motion, history: messages }),
      });
      const { scorecard } = await res.json();
      setScorecard(scorecard);
      persistSession("finished", messages, scorecard);
    } finally {
      setScoring(false);
    }
  }

  if (!started) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">ACE · AI Debate Sparring</p>
        <h1 className="mt-2 text-4xl font-bold">Pick a motion. Take a side. Defend it.</h1>
        <p className="mt-3 text-zinc-400">The AI always argues the other side. You get live fallacy flags and a judge&apos;s scorecard at the end. All data stays in your browser (localStorage).</p>

        <h2 className="mt-8 text-sm font-semibold text-zinc-300">1 · Choose a motion</h2>
        <div className="mt-3 grid gap-2">
          {MOTIONS.map((m) => (
            <button
              key={m.motion}
              onClick={() => setMotion(m.motion)}
              className={`rounded-xl border p-3 text-left transition ${motion === m.motion ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{m.category}</span>
              <p className="font-medium">{m.motion}</p>
              <p className="text-xs text-zinc-500">{m.info}</p>
            </button>
          ))}
        </div>
        <input
          value={customMotion}
          onChange={(e) => setCustomMotion(e.target.value)}
          placeholder="…or type your own motion"
          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm outline-none focus:border-emerald-500"
        />

        <h2 className="mt-6 text-sm font-semibold text-zinc-300">2 · Choose your side</h2>
        <div className="mt-2 flex gap-2">
          {(["proposition", "opposition"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => setUserSide(s)}
              className={`flex-1 rounded-xl border p-3 text-sm font-semibold capitalize ${userSide === s ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-400"}`}
            >
              {s}
            </button>
          ))}
        </div>

        <button onClick={() => start(customMotion)} className="mt-6 w-full rounded-xl bg-emerald-500 p-4 font-bold text-zinc-950 hover:bg-emerald-400">
          Start sparring → AI takes {aiSide}
        </button>
        <p className="mt-3 text-center text-xs text-zinc-600">Progress auto-saves to this browser · {history.length} past debate{history.length === 1 ? "" : "s"} stored</p>
        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-zinc-300">Recent debates</h2>
            <div className="mt-2 space-y-2">
              {history.slice(0, 5).map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setMotion(h.motion);
                    setUserSide(h.userSide);
                    setMessages(h.transcript);
                    setScorecard(h.scorecard);
                    setSessionId(h.id);
                    setStarted(true);
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left hover:border-zinc-600"
                >
                  <p className="truncate text-sm font-medium">{h.motion}</p>
                  <p className="text-xs text-zinc-500">
                    {h.userSide} vs AI {h.aiSide} · {h.transcript.filter((m) => m.role === "user").length} turns · {h.status}
                    {h.scorecard ? ` · ${h.scorecard.overall}/10` : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">Round {turn} · You: {userSide} vs AI: {aiSide}</p>
          <h1 className="mt-1 text-xl font-bold">{motion}</h1>
          {model && <p className="text-[11px] text-zinc-600">AI engine: {model}</p>}
        </div>
        <button onClick={() => setStarted(false)} className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white">New motion</button>
      </div>

      <div className="mt-6 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
            Opening argument is yours. State your case: <b>claim → mechanism → evidence</b>.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl border p-4 ${m.role === "user" ? "border-emerald-700/50 bg-emerald-950/30" : "border-zinc-800 bg-zinc-900"}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{m.role === "user" ? `You · Turn ${m.turn}` : `AI (${aiSide}) · Turn ${m.turn}`}</p>
            <div className="prose-debate mt-1 whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            <FallacyBadges flags={m.fallacies} />
          </div>
        ))}
        {loading && <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">AI is steelmanning a rebuttal…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-3 mt-6 rounded-2xl border border-zinc-700 bg-zinc-950/90 p-3 backdrop-blur">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder={`Your turn ${turn} rebuttal… (Enter to send)`}
            className="flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm outline-none focus:border-emerald-500"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="rounded-xl bg-emerald-500 px-5 font-bold text-zinc-950 disabled:opacity-40">Send</button>
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={finish} disabled={messages.length === 0 || scoring} className="flex-1 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2 text-sm font-semibold text-amber-300 disabled:opacity-40">
            {scoring ? "Judging…" : "🏁 Finish & get scorecard"}
          </button>
        </div>
      </div>

      {scorecard && (
        <section className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h2 className="text-lg font-bold">Judge&apos;s Scorecard — {scorecard.overall}/10</h2>
          <p className="text-sm text-zinc-400">{scorecard.verdict}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ScoreBar label="clarity" value={scorecard.clarity} />
            <ScoreBar label="evidence" value={scorecard.evidence} />
            <ScoreBar label="logic" value={scorecard.logic} />
            <ScoreBar label="rebuttal" value={scorecard.rebuttal} />
            <ScoreBar label="style" value={scorecard.style} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><h3 className="text-xs font-bold uppercase text-emerald-400">Strengths</h3><ul className="mt-1 list-disc pl-5 text-sm text-zinc-300">{scorecard.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            <div><h3 className="text-xs font-bold uppercase text-amber-400">To improve</h3><ul className="mt-1 list-disc pl-5 text-sm text-zinc-300">{scorecard.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Fallacies flagged in your speeches: {scorecard.fallacyCount}</p>
        </section>
      )}
    </main>
  );
}
