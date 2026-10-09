import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { DatePatch, TimelineEntry } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { getDocumentRow, rowToSummary } from "@/server/documents";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const dateRow = db.prepare(`SELECT * FROM dates WHERE id = ?`).get(id) as
    | { id: string; document_id: string; iso_date: string; label: string; confidence: number; span: string; status: string }
    | undefined;
  if (!dateRow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch = (await req.json()) as DatePatch;
  db.prepare(`UPDATE dates SET status = ? WHERE id = ?`).run(patch.status, id);

  const documentRow = getDocumentRow(dateRow.document_id);
  const summary = documentRow ? rowToSummary(documentRow) : null;
  const now = Date.now();

  const entry: TimelineEntry = {
    id: dateRow.id,
    documentId: dateRow.document_id,
    documentTitle: summary?.title ?? "",
    subjectId: summary?.subjectId ?? null,
    subjectName: summary?.subjectName ?? null,
    isoDate: dateRow.iso_date,
    label: dateRow.label,
    status: patch.status,
    soon: Math.abs(new Date(`${dateRow.iso_date}T00:00:00`).getTime() - now) <= 48 * 60 * 60 * 1000,
  };

  return NextResponse.json(entry);
}
