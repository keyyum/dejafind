import { unlink } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { DocumentPatch } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { getDocumentDetailById, getDocumentRow } from "@/server/documents";
import { emitEvent } from "@/server/events";
import { removeDocumentFromIndex } from "@/server/index";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const detail = getDocumentDetailById(id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = getDocumentRow(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch = (await req.json()) as DocumentPatch;
  const db = getDb();
  if (patch.title !== undefined) {
    db.prepare(`UPDATE documents SET title = ? WHERE id = ?`).run(patch.title, id);
  }
  if (patch.subjectId !== undefined) {
    db.prepare(`UPDATE documents SET subject_id = ? WHERE id = ?`).run(patch.subjectId, id);
  }

  return NextResponse.json(getDocumentDetailById(id));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = getDocumentRow(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const db = getDb();
  removeDocumentFromIndex(id);
  db.prepare(`DELETE FROM dates WHERE document_id = ?`).run(id);
  db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);

  if (row.thumb_path) await unlink(row.thumb_path).catch(() => {});
  if (row.clean_path) await unlink(row.clean_path).catch(() => {});

  emitEvent({ type: "document.deleted", documentId: id }, id);
  return NextResponse.json({ ok: true });
}
