import chokidar, { type FSWatcher } from "chokidar";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import type { DocumentKind, DocumentSummary } from "@/lib/api-types";
import { getDb, watchDir } from "@/server/db";
import { getDocumentSummaryById } from "@/server/documents";
import { emitEvent } from "@/server/events";
import { newId } from "@/server/ids";
import { enqueue } from "@/server/pipeline";

const ACCEPTED_EXT = new Set([".png", ".jpg", ".jpeg", ".heic", ".webp", ".pdf"]);

declare global {
  var __dejafindWatchers: FSWatcher[] | undefined;
}

function kindFor(ext: string): DocumentKind {
  return ext === ".pdf" ? "pdf" : "image";
}

export interface IngestResult {
  summary: DocumentSummary | null;
  duplicate: boolean;
}

/** Hashes, dedupes, inserts a `queued` row, and enqueues the file for the pipeline. */
export async function ingestFile(path: string): Promise<IngestResult> {
  const ext = extname(path).toLowerCase();
  if (!ACCEPTED_EXT.has(ext)) return { summary: null, duplicate: false };

  let stats;
  let buffer: Buffer;
  try {
    stats = await stat(path);
    if (!stats.isFile() || stats.size === 0) return { summary: null, duplicate: false };
    buffer = await readFile(path);
  } catch {
    return { summary: null, duplicate: false }; // file moved or removed before we could read it
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM documents WHERE sha256 = ?`).get(sha256) as
    | { id: string }
    | undefined;
  if (existing) return { summary: null, duplicate: true };

  const id = newId();
  const capturedAt = stats.mtime.toISOString();
  const createdAt = new Date().toISOString();
  const kind = kindFor(ext);

  db.prepare(
    `INSERT INTO documents (
       id, path, kind, doc_type, sha256, captured_at, title, summary, tags, subject_id,
       text, status, thumb_path, clean_path, width, height, pages, read_ms, filed_at,
       error, schedule_section, created_at
     ) VALUES (
       @id, @path, @kind, NULL, @sha256, @capturedAt, '', '', '[]', NULL,
       '', 'queued', NULL, NULL, NULL, NULL, 1, NULL, NULL,
       NULL, NULL, @createdAt
     )`
  ).run({ id, path, kind, sha256, capturedAt, createdAt });

  const summary = getDocumentSummaryById(id);
  if (summary) emitEvent({ type: "document.queued", document: summary }, id);
  enqueue(id);
  return { summary, duplicate: false };
}

/**
 * Watches `data/watch/` (initial scan on) plus `~/Desktop` and `~/Downloads`
 * (existing files ignored, only new drops matter). Step 1.
 */
export function startWatcher(): void {
  if (globalThis.__dejafindWatchers) return;

  const dropWatcher = chokidar.watch(watchDir(), {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    depth: 0,
  });
  dropWatcher.on("add", (path) => void ingestFile(path));

  const folderWatcher = chokidar.watch([join(homedir(), "Desktop"), join(homedir(), "Downloads")], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    depth: 0,
  });
  folderWatcher.on("add", (path) => void ingestFile(path));

  globalThis.__dejafindWatchers = [dropWatcher, folderWatcher];
}

export function watchedFolders(): string[] {
  return [watchDir(), join(homedir(), "Desktop"), join(homedir(), "Downloads")];
}
