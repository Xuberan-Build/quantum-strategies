# The Perception Read: build contract

Spec: `brain/gtm/free-quiz-spec-v3.md` (private brain). Types: `src/lib/read/types.ts`.
Same engine as the Three Rites: product row `perception-read` in `product_definitions`, one `product_sessions` row per attempt.

## Library functions (scoring/content agent, pure or server-only, no DB)
- `src/lib/read/questions.ts`: `export const READ_QUESTIONS: ReadQuestion[]` (spec v3 §5, Austin's voice) and `visibleQuestions(segment?, variant?)`.
- `src/lib/read/score.ts`: `scorePerceptionRead(answers: ReadAnswers): PatternScores` (spec v3 §7, deterministic, SHOULDS wins ties and is the low-signal fallback with the 40% guard handled by config).
- `src/lib/read/safety.ts`: `screenText(text: string): SafetyResult`, `screenAnswers(answers: ReadAnswers): SafetyResult` (worst tier wins; lists in code, reviewed before launch).
- `src/lib/read/mirror.ts`: `buildWeekMirror(answers: ReadAnswers): WeekMirror`.
- `src/lib/read/results.ts`: `PATTERNS: Record<PatternId, PatternContent>` (name, read, on-camera line, scan slug/name, mechanism, receipt, move, why-it-didn't-stick, fix-fits) and `buildResult(input: { sessionId; answers; scores; mirror; safety; utm? }): Promise<ReadResult>`.
- `src/lib/read/paragraph.ts` (server-only): `writeMirrorParagraph(input): Promise<{ text: string; usedFallback: boolean }>`: the only AI block; must quote two of the person's phrases exactly, verified in code, banned-word check, static fallback.

## Data + API (engine/API agent)
- Migration (additive): `product_definitions` gets `is_free bool default false`, `requires_auth bool default true`, `requires_chart bool default true`, `experience_kind text default 'rite'`; `product_sessions` allows `user_id` null and gets `lead_id uuid`, `anon_token_hash text`, `utm jsonb`; new `read_leads` (email, consent_marketing, consent_at, utm, source, session_id, pattern, user_id null, unsubscribed_at, created_at) and `product_events` (session_id, lead_id, user_id, product_slug, event, step, props jsonb, created_at). Both new tables: RLS on, service role only. Seed the `perception-read` row (is_free, requires_auth false, requires_chart false, is_purchasable false, price 0, experience_kind 'read', steps = READ_QUESTIONS).
- Chart gate: the Rites engine skips the chart step when `requires_chart` is false (also the P0 fix for chart-free Rites).
- `src/lib/read/store.ts`: session/lead/event persistence (service role).
- Routes (all server-side, rate limited per IP and per session, anonymous allowed):
  - `POST /api/read/start` `{ utm?, variant? }` → `{ sessionId }`, sets httpOnly cookie `qs_read_token` (hash stored in `anon_token_hash`).
  - `GET /api/read/questions?segment=&variant=` → `{ questions: ReadQuestion[] }`.
  - `POST /api/read/answer` `{ sessionId, answer: ReadAnswer }` → `{ ok: true, safety?: SafetyResult }`.
  - `POST /api/read/complete` `{ sessionId }` → `ReadPreview`.
  - `POST /api/read/unlock` `{ sessionId, lead: ReadLeadInput }` → `ReadResult` (creates the lead, builds the result, triggers the result email).
  - `GET /api/read/result/[sessionId]` → `ReadResult` (cookie token, or `?t=` signed link from the email).
  - `POST /api/read/event` `{ sessionId?, event: ReadEvent, step?, props? }` → 204.
  - `POST /api/read/feedback` `{ sessionId, accuracy?: 1-5, hardestPart?: string, moveCommitted?: boolean }` → 204.

## Emails + checkout (email/checkout agent)
- `src/lib/read/emails.ts`: `sendReadResultEmail({ lead, result, resultUrl })` and `scheduleReadFollowups({ leadId, sessionId, pattern })` (day 2 and day 7 per spec v3 §10, day-7 asks the "very disappointed" question), using the existing senders and scheduling.
- Checkout bridge: `/read/checkout?session=<id>`: signed-in users go to the existing `/api/checkout` with `productSlug: 'perception-rite-bundle'` ($12); others get a magic-link sign-in to the lead's email that returns to checkout; on account creation link `read_leads.user_id`. Purchase event recorded from the existing webhook path.

## UI (UI agent)
- `/read`: landing (misalignment-first headline, spec v3 §3.5), `/read/start`: one question per screen, progress "4 of 12", reuses the Rites step-input components where they fit, `/read/result/[sessionId]`: preview → gate → full result blocks, offer CTA, accuracy rating, support screen for crisis tier. Events on every step.
