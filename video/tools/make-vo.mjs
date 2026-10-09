// Synthesises the voice-over phrase by phrase with macOS `say` (offline), so every caption
// is timed to its own audio. Writes video/audio/vo/*.wav and video/audio/vo-durations.json.
//   node video/tools/make-vo.mjs [voice] [rate]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
const A = new URL("../audio/", import.meta.url).pathname;
const voice = process.argv[2] ?? "Daniel", rate = process.argv[3] ?? "170";
const beats = JSON.parse(readFileSync(A + "vo.json", "utf8"));
mkdirSync(A + "vo", { recursive: true });
const out = [];
beats.forEach((b, bi) => b.phrases.forEach((p, pi) => {
  const id = `${bi}-${pi}`;
  const aiff = `${A}vo/${id}.aiff`, wav = `${A}vo/${id}.wav`;
  // A founder recording at ~/Music/dejafind-vo/<id>.wav wins over the synthetic voice.
  const human = `${process.env.HOME}/Music/dejafind-vo/${id}.wav`;
  const edge = `${A}vo-edge/${id}.mp3`; // edge-tts voice (tts_edge.py), the founder's chosen voice
  const trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse";
  if (existsSync(human)) execFileSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-y", "-i", human, "-ar", "48000", "-ac", "1", wav]);
  else if (existsSync(edge)) execFileSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-y", "-i", edge, "-af", trim, "-ar", "48000", "-ac", "1", wav]);
  else {
    execFileSync("say", ["-v", voice, "-r", rate, "-o", aiff, p.tts]);
    // trim leading/trailing silence so phrase timing is tight
    execFileSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-y", "-i", aiff, "-af",
      "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
      "-ar", "48000", "-ac", "1", wav]);
  }
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
  out.push({ id, beat: b.beat, cap: p.cap, dur: +dur.toFixed(3) });
}));
writeFileSync(A + "vo-durations.json", JSON.stringify(out, null, 2));
console.log(out.map((o) => `${o.id} ${o.dur}s ${o.cap.replace(/<[^>]+>/g, "")}`).join("\n"));
console.log("total speech", out.reduce((a, o) => a + o.dur, 0).toFixed(2), "s");
