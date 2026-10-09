# DéjàFind

**Your files, understood. No internet needed.**

DéjàFind watches your Screenshots, Downloads, and a drop folder. Every new photo, screenshot, or PDF is read, titled, summarized, tagged by subject, and placed on a deadline timeline, by itself, on your own laptop. Ask "when's my bio quiz?" and it answers from your own files and shows the one it came from.

Built for students first. Works for anyone with files.

AppBuildersPH Hackathon 2026 entry. Theme: Local AI.

## Why local AI

A website cannot watch your folders; it has to ask you to upload. Only software running on your machine can organize files as they arrive. It works with no signal and no data, costs nothing per file, and your class photos and personal screenshots never leave the device.

## Run it

Requires macOS or Linux, Node 20+, and [Ollama](https://ollama.com).

```bash
ollama pull qwen2.5vl:3b
ollama pull qwen3:4b
ollama pull nomic-embed-text
npm ci
npm run dev
```

Open http://localhost:3100. Drop a file into `data/watch/` or take a screenshot. Turn Wi-Fi off; it keeps working.

## What runs locally, what needs internet

- **Runs locally:** everything in the product. File watching, reading images and PDFs, summarizing, subject tagging, date extraction, search, question answering, and the quiz all run on the laptop through Ollama.
- **Needs internet:** only the one-time model download through `ollama pull`. Nothing at runtime.

## Disclosures

Keep this section current. Every model, framework, and library is listed the moment it is added.

**Models (all run locally via Ollama)**
- `qwen2.5vl:3b` (Qwen2.5-VL 3B, Apache 2.0): reads images, returns text, title, summary, tags, dates.
- `qwen3:4b` (Qwen3 4B, Apache 2.0): text files, structured extraction, answers, quiz generation.
- `nomic-embed-text` (Nomic Embed v1.5, Apache 2.0): embeddings for semantic search.

**Frameworks and libraries**
- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Ollama (local model server) and the `ollama` JS client
- `chokidar` (folder watching), `better-sqlite3` + `sqlite-vec` + SQLite FTS5 (storage and search), `pdf-parse` (PDF text), `chrono-node` (date cross-check)

**Cloud services and APIs:** none in the product.

**Existing code and assets:** none. Scaffolded with `create-next-app` on Oct 10 2026 during the hackathon. Sample files in `data/samples/` are synthetic.

**AI development tools:** Claude Code (Anthropic) was used as a coding assistant. All code was written during the hackathon.

## Team

See the submission form. Members are listed exactly as on the official AppBuildersPH participant list.
