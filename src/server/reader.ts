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

/**
 * Coerces an individually-malformed field (wrong type, missing, an invalid
 * doc_type) to a safe default instead of discarding an otherwise-good response —
 * seen live on a real sample: valid JSON, every other field fine, but
 * `"doc_type": null`. Only requires non-empty "text" to count as a real read;
 * that's the actual signal the model engaged with the content at all.
 */
function coerceReaderJson(value: unknown): RawReaderJson | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string" || v.text.length === 0) return null;

  const dates: RawReaderDate[] = Array.isArray(v.dates)
    ? v.dates.filter((d): d is RawReaderDate => {
        if (!d || typeof d !== "object") return false;
        const dd = d as Record<string, unknown>;
        return typeof dd.iso_date === "string" && typeof dd.label === "string" && typeof dd.span === "string";
      })
    : [];

  return {
    text: v.text,
    title: typeof v.title === "string" ? v.title : "",
    summary: typeof v.summary === "string" ? v.summary : "",
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === "string") : [],
    subject: typeof v.subject === "string" ? v.subject : "",
    doc_type: typeof v.doc_type === "string" && VALID_DOC_TYPES.has(v.doc_type) ? v.doc_type : "other",
    dates,
    schedule_section: typeof v.schedule_section === "string" ? v.schedule_section : null,
  };
}

/**
 * Repairs a response cut off mid-token (hit the model's token limit): closes an
 * unterminated string, drops a dangling trailing comma, and closes any braces/
 * brackets still open at the point of truncation. Walks the string tracking
 * whether we're inside a quoted string so structural characters inside string
 * values aren't mistaken for real JSON structure.
 */
function repairTruncatedJson(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  const text = raw.slice(start);

  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") {
        i++; // skip the escaped character
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let repaired = text;
  if (inString) repaired += '"';
  repaired = repaired.replace(/,(\s*)$/, "$1").replace(/,(\s*[}\]])/g, "$1");
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === "{" ? "}" : "]";
  }
  return repaired;
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
        // fall through to the truncation repair below
      }
    }
    const repaired = repairTruncatedJson(candidate);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Recovers whatever "text" value is present even in content JSON.parse can't fix. */
function extractTextField(content: string): string {
  const match = content.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

/** Last-resort fallback so a document never lands in `error` status purely because
 * the model's JSON was unrecoverable — keep whatever text we can salvage. */
function minimalReaderJson(knownText: string): RawReaderJson {
  const firstLine = knownText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return {
    text: knownText,
    title: firstLine ? firstLine.slice(0, 60) : "Untitled",
    summary: "",
    tags: [],
    subject: "",
    doc_type: "other",
    dates: [],
    schedule_section: null,
  };
}

function promptFor(capturedAt: string): string {
  return `You read a photo or document for a student's study app. Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"text": string (verbatim text you can read, newline separated), "title": string (<=8 words, about what the message/document is actually about, e.g. "Long Quiz 2 Reminder" — never just the chat name or group name), "summary": string (one sentence), "tags": string[] (3-5 short keywords), "subject": string (the SCHOOL COURSE name the content belongs to, such as "Calculus", "Biology", or "Physics" — infer the course from the topics discussed, e.g. "limits and continuity" or "derivatives" are Calculus topics so subject is "Calculus", "cell division" is a Biology topic so subject is "Biology"; always give a course name, never a topic phrase; empty string if no academic subject is evident), "doc_type": one of "slide","whiteboard","handout","chat","schedule","pdf","other" ("pdf" means this is literally a born-digital PDF file, not just a formal-looking document — a photo of a receipt or any non-academic document is "other", never "pdf"), "dates": [{"iso_date": "YYYY-MM-DD", "label": string (what the date is for), "span": string (the exact substring of text this date came from)}], "schedule_section": string or null (only set for doc_type "schedule": the section/class code if visible, e.g. "BSCS 2-B")}.
IMPORTANT for "title" and "subject": a group chat's name/header (e.g. "BSCS 2-A") or section code is shared across many different classes and is NEVER itself the subject or the title — read the actual message body to find what class and topic it is about.
The capture date is ${capturedAt}. IMPORTANT: scan the text for every mention of a date, day of week, or deadline (words like "due", "moved to", "on", "quiz", "exam", a month name, or a day name) and add ONE entry per date to the "dates" array with its resolved "iso_date". Do not leave "dates" empty if the text names any date or day. Resolve relative dates ("next Friday", "moved to Oct 17") against the capture date above. If this looks like a class schedule or timetable, set doc_type to "schedule".`;
}

async function callVisionModel(imageBuffer: Buffer, capturedAt: string): Promise<RawReaderJson> {
  const prompt = promptFor(capturedAt);
  const scaled = await downscaleForVision(imageBuffer);
  let lastRawContent = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ollama.chat({
        model: VISION_MODEL,
        format: "json",
        keep_alive: -1,
        options: { temperature: 0, num_ctx: VISION_NUM_CTX, num_predict: 1024 },
        messages: [{ role: "user", content: prompt, images: [scaled] }],
      });
      lastRawContent = response.message.content;
      const parsed = parseModelJson(response.message.content);
      const coerced = coerceReaderJson(parsed);
      if (coerced) return coerced;
    } catch (err) {
      // Ollama itself can throw (e.g. its own repeat-loop guard aborting a
      // prediction) independent of our JSON-shape validation; retry covers both.
      console.error("[reader] vision model call failed", err);
    }
  }
  // Never let a document land in `error` status purely over unrecoverable JSON;
  // salvage whatever text we can and keep going as a minimal document.
  console.error("[reader] vision model produced no valid JSON after retry, using minimal fallback");
  return minimalReaderJson(extractTextField(lastRawContent));
}

async function callTextModel(text: string, capturedAt: string): Promise<RawReaderJson> {
  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
  const prompt = `${promptFor(capturedAt)}\n\nDocument text:\n${truncated}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ollama.chat({
        model: TEXT_MODEL,
        format: "json",
        keep_alive: -1,
        think: false,
        options: { temperature: 0, num_ctx: TEXT_NUM_CTX, num_predict: 1024 },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = parseModelJson(response.message.content);
      const coerced = coerceReaderJson(parsed);
      if (coerced) return coerced;
    } catch (err) {
      console.error("[reader] text model call failed", err);
    }
  }
  console.error("[reader] text model produced no valid JSON after retry, using minimal fallback");
  // The text model's input text is already ground truth (pdf-parse output); prefer
  // it over trying to regex a "text" field back out of a broken JSON response.
  return minimalReaderJson(truncated);
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

  // The model sometimes uses doc_type "pdf" to mean "a formal printed document"
  // generally (e.g. a receipt photo), not literally a PDF file. Downgrade it when
  // the file itself isn't a PDF, since downstream filing treats "pdf" as a signal
  // that this came through the born-digital PDF path.
  const docType = raw.doc_type === "pdf" && row.kind !== "pdf" ? "other" : (raw.doc_type as DocType);

  return {
    text: raw.text,
    title: raw.title,
    summary: raw.summary,
    tags: raw.tags,
    subjectRaw: raw.subject,
    docType,
    dates: raw.dates.map((d) => ({ isoDate: d.iso_date, label: d.label, span: d.span })),
    scheduleSection: raw.schedule_section ?? null,
    readMs: Date.now() - start,
    pages,
  };
}
