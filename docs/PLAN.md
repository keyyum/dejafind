# Build plan, Oct 10 2026, deadline 10:00 AM Manila

Hard stops: feature freeze 06:00, submission assets 06:00 to 09:00, submit by 09:30. Code freeze 10:00.

## Decided stack

Next.js 16 (TypeScript, Tailwind) on port 3100. Server-side modules do the local work. Ollama on localhost:11434 serves `qwen2.5vl:3b` (images), `qwen3:4b` (text, extraction, answers, quiz), `nomic-embed-text` (embeddings). `chokidar` watches folders. `better-sqlite3` + `sqlite-vec` + FTS5 in `data/dejafind.sqlite`. `pdf-parse` for PDFs. `chrono-node` cross-checks dates.

## Data model

```
files(id, path, kind[image|pdf|text], sha256, captured_at, title, summary, tags json, subject, text, status[queued|done|error], created_at)
chunks(id, file_id, idx, text)            + FTS5 virtual table over text + vec table over embedding
dates(id, file_id, iso_date, label, confidence, source_span, status[auto|review])
```

## Steps, in order, each with a visible proof

| # | Step | Owner | Box | Proof |
|---|------|-------|-----|-------|
| 1 | Watcher: `data/watch/` and chosen folders; new file hashed and queued in SQLite | core | 00:45 | drop a file, row appears |
| 2 | Reader: image to vision model, PDF to text, text to text model; returns `{text,title,summary,tags,subject,dates[]}` as JSON | core | 01:30 | sample slide yields correct JSON |
| 3 | Dates: chrono cross-check anchored to capture time; agree = auto, disagree = review | core | 00:30 | "quiz moved to Friday" resolves to the right ISO date |
| 4 | Index: chunk, embed, FTS + vec insert | core | 00:45 | search returns the right file |
| 5 | UI: Subjects home (per subject: recent captures with title and summary, next deadline, quiz button), Timeline tab, Ask bar | ui | 02:00 | all views render live data |
| 6 | Ask: hybrid retrieval, answer with file id citation, refuse below threshold, show source file | core | 01:00 | "when's my bio quiz" answers with photo |
| 7 | Quiz: five MCQs from a subject, graded, source shown | core | 00:45 | "quiz me on Biology" yields 5 answerable questions |
| 8 | Network panel: a visible indicator that the server made zero outbound requests during a session | ui | 00:30 | counter stays at 0 while indexing |

If time runs out, cut step 7 first, then step 8. Never cut 1 to 6.

## Tier 2 and 3 (see PRODUCT.md), only after steps 1 to 8 are proven

| # | Step | Box | Gate |
|---|------|-----|------|
| 9 | Reviewer sheet per subject, cited lines | 00:30 | after 05:00, core proven |
| 10 | Flashcards per subject, flip UI | 00:45 | after step 9 |
| 11 | Export timeline as .ics | 00:20 | after step 10 |
| 12 | Reminders via macOS notification | 00:30 | only before 07:00 |
| 13 | Study streak (quiz days) | 00:20 | only before 07:00 |
| 14 | Clean notes from a whiteboard photo | 00:45 | only before 07:00 |

Hard stop 07:00. Then video, post, form.

Run order per worker: `npm run dev` on the main tree, workers on worktrees use `-p 3101`, `-p 3102`.

## Demo script, 60 seconds

1. App open on Files view, Wi-Fi visibly on for now. Network panel reads 0.
2. Take a screenshot of a prepared fake group-chat message: "Bio quiz moved to Oct 17, chapters 4 and 5." Two seconds later it appears in Files with a title and summary, and Oct 17 appears on the Timeline with the screenshot beside it. Nobody touched the app.
3. Hold a printed Biology slide to the camera (Continuity Camera or a photo dropped into the watch folder). It files under Biology with a summary.
4. Ask: "when's my bio quiz and what's it on". Answer cites the screenshot and shows it.
5. Turn Wi-Fi off. Drop one more file. Still works. Network panel still 0.
6. "Quiz me on Biology", answer one question out loud, graded with the slide shown.

Say out loud: the model names, their sizes, and the measured time per file on this M4 with 16 GB.

## Submission checklist (owner: pitch)

- Public GitHub repo by 09:30 with README: what runs locally, what needs internet (nothing in the core), models, frameworks, APIs, existing code or assets, AI dev tools used.
- 1-minute demo video recorded from the laptop screen with a phone shot of the camera step.
- Post the video on X or LinkedIn tagging Cognition and #AppBuildersPH. Paste the URL.
- Cerebral Valley form: project name, short description, team members exactly as on the official list, final team name, repo URL, video, post URL, disclosures paragraph, answer to "why does this product benefit from running AI locally".
- One submission per team, no edits after. Read it twice.
- Record a 60-second backup video of the working demo in case the live one dies.

## Demo-day prep (Oct 10, 12:00 at Cyberzone SM Makati)

Warm every model before stage. Grant camera and screen recording to the exact browser used. Host all model files locally and test with Wi-Fi off. Bring HDMI and USB-C. Print two Biology slides and one fake schedule. Keep canned sample files in `data/samples/`.

## Measured baseline (Oct 10 2026, 00:42, Apple M4 16 GB, Ollama 0.40.2)

`qwen2.5vl:3b` on `data/samples/gc-bio-quiz.png` with `format: json`, temperature 0: returned verbatim text, title "Biology Quiz Moved to October 17", subject Biology, date 2026-10-17. Total 20.0 s on a cold load, of which 5.1 s was generation. Expect roughly 5 to 8 s per image once the model is warm. Keep the model warm during the demo (`keep_alive`), and never cold-load on stage.
