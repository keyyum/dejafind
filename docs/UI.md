# UI spec

Read `docs/PRODUCT.md` first. This file is the contract for the UI worker. Invoke the `frontend-design` skill before laying out any screen.

## Art direction

Calm notebook, not a dashboard. Think Notion page meets Google Photos library. White page, near-black ink, grey for everything secondary, one accent (the theme's terracotta) used only for the nearest deadline. One typeface, Figtree, no serif. No cards with buttons, no badges, no shadows except the Ask bar. Nothing under 14px; body 16, page title 40. The user should feel like they opened their own notes, not an app.

Mockup to match: https://claude.ai/artifact/Ctv1CrDG8dSP85eWKCH3Tt, artboards "1 · Today", "2 · Subject page", "3 · Library", the shared Ask and Quiz boards for those screens.

## Views

**Sidebar, every screen.** Light grey, 240px, collapses to a top row at phone width. Items: DéjàFind wordmark with a small green dot ("On this laptop"), Ask or search, Today, Library (count), Schedule, then a Subjects heading and one plain row per subject with its capture count, Other last in grey. Footer line: "Watching Desktop, Downloads. Nothing leaves this laptop."

**0. Today (home).** The app opens here. One column, max 760px, four short sections, nothing configurable: **Classes** (today's classes from the confirmed schedule as one line, each linking to its subject), **Coming up** (next three deadlines as a checklist, source in grey on the right, only the one within 48 hours colored), **Just filed** (last six captures as small thumbnails with titles, screenshots and PDFs together, "See all" to Library), **Study next** (one suggestion with a Quiz me button, e.g. "Biology quiz is Friday. Five questions from this week's notes."). No streaks, stats, charts, banners, or onboarding checklists. During the demo the new screenshot appears in Just filed and in Coming up on this one screen without any click.

**1. Subject page.** Reached from the sidebar or from Today. One column, max 760px. Small grey line (teacher, section, count), the subject name at 40px, then two small buttons: Quiz me (dark) and Ask about this subject (outlined). Then "Coming up" as a checklist with the source in grey on the right. Then captures grouped "This week", "Last week", older: each row a 56px thumbnail, title, one-line summary in grey, type and time in lighter grey. A capture still being read shows a spinner thumbnail and "Reading…". Clicking a row opens the capture: full image left, extracted text right, tags and dates below, "Move to…" subject picker.

**2. Library.** A's photo grid: captures grouped by day, 4 across, 4:3 thumbnails, caption under each with subject in grey. A row of subject names across the top filters it. A newly filed capture appears at the top with "filed under Biology" under it for one minute.

**3. Ask.** The bar lives at the top of the sidebar and as ⌘K. Submitting opens the Ask view: the answer as plain 26px text with the key fact in bold, one grey line "From 2 of your notes, answered on this laptop in 2.1 s", the source capture beside it with the used spans highlighted, two text links (Quiz me on this, Show in Biology). Earlier answers below in grey. "Not in your notes." in grey, never red.

**4. Quiz.** Back link, "2 of 5", a 2px progress line. One question at 30px, four quiet rows as real buttons. On answer: correct row turns green-bordered, a wrong pick turns orange-bordered, others fade. Below a rule: verdict, one-line explanation, "From Lecture 5" link, the source thumbnail, Next.

**Schedule.** A simple week grid built from the confirmed timetable, each cell linking to its subject. Reached from the sidebar.

## Moments, not widgets

**Filing confirmation.** A small dark snackbar bottom-center for six seconds: check icon, "Screenshot filed under Biology · Oct 17 added to Coming up", Undo. This is the stage moment; polish it first.

**Schedule confirmation.** When a file looks like a timetable, a card at the top of the page: "This looks like a class schedule for BSCS 2-B. Is it yours?" with Use it and Not mine. Defaults to Not mine if the section differs from the confirmed one. It is the only thing the app ever asks.

**Status.** Three grey words in the sidebar with a pulsing green dot: "On this laptop". Clicking opens a small panel: 0 requests out, the three model names and sizes, measured seconds per capture.

## Already installed and verified on Tailwind 4 + React 19

- shadcn (Base UI flavor, CSS variables) with the tweakcn `claude` preset applied in `src/app/globals.css`: warm off-white background, terracotta primary.
- Fonts via `next/font`: Figtree (`font-sans`, everything), JetBrains Mono (`font-mono`, only for the status panel numbers). Fraunces is loaded but unused in this direction; do not use serif.
- `src/components/ui/animated-list.tsx` (Magic UI) for the ingest toast stack.
- `src/components/kibo-ui/status` for the local status pill.
- Stock shadcn: `button`, `badge`, `card`, `command`, `dialog`, `tabs`, `sonner`, `input`, `textarea`, `radio-group`, `field`, `label`, `separator`.
- Kibo `choicebox` was removed: it targets the Radix flavor and fails typecheck here. Quiz choices are plain large outlined `Button`s.

Install anything else only through `npx shadcn@latest add` and run `npm run typecheck` immediately after. Import animation from `motion/react`, never `framer-motion`.

## Data the UI reads

The core worker exposes JSON route handlers under `/api/`: `subjects`, `subjects/[id]`, `captures/[id]`, `library`, `timeline`, `schedule`, `ask` (POST `{question, subjectId?}`), `quiz/[subjectId]`, `status`, and a server-sent events stream at `/api/events` that emits `capture.filed` for the toast. Thumbnails are served from `/api/thumb/[id]`. If an endpoint is not ready, render against the mock in `src/lib/mock.ts` and swap later. Do not block on the core.

## Not building

A landing page. Dark mode. Folder trees. Cards with buttons. Settings beyond "which folders to watch". Any animation beyond the snackbar and the quiz fade. A logo that takes longer than ten minutes.
