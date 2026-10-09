# DéjàFind — brand

## Name

**DéjàFind.** Pronounced "day-zha-find." Write the accents (`é`, `à`) whenever the
font and encoding allow it; `DejaFind` (no accents) is an acceptable fallback
for plain-ASCII contexts (URLs, env vars, file names), never a redesign.

**Tagline:** "Find what you already saw."
**Secondary line:** "Your notes, understood. No internet needed."

## Voice

Calm, plain, a little dry. Short sentences. Never "AI-powered." Never an
exclamation mark. Say what the product did ("Filed under Biology"), not what
it is ("Powered by advanced AI").

## Colour

| Token | Hex | Use |
|---|---|---|
| Page | `#fcfcfa` | app background |
| Ink | `#1f1f1d` | text, the mark, primary UI |
| Secondary | `#7a7a74` | captions, metadata, grey chrome |
| Hairline | `#ededea` | borders, the empty-state illustration |
| Accent | `#c2410c` | the nearest deadline, and nothing else |
| Highlight | `#ffe8a3` | search-match highlight |
| Success | `#3c9a5f` | confirmations ("filed under…") |

The mark itself is **one colour only** — ink on page, or `currentColor` for
`mark-mono.svg`. Never tint it with the accent or add a second colour.

## Type

**Figtree**, weight 600 for the wordmark and headings, letter-spacing
`-0.02em`. Body text is Figtree at regular weights; `next/font` self-hosts it
for the app, so nothing here should load a font from the network at runtime.

The wordmark in `logo-horizontal.svg`, `logo-horizontal-light.svg`, and
`logo-stacked.svg` is kept as live SVG `<text>` (not converted to outline
paths) — the asset pipeline for this hackathon adds no new npm dependencies,
and there was no reliable path from Figtree's font file to clean outline
paths without one (no Illustrator, no `opentype.js`). Since the app already
self-hosts Figtree via `next/font`, `<text>` renders identically wherever the
app itself renders it. For contexts without the font loaded (slide decks,
the video), use `logo-horizontal@2x.png`, a 384×112 raster of the same
lockup rendered once with the font present.

## The mark

A sheet of paper with one corner notched off and one highlighted line. The
notch reads two ways at once: a folded-over corner (so it's recognizably a
"document"), and a small chevron pointing back into the page (so it echoes
"look back," which is what the product does). The line is a knockout
(negative space), not a second colour, so the mark tints cleanly with
`currentColor` in `mark-mono.svg`.

Construction: `viewBox="0 0 64 64"`, a single `evenodd` path — the page
outline (with the corner notch built into it) as the outer contour, the
highlighted line as an inner hole. No gradients, no stroke, no `<text>`, no
embedded raster.

**Minimum size:** 16px (the favicon size). Below that, legibility is the
overall silhouette (rounded page + one bar) more than the notch — this is
expected and fine; don't add detail to compensate.

**Clear space:** leave at least the width of the notch (≈6% of the mark's
width) of empty space on every side before any other element.

**Don't:**
- Don't recolour the mark with the accent, a gradient, or more than one
  colour.
- Don't add an eye, a magnifying glass, a brain, or sparkles to it.
- Don't rotate, skew, or flip it.
- Don't place it on a background that doesn't contrast with ink
  (`mark.svg`) or with whatever colour `mark-mono.svg` is tinted to.
- Don't redraw the line as a second shape with its own fill — it must stay
  a knockout so mono tinting keeps working.

## Files

| Path | Use |
|---|---|
| `mark.svg` | the mark, ink on transparent |
| `mark-mono.svg` | the mark, `currentColor` — tint to anything |
| `logo-horizontal.svg` / `-light.svg` | mark + wordmark, for light / dark backgrounds |
| `logo-horizontal@2x.png` | same lockup as a flattened raster, for contexts without the Figtree font loaded |
| `logo-stacked.svg` | mark above wordmark, for square placements |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png` | favicons, on `#fcfcfa` |
| `empty-library.svg` | faint paper-tile outline for the empty Library state |
| `og.png`, `post.png` | social share images |
