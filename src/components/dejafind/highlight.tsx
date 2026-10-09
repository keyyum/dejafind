import type { ReactNode } from "react";
import type { MatchSpan } from "@/lib/api-types";

/** Renders `text` with the [start, end) spans wrapped in <mark>. */
export function Highlight({ text, spans }: { text: string; spans: MatchSpan[] }) {
  const sorted = [...spans].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let at = 0;
  sorted.forEach(([s, e], i) => {
    if (s < at) return;
    if (s > at) out.push(text.slice(at, s));
    out.push(<mark key={i}>{text.slice(s, e)}</mark>);
    at = e;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

const STOP = new Set(["the", "and", "when", "what", "where", "who", "how", "why", "which", "my", "is", "are", "for", "with", "a", "an", "of", "to", "in", "on", "s"]);

/** Spans of every query word (3+ letters) and every exact phrase inside `text`, case-insensitive. */
export function termSpans(text: string, terms: string[]): MatchSpan[] {
  const low = text.toLowerCase();
  const spans: MatchSpan[] = [];
  for (const raw of terms) {
    const t = raw.toLowerCase();
    if (!t) continue;
    let i = low.indexOf(t);
    while (i >= 0) {
      let end = i + t.length;
      // A query word highlights the whole word it starts: "bio" marks "Biology".
      if (/^[\p{L}\p{N}]+$/u.test(t)) while (end < low.length && /[\p{L}\p{N}]/u.test(low[end])) end++;
      spans.push([i, end]);
      i = low.indexOf(t, end);
    }
  }
  return spans;
}

export function queryTerms(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}
