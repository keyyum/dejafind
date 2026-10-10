# Submission — AppBuildersPH Hackathon 2026 (Cerebral Valley form)

Answers to paste into the form. Founder submits; nothing here is posted anywhere by the build.
Only two fields are placeholders: **Video URL** and **Team**.

## Project name

DéjàFind

## One-liner

Your screenshots, slides and PDFs, understood and findable, fully offline on a laptop.

## Description (150 words)

Students photograph every slide and screenshot every group-chat announcement, then never open them again. The quiz date sits in a GC from three weeks ago; the lecture slide is photo 2,314 in the camera roll.

DéjàFind watches your Screenshots, Downloads and a drop folder. Every new screenshot, slide photo, whiteboard or PDF is read on the laptop: it gets a title, a one-line summary, tags, a subject and every date in it. It files itself under the right class, and deadlines land on one Coming up strip. Ask "when's my bio quiz?" and the answer comes from your own captures, with the source document shown and the lines it read highlighted. Pick a subject and it quizzes you from your own notes.

There is no upload button and no account. Nothing leaves the laptop: the app shows a live counter of outbound requests, and it reads zero.

## How local AI is used

Everything runs on one MacBook (Apple M4, 16 GB) through Ollama on localhost. There are no cloud AI calls anywhere in the code path, and the demo runs with Wi-Fi off.

- **Reading images:** `qwen2.5vl:3b` reads each screenshot or photo in one call and returns its text, title, summary, tags and dates as JSON.
- **Reading text, answering, quizzing:** `qwen3:4b` reads PDF text, answers questions restricted to retrieved documents (it cites them, or says "not in your documents"), and writes five-question quizzes from a subject's documents.
- **Search:** `nomic-embed-text` embeddings in SQLite (`sqlite-vec`) plus FTS5 keyword search, so one bar handles exact words, meaning and plain questions.
- **Dates:** each date the model finds is cross-checked with `chrono-node`, anchored to the capture time. It goes on the timeline only when both agree; otherwise it waits for review.
- **Photos:** OpenCV (WebAssembly) finds the page edges and flattens photographed whiteboards and handouts. Apple Vision on-device OCR gives word boxes for tap-to-select.

**Why it has to be local:** a website can't watch your folders, it has to ask you to upload. Only software on your machine can file things as they arrive. It also works with no signal, costs nothing per file, and keeps class photos and personal chats on the device.

**Measured on this machine (Apple M4, 16 GB, one production server, nothing else using Ollama):** 11 s per document read on average over 10 documents (median 7 s, range 5 to 23 s), about 7 s for a cited answer, about 25 s to write a five-question quiz, 0 outbound requests. Timings come from the app's own `/api/status`; the full rerunnable table is in the README. We have no public benchmark and quote none.

## What was built during the hackathon

All of it, from an empty `create-next-app` on Oct 10 2026:

- Folder watcher and ingest pipeline (hashing, dedupe, queue), image cleanup and perspective warp, thumbnails.
- Local model reader for images and PDFs, subject filing from a class schedule, date extraction with a cross-check, and a review list.
- Hybrid search (FTS5 + vectors), cited answers, quiz generation, and an `.ics` export of the timeline.
  <!-- story: add "flashcards and a reviewer sheet" here only if /api/flashcards and /api/review are on main at submission. -->
- The web app: Library, Subjects, Coming up timeline, Ask, Document view, Quiz, Snap (webcam or Continuity Camera capture), drag and drop, and the outbound-request counter.
- Brand, synthetic demo documents, this pitch deck (`pitch/index.html`), and the demo video (recorded from the real app, cut in HyperFrames).

No pre-existing project code. Claude Code (Anthropic) was used as a coding assistant during the build; it is not part of the product.

## Models and licences

| Model | Role | Licence |
|---|---|---|
| `qwen2.5vl:3b` (Qwen2.5-VL 3B Instruct) | reads images | Qwen Research License (non-commercial research and evaluation use) |
| `qwen3:4b` (Qwen3 4B) | text, answers, quiz | Apache 2.0 |
| `nomic-embed-text` (Nomic Embed Text v1.5) | embeddings | Apache 2.0 |

All three run locally through Ollama (MIT). The full list of libraries is in the README under Disclosures.

## Repo URL

https://github.com/keyyum/dejafind

## Video URL

[VIDEO URL — paste the X or LinkedIn post URL after uploading `video/dejafind-demo.mp4`]

## Team

[TEAM — names exactly as on the official AppBuildersPH participant list]

## Post (X / LinkedIn)

Upload `video/dejafind-demo.mp4` natively from the founder's account, tag Cognition, and use this one line:

> DéjàFind: your screenshots, slides and PDFs, understood and findable, fully offline on a laptop. Built in 24 h for #AppBuildersPH.
>
> Music: Newer Wave by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License. http://creativecommons.org/licenses/by/4.0/

## Video credits

- **Footage:** the real DéjàFind app on this laptop, recorded with headless Chrome; all documents are synthetic samples. Model waits are cut for time and each cut is labelled on screen.
- **Demo video (`video/dejafind-demo.mp4`):** the interface is re-created from the real app as animated components; the outputs and timings shown come from a real run on this laptop. The backup (`video/dejafind-backup.mp4`) is a raw screen recording.
- **Edit:** HyperFrames (HeyGen), with GSAP 3.
- **Voice:** edge-tts, Microsoft neural voice en-US-AndrewMultilingualNeural at +4%. This is an online text-to-speech service, used only to narrate the promo video; the DéjàFind app itself makes no network calls.
- **Music:** "Newer Wave" by Kevin MacLeod (incompetech.com), CC BY 4.0. Attribution line is in the post text above.
- **Sound effects:** Kenney (kenney.nl) Interface Sounds and UI Audio, CC0; whooshes, key taps and the riser were synthesised for this video.
