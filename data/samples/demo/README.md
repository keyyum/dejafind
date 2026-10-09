# Demo samples

Four synthetic files for the live demo, one per ingestion path the pipeline
has to show on stage: a born-digital PDF, a camera photo that needs the
cleanup step, a non-academic receipt, and a non-English page. Nothing here
is a real person's document — names, branches, and transaction numbers are
all made up (`Juan Dela Cruz` is the standard placeholder name used on PH
forms, not a real person).

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
