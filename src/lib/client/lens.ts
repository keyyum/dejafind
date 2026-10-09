import type { WordBox } from "@/lib/api-types";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const tokens = (line: string) => new Set(line.split(/\s+/).map(norm).filter(Boolean));

/** Groups word boxes into visual rows (indexes), top to bottom. */
export function rowsOf(words: WordBox[]): number[][] {
  const order = words.map((_, i) => i).sort((a, b) => words[a].y + words[a].height / 2 - (words[b].y + words[b].height / 2));
  const rows: { mid: number; band: number; ids: number[] }[] = [];
  for (const i of order) {
    const w = words[i];
    const mid = w.y + w.height / 2;
    const row = rows.find((r) => Math.abs(r.mid - mid) <= r.band);
    if (row) row.ids.push(i);
    else rows.push({ mid, band: w.height * 0.6, ids: [i] });
  }
  return rows.map((r) => r.ids.sort((a, b) => words[a].x - words[b].x));
}

/** The text line that best matches the row a tapped word sits in, or -1. */
export function lineForWord(index: number, words: WordBox[], rows: number[][], lines: string[]): { line: number; row: number[] } {
  const row = rows.find((r) => r.includes(index)) ?? [index];
  const rowTokens = row.map((i) => norm(words[i].text)).filter(Boolean);
  let best = -1;
  let bestScore = 0;
  lines.forEach((line, li) => {
    const t = tokens(line);
    const score = rowTokens.filter((w) => t.has(w)).length;
    if (score > bestScore) {
      best = li;
      bestScore = score;
    }
  });
  return { line: best, row };
}

/** Word indexes of every row that mostly appears in `line`. */
export function wordsForLine(line: string, words: WordBox[], rows: number[][]): Set<number> {
  const t = tokens(line);
  const lit = new Set<number>();
  for (const row of rows) {
    const rowTokens = row.map((i) => norm(words[i].text)).filter(Boolean);
    if (!rowTokens.length) continue;
    const hits = rowTokens.filter((w) => t.has(w)).length;
    if (hits / rowTokens.length >= 0.6) row.forEach((i) => lit.add(i));
  }
  return lit;
}
