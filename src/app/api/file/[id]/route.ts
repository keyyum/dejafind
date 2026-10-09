import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDocumentRow } from "@/server/documents";

type Params = { params: Promise<{ id: string }> };

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = getDocumentRow(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const variant = req.nextUrl.searchParams.get("variant");
  const path = variant === "clean" && row.clean_path ? row.clean_path : row.path;

  try {
    const buffer = await readFile(path);
    return new NextResponse(buffer, { headers: { "Content-Type": contentTypeFor(path) } });
  } catch {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
}
