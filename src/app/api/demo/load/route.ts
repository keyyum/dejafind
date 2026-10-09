import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import { getDb, watchDir } from "@/server/db";
import { ingestFile } from "@/server/watcher";

const DEMO_DIR = join(process.cwd(), "data", "samples", "demo");
const ACCEPTED_EXT = new Set([".png", ".jpg", ".jpeg", ".heic", ".webp", ".pdf"]);

// Hard stage order: the timetable first so its confirm card is the opening beat,
// then the rest in demo-script order. Anything else in the folder loads after.
const STAGE_ORDER = [
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

/**
 * POST /api/demo/load: loads the whole demo set in stage order for judges, one
 * click. Reuses the import path (copy into data/watch/ so dedupe and events work
 * as usual). Never auto-confirms the schedule — the confirm card has to appear.
 * 409s if the library isn't empty, so this can't silently double-load.
 */
export async function POST() {
  const existing = getDb().prepare(`SELECT COUNT(*) as n FROM documents`).get() as { n: number };
  if (existing.n > 0) {
    return NextResponse.json({ error: "library already has documents" }, { status: 409 });
  }

  let allFiles: string[];
  try {
    allFiles = (await readdir(DEMO_DIR)).filter((f) => ACCEPTED_EXT.has(extname(f).toLowerCase()));
  } catch {
    return NextResponse.json({ error: "demo samples folder not found" }, { status: 500 });
  }

  const ordered = STAGE_ORDER.filter((f) => allFiles.includes(f));
  const extras = allFiles.filter((f) => !STAGE_ORDER.includes(f)).sort();
  const toLoad = [...ordered, ...extras];

  let queued = 0;
  for (const filename of toLoad) {
    try {
      const buffer = await readFile(join(DEMO_DIR, filename));
      const destPath = join(watchDir(), `${randomUUID().slice(0, 8)}-${filename}`);
      await writeFile(destPath, buffer);
      const { summary } = await ingestFile(destPath);
      if (summary) queued++;
    } catch (err) {
      console.error(`[demo/load] failed to queue ${filename}`, err);
    }
  }

  return NextResponse.json({ queued });
}
