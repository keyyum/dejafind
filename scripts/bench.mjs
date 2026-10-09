#!/usr/bin/env node
// DéjàFind latency benchmark. Runs against a live server and prints Markdown.
// Everything it reports is measured on the machine it runs on, in that run.
//
//   node scripts/bench.mjs --base http://localhost:3100 [--out docs/bench.md]
//
// Expects a FRESH database (stop the server, move data/dejafind.sqlite aside,
// start it again) so the "first read after start" row is a real cold number.
// Uses only the public /api routes and the synthetic files in data/samples/demo.

import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = argOf("--base", "http://localhost:3100").replace(/\/$/, "");
const OUT = argOf("--out", null);
const SAMPLES = join(process.cwd(), "data", "samples", "demo");

// Order matters: the timetable first (and confirmed) so schedule subjects exist
// before the rest are filed, exactly like the stage demo.
const FILES = [
  "timetable-bscs-2b.png",
  "gc-biology-quiz-oct17.png",
  "bio-mitosis-slide.jpg",
  "whiteboard-photosynthesis.jpg",
  "calc-limits-slide.png",
  "calc-longquiz-handout.jpg",
  "gc-calculus-longquiz-oct19.png",
  "physics-kinematics-slide.png",
  "physics-lab-handout.pdf",
  "sanaysay-wika-kultura.jpg",
  "jollibee-receipt.jpg",
];

const KEYWORD_QUERIES = ["jollibee", "photosynthesis equation"];
const QUESTIONS = ["when's my bio quiz", "what room is the bio quiz in", "when is the calculus long quiz"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const sec = (ms) => (ms / 1000).toFixed(1) + " s";

async function api(path, init) {
  const res = await fetch(BASE + path, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function importFile(name) {
  const buf = await readFile(join(SAMPLES, name));
  const form = new FormData();
  form.append("files", new Blob([buf]), name);
  const t0 = now();
  const out = await api("/api/import", { method: "POST", body: form });
  const doc = out.documents[0];
  if (!doc) throw new Error(`${name}: import returned no document (duplicates=${out.duplicates})`);
  // Poll until the reader is done.
  let detail;
  for (;;) {
    detail = await api(`/api/documents/${encodeURIComponent(doc.id)}`);
    if (detail.status !== "queued" && detail.status !== "reading") break;
    await sleep(250);
  }
  const wall = now() - t0;
  return { detail, wall };
}

async function timed(label, fn) {
  const t0 = now();
  const value = await fn();
  return { label, ms: now() - t0, value };
}

const lines = [];
const log = (s = "") => {
  lines.push(s);
  console.log(s);
};

const status0 = await api("/api/status");
log(`# Benchmark, measured on this machine`);
log();
log(`Machine: ${status0.machine}. Models loaded: ${status0.models.map((m) => m.name).join(", ")}. Server started ${status0.startedAt}. Run at ${new Date().toISOString()}.`);
log(`All numbers below are wall-clock from the public API on one server with nothing else using Ollama. Model output varies between runs; the times are what to expect, not a promise.`);
log();

// 1. Reads
log(`## Reading documents (drop to filed)`);
log();
log(`| File | Kind | Subject | Dates | Model read | Drop to filed |`);
log(`|---|---|---|---|---|---|`);
const reads = [];
const ids = {};
for (const [i, name] of FILES.entries()) {
  const { detail, wall } = await importFile(name);
  ids[name] = detail.id;
  reads.push({ name, readMs: detail.readMs ?? 0, wall, first: i === 0 });
  const dates = (detail.dates ?? []).map((d) => `${d.isoDate}${d.status && d.status !== "auto" ? ` (${d.status})` : ""}`).join(", ") || "none";
  log(`| ${name}${i === 0 ? " (first read after start)" : ""} | ${detail.docType} | ${detail.subjectName ?? "Other"} | ${dates} | ${sec(detail.readMs ?? 0)} | ${sec(wall)} |`);
  if (i === 0) {
    const sched = await api("/api/schedule");
    if (sched.pending) {
      const t = await timed("confirm", () =>
        api("/api/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId: sched.pending.documentId, confirm: true }) })
      );
      log(`| (schedule confirmed: ${sched.pending.subjects.length} subjects) | | | | | ${sec(t.ms)} |`);
    }
  }
}
const warm = reads.slice(1);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
log();
log(`First read after server start: **${sec(reads[0].wall)}** (model load included). Warm reads, ${warm.length} files: average **${sec(avg(warm.map((r) => r.wall)))}** drop to filed, model read ${sec(avg(warm.map((r) => r.readMs)))} on average, fastest ${sec(Math.min(...warm.map((r) => r.wall)))}, slowest ${sec(Math.max(...warm.map((r) => r.wall)))}.`);
log();

// 2. Search
log(`## Search and answers`);
log();
log(`| Query | Kind | Time | Result |`);
log(`|---|---|---|---|`);
const search = (q) => api("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q }) });
for (const q of KEYWORD_QUERIES) {
  const t = await timed(q, () => search(q));
  log(`| ${q} | keyword | ${sec(t.ms)} | top: ${t.value.results[0]?.document?.title ?? "none"} |`);
}
for (const q of QUESTIONS) {
  const t = await timed(q, () => search(q));
  const a = t.value.answer;
  log(`| ${q} | question | ${sec(t.ms)} | ${a ? `"${a.text.replace(/\|/g, "/").slice(0, 90)}" citing ${a.citations.length} line(s)` : t.value.notInDocuments ? "not in your documents" : "no answer"} |`);
}
log();

// 3. Study tools on Biology
const subjects = (await api("/api/subjects")).subjects;
const bio = subjects.find((s) => /biology/i.test(s.name)) ?? subjects[0];
log(`## Study tools (subject: ${bio.name})`);
log();
log(`| Tool | Time | Result |`);
log(`|---|---|---|`);
const post = (path, body) => api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const quiz = await timed("quiz", () => post("/api/quiz", { subjectId: bio.id }));
log(`| Quiz | ${sec(quiz.ms)} | ${quiz.value.questions?.length ?? 0} questions |`);
try {
  const fc = await timed("flashcards", () => post("/api/flashcards", { subjectId: bio.id }));
  log(`| Flashcards | ${sec(fc.ms)} | ${fc.value.cards?.length ?? 0} cards |`);
} catch (e) {
  log(`| Flashcards | n/a | ${String(e.message).slice(0, 60)} |`);
}
try {
  const rv = await timed("review", () => post("/api/review", { subjectId: bio.id }));
  log(`| Reviewer sheet | ${sec(rv.ms)} | ${rv.value.lines?.length ?? 0} lines |`);
} catch (e) {
  log(`| Reviewer sheet | n/a | ${String(e.message).slice(0, 60)} |`);
}
try {
  const gc = ids["gc-biology-quiz-oct17.png"];
  const w = await timed("words", () => api(`/api/documents/${encodeURIComponent(gc)}/words`));
  log(`| Word boxes (Apple Vision) | ${sec(w.ms)} | ${w.value.words?.length ?? 0} words |`);
} catch (e) {
  log(`| Word boxes (Apple Vision) | n/a | ${String(e.message).slice(0, 60)} |`);
}
const ics = await timed("ics", async () => (await fetch(BASE + "/api/timeline.ics")).text());
log(`| Calendar export (.ics) | ${sec(ics.ms)} | ${(ics.value.match(/BEGIN:VEVENT/g) ?? []).length} events |`);
log();

// 4. Network
const status1 = await api("/api/status");
log(`## Network`);
log();
log(`Outbound requests counted by the server during this whole run: **${status1.requestsOut - status0.requestsOut}** (counter at ${status1.requestsOut}). Documents read: ${status1.documentsRead}. Watching: ${status1.watching.join(", ")}.`);

if (OUT) {
  await writeFile(OUT, lines.join("\n") + "\n");
  console.error(`wrote ${OUT}`);
}
