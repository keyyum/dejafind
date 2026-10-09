import ollama from "ollama";
import type { Answer, Citation, MatchSpan, SearchRequest, SearchResponse, SearchResult } from "@/lib/api-types";
import { getDb, serializeVector } from "@/server/db";
import { getDocumentRow, rowToSummary } from "@/server/documents";
import { embedQuery } from "@/server/index";
import { newId } from "@/server/ids";
import { parseModelJson } from "@/server/reader";

const TEXT_MODEL = "qwen3:4b";
const RRF_K = 60;
const CANDIDATE_LIMIT = 30;
const ANSWER_CHUNK_COUNT = 5;
/** Measured on the sample set (scripts/search-proof.ts); below this, answer "not in your files". */
const ANSWER_SCORE_THRESHOLD = 0.01;
const MAX_TURNS = 6;

interface RankedRow {
  rowid: number;
  document_id: string;
  text: string;
}

function subjectClause(subjectId?: string | null): { clause: string; params: unknown[] } {
  if (subjectId === "other") return { clause: "d.subject_id IS NULL", params: [] };
  if (subjectId) return { clause: "d.subject_id = ?", params: [subjectId] };
  return { clause: "1=1", params: [] };
}

function ftsQueryFor(q: string): string {
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return '""';
  return tokens.map((t) => `${t}*`).join(" OR ");
}

export function isQuestion(q: string): boolean {
  const trimmed = q.trim().toLowerCase();
  if (trimmed.endsWith("?")) return true;
  if (/^(when|what|where|who|how|which|is|does|did)\b/.test(trimmed)) return true;
  if (/\bmy\b/.test(trimmed)) return true;
  return false;
}

function ftsCandidates(q: string, subjectId?: string | null): RankedRow[] {
  const { clause, params } = subjectClause(subjectId);
  try {
    return getDb()
      .prepare(
        `SELECT f.rowid as rowid, c.document_id as document_id, c.text as text
         FROM chunks_fts f JOIN chunks c ON c.rowid = f.rowid JOIN documents d ON d.id = c.document_id
         WHERE f.text MATCH ? AND ${clause}
         ORDER BY bm25(f) ASC LIMIT ?`
      )
      .all(ftsQueryFor(q), ...params, CANDIDATE_LIMIT) as RankedRow[];
  } catch {
    return []; // malformed FTS query (rare punctuation edge case); vector search still runs
  }
}

function vecCandidates(queryEmbedding: number[], subjectId?: string | null): RankedRow[] {
  const rows = getDb()
    .prepare(`SELECT rowid, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance ASC`)
    .all(serializeVector(queryEmbedding), CANDIDATE_LIMIT * 3) as { rowid: number; distance: number }[];
  if (rows.length === 0) return [];

  const rowids = rows.map((r) => r.rowid);
  const placeholders = rowids.map(() => "?").join(",");
  const { clause, params } = subjectClause(subjectId);
  const chunkRows = getDb()
    .prepare(
      `SELECT c.rowid as rowid, c.document_id as document_id, c.text as text
       FROM chunks c JOIN documents d ON d.id = c.document_id
       WHERE c.rowid IN (${placeholders}) AND ${clause}`
    )
    .all(...rowids, ...params) as RankedRow[];

  const byRowid = new Map(chunkRows.map((r) => [r.rowid, r]));
  return rows
    .map((r) => byRowid.get(r.rowid))
    .filter((r): r is RankedRow => !!r)
    .slice(0, CANDIDATE_LIMIT);
}

function fuseRowids(ftsRows: RankedRow[], vecRows: RankedRow[]) {
  const scoreByRowid = new Map<number, number>();
  const info = new Map<number, RankedRow>();
  ftsRows.forEach((row, i) => {
    scoreByRowid.set(row.rowid, (scoreByRowid.get(row.rowid) ?? 0) + 1 / (RRF_K + i + 1));
    info.set(row.rowid, row);
  });
  vecRows.forEach((row, i) => {
    scoreByRowid.set(row.rowid, (scoreByRowid.get(row.rowid) ?? 0) + 1 / (RRF_K + i + 1));
    info.set(row.rowid, row);
  });
  return [...scoreByRowid.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rowid, score]) => ({ rowid, score, row: info.get(rowid) as RankedRow }));
}

function aggregateByDocument(ranked: { rowid: number; score: number; row: RankedRow }[]) {
  const byDocument = new Map<string, { score: number; bestChunk: RankedRow }>();
  for (const r of ranked) {
    const existing = byDocument.get(r.row.document_id);
    if (!existing || r.score > existing.score) {
      byDocument.set(r.row.document_id, { score: r.score, bestChunk: r.row });
    }
  }
  return byDocument;
}

function computeMatches(snippet: string, query: string): MatchSpan[] {
  const tokens = [...new Set(query.split(/\s+/).map((t) => t.toLowerCase()).filter((t) => t.length > 1))];
  const lower = snippet.toLowerCase();
  const spans: MatchSpan[] = [];
  for (const token of tokens) {
    let idx = lower.indexOf(token);
    while (idx !== -1) {
      spans.push([idx, idx + token.length]);
      idx = lower.indexOf(token, idx + token.length);
    }
  }
  return spans.sort((a, b) => a[0] - b[0]);
}

function recentMessages(conversationId: string): { role: "user" | "assistant"; content: string }[] {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO conversations (id, created_at) VALUES (?, ?)`).run(
    conversationId,
    new Date().toISOString()
  );
  const rows = db
    .prepare(`SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(conversationId, MAX_TURNS) as { role: string; text: string }[];
  return rows.reverse().map((r) => ({ role: r.role as "user" | "assistant", content: r.text }));
}

function recordMessage(conversationId: string, role: "user" | "assistant", text: string, citations: Citation[]) {
  getDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, text, citations, created_at) VALUES (?,?,?,?,?,?)`
    )
    .run(newId(), conversationId, role, text, JSON.stringify(citations), new Date().toISOString());
}

interface RawAnswerJson {
  answer: string;
  keyFact: string | null;
  citations: { documentId: string; lines: string[] }[];
}

function isValidAnswerJson(value: unknown): value is RawAnswerJson {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.answer !== "string") return false;
  if (v.keyFact !== null && typeof v.keyFact !== "string") return false;
  if (!Array.isArray(v.citations)) return false;
  for (const c of v.citations) {
    if (!c || typeof c !== "object") return false;
    const cc = c as Record<string, unknown>;
    if (typeof cc.documentId !== "string") return false;
    if (!Array.isArray(cc.lines) || !cc.lines.every((l) => typeof l === "string")) return false;
  }
  return true;
}

async function answerQuestion(query: string, chunks: RankedRow[], conversationId: string): Promise<Answer> {
  // qwen3:4b occasionally corrupts a character when transcribing a long UUID verbatim
  // (e.g. "...b9ba..." -> "...b9:9ba..."). Short aliases (D1, D2, ...) sidestep that
  // entirely; we map back to real ids after parsing.
  const aliasToId = new Map<string, string>();
  for (const c of chunks) {
    if (![...aliasToId.values()].includes(c.document_id)) {
      aliasToId.set(`D${aliasToId.size + 1}`, c.document_id);
    }
  }
  const idToAlias = new Map([...aliasToId.entries()].map(([alias, id]) => [id, alias]));
  const context = chunks.map((c) => `[document: ${idToAlias.get(c.document_id)}]\n${c.text}`).join("\n\n");
  const prompt = `Answer the user's question using ONLY the documents below. Respond with ONLY a JSON object, no commentary: {"answer": string (1-3 sentences), "keyFact": string or null (a short substring of "answer" to render bold), "citations": [{"documentId": string (one of: ${[...aliasToId.keys()].join(", ")}), "lines": string[] (verbatim lines from that document used)}]}. If the documents don't answer the question, set "answer" to "Not in your files." and "citations" to [].\n\nDocuments:\n${context}\n\nQuestion: ${query}`;

  const messages = [...recentMessages(conversationId), { role: "user" as const, content: prompt }];

  let raw: RawAnswerJson | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ollama.chat({
      model: TEXT_MODEL,
      format: "json",
      keep_alive: -1,
      think: false,
      options: { temperature: 0 },
      messages,
    });
    const parsed = parseModelJson(response.message.content);
    if (isValidAnswerJson(parsed)) {
      raw = parsed;
      break;
    }
  }
  if (!raw) raw = { answer: "Not in your files.", keyFact: null, citations: [] };

  const citations: Citation[] = raw.citations
    .map((c) => {
      const documentId = aliasToId.get(c.documentId);
      return documentId ? { ...c, documentId } : null;
    })
    .filter((c): c is Citation => c !== null);

  recordMessage(conversationId, "user", query, []);
  recordMessage(conversationId, "assistant", raw.answer, citations);

  return { text: raw.answer, keyFact: raw.keyFact, citations };
}

/** Vector-nearest documents to this one's own text, for the "similar" panel. */
export async function findSimilarDocuments(documentId: string, limit = 6): Promise<SearchResult[]> {
  const row = getDocumentRow(documentId);
  if (!row || !row.text) return [];

  const embedding = await embedQuery(row.text.slice(0, 2000));
  const neighbors = vecCandidates(embedding, null).filter((r) => r.document_id !== documentId);

  const byDocument = new Map<string, RankedRow>();
  for (const r of neighbors) {
    if (!byDocument.has(r.document_id)) byDocument.set(r.document_id, r);
  }

  const results: SearchResult[] = [];
  for (const [docId, chunk] of byDocument) {
    const docRow = getDocumentRow(docId);
    if (!docRow) continue;
    results.push({
      document: rowToSummary(docRow),
      snippet: chunk.text.slice(0, 220).trim(),
      matches: [],
      score: 1,
    });
    if (results.length >= limit) break;
  }
  return results;
}

/** Fuses FTS5 and vec0 by reciprocal rank; answers questions from the top chunks. Step 6. */
export async function search(request: SearchRequest): Promise<SearchResponse> {
  const start = Date.now();
  const q = request.q.trim();
  const limit = request.limit ?? 10;

  const queryEmbedding = await embedQuery(q);
  const ftsRows = ftsCandidates(q, request.subjectId);
  const vecRows = vecCandidates(queryEmbedding, request.subjectId);
  const ranked = fuseRowids(ftsRows, vecRows);
  const byDocument = aggregateByDocument(ranked);
  const sortedDocs = [...byDocument.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);

  const results: SearchResult[] = [];
  for (const [documentId, info] of sortedDocs) {
    const row = getDocumentRow(documentId);
    if (!row) continue;
    const snippet = info.bestChunk.text.slice(0, 220).trim();
    results.push({
      document: rowToSummary(row),
      snippet,
      matches: computeMatches(snippet, q),
      score: info.score,
    });
  }

  const question = isQuestion(q);
  let answer: Answer | null = null;
  let notInDocuments = false;
  let conversationId = request.conversationId ?? null;

  if (question) {
    const topScore = sortedDocs[0]?.[1].score ?? 0;
    if (sortedDocs.length === 0 || topScore < ANSWER_SCORE_THRESHOLD) {
      notInDocuments = true;
    } else {
      conversationId = conversationId ?? newId();
      const topChunks = ranked.slice(0, ANSWER_CHUNK_COUNT).map((r) => r.row);
      answer = await answerQuestion(q, topChunks, conversationId);
    }
  }

  return {
    q,
    isQuestion: question,
    answer,
    notInDocuments,
    results,
    conversationId,
    tookMs: Date.now() - start,
  };
}
