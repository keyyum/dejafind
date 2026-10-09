# Brand and assets brief

Owner: assets pane. Everything lands in `public/brand/`. Vector first. Nothing generated is shipped raw.

## Name and voice

DéjàFind. Pronounced "day-zha-find". Tagline: "Find what you already saw." Secondary: "Your notes, understood. No internet needed." Voice: calm, plain, a little dry. Never "AI-powered", never exclamation marks.

## Mark

A single idea: a sheet of paper with a folded corner and one highlighted line, and the fold reads as a small "look back" arrow. Flat, one color, works at 16px. No eyes, no magnifying glass, no brain, no sparkles. Deliver `mark.svg`, `mark-mono.svg`, `logo-horizontal.svg` (mark + wordmark), `logo-stacked.svg`.

## Wordmark

Figtree 600, letter-spacing -0.02em, the accents kept on the é and à. Dark ink `#1f1f1d` on light. Light version for dark backgrounds.

## Colors

Page `#fcfcfa`, ink `#1f1f1d`, secondary `#7a7a74`, hairline `#ededea`, accent `#c2410c` (deadlines and highlights only), success `#3c9a5f`, highlight `#ffe8a3`.

## Deliverables

- `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` (180), `icon-512.png`
- `og.png` 1200×630: the Library screen cropped with the wordmark and the tagline
- `post.png` 1600×900 for X/LinkedIn: same as OG with "Built offline in 24 hours · AppBuildersPH Hackathon 2026"
- `empty-library.svg`: a faint paper-tile outline for the empty state
- Four title cards for the video as 1920×1080 PNG: the name card, "No upload. It watches.", "Wi-Fi off", "Find what you already saw."
- `brand.md`: one page with the above and usage rules

## Process with a Codex image pane

Ask Codex for 4 to 6 concept images of the mark at 1024×1024, flat, single color, white background. Pick one. Recreate it by hand as SVG with clean paths, optical corrections, and consistent stroke. Do the same for the empty-state illustration. Generated images stay in `docs/brand-refs/` and are never referenced by the app.
