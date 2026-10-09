import { getDb } from "@/server/db";
import { generateFlashcards } from "@/server/flashcards";
import { generateQuiz } from "@/server/quiz";
import { generateReviewSheet } from "@/server/review";

export type PrecomputeKind = "quiz" | "flashcards" | "review";

const DEBOUNCE_MS = 20_000;
const POLL_WHILE_READS_PENDING_MS = 5_000;

declare global {
  var __dejafindPrecomputeTimers: Map<string, ReturnType<typeof setTimeout>> | undefined;
  var __dejafindPrecomputeQueue: Set<string> | undefined;
  var __dejafindPrecomputeRunning: boolean | undefined;
}

function timers(): Map<string, ReturnType<typeof setTimeout>> {
  if (!globalThis.__dejafindPrecomputeTimers) globalThis.__dejafindPrecomputeTimers = new Map();
  return globalThis.__dejafindPrecomputeTimers;
}

function queue(): Set<string> {
  if (!globalThis.__dejafindPrecomputeQueue) globalThis.__dejafindPrecomputeQueue = new Set();
  return globalThis.__dejafindPrecomputeQueue;
}

function readsPending(): boolean {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM documents WHERE status IN ('queued','reading')`)
    .get() as { n: number };
  return row.n > 0;
}

/** The sorted set of this subject's filed document ids, as a cache key. */
export function documentSetKey(subjectId: string): string {
  const rows = getDb()
    .prepare(`SELECT id FROM documents WHERE subject_id = ? AND status = 'done'`)
    .all(subjectId) as { id: string }[];
  return rows
    .map((r) => r.id)
    .sort()
    .join(",");
}

interface CachedRow {
  payload: string;
  doc_set_key: string;
  cached_at: string;
}

function readCache(kind: PrecomputeKind, subjectId: string): { payload: unknown; docSetKey: string; cachedAt: string } | null {
  const row = getDb()
    .prepare(`SELECT payload, doc_set_key, cached_at FROM precomputed WHERE subject_id = ? AND kind = ?`)
    .get(subjectId, kind) as CachedRow | undefined;
  if (!row) return null;
  return { payload: JSON.parse(row.payload), docSetKey: row.doc_set_key, cachedAt: row.cached_at };
}

function writeCache(kind: PrecomputeKind, subjectId: string, docSetKey: string, payload: unknown): void {
  const cachedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO precomputed (subject_id, kind, doc_set_key, payload, cached_at) VALUES (?,?,?,?,?)
       ON CONFLICT(subject_id, kind) DO UPDATE SET doc_set_key = excluded.doc_set_key, payload = excluded.payload, cached_at = excluded.cached_at`
    )
    .run(subjectId, kind, docSetKey, JSON.stringify(payload), cachedAt);
}

/**
 * Returns the cached result for this subject's *current* document set, or null if
 * there is no cache or it's stale (the subject's filed documents changed since it
 * was computed). The three POST routes call this first.
 */
export function getFreshCache(kind: PrecomputeKind, subjectId: string): { payload: unknown; cachedAt: string } | null {
  const cached = readCache(kind, subjectId);
  if (!cached) return null;
  if (cached.docSetKey !== documentSetKey(subjectId)) return null;
  return { payload: cached.payload, cachedAt: cached.cachedAt };
}

/** Schedules a debounced background precompute for a subject a document was just filed into. */
export function schedulePrecompute(subjectId: string): void {
  const t = timers();
  const existing = t.get(subjectId);
  if (existing) clearTimeout(existing);
  t.set(
    subjectId,
    setTimeout(() => {
      t.delete(subjectId);
      queue().add(subjectId);
      void runPrecomputeQueue();
    }, DEBOUNCE_MS)
  );
}

async function precomputeOne(kind: PrecomputeKind, subjectId: string, docSetKey: string): Promise<void> {
  let payload: unknown;
  if (kind === "quiz") payload = await generateQuiz({ subjectId });
  else if (kind === "flashcards") payload = await generateFlashcards({ subjectId });
  else payload = await generateReviewSheet(subjectId);
  writeCache(kind, subjectId, docSetKey, payload);
}

async function precomputeSubject(subjectId: string): Promise<void> {
  const docSetKey = documentSetKey(subjectId);
  if (!docSetKey) return; // nothing filed under this subject (yet)

  for (const kind of ["quiz", "flashcards", "review"] as const) {
    if (readsPending()) {
      queue().add(subjectId); // the read pipeline took priority; finish this subject later
      return;
    }
    const cached = readCache(kind, subjectId);
    if (cached && cached.docSetKey === docSetKey) continue; // already current
    try {
      await precomputeOne(kind, subjectId, docSetKey);
    } catch (err) {
      console.error(`[precompute] ${kind} failed for subject ${subjectId}`, err);
    }
  }
}

/** One at a time, lowest priority: always yields to the read pipeline. */
async function runPrecomputeQueue(): Promise<void> {
  if (globalThis.__dejafindPrecomputeRunning) return;
  globalThis.__dejafindPrecomputeRunning = true;
  try {
    const q = queue();
    while (q.size > 0) {
      if (readsPending()) {
        await new Promise((resolve) => setTimeout(resolve, POLL_WHILE_READS_PENDING_MS));
        continue;
      }
      const subjectId = q.values().next().value as string;
      q.delete(subjectId);
      await precomputeSubject(subjectId).catch((err) => {
        console.error(`[precompute] subject ${subjectId} failed unexpectedly`, err);
      });
    }
  } finally {
    globalThis.__dejafindPrecomputeRunning = false;
  }
}
