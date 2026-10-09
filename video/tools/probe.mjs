import { launchChrome, connect, setup, goto, shot, evaluate, sleep } from "./cdp.mjs";
const T = new URL("../takes/", import.meta.url).pathname;
const [,, url = "http://localhost:3103/", name = "probe.png", launch] = process.argv;
if (launch) { launchChrome({ camFile: T + "cam/slide.y4m", profileDir: T + "profile" }); }
const cdp = await connect();
await setup(cdp);
await goto(cdp, url, 3000);
await shot(cdp, T + name);
console.log(await evaluate(cdp, `[...document.querySelectorAll('button,a,input,[role=button]')].map(e=>(e.tagName+':'+(e.getAttribute('aria-label')||e.textContent||e.placeholder||'').trim().slice(0,40))).join(' | ')`));
process.exit(0);
