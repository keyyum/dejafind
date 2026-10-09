# Build plan, Oct 10 2026. Deadline 10:00 AM Manila. No extensions.

Written 02:15. Everything below is decided. Workers do not relitigate scope; they build their step and prove it.

## Hard times

| Time | What |
|---|---|
| 02:30 | Panes launched, worktrees ready |
| 05:30 | Core proven end to end on the sample files (steps 1 to 7) |
| 06:30 | UI on live data, paper tiles, snackbar, search, document, quiz |
| 07:15 | Animations in, tier 2 in if green, everything else cut |
| 07:15 to 08:45 | Demo video recorded and cut, pitch deck done, X/LinkedIn post up, README disclosures final |
| 09:00 | Repo public. Submission form filled on Cerebral Valley. Read twice. Submit by 09:30 |
| 10:00 | Code freeze. Nothing pushed after this |

## Decided stack

Next.js 16 (TypeScript, Tailwind) on port 3100. Server modules do the local work. Ollama on localhost:11434: `qwen2.5vl:3b` (images), `qwen3:4b` (text, extraction, answers, quiz), `nomic-embed-text` (embeddings). `chokidar` watches folders. `better-sqlite3` + `sqlite-vec` + FTS5 in `data/dejafind.sqlite`. `pdf-parse` for PDFs. `chrono-node` cross-checks dates. OpenCV via `opencv-wasm` or `sharp` for crop and warp (worker picks, Node only, no Python).

## Data model

```
documents(id, path, kind[image|pdf], sha256, captured_at, title, summary, tags json, subject_id, text, status[queued|reading|done|error], thumb_path, clean_path, width, height, read_ms, created_at)
subjects(id, name, source[schedule|inferred], created_at)
schedule(id, subject_id, weekday, start, end, room, section)
chunks(id, document_id, idx, text)        + FTS5 over text + vec0 table over embedding
dates(id, document_id, iso_date, label, confidence, span, status[auto|review|ignored])
conversations(id, created_at) · messages(id, conversation_id, role, text, citations json)
events(id, kind, document_id, created_at)   for the SSE stream and the snackbar
```

## Steps

Owner is a pane. Each step ends with its proof shown in the pane and a commit on the worker's branch.

| # | Step | Owner | Proof |
|---|---|---|---|
| 1 | Watcher: `data/watch/`, `~/Desktop`, `~/Downloads`; new file hashed, deduped, queued; one-at-a-time worker loop | core | drop `data/samples/gc-bio-quiz.png`, a `documents` row appears with `status=queued` then `reading` |
| 2 | Reader: image to `qwen2.5vl:3b` with `format:json`, PDF to `pdf-parse` then `qwen3:4b`; returns `{text,title,summary,tags,subject,dates[],doc_type}` where `doc_type` includes `schedule` | core | sample yields subject Biology and date 2026-10-17 |
| 3 | Dates: chrono cross-check anchored to `captured_at`; agree = `auto`, disagree = `review`; dates from `Other` documents are `ignored` | core | "quiz moved to Friday" resolves correctly; a receipt date is ignored |
| 4 | Subjects and schedule: subject rows created from reader output; a `doc_type=schedule` document parses into `schedule` rows but only after a confirm flag; filing uses schedule time match plus text | core | a timetable screenshot creates six subjects after confirm; a photo captured Mon 9:15 files under Biology |
| 5 | Index: chunk, embed with `nomic-embed-text`, FTS + vec insert | core | FTS and vec both return the sample for "bio quiz" |
| 6 | Search endpoint: fuse FTS and vec with reciprocal rank; results carry best snippet with match offsets; if the query is a question, answer from the top documents with `qwen3:4b`, cite document ids, "not in your documents" below threshold; multi-turn keeps the last six turns | core | "jollibee" finds the receipt, "photosynthesis equation" finds the whiteboard, "when's my bio quiz" answers with the screenshot |
| 7 | Quiz endpoint: five MCQs from a subject or document ids, JSON schema, grade and explain, source id per question | core | "quiz me on Biology" yields five answerable questions |
| 8 | Ingest cleanup: document quad detection + perspective warp + background clean for photos; plain crop fallback; screenshots untouched; thumbnails keep real aspect ratio; `clean_path` and `thumb_path` written | core | an angled slide photo becomes a flat slide tile |
| 9 | Status counter: a wrapper around outbound HTTP in the Node process; `/api/status` returns requests_out, model names and sizes, measured read_ms average | core | counter stays 0 through a full ingest |
| 10 | Library: paper tiles in a masonry grid by day, subject filters, Coming up strip, search bar, snackbar on `document.filed` | ui | renders against mock, then live |
| 11 | Search results view with answer block and highlighted snippets | ui | live against step 6 |
| 12 | Document view: image with highlights, understanding panel, text it read, actions | ui | live against step 2 |
| 13 | Quiz view | ui | live against step 7 |
| 14 | Animations: capture lands, date lifts off, highlights paint, quiz slides from source, Lens-style tap in Document view using word boxes from Apple Vision OCR if available (core exposes `/api/documents/[id]/words`; if not ready, skip tap) | ui | capture-lands plays on a real screenshot |
| 15 | Schedule confirmation card, status panel, keyboard shortcut ⌘K for the bar, drag and drop onto the window as a second way in, bulk import progress for a dropped folder | ui | drop 20 files, progress shows, grid fills |
| 16 | Snap button: in-app capture from the webcam or Continuity Camera via `getUserMedia`, saved into `data/watch/` so it flows through the normal pipeline | ui | hold a printed slide to the iPhone, it appears in the grid |
| 17 | Tier 2 only after 10 to 13 are green: reviewer sheet per subject, flashcards, .ics export of Coming up | core then ui | one each, demoable in ten seconds |

Cut order if behind at 07:15: 17, then 16, then the Lens tap in 14, then 15's bulk import. Never cut 1 to 13.

## Measured baseline (02:00, Apple M4 16 GB, Ollama 0.40.2)

`qwen2.5vl:3b` on `data/samples/gc-bio-quiz.png`, `format: json`, temperature 0: verbatim text, subject Biology, date 2026-10-17. 20.0 s cold, 5.1 s generation. Keep models warm (`keep_alive: -1`) and never cold-load on stage.

## Demo script, 60 seconds, also the live pitch demo

1. Library open on the projector. Status reads "On this laptop · nothing sent".
2. "Here's my class schedule from the registrar." Screenshot it. The confirmation card appears, tap Use it, six subjects appear as filters.
3. Screenshot the prepared fake GC message "Bio quiz moved to Oct 17, chapters 4 and 5". Say nothing. The tile flies in, the light bar sweeps, the title types in, "filed under Biology", the Oct 17 chip lifts into Coming up. Snackbar.
4. Hold a printed Biology slide to the iPhone with the Snap button. Flat slide tile lands, filed under Biology.
5. Type "when's my bio quiz". Answer on top, screenshot beside it with the lines highlighted. Click it, the Document view shows what it read.
6. Wi-Fi off, visibly. Drop one more file. Still works, counter still 0.
7. "Quiz me on Biology." Answer one aloud, graded with the slide shown.

Say out loud: three models, 3B vision, 4B text, 270 MB embeddings, measured seconds per document on this M4.
