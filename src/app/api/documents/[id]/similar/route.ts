import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDocumentRow } from "@/server/documents";
import { findSimilarDocuments } from "@/server/search";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!getDocumentRow(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const results = await findSimilarDocuments(id);
  return NextResponse.json({ results });
}
