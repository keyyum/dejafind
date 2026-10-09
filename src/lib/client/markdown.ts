import type { DocumentDetail, DocumentSummary, ReviewSheetResponse, ScheduleEntry } from "@/lib/api-types";
import { longDay } from "./format";

/** Saves `text` as a Markdown file through an object URL. Client-side only. */
export function downloadMarkdown(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Biology quiz moved to Oct 17" -> "biology-quiz-moved-to-oct-17". */
export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "dejafind"
  );
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function reviewMarkdown(r: ReviewSheetResponse, docs: Record<string, DocumentSummary>): string {
  const lines = r.lines.map((l) => {
    const title = docs[l.documentId]?.title;
    return `- ${l.text}${title ? ` (from ${title})` : ""}`;
  });
  return `# ${r.subjectName} reviewer\n\n${lines.join("\n")}\n`;
}

export function documentMarkdown(doc: DocumentDetail): string {
  const out = [`# ${doc.title || "Untitled"}`, "", `- Subject: ${doc.subjectName ?? "Other"}`];
  if (doc.tags.length) out.push(`- Tags: ${doc.tags.join(", ")}`);
  out.push(`- Captured: ${new Date(doc.capturedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`);
  if (doc.summary) out.push("", doc.summary);
  out.push("", "## Dates found", "");
  if (doc.dates.length === 0) out.push("None in this document.");
  for (const d of doc.dates) {
    const state = d.status === "auto" ? "on Coming up" : d.status === "review" ? "needs a look" : "ignored";
    out.push(`- ${longDay(d.isoDate)}: ${d.label} (${state})`);
  }
  out.push("", "## Text it read", "");
  // Keep the model's line breaks: Markdown needs two trailing spaces for a hard break.
  out.push(doc.text.split("\n").map((l) => (l.trim() ? `${l}  ` : "")).join("\n"));
  return `${out.join("\n").trimEnd()}\n`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A weekday × time table: one row per time slot, one column per class day. */
export function scheduleMarkdown(entries: ScheduleEntry[], section: string | null): string {
  const days = [...new Set(entries.map((e) => e.weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const slots = [...new Set(entries.map((e) => `${e.start}–${e.end}`))].sort();
  const head = `| Time | ${days.map((d) => DAYS[d]).join(" | ")} |`;
  const rule = `| --- | ${days.map(() => "---").join(" | ")} |`;
  const rows = slots.map((slot) => {
    const cells = days.map((d) => {
      const here = entries.filter((e) => e.weekday === d && `${e.start}–${e.end}` === slot);
      return here.map((e) => cell(e.room ? `${e.subjectName} (${e.room})` : e.subjectName)).join("<br>");
    });
    return `| ${slot} | ${cells.join(" | ")} |`;
  });
  return `# Class schedule${section ? ` · ${section}` : ""}\n\n${[head, rule, ...rows].join("\n")}\n`;
}
