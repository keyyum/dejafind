// Re-inlines public/brand/mark-mono.svg into every <svg data-mark> in the deck, the video
// and the backup generator, so a redrawn mark drops in without recomposing anything.
//   node video/tools/sync-mark.mjs
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname;
const src = readFileSync(`${ROOT}public/brand/mark-mono.svg`, "utf8");
const viewBox = src.match(/viewBox="([^"]+)"/)[1];
const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim().replace(/\s*\n\s*/g, "");
const files = ["pitch/index.html", "video/hf/index.html", "video/tools/make-backup.mjs"];
for (const f of files) {
  const path = ROOT + f;
  const before = readFileSync(path, "utf8");
  let n = 0;
  const after = before.replace(/<svg class="([^"]*)" data-mark viewBox="[^"]*"([^>]*)>[\s\S]*?<\/svg>/g, (_, cls, rest) => {
    n++;
    return `<svg class="${cls}" data-mark viewBox="${viewBox}"${rest}>${inner}</svg>`;
  });
  writeFileSync(path, after);
  console.log(`${f}: ${n} mark(s)${after === before ? " (unchanged)" : " updated"}`);
}
