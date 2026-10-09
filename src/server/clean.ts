import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { derivedDir } from "@/server/db";
import type { DocumentRow } from "@/server/documents";
import { detectAndWarpQuad } from "@/server/quad";

const execFileAsync = promisify(execFile);
const PDFTOPPM_BIN = "/opt/homebrew/bin/pdftoppm";

export interface ThumbResult {
  thumbPath: string;
  width: number;
  height: number;
}

export interface CleanResult {
  cleanPath: string;
}

/** Camera photos (jpg/jpeg/heic) get a crop + background clean; PNG/webp screenshots are left untouched. */
function isPhoto(row: DocumentRow): boolean {
  const ext = extname(row.path).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" || ext === ".heic";
}

async function renderPdfFirstPage(pdfPath: string): Promise<Buffer> {
  const dir = derivedDir();
  const prefix = `pdfpage-${randomUUID()}`;
  await execFileAsync(PDFTOPPM_BIN, ["-png", "-f", "1", "-l", "1", "-r", "150", pdfPath, join(dir, prefix)]);
  const files = await readdir(dir);
  const match = files.find((f) => f.startsWith(prefix) && f.endsWith(".png"));
  if (!match) throw new Error("pdftoppm did not produce a page image");
  const fullPath = join(dir, match);
  const buffer = await readFile(fullPath);
  await unlink(fullPath).catch(() => {});
  return buffer;
}

/**
 * Thumbnail for every document: images resize in place, PDFs render page 1 via
 * pdftoppm first. Max 800px on the long side, real aspect ratio kept. Step 8.
 */
export async function generateThumbnail(row: DocumentRow): Promise<ThumbResult> {
  const buffer = row.kind === "pdf" ? await renderPdfFirstPage(row.path) : await readFile(row.path);
  const outPath = join(derivedDir(), `${row.id}-thumb.jpg`);
  const { width, height } = await sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outPath);
  return { thumbPath: outPath, width: width ?? 0, height: height ?? 0 };
}

/**
 * Photos only: document-quad detection + perspective warp (opencv contour find on
 * Canny edges, 4-point approxPolyDP, getPerspectiveTransform/warpPerspective), with
 * a plain trim + normalise fallback when no confident quad is found. Screenshots
 * are left untouched (clean_path stays null). Step 8.
 */
export async function generateCleanImage(row: DocumentRow): Promise<CleanResult | null> {
  if (row.kind !== "image" || !isPhoto(row)) return null;

  const raw = await readFile(row.path);
  const oriented = await sharp(raw).rotate().toBuffer();
  const outPath = join(derivedDir(), `${row.id}-clean.jpg`);

  let warped: Buffer | null = null;
  try {
    warped = await detectAndWarpQuad(oriented);
  } catch (err) {
    console.error(`[clean] quad detection failed for ${row.id}, falling back to trim`, err);
  }

  if (warped) {
    await writeFile(outPath, warped);
  } else {
    await sharp(oriented).trim().normalise().jpeg({ quality: 90 }).toFile(outPath);
  }
  return { cleanPath: outPath };
}
