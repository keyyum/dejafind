import ollama from "ollama";
import { getDb, serializeVector } from "@/server/db";
import { newId } from "@/server/ids";

const EMBED_MODEL = "nomic-embed-text";
const CHUNK_SIZE = 400;

/** About 400-character chunks, breaking on line boundaries where possible. */
export function chunkText(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length > 0 && current.length + line.length + 1 > CHUNK_SIZE) {
      chunks.push(current.trim());
      current = "";
    }
    current = current ? `${current}\n${line}` : line;
    while (current.length > CHUNK_SIZE) {
      chunks.push(current.slice(0, CHUNK_SIZE).trim());
      current = current.slice(CHUNK_SIZE);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

/** Chunks, embeds with nomic-embed-text, and inserts into chunks/chunks_fts/chunks_vec. Step 5. */
export async function indexDocument(documentId: string, text: string): Promise<void> {
  const db = getDb();
  removeDocumentFromIndex(documentId);

  const pieces = chunkText(text);
  if (pieces.length === 0) return;

  const embedResponse = await ollama.embed({ model: EMBED_MODEL, input: pieces, keep_alive: -1 });

  const insertChunk = db.prepare(`INSERT INTO chunks (id, document_id, idx, text) VALUES (?,?,?,?)`);
  const insertVec = db.prepare(`INSERT INTO chunks_vec (rowid, embedding) VALUES (?,?)`);
  const insertFts = db.prepare(`INSERT INTO chunks_fts (rowid, text) VALUES (?,?)`);

  pieces.forEach((piece, idx) => {
    const id = newId();
    const info = insertChunk.run(id, documentId, idx, piece);
    // vec0 requires the rowid bound as BigInt (sqlite3_bind_int64); a plain number fails.
    const rowid = BigInt(info.lastInsertRowid);
    insertVec.run(rowid, serializeVector(embedResponse.embeddings[idx]));
    insertFts.run(rowid, piece);
  });
}

export function removeDocumentFromIndex(documentId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM chunks_vec WHERE rowid IN (SELECT rowid FROM chunks WHERE document_id = ?)`).run(
    documentId
  );
  db.prepare(`DELETE FROM chunks_fts WHERE rowid IN (SELECT rowid FROM chunks WHERE document_id = ?)`).run(
    documentId
  );
  db.prepare(`DELETE FROM chunks WHERE document_id = ?`).run(documentId);
}

export async function embedQuery(query: string): Promise<number[]> {
  const response = await ollama.embed({ model: EMBED_MODEL, input: query, keep_alive: -1 });
  return response.embeddings[0];
}
