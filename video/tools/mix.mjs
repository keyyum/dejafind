// Mixes the demo soundtrack and muxes it onto a render.
//   voice: edge-tts phrases (make-vo.mjs), placed from video/audio/cues.json, normalised to -19 LUFS
//   music: "Newer Wave" by Kevin MacLeod (CC BY 4.0), ducked under the voice with a sidechain compressor
//   sfx:   the Pawi kit's Kenney CC0 and self-synthesised effects, placed from the same cues
//   master: two-pass loudnorm to -16 LUFS integrated, true peak -2.5 dBTP; AAC 48 kHz stereo
//   node video/tools/mix.mjs video/dejafind-demo.mp4 [cues.json]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, renameSync } from "node:fs";

const FF = "/opt/homebrew/bin/ffmpeg";
const ROOT = new URL("../../", import.meta.url).pathname;
const A = ROOT + "video/audio/";
const KIT = `${process.env.HOME}/Desktop/Pawi-Reset-Lanes/video/v2/audio/`;
const ff = (...args) => execFileSync(FF, ["-v", "error", "-y", ...args], { maxBuffer: 1 << 26 });
const video = ROOT + (process.argv[2] ?? "video/dejafind-demo.mp4");
const cues = JSON.parse(readFileSync(process.argv[3] ? ROOT + process.argv[3] : A + "cues.json", "utf8"));
const total = cues.total;
const tag = cues.tag ?? "demo";
const MUSIC_LUFS = process.env.MUSIC_LUFS ?? "22"; // music bed level before the master (positive number, LUFS below 0)

const SFX = {
  whoosh1: ["whoosh1", 0.34], whoosh2: ["whoosh2", 0.34], whoosh3: ["whoosh3", 0.34], "whoosh3-soft": ["whoosh3", 0.18],
  key1: ["key1", 0.26], key2: ["key2", 0.26], key3: ["key3", 0.26], key4: ["key4", 0.26],
  click: ["click", 0.4], click2: ["click2", 0.3], click3: ["click3", 0.38],
  chime: ["chime", 0.38], tick: ["tick", 0.4], pop: ["pop", 0.42], "riser-tail": ["riser", 0.32],
};

function stem(out, items) {
  if (!items.length) { ff("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${total}`, out); return; }
  const args = [];
  items.forEach((it) => { if (it.ss) args.push("-ss", String(it.ss)); args.push("-i", it.file); });
  const fc = items.map((it, i) => `[${i}]aresample=48000,aformat=channel_layouts=stereo,volume=${it.gain ?? 1},adelay=${Math.round(it.t * 1000)}:all=1[a${i}]`).join(";")
    + ";" + items.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${items.length}:normalize=0,apad=whole_dur=${total},atrim=0:${total}[o]`;
  ff(...args, "-filter_complex", fc, "-map", "[o]", "-ar", "48000", out);
}

// voice
stem(`${A}${tag}-vo-stem.wav`, (cues.vo ?? []).map((v) => ({ file: `${A}vo/${v.id}.wav`, t: v.t })));
// effects; the riser is cut to its last 1.4 s so it peaks into the end card
stem(`${A}${tag}-sfx-stem.wav`, cues.sfx.map((c) => {
  const [f, gain] = SFX[c.kind];
  return { file: `${KIT}sfx/${f}.wav`, t: c.t, gain, ss: c.kind === "riser-tail" ? 1.98 : undefined };
}));
// music bed
ff("-i", `${KIT}music/newer-wave.mp3`, "-af",
  `atrim=0:${total},asetpts=N/SR/TB,aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-${MUSIC_LUFS}:TP=-6:LRA=11,afade=t=in:d=1.0,afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8`,
  `${A}${tag}-music.wav`);

const hasVo = (cues.vo ?? []).length > 0;
if (hasVo) ff("-i", `${A}${tag}-vo-stem.wav`, "-af", "loudnorm=I=-19:TP=-3:LRA=7", "-ar", "48000", `${A}${tag}-vo-norm.wav`);
// duck the music under the voice (about -10 dB more while speaking), then sum
const pre = `${A}${tag}-premaster.wav`;
if (hasVo) {
  ff("-i", `${A}${tag}-vo-norm.wav`, "-i", `${A}${tag}-sfx-stem.wav`, "-i", `${A}${tag}-music.wav`, "-filter_complex",
    "[0]asplit=2[v][sc];[2][sc]sidechaincompress=threshold=0.06:ratio=2.6:knee=4:attack=20:release=350:makeup=1[m];[v][1][m]amix=inputs=3:normalize=0[o]",
    "-map", "[o]", "-ar", "48000", pre);
} else {
  ff("-i", `${A}${tag}-sfx-stem.wav`, "-i", `${A}${tag}-music.wav`, "-filter_complex", "[0][1]amix=inputs=2:normalize=0[o]", "-map", "[o]", "-ar", "48000", pre);
}
// two-pass loudnorm to -16 LUFS / -2.5 dBTP
const m = spawnSync(FF, ["-hide_banner", "-nostats", "-i", pre, "-af", "loudnorm=I=-16:TP=-2.0:LRA=11:print_format=json", "-f", "null", "-"], { maxBuffer: 1 << 26 });
const meas = JSON.parse(String(m.stderr ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "{}");
const second = meas.input_i
  ? `loudnorm=I=-16:TP=-2.0:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`
  : "loudnorm=I=-16:TP=-2.0:LRA=11";
ff("-i", pre, "-af", `${second},aresample=192000,alimiter=limit=0.76:level=disabled:attack=1:release=60,aresample=48000`, "-ac", "2", `${A}${tag}-mix.wav`);

const tmp = video.replace(/\.mp4$/, ".mux.mp4");
ff("-i", video, "-i", `${A}${tag}-mix.wav`, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
  "-shortest", "-movflags", "+faststart", tmp);
renameSync(tmp, video);
console.log("muxed", video);
