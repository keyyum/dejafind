import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDocumentRow } from "@/server/documents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = getDocumentRow(id);
  if (!row || !row.thumb_path) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const buffer = await readFile(row.thumb_path);
    const contentType = extname(row.thumb_path).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
    return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
  } catch {
    return NextResponse.json({ error: "thumbnail missing" }, { status: 404 });
  }
}
