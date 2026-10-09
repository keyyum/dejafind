/**
 * DéjàFind API contract. Shared by the core worker (route handlers under
 * `src/app/api/**`) and the UI worker (views and `src/lib/mock.ts`).
 *
 * Both sides compile against this file. Change it only through the
 * orchestrator; a worker that needs a new field reports it in STATUS.md.
 *
 * Conventions
 * - Every id is a string (ULID or nanoid), never a number.
 * - Every timestamp is ISO 8601 with offset, e.g. "2026-10-10T02:15:00+08:00".
 * - Every calendar date is "YYYY-MM-DD".
 * - Binary routes: thumbnails at `/api/thumb/[id]`, originals at `/api/file/[id]`,
 *   cleaned (warped) image at `/api/file/[id]?variant=clean`.
 * - JSON errors are `{ error: string }` with a 4xx or 5xx status.
 */

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentKind = "image" | "pdf";

/** Pipeline state. `queued` and `reading` render as the spinner tile. */
export type DocumentStatus = "queued" | "reading" | "done" | "error";

/** What the reader decided the capture is. `schedule` triggers the confirm card. */
export type DocType =
  | "slide"
  | "whiteboard"
  | "handout"
  | "chat"
  | "schedule"
  | "pdf"
  | "other";

/** The shape every list, grid, result and citation carries. */
export interface DocumentSummary {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  docType: DocType;
  title: string;
  summary: string;
  tags: string[];
  /** null while reading, and for `Other` documents (no subject). */
  subjectId: string | null;
  subjectName: string | null;
  /** File capture time (EXIF or mtime), the anchor for date parsing. */
  capturedAt: string;
  /** Pixel size of the thumbnail image, so tiles keep the real aspect ratio. */
  width: number;
  height: number;
  /** `/api/thumb/[id]`. Present once status is `done` (or `error` with a raw thumb). */
  thumbUrl: string | null;
  /** `/api/file/[id]`. */
  fileUrl: string;
  /** Set when status becomes `done`. Drives "filed under X" for one minute. */
  filedAt: string | null;
  /** Number of dates with status `auto` on this document. */
  comingUpCount: number;
}

export type DateStatus = "auto" | "review" | "ignored";

/** A date the reader found inside a document. */
export interface DateFound {
  id: string;
  documentId: string;
  isoDate: string;
  /** What the date is for, in the document's words, e.g. "Bio quiz, chapters 4 and 5". */
  label: string;
  /** 0 to 1. Both the model and chrono agreed at 1; model only at about 0.5. */
  confidence: number;
  /** The exact substring of `text` the date came from, for highlighting. */
  span: string;
  status: DateStatus;
}

/** A word box from OCR, in pixels of the original image. Optional feature. */
export interface WordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentDetail extends DocumentSummary {
  /** Full extracted text, newline separated as read. */
  text: string;
  dates: DateFound[];
  /** Milliseconds the local model spent reading this document. null until done. */
  readMs: number | null;
  /** Absolute path on this laptop, shown under "Open original file". */
  path: string;
  /** `/api/file/[id]?variant=clean` when a warped/cleaned image exists, else null. */
  cleanUrl: string | null;
  /** Page count for PDFs, 1 for images. */
  pages: number;
  /** For `schedule` documents: section the reader saw, e.g. "BSCS 2-B". */
  scheduleSection: string | null;
  /** Error message when status is `error`. */
  error: string | null;
}

export interface DocumentGroup {
  /** "YYYY-MM-DD" in local time. */
  day: string;
  /** Human label: "Today", "Yesterday", "Mon, Oct 6". */
  label: string;
  documents: DocumentSummary[];
}

/** GET /api/documents?subject=<id|other|all>&limit=<n> */
export interface DocumentsResponse {
  groups: DocumentGroup[];
  total: number;
}

/** GET /api/documents/[id] */
export type DocumentResponse = DocumentDetail;

/** PATCH /api/documents/[id] */
export interface DocumentPatch {
  title?: string;
  /** Set to null to move the document to Other. */
  subjectId?: string | null;
}

/** DELETE /api/documents/[id] -> { ok: true } */
export interface OkResponse {
  ok: true;
}

/** PATCH /api/dates/[id] */
export interface DatePatch {
  status: "auto" | "ignored";
}

/** GET /api/documents/[id]/words */
export interface WordsResponse {
  words: WordBox[];
  /** Pixel size of the image the boxes are measured against. */
  width: number;
  height: number;
}

/** GET /api/documents/[id]/similar */
export interface SimilarResponse {
  results: SearchResult[];
}

// ---------------------------------------------------------------------------
// Subjects and schedule
// ---------------------------------------------------------------------------

export type SubjectSource = "schedule" | "inferred";

export interface Subject {
  id: string;
  name: string;
  source: SubjectSource;
  /** Documents filed under this subject. */
  count: number;
}

/** GET /api/subjects. `otherCount` is documents with no subject. */
export interface SubjectsResponse {
  subjects: Subject[];
  otherCount: number;
  total: number;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface ScheduleEntry {
  id: string;
  subjectId: string;
  subjectName: string;
  weekday: Weekday;
  /** "HH:MM" 24-hour local time. */
  start: string;
  end: string;
  room: string | null;
  section: string | null;
}

/** A timetable document waiting for "Use it" or "Not mine". */
export interface SchedulePending {
  documentId: string;
  /** Section the reader saw, e.g. "BSCS 2-B". */
  section: string | null;
  /** Subject names the timetable would create. */
  subjects: string[];
  entries: Omit<ScheduleEntry, "id" | "subjectId">[];
}

/** GET /api/schedule */
export interface ScheduleResponse {
  /** Section of the confirmed schedule, if any. */
  section: string | null;
  entries: ScheduleEntry[];
  /** Most recent unconfirmed timetable, or null. */
  pending: SchedulePending | null;
}

/** POST /api/schedule */
export interface ScheduleConfirmRequest {
  documentId: string;
  /** true = "Use it", false = "Not mine". */
  confirm: boolean;
}

export type ScheduleConfirmResponse = ScheduleResponse;

// ---------------------------------------------------------------------------
// Timeline (the Coming up strip)
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  /** The date row id, so the UI can PATCH /api/dates/[id]. */
  id: string;
  documentId: string;
  documentTitle: string;
  subjectId: string | null;
  subjectName: string | null;
  isoDate: string;
  label: string;
  status: DateStatus;
  /** True when the date is within 48 hours of now. Render in accent. */
  soon: boolean;
}

/** GET /api/timeline?from=<YYYY-MM-DD>&limit=<n>. Sorted ascending, `auto` only unless `?all=1`. */
export interface TimelineResponse {
  entries: TimelineEntry[];
}

// ---------------------------------------------------------------------------
// Search and ask
// ---------------------------------------------------------------------------

/** POST /api/search */
export interface SearchRequest {
  q: string;
  /** Restrict to one subject. "other" means documents with no subject. */
  subjectId?: string | null;
  /** Continue a conversation so follow-up questions keep context. */
  conversationId?: string | null;
  limit?: number;
}

/** [start, end) character offsets inside `snippet`. */
export type MatchSpan = [number, number];

export interface SearchResult {
  document: DocumentSummary;
  /** Best matching passage, about one to two lines. */
  snippet: string;
  /** Offsets inside `snippet` to highlight. Empty for pure semantic hits. */
  matches: MatchSpan[];
  /** Fused rank score, higher is better. Only comparable within one response. */
  score: number;
}

export interface Citation {
  documentId: string;
  /** The lines from the document the answer used, verbatim. */
  lines: string[];
}

export interface Answer {
  /** Plain text answer, one to three sentences. */
  text: string;
  /** The key fact, a substring of `text`, to render bold. */
  keyFact: string | null;
  citations: Citation[];
}

export interface SearchResponse {
  q: string;
  /** True when the query read as a question and the answer path ran. */
  isQuestion: boolean;
  /** Present when `isQuestion` and retrieval confidence was high enough. */
  answer: Answer | null;
  /** True when the query was a question but nothing in the documents answers it. */
  notInDocuments: boolean;
  results: SearchResult[];
  conversationId: string | null;
  /** Milliseconds spent, measured on this machine. */
  tookMs: number;
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** POST /api/quiz. One of `subjectId` or `documentIds` is required. */
export interface QuizRequest {
  subjectId?: string | null;
  documentIds?: string[];
  /** Default 5. */
  count?: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  /** Exactly four. */
  choices: [string, string, string, string];
  /** Index into `choices`. The UI grades locally. */
  answerIndex: 0 | 1 | 2 | 3;
  /** One line, shown after answering. */
  explanation: string;
  sourceDocumentId: string;
}

export interface Quiz {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  documentIds: string[];
  questions: QuizQuestion[];
  /** Summaries of every source document, keyed by id, for the thumbnail under each verdict. */
  sources: Record<string, DocumentSummary>;
  tookMs: number;
}

export type QuizResponse = Quiz;

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface ModelInfo {
  /** Ollama tag, e.g. "qwen2.5vl:3b". */
  name: string;
  /** Human size, e.g. "3B" or "137M". */
  params: string;
  sizeBytes: number;
  role: "vision" | "text" | "embedding";
  loaded: boolean;
}

/** GET /api/status */
export interface StatusResponse {
  /** Outbound HTTP requests leaving this laptop since the server started. Must read 0. */
  requestsOut: number;
  ollamaReachable: boolean;
  models: ModelInfo[];
  /** Average read time over documents read since start, on this machine. */
  avgReadMs: number | null;
  documentsRead: number;
  queued: number;
  /** Absolute folders being watched. */
  watching: string[];
  /** Machine description for the stage line, e.g. "Apple M4, 16 GB". */
  machine: string;
  startedAt: string;
}

// ---------------------------------------------------------------------------
// Import (drag and drop, bulk folder drop, Snap)
// ---------------------------------------------------------------------------

/**
 * POST /api/import, multipart/form-data with one or more `files` fields.
 * Each file is written into `data/watch/` and flows through the normal pipeline.
 * The Snap button posts a single JPEG the same way with `source=snap`.
 */
export interface ImportResponse {
  /** Documents created, in the order received. Status is `queued`. */
  documents: DocumentSummary[];
  /** Files skipped because an identical sha256 already exists. */
  duplicates: number;
}

// ---------------------------------------------------------------------------
// Events (server-sent events at GET /api/events)
// ---------------------------------------------------------------------------

/**
 * Each SSE message has `event: <type>` and `data: <JSON of the matching payload>`.
 * `document.filed` is the one the snackbar and the capture-lands animation key on.
 */
export type EventType =
  | "document.queued"
  | "document.reading"
  | "document.filed"
  | "document.error"
  | "document.deleted"
  | "schedule.pending"
  | "subject.created";

export interface DocumentQueuedEvent {
  type: "document.queued";
  document: DocumentSummary;
}

export interface DocumentReadingEvent {
  type: "document.reading";
  documentId: string;
}

export interface DocumentFiledEvent {
  type: "document.filed";
  document: DocumentSummary;
  /** Dates that went straight to Coming up (status `auto`). */
  dates: TimelineEntry[];
  /** Subjects created by this document, if any. */
  newSubjects: Subject[];
  readMs: number;
}

export interface DocumentErrorEvent {
  type: "document.error";
  documentId: string;
  error: string;
}

export interface DocumentDeletedEvent {
  type: "document.deleted";
  documentId: string;
}

export interface SchedulePendingEvent {
  type: "schedule.pending";
  pending: SchedulePending;
}

export interface SubjectCreatedEvent {
  type: "subject.created";
  subject: Subject;
}

export type DejaEvent =
  | DocumentQueuedEvent
  | DocumentReadingEvent
  | DocumentFiledEvent
  | DocumentErrorEvent
  | DocumentDeletedEvent
  | SchedulePendingEvent
  | SubjectCreatedEvent;

// ---------------------------------------------------------------------------
// Tier 2 (only after steps 10 to 13 are green)
// ---------------------------------------------------------------------------

/** POST /api/review { subjectId } */
export interface ReviewSheetResponse {
  subjectId: string;
  subjectName: string;
  /** Each line cites the document it came from. */
  lines: { text: string; documentId: string }[];
  tookMs: number;
}

/** POST /api/flashcards { subjectId?, documentIds? } */
export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  sourceDocumentId: string;
}

export interface FlashcardsResponse {
  cards: Flashcard[];
  sources: Record<string, DocumentSummary>;
}

/** GET /api/timeline.ics returns text/calendar; no JSON shape. */
