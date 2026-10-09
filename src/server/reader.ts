import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import ollama from "ollama";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import type { DocType } from "@/lib/api-types";
import { derivedDir } from "@/server/db";
import type { DocumentRow } from "@/server/documents";

const execFileAsync = promisify(execFile);

const VISION_MODEL = "qwen2.5vl:3b";
const TEXT_MODEL = "qwen3:4b";
const PDFTOPPM_BIN = "/opt/homebrew/bin/pdftoppm";
/** qwen2.5vl's default num_ctx (4096) overflows on large images; this covers prompt + a big image grid. */
const VISION_NUM_CTX = 8192;
const TEXT_NUM_CTX = 8192;
/** Downscaled before sending to the vision model: keeps tokens bounded, plenty for OCR. */
const MAX_IMAGE_DIMENSION = 1280;
/** Truncated before sending to the text model: keeps tokens bounded on long PDFs. */
const MAX_TEXT_CHARS = 6000;

async function downscaleForVision(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toBuffer();
}

const VALID_DOC_TYPES = new Set<string>([
  "slide",
  "whiteboard",
  "handout",
  "chat",
  "schedule",
  "pdf",
  "other",
]);

interface RawReaderDate {
  iso_date: string;
  label: string;
  span: string;
}

interface RawReaderJson {
  text: string;
  title: string;
  summary: string;
  tags: string[];
  subject: string;
  doc_type: string;
  dates: RawReaderDate[];
  schedule_section?: string | null;
}

export interface ReadResult {
  text: string;
  title: string;
  summary: string;
  tags: string[];
  subjectRaw: string;
  docType: DocType;
  dates: { isoDate: string; label: string; span: string }[];
  scheduleSection: string | null;
  readMs: number;
  pages: number;
}

function isValidReaderJson(value: unknown): value is RawReaderJson {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string") return false;
  if (typeof v.title !== "string") return false;
  if (typeof v.summary !== "string") return false;
  if (!Array.isArray(v.tags) || !v.tags.every((t) => typeof t === "string")) return false;
  if (typeof v.subject !== "string") return false;
  if (typeof v.doc_type !== "string" || !VALID_DOC_TYPES.has(v.doc_type)) return false;
  if (!Array.isArray(v.dates)) return false;
  for (const d of v.dates) {
    if (!d || typeof d !== "object") return false;
    const dd = d as Record<string, unknown>;
    if (typeof dd.iso_date !== "string" || typeof dd.label !== "string" || typeof dd.span !== "string") {
      return false;
    }
  }
  if (v.schedule_section !== undefined && v.schedule_section !== null && typeof v.schedule_section !== "string") {
    return false;
  }
  return true;
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function promptFor(capturedAt: string): string {
  return `You read a photo or document for a student's study app. Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"text": string (verbatim text you can read, newline separated), "title": string (<=8 words), "summary": string (one sentence), "tags": string[] (3-6 short keywords), "subject": string (school subject such as "Biology"; empty string if none is evident), "doc_type": one of "slide","whiteboard","handout","chat","schedule","pdf","other", "dates": [{"iso_date": "YYYY-MM-DD", "label": string (what the date is for), "span": string (the exact substring of text this date came from)}], "schedule_section": string or null (only set for doc_type "schedule": the section/class code if visible, e.g. "BSCS 2-B")}.
The capture date is ${capturedAt}. IMPORTANT: scan the text for every mention of a date, day of week, or deadline (words like "due", "moved to", "on", "quiz", "exam", a month name, or a day name) and add ONE entry per date to the "dates" array with its resolved "iso_date". Do not leave "dates" empty if the text names any date or day. Resolve relative dates ("next Friday", "moved to Oct 17") against the capture date above. If this looks like a class schedule or timetable, set doc_type to "schedule".`;
}

async function callVisionModel(imageBuffer: Buffer, capturedAt: string): Promise<RawReaderJson> {
  const prompt = promptFor(capturedAt);
  const scaled = await downscaleForVision(imageBuffer);
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ollama.chat({
      model: VISION_MODEL,
      format: "json",
      keep_alive: -1,
      options: { temperature: 0, num_ctx: VISION_NUM_CTX },
      messages: [{ role: "user", content: prompt, images: [scaled] }],
    });
    const parsed = parseModelJson(response.message.content);
    if (isValidReaderJson(parsed)) return parsed;
    lastError = response.message.content.slice(0, 200);
  }
  throw new Error(`vision model returned invalid JSON after retry: ${lastError}`);
}

async function callTextModel(text: string, capturedAt: string): Promise<RawReaderJson> {
  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
  const prompt = `${promptFor(capturedAt)}\n\nDocument text:\n${truncated}`;
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ollama.chat({
      model: TEXT_MODEL,
      format: "json",
      keep_alive: -1,
      think: false,
      options: { temperature: 0, num_ctx: TEXT_NUM_CTX },
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = parseModelJson(response.message.content);
    if (isValidReaderJson(parsed)) return parsed;
    lastError = response.message.content.slice(0, 200);
  }
  throw new Error(`text model returned invalid JSON after retry: ${lastError}`);
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

export async function readDocument(row: DocumentRow): Promise<ReadResult> {
  const start = Date.now();
  let raw: RawReaderJson;
  let pages = 1;

  if (row.kind === "pdf") {
    const buffer = await readFile(row.path);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      pages = result.total || 1;
      const text = result.text.trim();
      if (text.length > 0) {
        raw = await callTextModel(text, row.captured_at);
      } else {
        const pageImage = await renderPdfFirstPage(row.path);
        raw = await callVisionModel(pageImage, row.captured_at);
      }
    } finally {
      await parser.destroy();
    }
  } else {
    const imageBuffer = await readFile(row.path);
    raw = await callVisionModel(imageBuffer, row.captured_at);
  }

  return {
    text: raw.text,
    title: raw.title,
    summary: raw.summary,
    tags: raw.tags,
    subjectRaw: raw.subject,
    docType: raw.doc_type as DocType,
    dates: raw.dates.map((d) => ({ isoDate: d.iso_date, label: d.label, span: d.span })),
    scheduleSection: raw.schedule_section ?? null,
    readMs: Date.now() - start,
    pages,
  };
}
