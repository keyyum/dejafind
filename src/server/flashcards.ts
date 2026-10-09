import ollama from "ollama";
import type { DocumentSummary, Flashcard, FlashcardsResponse } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { getDocumentRow, rowToSummary } from "@/server/documents";
import { newId } from "@/server/ids";
import { parseModelJson } from "@/server/reader";

const TEXT_MODEL = "qwen3:4b";
const MAX_CONTEXT_CHARS = 8000;

export interface FlashcardsRequest {
  subjectId?: string | null;
  documentIds?: string[];
}

interface RawFlashcard {
  term: string;
  definition: string;
  sourceDocumentId: string;
}

// qwen3:4b occasionally corrupts a character when transcribing a long UUID verbatim.
// Short aliases (D1, D2, ...) sidestep that; mapped back to real ids after parsing.
function isValidFlashcardsJson(
  value: unknown,
  allowedAliases: Set<string>
): value is { cards: RawFlashcard[] } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.cards) || v.cards.length === 0) return false;
  for (const c of v.cards) {
    if (!c || typeof c !== "object") return false;
    const cc = c as Record<string, unknown>;
    if (typeof cc.term !== "string") return false;
    if (typeof cc.definition !== "string") return false;
    if (typeof cc.sourceDocumentId !== "string" || !allowedAliases.has(cc.sourceDocumentId)) return false;
  }
  return true;
}

function documentIdsForRequest(request: FlashcardsRequest): string[] {
  if (request.documentIds && request.documentIds.length > 0) return request.documentIds;
  if (request.subjectId) {
    const rows = getDb()
      .prepare(`SELECT id FROM documents WHERE subject_id = ? AND status = 'done' ORDER BY captured_at DESC`)
      .all(request.subjectId) as { id: string }[];
    return rows.map((r) => r.id);
  }
  return [];
}

async function generateCards(context: string, aliases: string[]): Promise<RawFlashcard[]> {
  const prompt = `You write study flashcards from the documents below. Generate 6 to 10 term/definition flashcards covering the key concepts. Respond with ONLY a JSON object, no commentary: {"cards": [{"term": string (a short key term or concept), "definition": string (one to two sentences), "sourceDocumentId": string (must be exactly one of: ${aliases.join(", ")})}]}.\n\nDocuments:\n${context}`;

  const allowed = new Set(aliases);
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ollama.chat({
        model: TEXT_MODEL,
        format: "json",
        keep_alive: -1,
        think: false,
        options: { temperature: 0.3, num_ctx: 8192 },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = parseModelJson(response.message.content);
      if (isValidFlashcardsJson(parsed, allowed)) return parsed.cards;
      lastError = response.message.content.slice(0, 200);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`flashcards model failed after retry: ${lastError}`);
}

/** POST /api/flashcards: term/definition cards from a subject or document ids. Tier 2. */
export async function generateFlashcards(request: FlashcardsRequest): Promise<FlashcardsResponse> {
  const documentIds = documentIdsForRequest(request);
  if (documentIds.length === 0) throw new Error("no documents to generate flashcards from");

  const sources: Record<string, DocumentSummary> = {};
  const aliasToId = new Map<string, string>();
  let context = "";
  for (const id of documentIds) {
    const row = getDocumentRow(id);
    if (!row || !row.text) continue;
    sources[id] = rowToSummary(row);
    const alias = `D${aliasToId.size + 1}`;
    aliasToId.set(alias, id);
    const piece = `[document: ${alias}]\n${row.text}\n\n`;
    if (context.length + piece.length > MAX_CONTEXT_CHARS) continue;
    context += piece;
  }

  const usableIds = Object.keys(sources);
  if (usableIds.length === 0) throw new Error("no readable documents to generate flashcards from");

  const raw = await generateCards(context, [...aliasToId.keys()]);
  const cards: Flashcard[] = raw.map((c) => ({
    id: newId(),
    term: c.term,
    definition: c.definition,
    sourceDocumentId: aliasToId.get(c.sourceDocumentId) ?? usableIds[0],
  }));

  return { cards, sources };
}
