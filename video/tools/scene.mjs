// Records one demo beat from the real app. Usage: node scene.mjs <beat> <take>
import { copyFileSync } from "node:fs";
import { connect, setup, goto, shot, evaluate, sleep, startRecording, clickSelector, typeText, pressKey, rect } from "./cdp.mjs";
const ROOT = new URL("../../", import.meta.url).pathname;
const T = ROOT + "video/takes/";
const S = ROOT + "data/samples/demo/";
const APP = "http://localhost:3103";
const [, , beat, take = "1"] = process.argv;
const status = async () => (await fetch(APP + "/api/status")).json();
async function waitIdle(maxMs = 180000) {
  const t0 = Date.now();
  await sleep(1500);
  while (Date.now() - t0 < maxMs) {
    const s = await status();
    if (s.queued === 0) return Date.now() - t0;
    await sleep(500);
  }
  throw new Error("pipeline did not go idle");
}
const byText = (sel, text) =>
  `[...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(text)}))`;
async function clickText(cdp, sel, text) {
  const r = await evaluate(cdp, `(() => { const e = ${byText(sel, text)}; if (!e) return null; e.scrollIntoView({block:'nearest'}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  if (!r) throw new Error(`no ${sel} with text ${text}`);
  const { click } = await import("./cdp.mjs");
  await click(cdp, r.x, r.y);
}

const cdp = await connect();
await setup(cdp);
const out = (n) => `${T}${beat}-${take}${n}`;

if (beat === "watch") {
  await goto(cdp, APP + "/", 3000);
  await shot(cdp, out("-before.png"));
  const stop = await startRecording(cdp, out(".mp4"));
  await sleep(1500);
  copyFileSync(S + "gc-biology-quiz-oct17.png", ROOT + "data/watch/gc-biology-quiz-oct17.png");
  const ms = await waitIdle();
  await sleep(6000);
  console.log("read+settle", ms, await stop());
  await shot(cdp, out("-after.png"));
}

if (beat === "snap") {
  await goto(cdp, APP + "/", 3000);
  const stop = await startRecording(cdp, out(".mp4"));
  await sleep(1200);
  await clickText(cdp, "button", "Snap");
  await sleep(2500);
  await shot(cdp, out("-sheet.png"));
  await clickSelector(cdp, '[aria-label*="hutter" i], [aria-label*="Take" i]');
  const ms = await waitIdle();
  await sleep(6000);
  console.log("read+settle", ms, await stop());
  await shot(cdp, out("-after.png"));
}

if (beat === "find") {
  await goto(cdp, APP + "/", 3000);
  const stop = await startRecording(cdp, out(".mp4"));
  await sleep(1000);
  await clickSelector(cdp, 'input[placeholder*="Search"]');
  await sleep(300);
  await typeText(cdp, "when's my bio quiz", 85);
  await sleep(400);
  await pressKey(cdp, "Enter");
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const done = await evaluate(cdp, `!!document.querySelector('[data-answer], article, [aria-live]') && !document.body.innerText.includes('Reading')`);
    if (i > 16 && done) break;
  }
  await sleep(3500);
  await shot(cdp, out("-answer.png"));
  console.log(await stop());
}

if (beat === "quiz") {
  await goto(cdp, APP + "/", 3000);
  const stop = await startRecording(cdp, out(".mp4"));
  await sleep(1000);
  await clickText(cdp, "a", "Quiz me");
  await sleep(20000);
  await shot(cdp, out("-q.png"));
  console.log(await stop());
}

if (beat === "drop") {
  await goto(cdp, APP + "/", 3000);
  const stop = await startRecording(cdp, out(".mp4"));
  await sleep(1500);
  copyFileSync(S + "whiteboard-photosynthesis.jpg", ROOT + "data/watch/whiteboard-photosynthesis.jpg");
  const ms = await waitIdle();
  await sleep(5000);
  console.log("read+settle", ms, await stop());
  await shot(cdp, out("-after.png"));
}

if (beat === "still") {
  const [, , , , path = "/", name = "still"] = process.argv;
  await goto(cdp, APP + path, 3500);
  await shot(cdp, `${T}${name}.png`);
}
process.exit(0);
