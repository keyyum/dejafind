# UI spec

Read `docs/PRODUCT.md` first. This file is the contract for the UI worker. Invoke the `frontend-design` skill before laying out any screen.

## Art direction

A warm paper desk, not a dashboard. Off-white page, near-black ink, one accent (the installed theme's terracotta primary). Big serif subject names, small mono deadlines. Flat bordered cards, no shadows, no gradients. Citations drawn as mono footnote chips. No sidebar: a slim top bar. Animate only two things: the ingest toast sliding in, and the quiz question transition. Light theme only. Nothing under 14px; body 16, headings 24 and 32. It must read from the back of a mall event space on a projector.

## Already installed and verified on Tailwind 4 + React 19

- shadcn (Base UI flavor, CSS variables) with the tweakcn `claude` preset applied in `src/app/globals.css`: warm off-white background, terracotta primary.
- Fonts via `next/font`: Fraunces (`font-serif`, headings), Figtree (`font-sans`, body), JetBrains Mono (`font-mono`, citations and status). `h1`–`h3` are serif by default.
- `src/components/ui/animated-list.tsx` (Magic UI) for the ingest toast stack.
- `src/components/kibo-ui/status` for the local status pill.
- Stock shadcn: `button`, `badge`, `card`, `command`, `dialog`, `tabs`, `sonner`, `input`, `textarea`, `radio-group`, `field`, `label`, `separator`.
- Kibo `choicebox` was removed: it targets the Radix flavor and fails typecheck here. Quiz choices are plain large outlined `Button`s.

Install anything else only through `npx shadcn@latest add` and run `npm run typecheck` immediately after. Import animation from `motion/react`, never `framer-motion`.

## Screens

**Top bar, every screen.** Left: "DéjàFind" in serif. Center: the Ask bar (shadcn `command` styled as a single input, placeholder "Ask your notes… when's my bio quiz?"). Right: the status pill: a pulsing dot, "Local · 0 requests out · 3 models warm", mono. Clicking it opens a dialog listing model names, sizes, and the measured seconds per capture on this machine.

**1. Subjects home (`/`).** A grid of subject cards, 3 across at desktop. Each card: serif subject name (32px), capture count, the next deadline in mono with its date, and a "Quiz me" button. "Other" is last, visually quieter, no quiz button. Empty state: one sentence, "Drop a slide photo in the watch folder or take a screenshot."

**2. Subject view (`/subjects/[id]`).** Two columns. Left: captures, newest first, each row a 96px thumbnail, title, one-line summary, mono date. Rows in `status = queued` show a small spinner and "Reading…". Click opens a dialog: the full image on the left, extracted text on the right, tags and dates below. Right column: the next three deadlines for this subject, and "Quiz me".

**3. Timeline (`/timeline`).** One vertical list grouped by date. Each row: 64px thumbnail, label, subject badge. Dates with `status = review` carry an amber "check this" badge and a one-tap confirm. Top-right: "Add to calendar" (only if tier 2 ships; hide otherwise).

**4. Ask (inline, not a page).** Typing in the top bar and pressing Enter slides an answer panel down beneath the bar: the answer text, then a row of citation chips (mono, `#id · title`) each showing the thumbnail on hover and opening the capture dialog on click. "Not in your notes." renders as a quiet grey card, never red. A subject scope selector sits at the left of the bar, default "All subjects".

**5. Quiz (`/quiz/[subjectId]`).** Full width, no chrome except a thin progress line. One centered serif question (28px). Four large outlined buttons. On answer: the chosen button turns green or red, a one-line explanation appears, and the source capture thumbnail with its title. "Next" advances with a quick fade. Final screen: score out of five, "Again" and "Back to Biology".

## The two hero components

**Ingest toast.** Bottom-right stack built on `animated-list.tsx`. Each item: thumbnail, title in serif, then two mono lines: "Filed under Biology" and "Oct 17 added to timeline". Stays six seconds. This is the moment the judges see the app work without anyone touching it; polish it before anything else on this list.

**Status pill.** Always visible, always truthful. It reads a counter from the server that increments on any outbound HTTP request the Node process makes. It must say 0 for the whole demo.

## Data the UI reads

The core worker exposes JSON route handlers under `/api/`: `subjects`, `subjects/[id]`, `captures/[id]`, `timeline`, `ask` (POST `{question, subjectId?}`), `quiz/[subjectId]`, `status`, and a server-sent events stream at `/api/events` that emits `capture.filed` for the toast. Thumbnails are served from `/api/thumb/[id]`. If an endpoint is not ready, render against the mock in `src/lib/mock.ts` and swap later. Do not block on the core.

## Not building

A landing page. Dark mode. Settings beyond "which folders to watch". Any animation not listed above. A logo that takes longer than ten minutes.
