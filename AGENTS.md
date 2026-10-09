# DéjàFind agent instructions

AppBuildersPH Hackathon 2026 entry. Theme: Local AI. Submission deadline **10:00 AM, Oct 10 2026, Asia/Manila**, no extensions. Code freeze at the deadline; judges review the repo as of then.

## Read first
- `docs/PRODUCT.md` is the finalized product definition. Do not relitigate scope.
- `docs/PLAN.md` is the build order, time boxes, and demo script. Build in that order.

## Hard rules (hackathon)
- Core AI runs on this laptop. **No calls to OpenAI, Anthropic, Google, or any cloud AI API** anywhere in the code path. The demo runs with Wi-Fi off.
- Every model, framework, and library used must be listed in `README.md` under Disclosures. Add it the moment you add a dependency.
- No pre-existing project code. Everything here is written during the hackathon. Disclose any copied snippet or asset in `README.md`.
- Never commit user files, indexes, or test documents containing real people's data. `data/` is gitignored. Sample files for the demo are synthetic.
- No fake benchmarks. Quote only numbers you measured on this machine, and say so.

## Stack (decided)
- Next.js 16 app, TypeScript, Tailwind. Route handlers and a long-running server module do the local work. One language, one process.
- File watching: `chokidar` on `data/watch/` plus user-chosen folders (Screenshots, Downloads).
- Storage: `better-sqlite3` with `sqlite-vec` for embeddings and FTS5 for keyword search. One file at `data/dejafind.sqlite`.
- Models via Ollama on localhost:11434: `qwen2.5vl:3b` reads images (text, title, summary, tags, dates in one JSON call), `qwen3:4b` for text files, extraction, answers, and quiz, `nomic-embed-text` for embeddings. Machine is an M4 with 16 GB, so keep one vision model and one text model loaded at most.
- PDFs: `pdf-parse` for text, fall back to the vision model on page images only if text is empty.
- Dates: model output cross-checked with `chrono-node` anchored to the file's capture time. A date is auto-filed only when both agree, otherwise it goes to a review list.

## Engineering rules
- Small commits, every 30 to 60 minutes, pushed to `origin/main`. A squad worker pushes its own branch and opens a PR.
- Each worker owns exclusive files. No two workers edit the same file.
- Answers must cite a file id. If retrieval confidence is low, answer "not in your files".
- Keep the UI to four views: Files (with summaries), Subjects, Timeline, Ask. Quiz is a fifth view only if the core four work.
- Read `node_modules/next/dist/docs/` before writing Next.js code; this version differs from training data.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
