import type { DocumentSummary, DocType } from "@/lib/api-types";

const at = (isoDate: string) => new Date(`${isoDate}T12:00:00`);

/** "Fri 17" for the Coming up strip. */
export function shortDay(isoDate: string): string {
  const d = at(isoDate);
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
}

/** "Oct 17". */
export function monthDay(isoDate: string): string {
  return at(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Fri, Oct 17". */
export function longDay(isoDate: string): string {
  return at(isoDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "Yesterday", "Today", or "Oct 7", from a full timestamp. */
export function relativeDay(timestamp: string, now = Date.now()): string {
  const d = new Date(timestamp);
  const day = (x: Date) => x.toDateString();
  if (day(d) === day(new Date(now))) return "Today";
  if (day(d) === day(new Date(now - 86_400_000))) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const KIND_WORD: Record<DocType, string> = {
  chat: "Screenshot",
  slide: "Slide",
  whiteboard: "Whiteboard photo",
  handout: "Handout",
  schedule: "Schedule",
  pdf: "PDF",
  other: "File",
};

export function kindWord(doc: Pick<DocumentSummary, "docType" | "kind">): string {
  if (doc.kind === "pdf" && doc.docType !== "schedule") return "PDF";
  return KIND_WORD[doc.docType] ?? "File";
}

/** Screenshots keep their rounded corners; photos and pages sit square like paper. */
export function isScreenshot(doc: Pick<DocumentSummary, "docType" | "kind">): boolean {
  return doc.kind === "image" && (doc.docType === "chat" || doc.docType === "schedule");
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
