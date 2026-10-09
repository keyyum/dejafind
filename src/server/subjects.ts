import ollama from "ollama";
import type { ScheduleConfirmResponse, ScheduleEntry, ScheduleResponse, SchedulePending, Subject, Weekday } from "@/lib/api-types";
import { getDb } from "@/server/db";
import type { DocumentRow } from "@/server/documents";
import { newId } from "@/server/ids";
import { parseModelJson } from "@/server/reader";
import type { ReadResult } from "@/server/reader";

const TEXT_MODEL = "qwen3:4b";

const ALIASES: Record<string, string> = {
  bio: "Biology",
  biol: "Biology",
  chem: "Chemistry",
  calc: "Calculus",
  phy: "Physics",
  phys: "Physics",
  pe: "Physical Education",
  physed: "Physical Education",
  cs: "Computer Science",
  comsci: "Computer Science",
  math: "Mathematics",
  mathematics: "Mathematics",
  engl: "English",
  eng: "English",
  fil: "Filipino",
  hist: "History",
  nstp: "NSTP",
  stats: "Statistics",
  stat: "Statistics",
};

/**
 * Broader family grouping than ALIASES: terms that aren't spelling variants of the
 * same word but should still match the same schedule subject ("Mathematics" and
 * "Calculus" aren't synonyms, but in a PH class schedule they're the same slot).
 * Used only to match an existing (especially schedule-sourced) subject, never to
 * pick a display name.
 */
const FAMILY: Record<string, string> = {
  math: "math",
  mathematics: "math",
  calc: "math",
  calculus: "math",
  algebra: "math",
  trig: "math",
  trigonometry: "math",
  bio: "bio",
  biology: "bio",
  phy: "physics",
  phys: "physics",
  physics: "physics",
  chem: "chem",
  chemistry: "chem",
  fil: "filipino",
  filipino: "filipino",
  wika: "filipino",
  sanaysay: "filipino",
  panitikan: "filipino",
  tagalog: "filipino",
  pe: "pe",
  physed: "pe",
  physicaleducation: "pe",
  cs: "cs",
  comsci: "cs",
  computerscience: "cs",
  eng: "english",
  engl: "english",
  english: "english",
  hist: "history",
  history: "history",
  nstp: "nstp",
  stat: "statistics",
  stats: "statistics",
  statistics: "statistics",
};

/** Subject names the reader sometimes produces that mean "no subject", never create these. */
const REJECTED_NAMES = new Set(["unknown", "none", "na", "general", "other", "n", "nota", "notapplicable"]);

function titleCase(name: string): string {
  return name.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Strips a trailing course/section number for display: "Biology 101" / "Calculus 1" -> "Biology" / "Calculus". */
function stripCourseNumber(name: string): string {
  return name.replace(/\s+\d+[A-Za-z]?\s*$/, "").trim();
}

function alphaKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export function normalizeSubjectName(raw: string | null | undefined): string {
  const trimmed = stripCourseNumber((raw ?? "").trim());
  if (!trimmed) return "";
  const key = alphaKey(trimmed);
  if (REJECTED_NAMES.has(key)) return "";
  if (ALIASES[key]) return ALIASES[key];
  return titleCase(trimmed);
}

/** Family key for fuzzy-matching against existing subjects; null when the name isn't in a known family. */
/** Checks the whole (alias-collapsed) name first, then each word on its own, so a
 * multi-word name like "Wika at Kultura" still matches the single-word "wika" entry
 * that alphaKey() would otherwise merge into one unmatched token. */
function familyKey(name: string): string | null {
  const stripped = stripCourseNumber(name);
  const whole = FAMILY[alphaKey(stripped)];
  if (whole) return whole;
  for (const word of stripped.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
    if (FAMILY[word]) return FAMILY[word];
  }
  return null;
}

interface SubjectRow {
  id: string;
  name: string;
  source: string;
  created_at: string;
}

function rowToSubject(row: SubjectRow): Subject {
  const count = getDb()
    .prepare(`SELECT COUNT(*) as n FROM documents WHERE subject_id = ?`)
    .get(row.id) as { n: number };
  return { id: row.id, name: row.name, source: row.source as Subject["source"], count: count.n };
}

export function listSubjects(): Subject[] {
  const rows = getDb().prepare(`SELECT * FROM subjects ORDER BY name ASC`).all() as SubjectRow[];
  return rows.map(rowToSubject);
}

export function otherDocumentCount(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM documents WHERE subject_id IS NULL AND status IN ('done','error')`)
    .get() as { n: number };
  return row.n;
}

export function findSubjectByName(name: string): Subject | null {
  if (!name) return null;
  const row = getDb().prepare(`SELECT * FROM subjects WHERE name = ? COLLATE NOCASE`).get(name) as
    | SubjectRow
    | undefined;
  return row ? rowToSubject(row) : null;
}

export function createSubject(name: string, source: "inferred" | "schedule"): Subject {
  const id = newId();
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(`INSERT INTO subjects (id, name, source, created_at) VALUES (?,?,?,?)`)
    .run(id, name, source, createdAt);
  return { id, name, source, count: 0 };
}

function matchScheduleByTime(capturedAt: string): string | null {
  const d = new Date(capturedAt);
  const weekday = d.getDay();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const row = getDb()
    .prepare(`SELECT subject_id FROM schedule WHERE weekday = ? AND start <= ? AND end > ? LIMIT 1`)
    .get(weekday, time, time) as { subject_id: string } | undefined;
  return row?.subject_id ?? null;
}

function hasConfirmedSchedule(): boolean {
  const row = getDb().prepare(`SELECT 1 FROM schedule LIMIT 1`).get();
  return !!row;
}

/** Closest schedule-sourced subject by alias/family match, e.g. "Mathematics" -> "Calculus". */
function findScheduleSubjectByFamily(normalizedName: string): Subject | null {
  const wantFamily = familyKey(normalizedName);
  if (!wantFamily) return null;

  const rows = getDb().prepare(`SELECT * FROM subjects WHERE source = 'schedule'`).all() as SubjectRow[];
  for (const row of rows) {
    if (familyKey(row.name) === wantFamily) return rowToSubject(row);
  }
  return null;
}

/** doc_type values that can plausibly be a school document. "pdf" only counts
 * when the file itself is a PDF — a photo the vision model mislabeled doc_type
 * "pdf" (e.g. a receipt) is not a school PDF. */
const SCHOOL_LIKE_DOC_TYPES = new Set(["slide", "whiteboard", "handout", "chat", "schedule"]);

function isSchoolLikeDocument(docType: string, kind: string): boolean {
  if (SCHOOL_LIKE_DOC_TYPES.has(docType)) return true;
  return docType === "pdf" && kind === "pdf";
}

/**
 * Filing order: reader subject match, then (when a schedule is confirmed) a fuzzy
 * family match against schedule subjects, then schedule time match, then a new
 * inferred subject (only for a school-like document type), else Other.
 */
export function fileDocumentSubject(
  row: DocumentRow,
  read: ReadResult
): { subjectId: string | null; newSubjects: Subject[] } {
  const newSubjects: Subject[] = [];
  const normalized = normalizeSubjectName(read.subjectRaw);

  if (normalized) {
    const existing = findSubjectByName(normalized);
    if (existing) return { subjectId: existing.id, newSubjects };

    if (hasConfirmedSchedule()) {
      const fuzzy = findScheduleSubjectByFamily(normalized);
      if (fuzzy) return { subjectId: fuzzy.id, newSubjects };
    }
  }

  const scheduleMatch = matchScheduleByTime(row.captured_at);
  if (scheduleMatch) return { subjectId: scheduleMatch, newSubjects };

  if (normalized && isSchoolLikeDocument(read.docType, row.kind)) {
    const created = createSubject(normalized, "inferred");
    newSubjects.push(created);
    return { subjectId: created.id, newSubjects };
  }

  return { subjectId: null, newSubjects };
}

// ---------------------------------------------------------------------------
// Schedule parsing and confirmation
// ---------------------------------------------------------------------------

interface RawScheduleEntry {
  subject: string;
  weekday: number;
  start: string;
  end: string;
  room?: string | null;
}

interface RawScheduleJson {
  section: string | null;
  entries: RawScheduleEntry[];
}

function isValidScheduleJson(value: unknown): value is RawScheduleJson {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.section !== null && typeof v.section !== "string") return false;
  if (!Array.isArray(v.entries)) return false;
  for (const e of v.entries) {
    if (!e || typeof e !== "object") return false;
    const ee = e as Record<string, unknown>;
    if (typeof ee.subject !== "string") return false;
    if (typeof ee.weekday !== "number" || ee.weekday < 0 || ee.weekday > 6) return false;
    if (typeof ee.start !== "string" || typeof ee.end !== "string") return false;
    if (ee.room !== undefined && ee.room !== null && typeof ee.room !== "string") return false;
  }
  return true;
}

async function parseScheduleEntries(text: string): Promise<RawScheduleJson> {
  const prompt = `Parse this class schedule / timetable text. Respond with ONLY a JSON object, no commentary: {"section": string or null (the class section code, e.g. "BSCS 2-B"), "entries": [{"subject": string, "weekday": number (0=Sunday..6=Saturday), "start": "HH:MM" 24-hour, "end": "HH:MM" 24-hour, "room": string or null (the room or venue column for this class, e.g. "Room 301" or "Covered Court" — ALWAYS include this key in every entry; use null only if no room/venue is shown at all)}]}. Every entry MUST have all five keys: subject, weekday, start, end, room. One entry per class meeting, expand repeated days into separate entries.\n\nText:\n${text}`;
  let lastError = "no attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ollama.chat({
        model: TEXT_MODEL,
        format: "json",
        keep_alive: -1,
        think: false,
        options: { temperature: 0, num_ctx: 8192 },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = parseModelJson(response.message.content);
      if (isValidScheduleJson(parsed)) return parsed;
      lastError = response.message.content.slice(0, 200);
    } catch (err) {
      // Ollama itself can throw (e.g. its own repeat-loop guard); retry covers both.
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`schedule model failed after retry: ${lastError}`);
}

export async function createSchedulePending(row: DocumentRow, read: ReadResult): Promise<SchedulePending> {
  const parsed = await parseScheduleEntries(read.text);
  const section = read.scheduleSection ?? parsed.section ?? null;
  const subjectNames = [...new Set(parsed.entries.map((e) => normalizeSubjectName(e.subject)).filter(Boolean))];

  const pending: SchedulePending = {
    documentId: row.id,
    section,
    subjects: subjectNames,
    entries: parsed.entries
      .map((e) => ({
        subjectName: normalizeSubjectName(e.subject),
        weekday: e.weekday as Weekday,
        start: e.start,
        end: e.end,
        room: e.room ?? null,
        section,
      }))
      .filter((e) => e.subjectName),
  };

  getDb()
    .prepare(
      `INSERT OR REPLACE INTO schedule_pending (document_id, section, payload, created_at) VALUES (?,?,?,?)`
    )
    .run(row.id, section, JSON.stringify(pending), new Date().toISOString());

  return pending;
}

function entriesToScheduleList(): ScheduleEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id as id, s.subject_id as subjectId, sub.name as subjectName, s.weekday as weekday, s.start as start, s.end as end, s.room as room, s.section as section
       FROM schedule s JOIN subjects sub ON sub.id = s.subject_id
       ORDER BY s.weekday ASC, s.start ASC`
    )
    .all() as ScheduleEntry[];
  return rows;
}

function latestPending(): SchedulePending | null {
  const row = getDb()
    .prepare(`SELECT payload FROM schedule_pending ORDER BY created_at DESC LIMIT 1`)
    .get() as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as SchedulePending) : null;
}

export function getScheduleResponse(): ScheduleResponse {
  const entries = entriesToScheduleList();
  const section = entries[0]?.section ?? null;
  return { section, entries, pending: latestPending() };
}

export function confirmSchedule(documentId: string, confirm: boolean): { response: ScheduleConfirmResponse; newSubjects: Subject[] } {
  const db = getDb();
  const pendingRow = db.prepare(`SELECT payload FROM schedule_pending WHERE document_id = ?`).get(documentId) as
    | { payload: string }
    | undefined;
  if (!pendingRow) throw new Error("no pending schedule for this document");
  const pending = JSON.parse(pendingRow.payload) as SchedulePending;

  db.prepare(`DELETE FROM schedule_pending WHERE document_id = ?`).run(documentId);

  const newSubjects: Subject[] = [];
  const filedAt = new Date().toISOString();

  if (confirm) {
    const nameToId = new Map<string, string>();
    for (const name of pending.subjects) {
      let subject = findSubjectByName(name);
      if (!subject) {
        subject = createSubject(name, "schedule");
        newSubjects.push(subject);
      }
      nameToId.set(name, subject.id);
    }

    const insertSchedule = db.prepare(
      `INSERT INTO schedule (id, subject_id, weekday, start, end, room, section) VALUES (?,?,?,?,?,?,?)`
    );
    for (const entry of pending.entries) {
      const subjectId = nameToId.get(entry.subjectName);
      if (!subjectId) continue;
      insertSchedule.run(newId(), subjectId, entry.weekday, entry.start, entry.end, entry.room, entry.section);
    }

    // The timetable document itself isn't "about" any one of the subjects it lists;
    // it belongs under Other, same as when it's declined.
    db.prepare(`UPDATE documents SET subject_id = NULL, filed_at = ? WHERE id = ?`).run(filedAt, documentId);
  } else {
    db.prepare(`UPDATE documents SET subject_id = NULL, filed_at = ? WHERE id = ?`).run(filedAt, documentId);
  }

  return { response: getScheduleResponse(), newSubjects };
}
