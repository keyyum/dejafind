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

const MONTH_NAME_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
const FOUR_DIGIT_YEAR_RE = /\b\d{4}\b/;

/** chrono can mis-parse a fraction or formula (e.g. "½ a t²" -> "1/2 at2" -> Jan 2)
 * as a numeric date. Only trust a chrono-only hit when its own matched text names a
 * month or a four-digit year — real dates almost always have one. */
function looksLikeRealDate(sourceText: string): boolean {
  return MONTH_NAME_RE.test(sourceText) || FOUR_DIGIT_YEAR_RE.test(sourceText);
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
  // the model) rather than silently filing nothing — but only when chrono's own
  // matched text looks like an actual date, not a fraction or formula it misread
  // as one (e.g. "½ a t²" -> "1/2 at2" -> a bogus January 2).
  for (const r of chronoResults) {
    if (!looksLikeRealDate(r.text)) continue;
    const isoDate = toLocalDateOnly(r.start.date());
    const label = ignored ? r.text : `Mentioned: ${r.text}`;
    insert.run(newId(), documentId, isoDate, label, 0.5, r.text, ignored ? "ignored" : "review");
  }
}
