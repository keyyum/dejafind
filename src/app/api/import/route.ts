import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { DocumentSummary } from "@/lib/api-types";
import { watchDir } from "@/server/db";
import { ingestFile } from "@/server/watcher";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_") || "upload";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  const documents: DocumentSummary[] = [];
  let duplicates = 0;

  for (const file of files) {
    const filename = `${randomUUID().slice(0, 8)}-${sanitizeName(file.name)}`;
    const destPath = join(watchDir(), filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(destPath, buffer);

    const { summary, duplicate } = await ingestFile(destPath);
    if (duplicate) duplicates += 1;
    if (summary) documents.push(summary);
  }

  return NextResponse.json({ documents, duplicates });
}
