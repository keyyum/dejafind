import * as chrono from "chrono-node";
import { getDb } from "@/server/db";
import { newId } from "@/server/ids";

export interface ReaderDateInput {
  isoDate: string;
  label: string;
  span: string;
}

function toLocalDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function withinOneDay(isoA: string, isoB: string): boolean {
  const a = new Date(`${isoA}T00:00:00`).getTime();
  const b = new Date(`${isoB}T00:00:00`).getTime();
  return Math.abs(a - b) <= 24 * 60 * 60 * 1000;
}

/** Cross-checks the reader's dates against chrono-node, anchored to `capturedAt`. Step 3. */
export function resolveDates(
  documentId: string,
  text: string,
  capturedAt: string,
  docType: string | null,
  subjectId: string | null,
  modelDates: ReaderDateInput[]
): void {
  const db = getDb();
  const refDate = new Date(capturedAt);
  const chronoResults = chrono.parse(text, refDate, { forwardDate: true });
  const chronoFound = chronoResults.map((r) => toLocalDateOnly(r.start.date()));
  const ignored = docType === "other" || subjectId === null;

  const insert = db.prepare(
    `INSERT INTO dates (id, document_id, iso_date, label, confidence, span, status) VALUES (?,?,?,?,?,?,?)`
  );

  if (modelDates.length > 0) {
    for (const d of modelDates) {
      if (ignored) {
        insert.run(newId(), documentId, d.isoDate, d.label, 0.5, d.span, "ignored");
        continue;
      }
      const agrees = chronoFound.some((c) => withinOneDay(c, d.isoDate));
      insert.run(newId(), documentId, d.isoDate, d.label, agrees ? 1 : 0.5, d.span, agrees ? "auto" : "review");
    }
    return;
  }

  // Defense in depth: the model sometimes leaves `dates` empty even when the text
  // clearly names one. Fall back to chrono's own finds as `review` (unconfirmed by
  // the model) rather than silently filing nothing.
  for (const r of chronoResults) {
    const isoDate = toLocalDateOnly(r.start.date());
    const label = ignored ? r.text : `Mentioned: ${r.text}`;
    insert.run(newId(), documentId, isoDate, label, 0.5, r.text, ignored ? "ignored" : "review");
  }
}
