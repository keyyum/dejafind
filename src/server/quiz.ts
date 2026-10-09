import { randomInt } from "node:crypto";
import ollama from "ollama";
import type { DocumentSummary, Quiz, QuizQuestion, QuizRequest, QuizResponse } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { getDocumentRow, rowToSummary } from "@/server/documents";
import { newId } from "@/server/ids";
import { parseModelJson } from "@/server/reader";

const TEXT_MODEL = "qwen3:4b";
const MAX_CONTEXT_CHARS = 8000;

interface RawQuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  sourceDocumentId: string;
}

// qwen3:4b occasionally corrupts a character when transcribing a long UUID verbatim
// (e.g. "...b9ba..." -> "...b9:9ba..."). Short aliases (D1, D2, ...) sidestep that
// entirely; we map back to real ids after parsing.
function isValidQuizJson(
  value: unknown,
  count: number,
  allowedAliases: Set<string>
): value is { questions: RawQuizQuestion[] } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.questions) || v.questions.length !== count) return false;
  for (const q of v.questions) {
    if (!q || typeof q !== "object") return false;
    const qq = q as Record<string, unknown>;
    if (typeof qq.question !== "string") return false;
    if (!Array.isArray(qq.choices) || qq.choices.length !== 4 || !qq.choices.every((c) => typeof c === "string")) {
      return false;
    }
    if (typeof qq.answerIndex !== "number" || qq.answerIndex < 0 || qq.answerIndex > 3) return false;
    if (typeof qq.explanation !== "string") return false;
    if (typeof qq.sourceDocumentId !== "string" || !allowedAliases.has(qq.sourceDocumentId)) return false;
  }
  return true;
}

function shuffleChoices(raw: RawQuizQuestion): { choices: [string, string, string, string]; answerIndex: 0 | 1 | 2 | 3 } {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const choices = order.map((i) => raw.choices[i]) as [string, string, string, string];
  const answerIndex = order.indexOf(raw.answerIndex) as 0 | 1 | 2 | 3;
  return { choices, answerIndex };
}

function documentIdsForRequest(request: QuizRequest): string[] {
  if (request.documentIds && request.documentIds.length > 0) return request.documentIds;
  if (request.subjectId) {
    const rows = getDb()
      .prepare(`SELECT id FROM documents WHERE subject_id = ? AND status = 'done' ORDER BY captured_at DESC`)
      .all(request.subjectId) as { id: string }[];
    return rows.map((r) => r.id);
  }
  return [];
}

async function generateQuestions(
  context: string,
  aliases: string[],
  count: number
): Promise<RawQuizQuestion[]> {
  const prompt = `You write multiple-choice quiz questions for a student studying the documents below. Generate exactly ${count} questions. Respond with ONLY a JSON object, no commentary: {"questions": [{"question": string, "choices": [string,string,string,string] (exactly four, one correct), "answerIndex": number (0-3, index of the correct choice), "explanation": string (one line, shown after answering), "sourceDocumentId": string (must be exactly one of: ${aliases.join(", ")})}]}.\n\nDocuments:\n${context}`;

  const allowed = new Set(aliases);
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ollama.chat({
      model: TEXT_MODEL,
      format: "json",
      keep_alive: -1,
      think: false,
      options: { temperature: 0.4, num_ctx: 8192 },
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = parseModelJson(response.message.content);
    if (isValidQuizJson(parsed, count, allowed)) return parsed.questions;
    lastError = response.message.content.slice(0, 200);
  }
  throw new Error(`quiz model returned invalid JSON after retry: ${lastError}`);
}

/** Five MCQs from a subject or document ids, via qwen3:4b. Step 7. */
export async function generateQuiz(request: QuizRequest): Promise<QuizResponse> {
  const start = Date.now();
  const count = request.count ?? 5;
  const documentIds = documentIdsForRequest(request);
  if (documentIds.length === 0) throw new Error("no documents to quiz from");

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
  if (usableIds.length === 0) throw new Error("no readable documents to quiz from");

  const raw = await generateQuestions(context, [...aliasToId.keys()], count);
  const questions: QuizQuestion[] = raw.map((q) => {
    const { choices, answerIndex } = shuffleChoices(q);
    return {
      id: newId(),
      question: q.question,
      choices,
      answerIndex,
      explanation: q.explanation,
      sourceDocumentId: aliasToId.get(q.sourceDocumentId) ?? usableIds[0],
    };
  });

  const subjectId = request.subjectId ?? null;
  const subjectName = subjectId
    ? ((getDb().prepare(`SELECT name FROM subjects WHERE id = ?`).get(subjectId) as { name: string } | undefined)
        ?.name ?? null)
    : null;

  const quiz: Quiz = {
    id: newId(),
    subjectId,
    subjectName,
    documentIds: usableIds,
    questions,
    sources,
    tookMs: Date.now() - start,
  };
  return quiz;
}
