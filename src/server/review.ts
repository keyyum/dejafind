import ollama from "ollama";
import type { ReviewSheetResponse } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { getDocumentRow } from "@/server/documents";
import { parseModelJson } from "@/server/reader";

const TEXT_MODEL = "qwen3:4b";
const MAX_CONTEXT_CHARS = 8000;

interface RawReviewLine {
  text: string;
  sourceDocumentId: string;
}

function isValidReviewJson(value: unknown, allowedAliases: Set<string>): value is { lines: RawReviewLine[] } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.lines) || v.lines.length === 0) return false;
  for (const l of v.lines) {
    if (!l || typeof l !== "object") return false;
    const ll = l as Record<string, unknown>;
    if (typeof ll.text !== "string") return false;
    if (typeof ll.sourceDocumentId !== "string" || !allowedAliases.has(ll.sourceDocumentId)) return false;
  }
  return true;
}

async function generateLines(context: string, aliases: string[]): Promise<RawReviewLine[]> {
  const prompt = `You write a concise review sheet (study notes) from the documents below. Produce 8 to 15 short bullet lines covering the key facts a student should remember. Respond with ONLY a JSON object, no commentary: {"lines": [{"text": string (one fact, one short sentence), "sourceDocumentId": string (must be exactly one of: ${aliases.join(", ")})}]}.\n\nDocuments:\n${context}`;

  const allowed = new Set(aliases);
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ollama.chat({
        model: TEXT_MODEL,
        format: "json",
        keep_alive: -1,
        think: false,
        options: { temperature: 0.2, num_ctx: 8192 },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = parseModelJson(response.message.content);
      if (isValidReviewJson(parsed, allowed)) return parsed.lines;
      lastError = response.message.content.slice(0, 200);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`review model failed after retry: ${lastError}`);
}

/** POST /api/review: a short study sheet for one subject, each line cites its document. Tier 2. */
export async function generateReviewSheet(subjectId: string): Promise<ReviewSheetResponse> {
  const start = Date.now();
  const db = getDb();
  const subjectRow = db.prepare(`SELECT name FROM subjects WHERE id = ?`).get(subjectId) as
    | { name: string }
    | undefined;
  if (!subjectRow) throw new Error("subject not found");

  const docRows = db
    .prepare(`SELECT id FROM documents WHERE subject_id = ? AND status = 'done' ORDER BY captured_at DESC`)
    .all(subjectId) as { id: string }[];
  if (docRows.length === 0) throw new Error("no documents for this subject");

  const aliasToId = new Map<string, string>();
  let context = "";
  for (const { id } of docRows) {
    const row = getDocumentRow(id);
    if (!row || !row.text) continue;
    const alias = `D${aliasToId.size + 1}`;
    aliasToId.set(alias, id);
    const piece = `[document: ${alias}]\n${row.text}\n\n`;
    if (context.length + piece.length > MAX_CONTEXT_CHARS) continue;
    context += piece;
  }

  if (aliasToId.size === 0) throw new Error("no readable documents for this subject");

  const raw = await generateLines(context, [...aliasToId.keys()]);
  const fallbackId = [...aliasToId.values()][0];
  const lines = raw.map((l) => ({
    text: l.text,
    documentId: aliasToId.get(l.sourceDocumentId) ?? fallbackId,
  }));

  return {
    subjectId,
    subjectName: subjectRow.name,
    lines,
    tookMs: Date.now() - start,
  };
}
