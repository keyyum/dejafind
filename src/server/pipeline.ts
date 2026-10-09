import type { TimelineEntry } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { generateCleanImage, generateThumbnail } from "@/server/clean";
import { resolveDates } from "@/server/dates";
import { getDatesForDocument, getDocumentRow, rowToSummary } from "@/server/documents";
import { emitEvent } from "@/server/events";
import { indexDocument } from "@/server/index";
import { schedulePrecompute } from "@/server/precompute";
import { readDocument } from "@/server/reader";
import { createSchedulePending, fileDocumentSubject } from "@/server/subjects";

declare global {
  var __dejafindQueue: string[] | undefined;
  var __dejafindProcessing: boolean | undefined;
  var __dejafindPipelineStarted: boolean | undefined;
}

function queue(): string[] {
  if (!globalThis.__dejafindQueue) globalThis.__dejafindQueue = [];
  return globalThis.__dejafindQueue;
}

/** Enqueues a document for the one-at-a-time worker loop. */
export function enqueue(documentId: string): void {
  queue().push(documentId);
  void processQueue();
}

export function startPipeline(): void {
  if (globalThis.__dejafindPipelineStarted) return;
  globalThis.__dejafindPipelineStarted = true;

  // Resume anything a previous process left mid-flight.
  const stuck = getDb()
    .prepare(`SELECT id FROM documents WHERE status IN ('queued','reading') ORDER BY created_at ASC`)
    .all() as { id: string }[];
  for (const row of stuck) {
    getDb().prepare(`UPDATE documents SET status = 'queued' WHERE id = ?`).run(row.id);
    queue().push(row.id);
  }
  void processQueue();
}

async function processQueue(): Promise<void> {
  if (globalThis.__dejafindProcessing) return;
  globalThis.__dejafindProcessing = true;
  try {
    const q = queue();
    while (q.length > 0) {
      const id = q.shift();
      if (!id) continue;
      await processDocument(id).catch((err) => {
        console.error(`[pipeline] document ${id} failed unexpectedly`, err);
      });
    }
  } finally {
    globalThis.__dejafindProcessing = false;
  }
}

function timelineEntriesFor(
  documentId: string,
  documentTitle: string,
  subjectId: string | null,
  subjectName: string | null
): TimelineEntry[] {
  const now = Date.now();
  return getDatesForDocument(documentId)
    .filter((d) => d.status === "auto")
    .map((d) => ({
      id: d.id,
      documentId,
      documentTitle,
      subjectId,
      subjectName,
      isoDate: d.isoDate,
      label: d.label,
      status: d.status,
      soon: Math.abs(new Date(`${d.isoDate}T00:00:00`).getTime() - now) <= 48 * 60 * 60 * 1000,
    }));
}

async function processDocument(id: string): Promise<void> {
  const db = getDb();
  const row = getDocumentRow(id);
  if (!row) return;

  db.prepare(`UPDATE documents SET status = 'reading' WHERE id = ?`).run(id);
  emitEvent({ type: "document.reading", documentId: id }, id);

  try {
    const read = await readDocument(row);

    db.prepare(
      `UPDATE documents SET text = ?, title = ?, summary = ?, tags = ?, doc_type = ?, schedule_section = ?, read_ms = ?, pages = ? WHERE id = ?`
    ).run(
      read.text,
      read.title,
      read.summary,
      JSON.stringify(read.tags),
      read.docType,
      read.scheduleSection,
      read.readMs,
      read.pages,
      id
    );

    let subjectId: string | null = null;
    let newSubjects: ReturnType<typeof fileDocumentSubject>["newSubjects"] = [];

    if (read.docType === "schedule") {
      const pending = await createSchedulePending(row, read);
      emitEvent({ type: "schedule.pending", pending });
    } else {
      const filed = fileDocumentSubject(row, read);
      subjectId = filed.subjectId;
      newSubjects = filed.newSubjects;
      db.prepare(`UPDATE documents SET subject_id = ? WHERE id = ?`).run(subjectId, id);
    }

    resolveDates(id, read.text, row.captured_at, read.docType, subjectId, read.dates);

    await indexDocument(id, read.text);

    // Clean/warp first so the thumbnail (grid, search, quiz source) is built from
    // the flat tile when one exists, not the original tilted photo.
    let cleanPath: string | null = null;
    try {
      const clean = await generateCleanImage(row);
      if (clean) {
        cleanPath = clean.cleanPath;
        db.prepare(`UPDATE documents SET clean_path = ? WHERE id = ?`).run(clean.cleanPath, id);
      }
    } catch (err) {
      console.error(`[pipeline] clean image failed for ${id}`, err);
    }

    try {
      const thumb = await generateThumbnail(row, cleanPath);
      db.prepare(`UPDATE documents SET thumb_path = ?, width = ?, height = ? WHERE id = ?`).run(
        thumb.thumbPath,
        thumb.width,
        thumb.height,
        id
      );
    } catch (err) {
      console.error(`[pipeline] thumbnail failed for ${id}`, err);
    }

    db.prepare(`UPDATE documents SET status = 'done', filed_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      id
    );

    for (const subject of newSubjects) emitEvent({ type: "subject.created", subject });

    const finalRow = getDocumentRow(id);
    if (finalRow) {
      const summary = rowToSummary(finalRow);
      const dates = timelineEntriesFor(id, summary.title, summary.subjectId, summary.subjectName);
      emitEvent({ type: "document.filed", document: summary, dates, newSubjects, readMs: read.readMs }, id);
      if (summary.subjectId) schedulePrecompute(summary.subjectId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(`UPDATE documents SET status = 'error', error = ? WHERE id = ?`).run(message, id);
    emitEvent({ type: "document.error", documentId: id, error: message }, id);
  }
}
