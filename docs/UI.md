# UI spec

Read `docs/PRODUCT.md` first. This file is the contract for the UI worker. Invoke the `frontend-design` skill before laying out any screen.

## Art direction

Google Photos for documents, with a Spotlight search bar. White page, near-black ink, grey for everything secondary, one accent (the theme's terracotta) used only for the nearest deadline and highlighted matches. One typeface, Figtree. Documents are the biggest thing on every screen; chrome is small and grey. No cards with buttons, no sidebar, no dashboard. Nothing under 14px; body 16. It must read on a projector.

Mockup: https://claude.ai/artifact/Ctv1CrDG8dSP85eWKCH3Tt, artboards "1 · Library", "2 · Search", "3 · Document", "4 · Quiz".

## Four screens

**1. Library (home).** Top-left wordmark, top-right three grey words with a pulsing green dot: "On this laptop · nothing sent". Then one big search bar, pill shaped, placeholder "Search inside your documents, or ask". Under it, subject names as plain text filters with counts (All, Biology, Calculus, …, Other in lighter grey, and Schedule), auto-created, plus a quiet "Quiz me" text link at the right that quizzes the current filter. Then one thin **Coming up** strip: the next three dates found in documents, each linking to its document, the one within 48 hours in accent. Then the grid: documents grouped by day, 4 across, 4:3 thumbnails of the real image or PDF first page, caption under each: title, then subject in grey. A document still being read shows a spinner tile and "Reading…". A newly filed document carries "filed under Biology" in green under its caption for one minute.

**2. Search results.** Same bar at the top, query inside it. If the query reads as a question, an answer block first: plain 24px text with the key fact bold, "From 2 of your documents" in grey, and the cited documents as thumbnails beside it with the used lines highlighted. Then "Documents" as a list: 96px thumbnail, title, the best matching snippet with the match highlighted, subject and date in grey. Filters by subject stay visible. Zero results: "Nothing in your documents matches that." in grey.

**3. Document.** Image or PDF page large on the left, zoomable. Right column, in this order: title (editable), one-line summary, subject with a small change menu, tags, dates found (each with "on Coming up" or "ignored" and a one-tap toggle), then the full extracted text in a scrolling box with matches highlighted when arriving from search. Footer actions as text links: Quiz me on this, Find similar, Open original file, Delete. This screen is the proof of the product; make the extracted text and the dates visibly come from the image.

**4. Quiz.** Back link, "2 of 5", a 2px progress line. One question at 30px, four quiet rows as real buttons. On answer: correct row turns green-bordered, a wrong pick orange-bordered, others fade. Below a rule: verdict, one-line explanation, the source document thumbnail with a link, Next. Final screen: score, Again, Back.

## Moments, not widgets

**Filing confirmation.** A dark snackbar bottom-center for six seconds: "Screenshot filed under Biology · Oct 17 added to Coming up", Undo. The stage moment; polish it first.

**Schedule confirmation.** When a document looks like a timetable, a card above the grid: "This looks like a class schedule for BSCS 2-B. Is it yours?" with Use it and Not mine; defaults to Not mine if the section differs from the confirmed one. The only thing the app ever asks.

**Status panel.** Clicking the three grey words opens a small panel: 0 requests out, the three model names and sizes, measured seconds per document on this machine.

## Already installed and verified on Tailwind 4 + React 19

- shadcn (Base UI flavor, CSS variables) with the tweakcn `claude` preset applied in `src/app/globals.css`.
- Fonts via `next/font`: Figtree (`font-sans`, everything), JetBrains Mono (`font-mono`, only for numbers in the status panel). Fraunces is loaded but unused; do not use serif.
- `src/components/ui/animated-list.tsx` (Magic UI) if the Library needs a live-arriving list; `src/components/kibo-ui/status` for the status dot.
- Stock shadcn: `button`, `badge`, `card`, `command`, `dialog`, `tabs`, `sonner` (use for the snackbar), `input`, `textarea`, `radio-group`, `field`, `label`, `separator`.

Install anything else only through `npx shadcn@latest add` and run `npm run typecheck` immediately after. Import animation from `motion/react`, never `framer-motion`.

## Data the UI reads

The core worker exposes JSON route handlers under `/api/`: `documents` (grouped by day, filter by subject), `documents/[id]`, `subjects`, `timeline`, `schedule`, `search` (POST `{q, subjectId?}` returning `{answer?, citations?, results[]}`), `quiz` (POST `{subjectId?, documentIds?}`), `status`, and a server-sent events stream at `/api/events` that emits `document.filed`. Thumbnails from `/api/thumb/[id]`, originals from `/api/file/[id]`. If an endpoint is not ready, render against the mock in `src/lib/mock.ts` and swap later. Do not block on the core.

## Not building

Today or dashboard pages. Subject pages as documents. Checklists. Chat bubbles or a bot name. Folder trees. Sidebars. Dark mode. Settings beyond "which folders to watch". Any animation beyond the snackbar and the quiz fade.
