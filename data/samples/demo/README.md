# Demo samples

**05:20 update (orchestrator):** `bio-mitosis-slide.jpg`, `whiteboard-photosynthesis.jpg`, and `calc-longquiz-handout.jpg` are now photorealistic images generated with OpenAI Codex's image tool from the same text as before (disclosed in the root README). Verified through the live pipeline on main at 05:19: mitosis → Biology, slide, warped flat, no date; whiteboard → Biology, Oct 17 auto; calc handout → Calculus, Oct 19 auto. The earlier HTML-rendered versions are kept out of the repo.

Eleven synthetic files for the live demo, built in two batches, covering
every ingestion path the pipeline has to show on stage: a born-digital PDF,
camera photos that need the cleanup step, GC screenshots, a timetable, slide
decks, a whiteboard, a printed handout, and a non-academic receipt. Nothing
here is a real person's document — names, branches, and transaction numbers
are all made up (`Juan Dela Cruz` is the standard placeholder name used on PH
forms, not a real person).

Batch 1 (four files, below) has full measured-run detail per file, including
two real findings (the receipt's non-deterministic subject, and the quad
bug that was live when that batch was built — since fixed, see Batch 2).
Batch 2 (seven files, after "Why these four") was built to save time budget,
so most of its files were not individually round-tripped through the live
pipeline; the one that was (the whiteboard) is called out below.

**Calendar reference (verified against October 2026, real dates — not
model output):** Oct 9 Fri, Oct 11 Sun, Oct 13 Tue, Oct 17 Sat, Oct 19 Mon.
Checked every file below for a stated weekday against its date after a QA
rehearsal caught `gc-biology-quiz-oct17.png` claiming "(Friday)" for Oct 17
(it's a Saturday — fixed, see that file's entry). Every other date mention
across all eleven files (`jollibee-receipt.jpg` Oct 9, `physics-lab-handout.pdf`
"Sunday, October 11", `sanaysay-wika-kultura.jpg` Oct 13, the two Oct 19
mentions in `gc-calculus-longquiz-oct19.png` and `calc-longquiz-handout.jpg`
which both already said "Monday", and the Oct 17 reminder in
`whiteboard-photosynthesis.jpg` which states no weekday) matched the real
calendar; only the one fix was needed.

All four were verified against the real pipeline on this machine
(`NEXT_PUBLIC_DEJAFIND_MOCK` unset, models already pulled: `qwen2.5vl:3b`,
`qwen3:4b`, `nomic-embed-text`) by dropping them into `data/watch/` and
reading the `documents`/`dates` tables directly, re-verified against
`main`@`1a88f5e` (the perspective-warp commit) under both `next start` and
`next dev`. Expected results below are what was actually measured, not a
guess — see **Measured run** under each file. Re-running will likely reorder
read times (keep-alive keeps the models warm after the first file) and can
shift wording slightly; treat subject/date as the stable part of the
contract, not the exact title string.

## `physics-lab-handout.pdf`

One-page PDF (built with Chrome `--print-to-pdf` from a plain HTML page),
text layer only, no images — exercises the PDF path: `pdf-parse` extracts
the text, the **text** model (`qwen3:4b`) reads it, no vision OCR involved.

- **Subject:** Physics
- **Date:** 2026-10-11, labeled "Due date", status `auto` — matches the
  "Physics lab report" item already in the UI's mock "Coming up" strip, so
  the live drop reproduces what the mock previewed.
- **Measured run:** done in 16.6 s (cold first read: 72 s). Title came back
  as "Physics Lab Report 2" / "Lab Report 2: Projectile Motion" across runs
  — wording varies, subject and date didn't.

## `bio-mitosis-slide.jpg`

A lecture slide ("Cell Division: Mitosis", bullet list + a small diagram)
photographed at a moderate angle on a desk — CSS `perspective`/`rotateX`/
`rotateY` on the slide over a wood-tone background, screenshotted and saved
as JPEG so it's routed through the photo-cleanup path (`isPhoto()` only
treats `.jpg`/`.jpeg`/`.heic` as photos; `.png` is left alone as a
screenshot).

**This is the file for the cleanup step.** As of `main`@`1a88f5e`,
`src/server/clean.ts` tries `src/server/quad.ts` (opencv-js edge detection +
`warpPerspective`) first and falls back to `sharp().trim().normalise()` when
no confident quad is found. On this image it always hits the fallback —
`detectAndWarpQuad` throws before it gets anywhere near contour detection:

```
[clean] quad detection failed for <id>, falling back to trim
TypeError: Method Promise.prototype.then called on incompatible receiver [object Module]
    at async detectAndWarpQuad (src/server/quad.ts:37:14)
```

Reproduced on this machine under both `next start` and `next dev`, so it
isn't a dev/prod bundling difference — `await getCv()` (the dynamic
`import("@techstark/opencv-js")` wrapper) fails on its very first call,
every time, for every photo, not just this one. The pipeline doesn't crash
— it logs and falls back, same as the pre-warp behavior — but the warp
itself has not actually run successfully on this machine. Flagged to the
orchestrator; not something this worktree's ownership (`public/**`,
`video/**`, `docs/brand-refs/**`, now `data/samples/**`) can fix.
Until that's resolved, the fallback crop still does visibly nothing to this
tilt (`data/derived/<id>-clean.jpg` looks identical to the source) — this
sample is a good one to demo the gap honestly: don't claim deskewing on
stage, just cropping/contrast, unless the quad fix lands and gets
re-verified here first.

- **Subject:** Biology
- **Date:** none expected (a slide with phase names, no calendar date).
- **Measured run:** done in 4.2–15.3 s warm (22 s cold). Title "Cell
  Division: Mitosis".

## `jollibee-receipt.jpg`

A synthetic Jollibee receipt (thermal-receipt layout, fictitious branch,
TIN, and OR number) photographed near-square-on on a desk. Matches the
product doc's own example search query ("jollibee" is listed in
`docs/PRODUCT.md` as a demo query). Per the product spec, non-academic
files are indexed but get no subject and no timeline entry.

- **Subject:** expected none/Other. **Measured variance:** across three
  clean runs, got no subject once (correct), subject "Economy" once, and
  subject "Economics" once — each time with the receipt date auto-filed to
  Coming Up. Same image, same prompt, temperature 0 — the small vision model
  isn't reliably obeying "no subject for non-academic docs" because that
  rule lives in the product spec, not in a hard check in the pipeline.
  Mentioning this so whoever runs the demo isn't surprised if "jollibee"
  shows up filed under something odd — it's a model behavior, not a sample
  defect, and not something an asset tweak can fix.
- **Measured run:** done in 20.7–27.8 s depending on run.

## `sanaysay-wika-kultura.jpg`

A one-page Filipino sanaysay ("Sanaysay: Wika at Kultura" — the exact title
already used for the Filipino tile in the UI's mock data), photographed
near-square-on. Exercises non-English vision OCR and the auto-vs-review
date cross-check.

- **Subject:** Filipino.
- **Date:** 2026-10-13, labeled "Isusumite" ("to be submitted"), status
  `auto` in the measured run — the page states the deadline bilingually
  ("Isusumite: Oktubre 13, 2026 (Submit by: October 13, 2026)") specifically
  so there's an English-formatted date in the text for chrono-node to agree
  with the model on. An earlier draft with only the Filipino month name
  ("Oktubre 13, 2026") got picked up correctly by the vision model but
  landed as `ignored` rather than `auto`, because chrono-node doesn't parse
  Filipino month names — a real, honest demo of the auto/review safety net
  described in `AGENTS.md` ("A date is auto-filed only when both agree,
  otherwise it goes to a review list"), not a flaw worth hiding, but the
  bilingual version is what's shipped here so the scripted demo auto-files.
- **Note on iteration:** the first two drafts (longer, justified-text
  paragraphs) made `qwen2.5vl:3b` abort with "prediction aborted, token
  repeat limit reached" — Ollama's own repeat-loop guard, reproducible on
  both attempts. Cutting to one short left-aligned paragraph fixed it. If
  anyone adds more sanaysay-style samples later: keep vision-OCR'd prose
  short, long justified paragraphs are a known trigger for this model.
- **Measured run:** done in 6.6–23.6 s warm (19.8 s cold).

## Why these four

- **PDF** — the only sample so far that isn't a screenshot or photo; proves
  the PDF branch (`pdf-parse` + text model) actually runs outside mocks.
- **Angled photo** — the explicit ask for this batch: show the cleanup step
  honestly, warts and all.
- **Receipt** — the product doc's own "jollibee" query needs a real file
  behind it, not just mock data.
- **Sanaysay** — non-English content and a cross-language date, both real
  technical claims worth demoing live rather than only in English samples.

## Batch 2

Requested after the quad-detection bug above was fixed on `main` (`67be46a`,
`await getCv()` switched to `require`). Same style conventions as batch 1:
`.png` for anything that's a genuine screenshot (chat, portal page, a flat
slide export), `.jpg` for anything that's a camera photo of a physical
object (routes through `isPhoto()`/cleanup). Not individually pipeline-tested
except where noted, per the orchestrator's budget call — these are built to
the same visual and content standards as batch 1, just not all re-verified
against `documents`/`dates` this time.

### `gc-biology-quiz-oct17.png`

Light Messenger-style GC screenshot, white background, same "BSCS 2-A"
section as `gc-bio-quiz.png` (core's original, now also light-themed) —
Ma'am Reyes moves the Biology quiz to October 17 (Saturday), adds a
room/time follow-up exchange. Expected: subject Biology, date 2026-10-17.

**Fixed after QA rehearsal:** the message originally read "October 17
(Friday)" — Oct 17, 2026 is a Saturday, and the app's own "Coming up" chip
says "Sat 17", so the mismatch was visible on stage. Corrected the text and
re-rendered at the same window size; only the first bubble's line wrap
shifted by a couple of words, everything else is pixel-identical.

### `gc-calculus-longquiz-oct19.png`

Second GC, same group, different teacher (Sir Mendoza) announcing a
Calculus long quiz on **Monday, October 19, 2026** (verified that's the
correct weekday), covering limits and continuity, no calculators. Expected:
subject Calculus/Math, date 2026-10-19.

### `timetable-bscs-2b.png`

A student-portal-style class schedule for **BSCS 2-B** — the exact section
named in `docs/UI.md`'s schedule-confirmation card ("This looks like a class
schedule for BSCS 2-B. Is it yours?"). Six subjects with days, times, and
rooms: Biology 101, Calculus 1, Physics 101, Filipino 1, PE 2, NSTP 1.
Expected: doc_type `schedule`, `schedule_section` "BSCS 2-B", six schedule
entries extracted by `src/server/subjects.ts`'s timetable parser.

### `calc-limits-slide.png` / `physics-kinematics-slide.png`

Two flat, straight-on 1600×900 slide exports (no perspective transform —
"straight" per the ask), styled like the other lecture slides but without
the desk/angle treatment. Calculus: "Limits and Continuity" with a small
SVG graph showing a removable discontinuity. Physics: "Kinematics: Motion in
One Dimension" with the `v = v₀ + at` / `x = x₀ + v₀t + ½at²` equations.
Expected subjects: Calculus, Physics. No dates (pure lecture content).

### `whiteboard-photosynthesis.jpg`

A whiteboard photo (handwriting-style font, marker colors, visible board
bezel) with the photosynthesis equation, three bullet notes, and a corner
reminder "remember for quiz: Oct 17!" — ties back to the Biology quiz date
running through the other samples. **This one was round-tripped through the
live pipeline** to confirm the quad-detection fix: `clean.ts` logged no
error this time, and `data/derived/<id>-clean.jpg` came back flat and
axis-aligned (the perspective is gone), unlike `bio-mitosis-slide.jpg` in
batch 1. Measured: title "Photosynthesis", subject Biology, doc_type came
back `handout` rather than `whiteboard` (a model labeling quirk, not a
sample issue), date 2026-10-17 at confidence 1.0, status `auto`.

### `calc-longquiz-handout.jpg`

A printed handout (Calculus, "Long Quiz 2 Coverage", Sir Mendoza, due
Monday, October 19, 2026) photographed near-square-on — the same subject
and date as `gc-calculus-longquiz-oct19.png`, so a search for the long quiz
should surface both documents. Companion to batch 1's `physics-lab-handout.pdf`:
same kind of content, but through the photo/vision-OCR route instead of the
PDF/text route. Expected: subject Calculus, date 2026-10-19.
