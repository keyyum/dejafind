#!/usr/bin/env node
// Loads the synthetic demo set into a running DéjàFind, in the stage order, and
// prints what the app read for each file. Nothing here needs internet.
//
//   node scripts/seed.mjs                      # app on http://localhost:3000
//   node scripts/seed.mjs --base http://localhost:3100
//
// The timetable goes first. After it lands, the app shows a "This looks like a
// class schedule" card: click "Use it" (or let this script confirm it with
// --confirm-schedule) so the other files file under the schedule's subjects.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = argOf("--base", "http://localhost:3000").replace(/\/$/, "");
const CONFIRM = args.includes("--confirm-schedule");
const DIR = join(process.cwd(), "data", "samples", "demo");

const ORDER = [
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, init) {
  const res = await fetch(BASE + path, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const all = (await readdir(DIR)).filter((f) => /\.(jpe?g|png|pdf)$/i.test(f));
const files = [...ORDER.filter((f) => all.includes(f)), ...all.filter((f) => !ORDER.includes(f)).sort()];

try {
  await api("/api/status");
} catch {
  console.error(`No DéjàFind at ${BASE}. Start it first (npm run dev), or pass --base.`);
  process.exit(1);
}

console.log(`Loading ${files.length} files into ${BASE} ...\n`);
console.log(`| File | Filed under | Dates | Time |`);
console.log(`|---|---|---|---|`);
for (const name of files) {
  const buf = await readFile(join(DIR, name));
  const form = new FormData();
  form.append("files", new Blob([buf]), name);
  const t0 = performance.now();
  const out = await api("/api/import", { method: "POST", body: form });
  const doc = out.documents[0];
  if (!doc) {
    console.log(`| ${name} | already loaded | | |`);
    continue;
  }
  let d;
  for (;;) {
    d = await api(`/api/documents/${encodeURIComponent(doc.id)}`);
    if (d.status !== "queued" && d.status !== "reading") break;
    await sleep(300);
  }
  const dates = (d.dates ?? []).map((x) => x.isoDate).join(", ") || "none";
  console.log(`| ${name} | ${d.subjectName ?? (d.docType === "schedule" ? "schedule" : "Other")} | ${dates} | ${((performance.now() - t0) / 1000).toFixed(1)} s |`);
  if (d.docType === "schedule") {
    const sched = await api("/api/schedule");
    if (sched.pending) {
      if (CONFIRM) {
        await api("/api/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId: sched.pending.documentId, confirm: true }) });
        console.log(`| (schedule confirmed: ${sched.pending.subjects.join(", ")}) | | | |`);
      } else {
        console.log(`| (open the app and click "Use it" on the schedule card, or rerun with --confirm-schedule) | | | |`);
      }
    }
  }
}
console.log(`\nDone. Open ${BASE} and try: "when's my bio quiz", then Biology → Quiz me.`);
