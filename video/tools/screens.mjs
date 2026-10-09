// README screenshots from the running app: Library, Document view, Schedule, Ask.
//   node video/tools/screens.mjs <gc-doc-id>
import { connect, setup, goto, shot, evaluate, sleep, clickSelector, typeText, pressKey } from "./cdp.mjs";
import { execFileSync } from "node:child_process";
const ROOT = new URL("../../", import.meta.url).pathname;
const APP = "http://localhost:3103";
const T = ROOT + "video/takes/", OUT = ROOT + "docs/screenshots/";
const cdp = await connect();
await setup(cdp);
const save = async (name) => { await shot(cdp, `${T}${name}.png`); execFileSync("sips", ["-Z", "1920", `${T}${name}.png`, "--out", `${OUT}${name}.png`]); };
await goto(cdp, APP + "/", 3500); await save("library");
await goto(cdp, `${APP}/d/${process.argv[2]}`, 3500); await save("document-view");
await goto(cdp, APP + "/schedule", 3500); await save("schedule");
await goto(cdp, APP + "/ask", 3000);
await clickSelector(cdp, "textarea");
await typeText(cdp, "when's my bio quiz", 40);
await pressKey(cdp, "Enter");
for (let i = 0; i < 240; i++) { await sleep(500); if (i > 4 && !(await evaluate(cdp, `/Reading|Thinking|…$/.test(document.body.innerText.slice(-400))`))) break; }
await sleep(2500);
await save("ask");
process.exit(0);
