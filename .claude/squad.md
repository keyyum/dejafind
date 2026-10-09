# /squad config — dejafind

## Sacred zones (STOP before editing any of these)
- `README.md` Disclosures section (append only, never remove a listed model)
- `.github/workflows/`

## Extra risk keywords (added to the defaults)
cloud, openai, anthropic, fetch(, api key

## Specialist agents
- reviewer: `pawi-reviewer` is NOT available here; use a fresh `general-purpose` reviewer with the contract's Done-when.

## Worktree prep
- install: `npm ci`
- copy from main tree: none required (no `.env`). Ollama runs once on the host and is shared by every worktree.
- note: `npm run dev` picks a free port per worktree; pass `-p` explicitly in contracts so panes don't collide.

## Notes
- Default branch is `main`.
- Hackathon deadline 10:00 AM Oct 10 2026 Manila. Do not start a wave that cannot land by 08:30.
- Core AI must stay local. Any diff that adds a cloud AI call fails review.
