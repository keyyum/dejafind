import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDocumentRow } from "@/server/documents";
import { ocrWords } from "@/server/ocr";

type Params = { params: Promise<{ id: string }> };

/** Word boxes from Apple Vision OCR, in original image pixels. Optional step 8 feature. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = getDocumentRow(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.kind !== "image") {
    return NextResponse.json({ error: "word boxes are only available for images" }, { status: 501 });
  }

  const result = await ocrWords(row.path);
  if (!result) {
    return NextResponse.json(
      { error: "word boxes not available (swiftc missing or OCR failed)" },
      { status: 501 }
    );
  }

  return NextResponse.json(result);
}
