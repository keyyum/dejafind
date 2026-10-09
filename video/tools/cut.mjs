// Cuts raw takes into the clips the HyperFrames composition plays.
// Usage: node cut.mjs <take-suffix>   e.g. node cut.mjs 1  → reads watch-1.mp4, snap-1.mp4, …
// Crops come from element rects the recorder saved (CSS px; takes are 2x), so a UI shift
// between takes moves the crop with it. Waits for the local models are cut out: the clip
// joins "tile appears" to "tile filed" with a short crossfade, and the video says so.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
const require_fs = { writeFileSync };

const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const ROOT = new URL("../../", import.meta.url).pathname;
const T = ROOT + "video/takes/";
const OUT = ROOT + "video/hf/assets/clips/";
mkdirSync(OUT, { recursive: true });
const take = process.argv[2] ?? "1";
const only = process.argv[3];

const load = (beat, tk = take) => {
  const f = `${T}${beat}-${tk}.marks.json`;
  if (!existsSync(f)) throw new Error(`missing ${f}`);
  return JSON.parse(readFileSync(f, "utf8"));
};
const even = (n) => Math.round(n / 2) * 2;
/** CSS-px rect → ffmpeg crop on the 2x take. */
const crop = (r) => `crop=${even(r.w * 2)}:${even(r.h * 2)}:${even(r.x * 2)}:${even(r.y * 2)}`;
const pad = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Segments [{from, to}] of one take → one clip, crossfading 0.35 s between segments. Returns seconds. */
function cut(name, src, segs, rect, width) {
  const w = even(width), h = even((width * rect.h) / rect.w);
  const args = ["-v", "error", "-y"];
  for (const s of segs) args.push("-ss", String(Math.max(0, s.from)), "-to", String(s.to), "-i", src);
  const XF = 0.35;
  let fc = segs.map((_, i) => `[${i}:v]${crop(rect)},scale=${w}:${h}:flags=lanczos,fps=30,format=yuv420p,setpts=PTS-STARTPTS[s${i}]`).join(";");
  let last = "s0";
  let acc = segs[0].to - Math.max(0, segs[0].from);
  for (let i = 1; i < segs.length; i++) {
    fc += `;[${last}][s${i}]xfade=transition=fade:duration=${XF}:offset=${(acc - XF).toFixed(3)}[x${i}]`;
    last = `x${i}`;
    acc += segs[i].to - Math.max(0, segs[i].from) - XF;
  }
  // Hold the last frame for 6 s so a composition slot longer than the clip never shows an empty card.
  fc += `;[${last}]tpad=stop_mode=clone:stop_duration=6[out]`;
  args.push("-filter_complex", fc, "-map", "[out]", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}${name}.mp4`);
  execFileSync(FFMPEG, args);
  console.log(`${name}.mp4  ${w}×${h}  ${acc.toFixed(2)} s`);
  return { name, seconds: +acc.toFixed(3), cuts: segs.length - 1 };
}

/** Library region: the Coming up strip down through the first two columns of tiles.
 *  Anchored on the strip's rect; column geometry measured from the takes (285 px tiles, 28 px gap). */
function libRect(m) {
  const cu = m.rects.comingUp;
  return { x: cu.x - 16, y: cu.y - 2, w: 636, h: 390 };
}

const jobs = {
  watch() {
    const m = load("watch");
    const src = `${T}watch-${take}.mp4`;
    cut("watch-lib", src, [{ from: m.drop + 0.2, to: m.drop + 3.6 }, { from: m.idle - 0.4, to: m.idle + 6.2 }], libRect(m), 1250);
    if (m.rects.toast) cut("watch-toast", src, [{ from: m.idle + 0.2, to: m.idle + 5.5 }], pad(m.rects.toast, 6), 900);
  },
  snap() {
    const m = load("snap");
    const src = `${T}snap-${take}.mp4`;
    const d = m.rects.dialog;
    // Viewfinder only: drop the dialog header (its camera picker shows the device label,
    // which for the fake camera is a local file path) and the "Already in DéjàFind" strip.
    const top = 84;
    cut("snap-sheet", src, [{ from: m.open + 0.2, to: m.shutter + 1.0 }], { x: d.x, y: d.y + top, w: d.w, h: Math.round(d.h * 0.71) - top }, 1280);
    cut("snap-lib", src, [{ from: m.shutter + 1.0, to: m.shutter + 2.4 }, { from: m.idle - 0.2, to: m.idle + 2.7 }], libRect(m), 1250);
  },
  find() {
    const m = load("find");
    const src = `${T}find-${take}.mp4`;
    // The rounded search pill around the input (input rect is the bare text field).
    const i = m.rects.input;
    cut("find-type", src, [{ from: m.type - 0.3, to: m.enter + 1.0 }], { x: i.x - 71, y: i.y - 27, w: 928, h: 84 }, 1500);
    cut("find-answer", src, [{ from: m.answer - 0.5, to: m.answer + 3.4 }], pad(m.rects.answer, 18), 1600);
  },
  quiz() {
    const m = load("quiz");
    const src = `${T}quiz-${take}.mp4`;
    const r = union(m.rects.question, m.rects.graded ?? m.rects.question2);
    cut("quiz", src, [{ from: m.questions - 0.4, to: m.pick + 4.2 }], pad(r, 22), 880);
  },
  drop() {
    const m = load("drop");
    // The drop take shares the Library layout with the snap take; reuse its rects if missing.
    if (!m.rects.comingUp) m.rects = load("snap").rects;
    const src = `${T}drop-${take}.mp4`;
    cut("drop-lib", src, [{ from: m.drop + 0.6, to: m.drop + 2.2 }, { from: m.idle - 0.2, to: m.idle + 2.8 }], libRect(m), 1250);
  },
};
const FULL = { x: 0, y: 0, w: 1536, h: 864 };
// lvl2: "the night before" cut. Writes the real wait of each clip to lvl2-real.json for its label.
jobs.lvl2 = () => {
  const sc = load("schedule"), d = load("drop"), w = load("watch"), sn = load("snap");
  const real = {};
  cut("l2-sched", `${T}schedule-${take}.mp4`, [{ from: sc.idle - 0.3, to: sc.useit + 2.6 }], { x: 140, y: 186, w: 1256, h: 290 }, 1500);
  real["l2-sched"] = +(sc.idle - sc.drop).toFixed(1);
  const dm = d.rects.comingUp ? d : { ...d, rects: sn.rects };
  cut("l2-mitosis", `${T}drop-${take}.mp4`, [{ from: d.drop + 0.5, to: d.drop + 1.6 }, { from: d.idle - 0.2, to: d.idle + 1.5 }], libRect(dm), 1250);
  real["l2-mitosis"] = +(d.idle - d.drop).toFixed(1);
  cut("l2-chip", `${T}watch-${take}.mp4`, [{ from: w.idle - 0.3, to: w.idle + 1.9 }], libRect(w), 1250);
  real["l2-snap"] = +(sn.idle - sn.shutter).toFixed(1);
  const rv = load("review", "3");
  cut("l2-review", `${T}review-3.mp4`, [{ from: rv.ready - 0.3, to: rv.ready + 2.6 }], { x: 370, y: 95, w: 796, h: 605 }, 1100);
  real["l2-review"] = +(rv.ready - rv.open).toFixed(1);
  const a2 = load("ask2", "3"), i = a2.rects.input;
  cut("l2-ask2-type", `${T}ask2-3.mp4`, [{ from: a2.type - 0.1, to: a2.enter + 0.4 }], { x: i.x - 71, y: i.y - 27, w: 928, h: 84 }, 1500);
  cut("l2-ask2-answer", `${T}ask2-3.mp4`, [{ from: a2.answer - 0.2, to: a2.answer + 2.6 }], pad(a2.rects.answer, 18), 1600);
  real["l2-ask2"] = +(a2.answer - a2.enter).toFixed(1);
  const f = load("find");
  real["l2-find"] = +(f.answer - f.enter).toFixed(1);
  writeFileSync(`${ROOT}video/audio/lvl2-real.json`, JSON.stringify(real, null, 1));
  console.log(real);
};

// v2: the tighter 55 s cut (no hold over ~2.5 s without motion).
jobs.v2 = () => {
  const w = load("watch"), sn = load("snap"), f = load("find"), q = load("quiz");
  cut("v2-watch", `${T}watch-${take}.mp4`, [{ from: w.drop + 0.2, to: w.drop + 2.2 }, { from: w.idle - 0.3, to: w.idle + 3.9 }], libRect(w), 1250);
  cut("v2-snaplib", `${T}snap-${take}.mp4`, [{ from: sn.shutter + 1.0, to: sn.shutter + 2.0 }, { from: sn.idle - 0.3, to: sn.idle + 2.8 }], libRect(sn), 1250);
  const i = f.rects.input;
  cut("v2-type", `${T}find-${take}.mp4`, [{ from: f.type - 0.1, to: f.enter + 0.5 }], { x: i.x - 71, y: i.y - 27, w: 928, h: 84 }, 1500);
  cut("v2-answer", `${T}find-${take}.mp4`, [{ from: f.answer - 0.3, to: f.answer + 3.0 }], pad(f.rects.answer, 18), 1600);
  const r = union(q.rects.question, q.rects.graded ?? q.rects.question2);
  cut("v2-quiz", `${T}quiz-${take}.mp4`, [{ from: q.questions - 0.2, to: q.questions + 0.8 }, { from: q.pick - 0.15, to: q.pick + 3.8 }], pad(r, 22), 880);
};
// The 90-second backup: full-frame footage of the whole live-demo script.
jobs.backup = () => {
  const { writeFileSync } = require_fs;
  const sc = load("schedule"), w = load("watch"), sn = load("snap"), f = load("find"), d = load("drop"), q = load("quiz");
  const src = (b) => `${T}${b}-${take}.mp4`;
  const out = [
    cut("b1-library", src("schedule"), [{ from: 0.3, to: sc.drop }], FULL, 1920),
    cut("b2-schedule", src("schedule"), [{ from: sc.drop, to: sc.drop + 2.2 }, { from: sc.idle - 0.4, to: sc.useit + 5.5 }], FULL, 1920),
    cut("b3-watch", src("watch"), [{ from: w.drop - 0.3, to: w.drop + 3.4 }, { from: w.idle - 0.4, to: w.idle + 8.5 }], FULL, 1920),
    cut("b4-snap", src("snap"), [{ from: sn.open - 0.3, to: sn.shutter + 2.4 }, { from: sn.idle - 0.4, to: sn.idle + 7.0 }], FULL, 1920),
    cut("b5-find", src("find"), [{ from: f.type - 0.4, to: f.enter + 1.2 }, { from: f.answer - 0.4, to: f.open }, { from: f.open, to: f.open + 7.5 }], FULL, 1920),
    cut("b6-drop", src("drop"), [{ from: d.drop - 0.3, to: d.drop + 2.4 }, { from: d.idle - 0.4, to: d.idle + 5.5 }], FULL, 1920),
    cut("b7-quiz", src("quiz"), [{ from: q.questions - 0.4, to: q.pick + 7.5 }], FULL, 1920),
  ];
  writeFileSync(`${OUT}backup-manifest.json`, JSON.stringify(out, null, 2));
};

for (const [k, fn] of Object.entries(jobs)) {
  if (only ? only !== k : k === "backup" || k === "v2" || k === "lvl2") continue;
  try { fn(); } catch (e) { console.log(`skip ${k}: ${e.message}`); }
}
