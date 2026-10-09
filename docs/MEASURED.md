# Measured eval

Everything on this page was measured on this machine, this run. No public
benchmarks, no numbers from anywhere else. Re-running will shift read times
(model keep-alive, OS scheduling) and can shift wording in titles/summaries;
subject and date are the stable part of the contract.

**Machine:** Apple M4, 16 GB. Ollama with `qwen2.5vl:3b` (vision), `qwen3:4b`
(text), `nomic-embed-text` (embeddings), all `keep_alive: -1`. Single `next
dev` server, no other process sharing Ollama. Corpus: fresh database, all 11
files in `data/samples/demo/` (the timetable confirmed via "Use it" before
the other ten were dropped, so the schedule-aware subject matching is live
for the rest — matches how the stage demo runs it).

## Three filing bugs found and fixed during this pass

The ui worker's live screenshots and the story pane's QA rehearsal
(`.agents/squad-dejafind/qa/REPORT.md`) found four real bugs. Three are
subject-filing logic (fixed in `97bbd50`), one is the reader prompt
confusing a shared GC header with the subject (fixed in `609dfd5`). Tables
below are **before** (original filing logic + original reader prompt) and
**after** (both fixes applied, this is what's on the branch now).

### Before (original code)

| File | Subject | Title | Date | read_ms |
|---|---|---|---|---|
| timetable-bscs-2b.png | *(none — correct, pre-confirm)* | Class Schedule | 2026-10-09 ignored | 30823 |
| calc-limits-slide.png | Calculus | Limits and Continuity | none | 13934 |
| physics-lab-handout.pdf | Physics | Physics Lab Report 2 | 2026-10-11 auto | 35229 |
| whiteboard-photosynthesis.jpg | Biology | Photosynthesis | 2026-10-17 auto | 14438 |
| gc-biology-quiz-oct17.png | Biology | Biology Quiz Reminder | 2026-10-17 auto | 52556 |
| physics-kinematics-slide.png | Physics | Kinematics: Motion in One Dimension | none | 49760 |
| **gc-calculus-longquiz-oct19.png** | **Biology (wrong)** | **"BSCS 2-A" (wrong)** | 2026-10-19 auto | 62953 |
| bio-mitosis-slide.jpg | Biology | Cell Division: Mitosis | none | 27448 |
| calc-longquiz-handout.jpg | Calculus | Long Quiz 2 Coverage | 2026-10-19 auto | 42481 |
| sanaysay-wika-kultura.jpg | Filipino | Sanaysay: Wika at Kultura | 2026-10-13 auto | 29924 |
| jollibee-receipt.jpg | Economics (see note) | Jollibee Receipt | 2026-10-09 auto | 19561 |

Subjects created: `Biology`, `Calculus`, `Economics`, `Filipino`, `Physics` —
5 rows, all `inferred` (no schedule was confirmed in this run). The timetable
itself correctly had no subject only because confirm was never called in
this baseline run; **the actual bug** (confirming used to file the timetable
under its first listed subject) is demonstrated separately below, since it
only triggers on confirm.

### After (both fixes, schedule confirmed first)

| File | Subject | Subject source | Title | Date | read_ms |
|---|---|---|---|---|---|
| timetable-bscs-2b.png | **none (fixed, was first-listed subject)** | — | BSCS 2-B | 2026-10-09 ignored | 45510 |
| calc-limits-slide.png | Calculus | schedule | Limits and Continuity | none | 14335 |
| calc-longquiz-handout.jpg | Calculus | schedule | Long Quiz 2 Coverage | 2026-10-19 auto | 21640 |
| physics-kinematics-slide.png | Physics | schedule | Kinematics: Motion in One Dimension | none | 9948 |
| whiteboard-photosynthesis.jpg | Biology | schedule | Photosynthesis | 2026-10-17 auto | 18205 |
| jollibee-receipt.jpg | Economics (see note) | inferred | Jollibee Receipt | 2026-10-09 auto | 28666 |
| **gc-calculus-longquiz-oct19.png** | **Calculus (fixed)** | schedule | **Long Quiz 2 Reminder (fixed)** | 2026-10-19 auto | 8323 |
| physics-lab-handout.pdf | Physics | schedule | Physics Lab Report 2 | 2026-10-11 auto | 44460 |
| bio-mitosis-slide.jpg | Biology | schedule | Cell Division: Mitosis | none | 19888 |
| sanaysay-wika-kultura.jpg | Filipino | schedule | Sanaysay: Wika at Kultura | 2026-10-13 auto | 18730 |
| gc-biology-quiz-oct17.png | Biology | schedule | Biology Quiz Reminder | 2026-10-17 auto | 18591 |

(`gc-calculus-longquiz-oct19.png`'s row is from a second pass, after the
reader-prompt fix: deleted the mis-filed document and re-dropped the same
file live, with the schedule still confirmed.)

Subjects after "Use it" + all 11 files: exactly **7** — `Biology`,
`Calculus`, `Filipino`, `NSTP`, `Physical Education`, `Physics` (all
`source: schedule`), plus `Economics` (`inferred`, the jollibee variance
below). No `Biology 101`/`Calculus 1` duplicates, no `Unknown`/`None`. The
timetable's raw OCR text literally reads "Biology 101" (`SELECT text FROM
documents WHERE doc_type='schedule'`); `normalizeSubjectName` strips the
course number before the subject is created, so the schedule's subject and
every reader-extracted "Biology" land on the same row.

**read_ms average across all 11 (after, no contention): 22.6 s**
(248296 ms / 11; max 45510 ms on the timetable's schedule-parsing call, min
8323 ms on a short GC chat).

### Known, unfixed: `jollibee-receipt.jpg` subject variance

Across every run so far (this pass and the demo README's own batch-1
verification), the receipt's subject came back `Economics` or `Economy` or
none, never consistently none/Other. The product spec says non-academic
documents get no subject; that rule lives only in prose, not as a hard
check in the pipeline. This is model behavior (qwen2.5vl:3b, temperature 0,
still produces different subjects across runs on identical input/prompt),
not something the three filing-logic bugs above touch. Flagging it here
rather than silently re-running until it came out "right."

## Search latency (the three demo queries)

| Query | isQuestion | tookMs | Top result |
|---|---|---|---|
| `jollibee` | false | 1546 | Jollibee Receipt |
| `the slide with the photosynthesis equation` | false | 795 | Photosynthesis |
| `when's my bio quiz` | true | 42944 | Answer: "Your Biology quiz is on October 17 (Friday)." cites the GC screenshot |

The two non-question searches are FTS+vec fusion only (fast, no model call).
The question triggers the `qwen3:4b` answer call, which dominates the time —
42.9 s here was the first text-model call after several vision calls (cold
load). The QA rehearsal's UI-driven run measured the same query at 15.3 s
once the text model was already warm; expect low-teens to low-40s depending
on what ran immediately before it.

## Quiz latency

`POST /api/quiz {"subjectId": "<Biology>"}` (3 source documents): **65727
ms**, 5 questions returned, schema valid on the first attempt. Matches the
QA rehearsal's own API measurement (37.7 s warm) order of magnitude; this
run's text model was not pre-warmed immediately before the call.

## Apple Vision OCR (`/words`)

First call (compiles `scripts/ocr-words.swift` with `swiftc`, then runs):
completes in ~5 s total end to end against `gc-biology-quiz-oct17.png`
through the live route. Word boxes line up with the rendered text.

## Speed pass

Three things tried; one shipped as a real win, one shipped with no measured
effect (kept anyway for the robustness it buys), one reverted. This machine
had heavy ambient load while the full-set numbers below were measured
(other squad panes' Chrome instances, a video render) — load average 12+ on
what's normally near-idle — so absolute read times in this section run
higher than earlier in this document. Where that matters, numbers below are
isolated same-call-back-to-back comparisons instead, which stay valid under
shared load since both sides of a comparison absorb the same contention.

### 1. Precompute cache for quiz/flashcards/review — shipped, large win

After a document files into a subject, a 20 s debounced background job
(one at a time, lowest priority — it polls and waits whenever the read
pipeline has anything `queued`/`reading`, never races it) generates quiz,
flashcards, and review for that subject and caches each keyed by the
subject's current sorted document-id set. The three POST endpoints check
the cache first: if the subject's filed document set hasn't changed since
the cache was written, they return it instantly; otherwise they generate
live exactly as before. All three responses now carry `cachedAt` (ISO
string when served from cache, `null` when generated live this call) — a
superset field, `api-types.ts` untouched.

Proof, live: filed one document into a fresh Biology subject, waited for
the debounced job. `quiz` cached at T+0s, `flashcards` cached at T+16s
(sequential, one at a time, as designed). A `POST /api/quiz` against that
subject afterward: **1.47 s** (was a fresh ~40–70 s generation),
`cachedAt` set to the precompute timestamp. `review` failed to precompute
once in this run (a genuine model JSON failure on retry, logged and
skipped — the queue moved on to the next kind without blocking); the live
`review` endpoint still answered correctly on demand (`cachedAt: null`,
4 lines, 5.6 s), confirming a precompute miss degrades to today's
behavior rather than breaking anything.

### 2. `num_predict` caps + tighter prompts — shipped, no measured speed effect, kept for robustness

Reader `tags` narrowed to 3–5 (was 3–6), quiz `explanation` to "one
sentence" (was "one line" — already close), `num_predict: 1024` added to
both reader calls, `num_predict: 700` added to the quiz call. Isolated
same-call comparison (both sides run back-to-back on this machine, so
ambient load cancels out), 1280px, otherwise identical prompts:

| File | Before | After |
|---|---|---|
| `gc-biology-quiz-oct17.png` (vision) | 23.5 s | 27.2 s |
| `bio-mitosis-slide.jpg` (vision) | 8.9 s | 11.2 s |
| `physics-lab-handout.pdf` (text) | 58.9 s | 53.8 s |

No consistent direction — within noise. Expected in hindsight: `num_predict`
only caps the *maximum* tokens generated; on inputs that already finish
well under the cap (all of ours do), it changes nothing about generation
time. Its actual value is bounding worst-case runaway generation (the
token-repeat-limit failures documented earlier in this doc), not everyday
speed. Kept because it's free insurance, not because it's faster. Subject
and title were unchanged on all three files.

### 3. `MAX_IMAGE_DIMENSION` 1024 (was 1280) — reverted, broke a sample

Tried first since it has the clearest theoretical speed case (fewer pixels
= fewer vision tokens). Live-tested against all 11 demo files: one broke.
`sanaysay-wika-kultura.jpg` filed under a new inferred subject **"Bscs
2-a"** at 1024px instead of matching the existing schedule subject
**"Filipino"** — isolated and confirmed directly (same prompt, same
image, only the resize dimension changed):

| Dimension | subject | title |
|---|---|---|
| 1024px | `BSCS 2-A` (wrong — the chat-header bug this file exists to guard against) | `Sanaysay: Wika at Kultura` |
| 1280px | `Filipino` (correct) | `Sanaysay: Wika at Kultura` |

Per the brief ("keep only if all files keep the same subject and dates"),
reverted to 1280px. `MAX_IMAGE_DIMENSION` is unchanged from before this
pass.
