import { connection } from "next/server";
import { listTimeline } from "@/server/documents";

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function isoDateToIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function nowAsIcsTimestamp(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** GET /api/timeline.ics: Coming Up (auto dates only) as a calendar subscribers can import. */
export async function GET() {
  await connection(); // timeline changes at runtime; opt out of static prerendering

  const entries = listTimeline(null, 1000, false);
  const stamp = nowAsIcsTimestamp();

  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DejaFind//Timeline//EN", "CALSCALE:GREGORIAN"];

  for (const entry of entries) {
    const summary = entry.subjectName ? `${entry.label} (${entry.subjectName})` : entry.label;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.id}@dejafind.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${isoDateToIcsDate(entry.isoDate)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(entry.documentTitle)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=dejafind-timeline.ics",
    },
  });
}
