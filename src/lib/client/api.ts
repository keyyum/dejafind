/**
 * Typed fetchers for every `/api/` route. Each returns the shapes in
 * `src/lib/api-types.ts`, or mock data when `USE_MOCK` is on.
 */
import type {
  DatePatch,
  DejaEvent,
  DocumentPatch,
  DocumentResponse,
  DocumentsResponse,
  DocumentSummary,
  EventType,
  ImportResponse,
  OkResponse,
  QuizRequest,
  QuizResponse,
  ScheduleConfirmRequest,
  ScheduleConfirmResponse,
  ScheduleResponse,
  SearchRequest,
  SearchResponse,
  SimilarResponse,
  StatusResponse,
  SubjectsResponse,
  TimelineResponse,
  WordsResponse,
} from "@/lib/api-types";
import * as mock from "@/lib/mock";
import { USE_MOCK } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json", ...init.headers }
        : init?.headers,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

const delay = <T>(value: T, ms = 120) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export function getDocuments(subject?: string | null): Promise<DocumentsResponse> {
  if (USE_MOCK) return delay(mock.mockDocuments(subject));
  const qs = subject && subject !== "all" ? `?subject=${encodeURIComponent(subject)}` : "";
  return request(`/api/documents${qs}`);
}

export function getDocument(id: string): Promise<DocumentResponse> {
  if (USE_MOCK) {
    const doc = mock.mockDocument(id);
    return doc ? delay(doc) : Promise.reject(new ApiError("Not found", 404));
  }
  return request(`/api/documents/${encodeURIComponent(id)}`);
}

export function patchDocument(id: string, patch: DocumentPatch): Promise<DocumentResponse> {
  if (USE_MOCK) {
    mock.mockPatchDocument(id, patch);
    return getDocument(id);
  }
  return request(`/api/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteDocument(id: string): Promise<OkResponse> {
  if (USE_MOCK) {
    mock.mockDeleteDocument(id);
    return delay({ ok: true });
  }
  return request(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function patchDate(id: string, patch: DatePatch): Promise<OkResponse> {
  if (USE_MOCK) {
    mock.mockPatchDate(id, patch.status);
    return delay({ ok: true });
  }
  return request(`/api/dates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getWords(id: string): Promise<WordsResponse> {
  if (USE_MOCK) return Promise.reject(new ApiError("Not available on mock", 404));
  return request(`/api/documents/${encodeURIComponent(id)}/words`);
}

export function getSimilar(id: string): Promise<SimilarResponse> {
  if (USE_MOCK) {
    const doc = mock.mockDocument(id);
    return delay({ results: doc ? mock.mockSearch(doc.tags.join(" ")).results.filter((r) => r.document.id !== id) : [] });
  }
  return request(`/api/documents/${encodeURIComponent(id)}/similar`);
}

export function getSubjects(): Promise<SubjectsResponse> {
  if (USE_MOCK) return delay(mock.mockSubjects());
  return request("/api/subjects");
}

export function getTimeline(limit = 3): Promise<TimelineResponse> {
  if (USE_MOCK) return delay({ entries: mock.mockTimeline().entries.slice(0, limit) });
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return request(`/api/timeline?from=${today}&limit=${limit}`);
}

export function getSchedule(): Promise<ScheduleResponse> {
  if (USE_MOCK) return delay(mock.mockSchedule());
  return request("/api/schedule");
}

export function confirmSchedule(req: ScheduleConfirmRequest): Promise<ScheduleConfirmResponse> {
  if (USE_MOCK) return delay(mock.mockConfirmSchedule(req.confirm));
  return request("/api/schedule", { method: "POST", body: JSON.stringify(req) });
}

export function search(req: SearchRequest): Promise<SearchResponse> {
  if (USE_MOCK) return delay(mock.mockSearch(req.q, req.subjectId), 500);
  return request("/api/search", { method: "POST", body: JSON.stringify(req) });
}

export function quiz(req: QuizRequest): Promise<QuizResponse> {
  if (USE_MOCK) return delay(mock.mockQuiz(), 600);
  return request("/api/quiz", { method: "POST", body: JSON.stringify(req) });
}

export function getStatus(): Promise<StatusResponse> {
  if (USE_MOCK) return delay(mock.mockStatus());
  return request("/api/status");
}

export function importFiles(files: File[] | Blob[], source?: "snap" | "drop"): Promise<ImportResponse> {
  if (USE_MOCK) {
    const documents: DocumentSummary[] = [];
    for (let i = 0; i < files.length; i++) documents.push(simulateCapture(i * 1500));
    return delay({ documents, duplicates: 0 });
  }
  const form = new FormData();
  files.forEach((f, i) =>
    form.append("files", f, f instanceof File ? f.name : `snap-${Date.now()}-${i}.jpg`),
  );
  if (source) form.append("source", source);
  return request("/api/import", { method: "POST", body: form });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const EVENT_TYPES: EventType[] = [
  "document.queued",
  "document.reading",
  "document.filed",
  "document.error",
  "document.deleted",
  "schedule.pending",
  "subject.created",
];

const mockListeners = new Set<(e: DejaEvent) => void>();
const emitMock = (e: DejaEvent) => mockListeners.forEach((fn) => fn(e));

/** Subscribes to `/api/events`. Returns an unsubscribe function. */
export function subscribeEvents(onEvent: (e: DejaEvent) => void): () => void {
  if (USE_MOCK) {
    mockListeners.add(onEvent);
    return () => mockListeners.delete(onEvent);
  }
  const source = new EventSource("/api/events");
  const handler = (msg: MessageEvent<string>) => {
    try {
      const data = JSON.parse(msg.data) as DejaEvent;
      onEvent({ ...data, type: (data.type ?? msg.type) as EventType } as DejaEvent);
    } catch {}
  };
  for (const t of EVENT_TYPES) source.addEventListener(t, handler as EventListener);
  source.onmessage = handler;
  return () => source.close();
}

/** Mock only: plays queued, reading, filed for a fresh capture, like the real pipeline would. */
export function simulateCapture(startDelay = 0): DocumentSummary {
  const { queued, filed, dates } = mock.mockNewCapture();
  setTimeout(() => emitMock({ type: "document.queued", document: queued }), startDelay);
  setTimeout(() => emitMock({ type: "document.reading", documentId: queued.id }), startDelay + 600);
  setTimeout(() => {
    const done = { ...filed, filedAt: new Date().toISOString() };
    mock.mockFinishCapture(done);
    emitMock({ type: "document.filed", document: done, dates, newSubjects: [], readMs: 4800 });
  }, startDelay + 4200);
  return queued;
}

/** Mock only: a timetable screenshot arrives and asks "Is it yours?". */
export function simulateSchedule() {
  emitMock({ type: "schedule.pending", pending: mock.mockPendingSchedule() });
}
