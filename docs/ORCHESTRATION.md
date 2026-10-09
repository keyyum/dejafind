# Orchestration, Oct 10 2026

You are the orchestrator in the `~/dejafind` main tree, running inside cmux. Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/PLAN.md`, `docs/UI.md`, `docs/ASSETS.md`, `docs/VIDEO.md`, `docs/PITCH.md` once, then run this. Do not ask the founder questions that these files answer. Decide and move. Report in one line when a step proves, and in one line when something blocks.

## Panes and models

Use the `/squad` skill's mechanics (worktrees, `launch-pane.sh`, contracts, STATUS.md) with this fixed roster. Superpowers is disabled in this repo; do planning and review yourself.

| Pane | Hat | Model | Worktree branch | Owns |
|---|---|---|---|---|
| 1 | orchestrator | this session | main | docs, merges, STATUS, gates |
| 2 | core | `claude-sonnet-5` | `squad/dejafind/core` | `src/server/**`, `src/app/api/**`, `src/lib/db*`, `scripts/**`, steps 1 to 9, then 17 core |
| 3 | ui | `claude-opus-5-5` | `squad/dejafind/ui` | `src/app/**` except `api`, `src/components/**`, `src/lib/mock.ts`, steps 10 to 16, then 17 ui |
| 4 | assets | `claude-sonnet-5` | `squad/dejafind/assets` | `public/brand/**`, `docs/ASSETS.md` results, favicon, OG image, X post image, title cards for the video |
| 5 | story (launch at 06:30) | `claude-sonnet-5` | `squad/dejafind/story` | `docs/VIDEO.md` execution, `docs/PITCH.md` deck as `pitch/index.html`, README final pass, submission text |

A Codex pane may run beside pane 4 to generate concept images; the assets worker never ships a generated raster as-is, it recreates the final mark as clean SVG and uses generated images only as reference or as cleaned, cropped illustrations.

## Contracts

One contract per pane from `~/.claude/skills/squad/templates/contract.md`, filled completely. Exclusive file ownership as above. The UI worker builds against `src/lib/mock.ts` until the API exists, then swaps. The core worker exposes the routes named in `docs/UI.md` under "Data the UI reads" with exactly those shapes; write `src/lib/api-types.ts` first and commit it so both sides compile against it. The orchestrator writes `api-types.ts` before launching panes.

## Gates and merges

Gates: `npm run lint`, `npm run typecheck`, `npm run build`. A worker pushes its branch and opens a PR when a step proves. The orchestrator reviews the diff, runs the gates in the main tree after merging locally, and pushes `main`. Merge order: core steps 1 to 5 first so the UI has data by 04:30. Never merge a diff that adds a cloud AI call or a dependency missing from README Disclosures.

## Cadence

- Every 30 minutes: read each pane's last screen and STATUS.md. A pane idle for 10 minutes with no commit gets a nudge message; a pane stuck for 30 minutes gets its contract tightened or its step cut.
- 05:30, 06:30, 07:15: checkpoints from `docs/PLAN.md`. At each, apply the cut order without discussion.
- 07:15: freeze features. Pane 5 takes over the video and pitch with the real app. Panes 2 to 4 fix only what the video needs.
- 09:00: make the repo public (`gh repo edit --visibility public`), confirm README Disclosures match `package.json`, confirm `data/` has only synthetic samples, tag `v0.1-hackathon`, and hand the founder the submission text from pane 5 for the Cerebral Valley form.

## What only the founder does

Fill and submit the Cerebral Valley form (one submission, no edits). Post on X or LinkedIn from his account. Approve making the repo public. Stand on stage.
