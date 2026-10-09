// Records one demo beat from the real app. Usage: node scene.mjs <beat> <take>
import { copyFileSync } from "node:fs";
import { connect, setup, goto, shot, evaluate, sleep, startRecording as startRec, clickSelector, typeText, pressKey } from "./cdp.mjs";
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
// Event marks in seconds from recording start, saved beside the take for the cut script.
const marks = {};
let rec0 = 0;
const { writeFileSync } = await import("node:fs");
const mark = (name) => { marks[name] = +((Date.now() - rec0) / 1000).toFixed(2); };
marks.rects = {};
const RECT = (expr) => `(() => { const e = ${expr}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`;
const grab = async (name, expr) => { marks.rects[name] = await evaluate(cdp, RECT(expr)); };
const comingUp = `[...document.querySelectorAll('*')].filter(e => e.children.length && e.textContent.trim().startsWith('Coming up')).pop()`;
const firstTile = `document.querySelector('main a[href^="/d/"]')`;
const toast = `document.querySelector('[data-sonner-toast]')`;
const saveMarks = () => writeFileSync(out(".marks.json"), JSON.stringify(marks, null, 2));
async function record() { const stop = await record(); rec0 = Date.now(); return async () => { const r = await stop(); saveMarks(); return r; }; }

if (beat === "watch") {
  await goto(cdp, APP + "/", 3000);
  await shot(cdp, out("-before.png"));
  const stop = await record();
  await sleep(1500);
  mark("drop");
  copyFileSync(S + "gc-biology-quiz-oct17.png", ROOT + "data/watch/gc-biology-quiz-oct17.png");
  const ms = await waitIdle();
  mark("idle");
  await sleep(1200);
  await grab("toast", toast);
  await sleep(4800);
  await grab("comingUp", comingUp);
  await grab("firstTile", firstTile);
  console.log("read+settle", ms, await stop());
  await shot(cdp, out("-after.png"));
}

if (beat === "snap") {
  await goto(cdp, APP + "/", 3000);
  const stop = await record();
  await sleep(1200);
  mark("open");
  await clickText(cdp, "button", "Snap");
  await sleep(3500);
  await shot(cdp, out("-sheet.png"));
  await grab("dialog", `document.querySelector('[role="dialog"]')`);
  mark("shutter");
  await clickSelector(cdp, '[aria-label*="hutter" i], [aria-label*="Take" i]');
  const ms = await waitIdle();
  mark("idle");
  await sleep(6000);
  await grab("comingUp", comingUp);
  await grab("firstTile", firstTile);
  console.log("read+settle", ms, await stop());
  await shot(cdp, out("-after.png"));
}

async function waitGone(text, maxMs = 150000) {
  const t0 = Date.now();
  await sleep(800);
  while (Date.now() - t0 < maxMs) {
    if (!(await evaluate(cdp, `document.body.innerText.includes(${JSON.stringify(text)})`))) return Date.now() - t0;
    await sleep(300);
  }
  throw new Error("still showing " + text);
}

if (beat === "find") {
  await goto(cdp, APP + "/", 3000);
  const stop = await record();
  await sleep(1000);
  mark("type");
  await clickSelector(cdp, 'input[placeholder*="Search"]');
  await sleep(300);
  await typeText(cdp, "when's my bio quiz", 85);
  await sleep(400);
  mark("enter");
  await pressKey(cdp, "Enter");
  console.log("answer ms", await waitGone("Reading your documents"));
  mark("answer");
  await sleep(3500);
  await shot(cdp, out("-answer.png"));
  await grab("input", `document.querySelector('input[placeholder*="Search"]')`);
  await grab("answer", `document.querySelector('section[aria-label="Answer"]')`);
  // Open the cited document from the answer.
  const opened = await evaluate(cdp, `(() => { const a = document.querySelector('section[aria-label="Answer"] a[href^="/d/"]'); if (!a) return null; a.scrollIntoView({block:'nearest'}); const r = a.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,href:a.getAttribute('href')}; })()`);
  console.log("cited", opened && opened.href);
  if (opened) {
    const { click } = await import("./cdp.mjs");
    mark("open");
    await click(cdp, opened.x, opened.y);
    await sleep(4500);
    await shot(cdp, out("-doc.png"));
  }
  console.log(await stop());
}

if (beat === "quiz") {
  await goto(cdp, APP + "/", 3000);
  await cdp.send("Network.enable");
  let quizReq = null;
  cdp.on("Network.responseReceived", (p) => { if (p.response.url.includes("/api/quiz")) quizReq = p.requestId; });
  const stop = await record();
  await sleep(1000);
  await clickText(cdp, "a", "Biology");
  await sleep(1500);
  mark("quizme");
  await clickText(cdp, "a", "Quiz me");
  console.log("quiz ms", await waitGone("Writing five questions", 300000));
  mark("questions");
  await sleep(2500);
  let answer = 0;
  try {
    const { body } = await cdp.send("Network.getResponseBody", { requestId: quizReq });
    const q = JSON.parse(body).questions[0];
    answer = q.answerIndex;
    console.log("Q:", q.question, "->", q.choices[answer]);
  } catch (e) { console.log("no quiz body", e.message); }
  await shot(cdp, out("-q.png"));
  await grab("choices", `document.querySelector('[aria-label="Choices"]')`);
  await grab("question", `document.querySelector('[aria-label="Choices"]').parentElement`);
  const r = await evaluate(cdp, `(() => { const b = document.querySelectorAll('[aria-label="Choices"] button')[${answer}]; if (!b) return null; const r = b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  const { click } = await import("./cdp.mjs");
  mark("pick");
  if (r) await click(cdp, r.x, r.y);
  await sleep(4500);
  await shot(cdp, out("-graded.png"));
  await grab("graded", `document.querySelector('section[aria-live="polite"]')`);
  await grab("question2", `document.querySelector('[aria-label="Choices"]').parentElement`);
  console.log(await stop());
}

if (beat === "drop") {
  await goto(cdp, APP + "/", 3000);
  const stop = await record();
  await sleep(1500);
  mark("drop");
  copyFileSync(S + "bio-mitosis-slide.jpg", ROOT + "data/watch/bio-mitosis-slide.jpg");
  const ms = await waitIdle();
  mark("idle");
  await sleep(5000);
  console.log("read+settle", ms, await stop());
  await shot(cdp, out("-after.png"));
}

if (beat === "status") {
  await goto(cdp, APP + "/", 3000);
  await clickText(cdp, "button", "On this laptop");
  await sleep(2500);
  await shot(cdp, out("-panel.png"));
}

if (beat === "still") {
  const [, , , , path = "/", name = "still"] = process.argv;
  await goto(cdp, APP + path, 3500);
  await shot(cdp, `${T}${name}.png`);
}
process.exit(0);
