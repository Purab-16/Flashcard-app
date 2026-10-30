# Product spec (v0.1)

Status: scope approved by the human. Stack NOT decided yet.

## Idea
User uploads study material (text, PDF, DOCX, image). The app parses it and uses AI to ask practice questions. AI checks answers, explains mistakes with context, and recommends YouTube videos or playlists.

## Core
| Feature | Detail |
|---|---|
| Upload | PDF, DOCX, TXT, image (OCR) |
| Question types | MCQ, short answer, long answer. User chooses the type |
| AI checking | Correct or wrong, correct answer, reasoning, source context |
| YouTube on wrong answer | Videos or playlists for the weak topic |
| YouTube on correct answer | Shown on user click only (optional deeper learning) |

## High value add-ons (all approved)
| Feature | Detail |
|---|---|
| Spaced repetition | Wrong questions return more often, correct ones less |
| Subject and topic folders | Organize files by subject |
| Weak topic tracking | Wrong count per topic, with charts |
| Difficulty level | Easy, medium, hard |
| Partial marks | Score and rubric for subjective answers |
| Source highlight | Show which part of the document a question came from |
| Auto flashcards | Front and back cards from the document |
| Mock test mode | Timer, negative marking, final report |
| Hint button | Hint before revealing the answer |

## Later (not approved yet)
Chat with document, summary notes, streaks and goals, export (PDF, Anki), voice answers, share decks, multi-language, exam modes.

## Risks to plan for
- AI cost on large files: chunking and caching.
- AI can make wrong questions or answers: add a "report question" button.
- YouTube results can be low quality: use the YouTube API and filter.
- Study files are private by default.
- OCR can be weak on handwriting.
- Login is needed to save progress.

## Approved decisions
- Soft delete for user data (`deleted_at`). No hard delete by agents.

## Dev machine (for local AI)
i7 14th gen, RTX 5060 Ti 16 GB VRAM, 16 GB RAM, 1 TB disk. Fits 12B to 14B models (Q4) on GPU. Avoid models that spill to CPU.

## Open questions
- (Decided) Personal first, maybe public later. Design public-ready: per-user data, login, swappable AI provider.
- (Decided) Stack: see docs/decisions.md. Next.js + Supabase + Prisma + Gemini/Groq + Vercel.
- To confirm: exact Gemini model name, Next.js version, Ollama as optional local provider.
