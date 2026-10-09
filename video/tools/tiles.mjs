// Screenshots the Library and crops each document tile (thumb + title + subject) into
// video/hf/assets/tiles/ for the staggered "filed by subject" beat.
import { connect, setup, goto, shot, evaluate } from "./cdp.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const ROOT = new URL("../../", import.meta.url).pathname;
const OUT = ROOT + "video/hf/assets/tiles/";
mkdirSync(OUT, { recursive: true });
const cdp = await connect();
await setup(cdp);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 2200, deviceScaleFactor: 2, mobile: false });
await goto(cdp, "http://localhost:3103/", 3500);
const png = ROOT + "video/takes/library-tiles.png";
await shot(cdp, png);
const tiles = await evaluate(cdp, `[...document.querySelectorAll('main a[href^="/d/"]')].map(a => { const r = a.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: a.innerText.replace(/\\s+/g,' ').trim().slice(0,60) }; }).filter(r => r.w > 200 && r.y + r.h < 2200)`);
const meta = [];
tiles.forEach((r, i) => {
  const f = `tile-${i}.png`;
  execFileSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-y", "-i", png, "-vf",
    `crop=${Math.round(r.w * 2)}:${Math.round(r.h * 2)}:${Math.round(r.x * 2)}:${Math.round(r.y * 2)}`, OUT + f]);
  meta.push({ f, w: Math.round(r.w * 2), h: Math.round(r.h * 2), t: r.t });
});
writeFileSync(OUT + "tiles.json", JSON.stringify(meta, null, 2));
console.log(meta.map((m) => `${m.f} ${m.w}x${m.h} ${m.t}`).join("\n"));
process.exit(0);
