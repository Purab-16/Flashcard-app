# Plan

Full project plan. Progress is tracked in `docs/task.md`. Approved decisions are in `docs/decisions.md`.

## Idea
Upload study material (PDF, DOCX, TXT, image). The app splits it into chunks and uses AI to ask practice questions. AI checks answers, explains mistakes with the source text, and recommends YouTube videos.

## Stack (approved)
| Area | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind, shadcn/ui, Zustand |
| Backend | Supabase (Postgres, Auth, Storage), Prisma 7 for schema and types |
| AI | Vercel AI SDK. Main: Gemini (`gemini-3.8-flash`). Fallback: Groq (`openai/gpt-oss-20b`). Ollama is in the plan but OFF |
| Parsing | pdf-parse, mammoth, Gemini Vision for images |
| Videos | YouTube Data API |
| Hosting | Vercel |

## Rules that never change
- No git or gh commands by the agent. The human runs them.
- No hard delete. Use `deleted_at`. No delete policy on any table.
- RLS on every table, `user_id` on every user table.
- Ask before changing stack, schema, auth, build, or folder structure.
- Never read or print secrets. The human edits `.env`.
- One AI call per chunk, each step under 10 seconds.

## Phases

### Phase 0: Foundation (done)
Scaffold, env, Supabase project, auth, schema, RLS, AI layer with Gemini and usage log.

### Phase 1: Core practice loop (done)
Upload, parse, chunk, MCQ + short + long questions (3 per chunk, 4 MCQ options), AI check with correct answer, reasoning and source quote, Groq fallback, retry for failed documents.

### Phase 2: Learning aids (code done, human test pending; subject-wide practice still open)
| # | Feature | Plan |
|---|---|---|
| 2.1 | Report question | Button on the result card. Saves a row in `question_reports` and sets the question to `flagged`, so it is not shown again |
| 2.2 | Source highlight | Result card shows the part of the document around `source_quote`, with the quote highlighted |
| 2.3 | Subject folders | Create subjects, pick one on upload, group the document list by subject, practice a whole subject |
| 2.4 | Weak topic stats | `/stats` page: wrong count and accuracy per topic. Simple bars made with CSS, no chart library |
| 2.5 | YouTube | On a wrong answer: videos for the weak topic show automatically. On a correct answer: shown only when the user clicks. Results cached by topic in `video_cache`. Clicks saved in `video_clicks` |
| 2.6 | Difficulty and hint polish | Difficulty and hint already work. Show difficulty on the card, track hint use in stats |

YouTube notes:
- Search costs 100 quota units. Free quota is 10,000 per day, so about 100 searches per day. Caching by topic keeps this low.
- The API key stays on the server only.
- Writing `video_cache` needs the server-side service role key (the schema allows writes only from the server). Approved by the human on 2026-10-30. The key is used only in `src/lib/supabase/admin.ts`, server side.

### Phase 3: Retention (code done, human test pending)
| # | Feature |
|---|---|
| 3.1 | Spaced repetition (SM-2 style) using `review_state`. Wrong questions come back sooner |
| 3.2 | Partial marks rubric view for short and long answers |
| 3.3 | Flashcards: no separate option. Practice is shown as a card, with answer, submit, hint and every other practice feature inside |
| 3.4 | Mock test mode: timer, negative marking, final report (`test_sessions`). Uses questions that already exist. The running test lives in the browser tab (sessionStorage), the result is saved in the database |

### Phase 4: Polish and launch
| # | Feature |
|---|---|
| 4.1 | Per-user usage limit: 150 AI calls per rolling 24 hours, counted from `usage_log` (done) |
| 4.2 | Scanned PDF support (OCR through Gemini Vision) |
| 4.3 | UI polish and mobile layout |
| 4.4 | Playwright tests |
| 4.5 | Public launch checklist: paid Gemini key, Supabase Confirm email ON, privacy page, remove test users |

## Known risks
- Gemini can be busy (503). Calls fail after 30 seconds and the Groq fallback takes over.
- AI can write wrong questions. Questions whose `source_quote` is not in the chunk are dropped, and users can report questions.
- Large files make many chunks. Questions are made one chunk at a time.
- OCR is weak on handwriting.
