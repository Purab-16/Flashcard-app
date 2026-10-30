# Flashcard App

Study from your own notes. Upload a PDF, DOCX, text file or a photo, and the app makes practice questions from it. It checks your answers, shows the exact passage in your notes, suggests videos for what you missed, and brings missed questions back at the right time.

## Features
- Upload PDF, DOCX, TXT or an image. Scanned PDFs are read with AI (up to 20 pages).
- MCQ, short answer and long answer questions, easy, medium or hard.
- Answer checking with a correct answer, a reason, marks per rubric point and the source passage highlighted.
- Hints, skip, and a report button for bad questions.
- Spaced repetition: missed questions come back sooner. Review page for what is due.
- Subjects (folders), document removal (soft delete), weak topic stats.
- YouTube videos for the topic you missed, only when clearly relevant.
- Timed mock tests with negative marking and a report.
- Light and dark mode, phone layout, keyboard keys in practice.

## Stack
| Area | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind 4, shadcn/ui |
| Backend | Supabase (Postgres, Auth, Storage). Prisma is used for schema and types only |
| AI | Vercel AI SDK. Gemini first, Groq as fallback |
| Parsing | pdf-parse, mammoth, Gemini Vision for images and scans |
| Videos | YouTube Data API |
| Tests | Playwright |
| Hosting | Vercel |

More in [docs/architecture.md](docs/architecture.md). Every approved decision is in [docs/decisions.md](docs/decisions.md).

## Run it locally
1. `npm install`
2. Create `.env` and fill in the variables listed in [docs/deploy.md](docs/deploy.md). Never commit it.
3. Run the SQL files in `db/proposed/` in the Supabase SQL editor, in order (`001`, then `002`).
4. `npm run dev` and open http://localhost:3000

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Lint |
| `npm run test:e2e` | End to end tests |

## Project layout
| Path | Purpose |
|---|---|
| `src/app/(app)` | Signed-in pages: dashboard, documents, practice, review, mock, stats |
| `src/app/(auth)` | Login and signup |
| `src/app/api` | API routes (documents, questions, attempts, subjects, mock, review, videos) |
| `src/components/layout` | App navigation, page header, theme toggle |
| `src/components/shared` | Reusable pieces such as the empty state |
| `src/components/ui` | Base UI components (button, input, select and so on) |
| `src/lib/ai` | AI providers, question making, answer checking |
| `src/lib/parse` | File reading, chunking, scan OCR |
| `src/lib/questions` | Question flow shared by documents and subjects |
| `src/lib/srs` | Spaced repetition |
| `src/lib/limits` | Daily AI usage limit |
| `src/lib/youtube` | Video search, relevance check and cache |
| `src/lib/supabase` | Browser, server and admin clients |
| `db/proposed` | SQL for the human to review and run |
| `db/migrations` | Approved migrations |
| `tests` | Playwright tests |
| `scripts` | Helper scripts and the AI guardrails |
| `docs` | Plan, tasks, decisions, architecture, deploy steps |

## Tests
End to end tests use Playwright. They need a separate test account.

1. Copy `tests/env.test.example` to `tests/.env.test` and fill in `E2E_EMAIL` and `E2E_PASSWORD`.
2. Run `npm run test:e2e`. It reuses a running dev server or starts one.

The practice and mock test screens use fake API replies, so the tests cost no AI calls.

## AI tool guardrails
All rules live in [AGENTS.md](AGENTS.md). Tool-specific files only point to it.

Hard enforcement lives in `scripts/guard/` (shared rules + hook adapter). Requires Node.js.
Agents cannot edit guardrail files. Change them by hand.

| Tool | File |
|---|---|
| OpenCode | `opencode.json`, `AGENTS.md` |
| Antigravity | `GEMINI.md`, `AGENTS.md` |
| Cursor | `.cursor/rules/guardrails.mdc` |
| Copilot | `.github/copilot-instructions.md` |
| Claude Code | `CLAUDE.md`, `.claude/settings.json` |


## Live

https://flashcard-app-purab5.vercel.app