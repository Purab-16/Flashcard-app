# Architecture

How the app is built today. Plans and progress are in `plan.md` and `task.md`. Approved decisions are in `decisions.md`.

## Folders
```
src/
  app/
    (auth)/            login, signup
    (app)/             dashboard, documents, practice, review, mock, stats
    api/
      documents/       create, process (read and split), questions, remove
      subjects/        create, questions, remove
      questions/       report
      attempts/        check one answer
      mock/            start, grade, finish
      review/          questions that are due
      videos/          recommend, click
  components/
    layout/            app-nav, page-header, theme-toggle
    shared/            card-stack, empty-state
    ui/                button, card, input, label, native-select
  lib/
    ai/                providers (gemini, groq), questions, check, usage log, detail filter
    parse/             pdf, docx, txt, chunking, scan OCR, source passage finder
    questions/         flow shared by documents and subjects
    srs/               spaced repetition (SM-2 style)
    limits/            daily AI usage limit
    youtube/           search, relevance check, cache
    supabase/          client, server, admin (service role)
  proxy.ts             route guard (sends signed-out users to login)
prisma/                schema.prisma (types only)
db/proposed/           SQL to review and run by hand
tests/                 Playwright tests
```

## Main flows
1. **Upload.** The browser uploads the file to Supabase Storage, then `POST /api/documents` creates the row and `POST /api/documents/[id]/process` reads it. Text files are parsed directly. A PDF with almost no text is treated as a scan: its first 20 pages become images and the vision model reads them (one AI call per page).
2. **Chunks.** The text is split into parts of about 500 words, headings first. Parts with no real content are skipped.
3. **Questions.** One AI call makes questions for the next part that has none (type and level chosen by the user). Each question keeps an exact `source_quote`. Questions about document details (course code, author, page number) are dropped.
4. **Answer.** MCQ is checked in code. Short and long answers use one AI call and return marks per rubric point. The answer is saved in `attempts` and the next review is planned in `review_state`.
5. **Videos.** Search YouTube, drop shorts and very long videos, keep titles that match the topic, then ask the AI to keep only clearly relevant ones. Nothing is shown if nothing is clearly relevant. Results are cached in `video_cache`.
6. **Review.** Questions come back by the SM-2 schedule. Missed ones return in about 10 minutes.
7. **Mock test.** Built from existing questions. The running test lives in the browser tab (sessionStorage). Answers are graded after submit and the result is saved in `test_sessions` and `attempts`.

## AI layer
- One interface (`generate`, `check`, `vision`). Main provider and fallback come from `AI_PROVIDER` and `AI_FALLBACK`. Model names live in env, never in code.
- Calls fail after 30 seconds and the fallback runs once.
- Every call writes a row to `usage_log`. The daily limit counts those rows (150 per 24 hours by default).

## Data and security
- Every user table has `user_id` and row level security (select, insert and update for own rows only). There is no delete policy.
- Removing data is soft delete (`deleted_at`). Files in Storage are kept.
- The service role key is used in one place only, `src/lib/supabase/admin.ts`, to write the shared `video_cache` table. It is server only.
- Secrets live in `.env` or in the host's settings, never in code.

## Environment variables
See the table in `docs/deploy.md`.
