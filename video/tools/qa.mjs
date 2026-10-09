// Measures a finished video: streams, loudness, per-second RMS, VO onset vs caption start,
// and a 12-frame contact sheet.   node video/tools/qa.mjs video/dejafind-demo.mp4 demo
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const FF = "/opt/homebrew/bin/ffmpeg";
const ROOT = new URL("../../", import.meta.url).pathname;
const [, , rel = "video/dejafind-demo.mp4", tag = "demo"] = process.argv;
const v = ROOT + rel;
const err = (args) => String(spawnSync(FF, ["-hide_banner", "-nostats", ...args], { maxBuffer: 1 << 26 }).stderr);
console.log("## streams\n" + execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration", "-of", "compact", v]).toString());
const eb = err(["-i", v, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
const sum = eb.slice(eb.lastIndexOf("Summary"));
console.log("## loudness\nintegrated " + sum.match(/I:\s+(-?[\d.]+) LUFS/)[1] + " LUFS · true peak " + sum.match(/Peak:\s+(-?[\d.]+) dBFS/)[1] + " dBTP · LRA " + sum.match(/LRA:\s+(-?[\d.]+) LU/)[1] + " LU");
const rms = err(["-i", v, "-vn", "-af", "aresample=48000,asetnsamples=n=48000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"]);
const vals = [...rms.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => m[1]);
console.log("## RMS dBFS per second\n" + vals.map((x, i) => `${String(i).padStart(2)}s ${x === "-inf" ? "-inf" : (+x).toFixed(1)}`).join("  ").replace(/((?:\S+ \S+\s+){6})/g, "$1\n"));
// VO onsets: detect speech starts in the voice stem; compare with caption / headline starts
const stem = `${ROOT}video/audio/${tag}-vo-norm.wav`;
const sd = err(["-i", stem, "-af", "silencedetect=n=-40dB:d=0.12", "-f", "null", "-"]);
const onsets = [0, ...[...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1])].filter((x, i) => i > 0 || !sd.includes("silence_start: 0"));
const cues = JSON.parse(readFileSync(`${ROOT}video/audio/${tag === "demo" ? "cues" : tag + "-cues"}.json`, "utf8"));
const html = readFileSync(`${ROOT}video/hf/${tag === "demo" ? "index.html" : tag + "/index.html"}`, "utf8");
const capStarts = [...html.matchAll(/class="(?:cap|sub2) clip" data-start="([\d.]+)"/g)].map((m) => +m[1]);
console.log("## VO onset vs caption (ms)");
let worst = 0;
for (const c of cues.vo) {
  const on = onsets.reduce((b, x) => (Math.abs(x - c.t) < Math.abs(b - c.t) ? x : b), 1e9);
  const cap = capStarts.reduce((b, x) => (Math.abs(x - c.t) < Math.abs(b - c.t) ? x : b), 1e9);
  const viaHeadline = Math.abs(cap - c.t) > 0.5;
  const d = Math.round((on - (viaHeadline ? c.t : cap)) * 1000);
  worst = Math.max(worst, Math.abs(d));
  console.log(`${c.id.padEnd(5)} voice ${on.toFixed(2)}s  ${viaHeadline ? "headline" : "caption "} ${(viaHeadline ? c.t : cap).toFixed(2)}s  Δ ${d} ms`);
}
console.log(`worst |Δ| ${worst} ms`);
const sheet = `${ROOT}video/takes/sheet/${tag}-12.jpg`;
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", v]).toString());
execFileSync(FF, ["-v", "error", "-y", "-i", v, "-vf", `fps=12/${dur.toFixed(2)},scale=640:-1,tile=4x3`, "-frames:v", "1", sheet]);
console.log("## sheet " + sheet);
