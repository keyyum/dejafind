import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDocumentRow } from "@/server/documents";

type Params = { params: Promise<{ id: string }> };

/** Optional (step 8): word boxes from Apple Vision OCR. Not implemented; UI should skip the Lens tap. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!getDocumentRow(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ error: "word boxes not available" }, { status: 501 });
}
