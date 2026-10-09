// Writes video/hf/backup.html: the 90-second stage fallback, full-frame footage of the
// live-demo script with one caption per step. Reads the clip lengths cut.mjs measured.
//   node video/tools/make-backup.mjs
import { readFileSync, writeFileSync } from "node:fs";

const HF = new URL("../hf/", import.meta.url).pathname;
const clips = JSON.parse(readFileSync(`${HF}assets/clips/backup-manifest.json`, "utf8"));
const CAPS = {
  "b1-library": ["The Library. Top right: <b>On this laptop · nothing sent.</b>"],
  "b2-schedule": ["Screenshot the class schedule. <b>Use it</b>: six subjects."],
  "b3-watch": ["A GC screenshot lands, read and <b>filed under Biology</b>.", "<b>Oct 17</b> lifts into Coming up."],
  "b4-snap": ["Snap a whiteboard with the camera.", "It lands flat, <b>filed by subject</b>."],
  "b5-find": ["Ask: <b>when’s my bio quiz?</b>", "The answer <b>cites the screenshot</b> it came from.", "The Document view shows <b>what it read</b>."],
  "b6-drop": ["Drop one more file. <b>Still read on this laptop.</b>"],
  "b-status": ["<b>0 requests out.</b> Three local models."],
  "b7-quiz": ["Quiz me on Biology: <b>graded</b>, with the source shown."],
};
const order = ["b1-library", "b2-schedule", "b3-watch", "b4-snap", "b5-find", "b6-drop", "b-status", "b7-quiz"];
const byName = Object.fromEntries(clips.map((c) => [c.name, c]));
byName["b-status"] = { name: "b-status", seconds: 5.5, cuts: 0, still: true };

const XF = 0.3; // visual overlap between steps
let t = 0;
const media = [], caps = [], cutnotes = [];
for (const name of order) {
  const c = byName[name];
  const start = +t.toFixed(3);
  if (c.still) {
    media.push(`<img id="m-${name}" class="full clip" src="assets/stills/b-status.jpg" alt="" data-start="${start}" data-duration="${c.seconds}" data-track-index="1" />`);
  } else {
    media.push(`<video id="m-${name}" class="full clip" src="assets/clips/${name}.mp4" muted playsinline data-start="${start}" data-duration="${c.seconds}" data-track-index="${1 + (order.indexOf(name) % 2)}"></video>`);
  }
  const lines = CAPS[name];
  const per = c.seconds / lines.length;
  lines.forEach((html, i) => {
    const cs = +(start + per * i + 0.15).toFixed(3);
    caps.push({ id: `c-${name}-${i}`, start: cs, dur: +(per - 0.3).toFixed(3), html });
  });
  if (c.cuts > 0) cutnotes.push({ start: +(start + 0.4).toFixed(3) });
  t += c.seconds - XF;
}
const endStart = +(t + XF).toFixed(3);
const total = +(endStart + 4.5).toFixed(3);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>DéjàFind — 90 s stage backup</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: block; src: url("assets/fonts/figtree-latin.woff2") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
      @font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: block; src: url("assets/fonts/figtree-latin-ext.woff2") format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #fcfcfa; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Figtree", sans-serif; color: #1f1f1d; -webkit-font-smoothing: antialiased; }
      .full { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .cap { position: absolute; left: 0; right: 0; bottom: 48px; display: flex; justify-content: center; }
      .cap span { display: block; white-space: nowrap; background: rgba(31, 31, 29, 0.9); color: #fcfcfa; font-size: 48px; font-weight: 500; line-height: 1; padding: 20px 36px 22px; border-radius: 16px; letter-spacing: -0.01em; }
      .cap b { font-weight: 600; color: #ffd9c2; }
      .cutnote { position: absolute; right: 40px; top: 36px; font-size: 24px; font-weight: 500; color: #fcfcfa; background: rgba(31, 31, 29, 0.78); border-radius: 999px; padding: 10px 20px; }
      .ink { position: absolute; inset: 0; background: #1f1f1d; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; }
      .endrow { display: flex; align-items: center; gap: 34px; color: #fcfcfa; }
      .endrow svg { width: 140px; height: 140px; }
      .endrow span { font-size: 140px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; }
      .ink p { color: #fcfcfa; font-size: 60px; font-weight: 600; letter-spacing: -0.02em; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="backup" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
      ${media.join("\n      ")}
${cutnotes.map((c, i) => `      <div id="cut-${i}" class="cutnote clip" data-start="${c.start}" data-duration="1.4" data-track-index="6">Model wait cut</div>`).join("\n")}
${caps.map((c) => `      <div id="${c.id}" class="cap clip" data-start="${c.start}" data-duration="${c.dur}" data-track-index="8"><span>${c.html}</span></div>`).join("\n")}
      <div id="end" class="ink clip" data-start="${endStart}" data-duration="4.5" data-track-index="9">
        <div class="endrow"><svg class="mk" data-mark viewBox="0 0 64 64" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M18 8L36 8L44 22L50 14L50 52A4 4 0 0 1 46 56L18 56A4 4 0 0 1 14 52L14 12A4 4 0 0 1 18 8Z M23.5 36H40.5A2.5 2.5 0 0 1 43 38.5A2.5 2.5 0 0 1 40.5 41H23.5A2.5 2.5 0 0 1 21 38.5A2.5 2.5 0 0 1 23.5 36Z"/></svg><span>DéjàFind</span></div>
        <p>Find what you already saw.</p>
      </div>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      document.querySelectorAll(".cap span").forEach((el) => {
        const host = el.parentElement, s = parseFloat(host.dataset.start), d = parseFloat(host.dataset.duration);
        tl.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, s);
        tl.to(el, { opacity: 0, duration: 0.2 }, s + d - 0.22);
      });
      document.querySelectorAll("video.full, img.full").forEach((el, i) => {
        if (i === 0) return;
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: ${XF}, ease: "none" }, parseFloat(el.dataset.start));
      });
      tl.fromTo("#end .endrow, #end p", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.25, ease: "power3.out" }, ${endStart + 0.2});
      window.__timelines["backup"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(`${HF}backup.html`, html);
console.log(`backup.html: ${total} s, ${order.length} steps`);
