# ACE — AI Debate Sparring

Interactive debate practice: pick a motion, argue your side, the AI always takes the other side. Live logical-fallacy flags + post-debate judge's scorecard.

## Stack (meets all requirements)

| Requirement | Implementation |
|---|---|
| Frontend (React + Next.js) | Next.js 14 App Router, `app/page.tsx` — motion picker, turn-based arena, scorecard |
| Backend (API routes) | `app/api/debate`, `app/api/fallacy`, `app/api/score` |
| Database (localStorage) | `lib/storage.ts` — sessions + scorecards persist in-browser (last 20, newest first), resumable from start screen |
| AI model | Pluggable OpenAI-compatible (`AI_BASE_URL`/`AI_MODEL`) + offline template engine — works with zero keys |
| Deployment (Vercel) | `vercel.json`, `vercel --prod` ready |

## Architecture

```
app/page.tsx (client arena)
  ├─ POST /api/debate  → lib/ai.ts generateRebuttal() → OpenAI-compatible or offlineRebuttal()
  ├─ POST /api/fallacy → lib/fallacies.ts detectFallacies() (10 deterministic rules)
  ├─ POST /api/score   → heuristic + optional AI judge JSON
  └─ lib/storage.ts   → localStorage persist (history, resume, scorecards)
```

## Quickstart

```bash
npm install
cp .env.example .env.local   # AI key optional — works offline without it
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

```bash
vercel --prod
# then optionally add OPENAI_API_KEY in Vercel dashboard (works offline without it)
```

## Milestones

- [x] 1. Requirements & architecture
- [x] 2. Next.js + Tailwind UI
- [x] 3. localStorage persistence
- [x] 4. AI model generation
- [ ] 5. `vercel --prod` (run it — config is ready)
