import type {
  DateFound,
  DateStatus,
  DocType,
  DocumentDetail,
  DocumentGroup,
  DocumentKind,
  DocumentsResponse,
  DocumentStatus,
  DocumentSummary,
  TimelineEntry,
} from "@/lib/api-types";
import { getDb } from "@/server/db";

export interface DocumentRow {
  id: string;
  path: string;
  kind: string;
  doc_type: string | null;
  sha256: string;
  captured_at: string;
  title: string;
  summary: string;
  tags: string;
  subject_id: string | null;
  text: string;
  status: string;
  thumb_path: string | null;
  clean_path: string | null;
  width: number | null;
  height: number | null;
  pages: number;
  read_ms: number | null;
  filed_at: string | null;
  error: string | null;
  schedule_section: string | null;
  created_at: string;
}

interface DateRow {
  id: string;
  document_id: string;
  iso_date: string;
  label: string;
  confidence: number;
  span: string;
  status: string;
}

export function getDocumentRow(id: string): DocumentRow | undefined {
  return getDb().prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as DocumentRow | undefined;
}

function subjectNameFor(subjectId: string | null): string | null {
  if (!subjectId) return null;
  const row = getDb().prepare(`SELECT name FROM subjects WHERE id = ?`).get(subjectId) as
    | { name: string }
    | undefined;
  return row?.name ?? null;
}

function comingUpCountFor(documentId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM dates WHERE document_id = ? AND status = 'auto'`)
    .get(documentId) as { n: number };
  return row.n;
}

export function getDatesForDocument(documentId: string): DateFound[] {
  const rows = getDb()
    .prepare(`SELECT * FROM dates WHERE document_id = ? ORDER BY iso_date ASC`)
    .all(documentId) as DateRow[];
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    isoDate: r.iso_date,
    label: r.label,
    confidence: r.confidence,
    span: r.span,
    status: r.status as DateStatus,
  }));
}

export function rowToSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    kind: row.kind as DocumentKind,
    status: row.status as DocumentStatus,
    docType: (row.doc_type ?? "other") as DocType,
    title: row.title,
    summary: row.summary,
    tags: JSON.parse(row.tags) as string[],
    subjectId: row.subject_id,
    subjectName: subjectNameFor(row.subject_id),
    capturedAt: row.captured_at,
    width: row.width ?? 0,
    height: row.height ?? 0,
    thumbUrl: row.thumb_path ? `/api/thumb/${row.id}` : null,
    fileUrl: `/api/file/${row.id}`,
    filedAt: row.filed_at,
    comingUpCount: comingUpCountFor(row.id),
  };
}

export function rowToDetail(row: DocumentRow): DocumentDetail {
  return {
    ...rowToSummary(row),
    text: row.text,
    dates: getDatesForDocument(row.id),
    readMs: row.read_ms,
    path: row.path,
    cleanUrl: row.clean_path ? `/api/file/${row.id}?variant=clean` : null,
    pages: row.pages,
    scheduleSection: row.schedule_section,
    error: row.error,
  };
}

export function getDocumentSummaryById(id: string): DocumentSummary | null {
  const row = getDocumentRow(id);
  return row ? rowToSummary(row) : null;
}

export function getDocumentDetailById(id: string): DocumentDetail | null {
  const row = getDocumentRow(id);
  return row ? rowToDetail(row) : null;
}

function toLocalDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(isoDate: string, today: string, yesterday: string): string {
  if (isoDate === today) return "Today";
  if (isoDate === yesterday) return "Yesterday";
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** GET /api/documents: grouped by local capture day, newest first. */
export function listDocuments(subjectFilter: string | null | undefined, limit: number): DocumentsResponse {
  const db = getDb();
  const params: unknown[] = [];
  let where = "1=1";
  if (subjectFilter === "other") {
    where = "subject_id IS NULL AND status IN ('done','error')";
  } else if (subjectFilter && subjectFilter !== "all") {
    where = "subject_id = ?";
    params.push(subjectFilter);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as n FROM documents WHERE ${where}`).get(...params) as {
    n: number;
  };
  const rows = db
    .prepare(`SELECT * FROM documents WHERE ${where} ORDER BY captured_at DESC LIMIT ?`)
    .all(...params, limit) as DocumentRow[];

  const today = toLocalDateOnly(new Date());
  const yesterday = toLocalDateOnly(new Date(Date.now() - 86_400_000));

  const groups: DocumentGroup[] = [];
  const indexByDay = new Map<string, number>();
  for (const row of rows) {
    const day = toLocalDateOnly(new Date(row.captured_at));
    let idx = indexByDay.get(day);
    if (idx === undefined) {
      idx = groups.length;
      indexByDay.set(day, idx);
      groups.push({ day, label: dayLabel(day, today, yesterday), documents: [] });
    }
    groups[idx].documents.push(rowToSummary(row));
  }

  return { groups, total: totalRow.n };
}

interface TimelineRow {
  id: string;
  document_id: string;
  iso_date: string;
  label: string;
  status: string;
  doc_title: string;
  subject_id: string | null;
}

/** GET /api/timeline: ascending, `auto` only unless `all`. */
export function listTimeline(from: string | null, limit: number, all: boolean): TimelineEntry[] {
  const db = getDb();
  const params: unknown[] = [];
  let where = all ? "1=1" : "dt.status = 'auto'";
  if (from) {
    where += " AND dt.iso_date >= ?";
    params.push(from);
  }

  const rows = db
    .prepare(
      `SELECT dt.id as id, dt.document_id as document_id, dt.iso_date as iso_date, dt.label as label, dt.status as status,
              doc.title as doc_title, doc.subject_id as subject_id
       FROM dates dt JOIN documents doc ON doc.id = dt.document_id
       WHERE ${where}
       ORDER BY dt.iso_date ASC
       LIMIT ?`
    )
    .all(...params, limit) as TimelineRow[];

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    documentTitle: r.doc_title,
    subjectId: r.subject_id,
    subjectName: subjectNameFor(r.subject_id),
    isoDate: r.iso_date,
    label: r.label,
    status: r.status as DateStatus,
    soon: Math.abs(new Date(`${r.iso_date}T00:00:00`).getTime() - now) <= 48 * 60 * 60 * 1000,
  }));
}
