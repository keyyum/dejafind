import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { derivedDir } from "@/server/db";
import type { DocumentRow } from "@/server/documents";

export interface ThumbResult {
  thumbPath: string;
  width: number;
  height: number;
}

/**
 * Minimal thumbnail for steps 1-5 so the UI has something to render: resize, keep
 * aspect ratio, no perspective warp yet. Step 8 replaces this with quad detection,
 * warp, and background clean for photos, plus a pdftoppm-rendered thumb for PDFs.
 */
export async function generateThumbnail(row: DocumentRow, imageBuffer?: Buffer): Promise<ThumbResult | null> {
  if (row.kind !== "image") return null;

  const buffer = imageBuffer ?? (await readFile(row.path));
  const outPath = join(derivedDir(), `${row.id}-thumb.jpg`);
  const pipeline = sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 });

  const { width, height } = await pipeline.toFile(outPath);
  return { thumbPath: outPath, width: width ?? 0, height: height ?? 0 };
}
