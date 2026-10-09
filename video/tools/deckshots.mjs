import { connect, evaluate, sleep, shot } from "./cdp.mjs";
const ROOT = new URL("../../", import.meta.url).pathname;
const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const reqs = [];
await cdp.send("Network.enable");
cdp.on("Network.requestWillBeSent", (p) => reqs.push(p.request.url.slice(0, 80)));
await cdp.send("Page.navigate", { url: `file://${ROOT}pitch/index.html` });
await sleep(1500);
for (let i = 1; i <= 6; i++) {
  if (i > 1) {
    const k = i % 2 ? { key: " ", code: "Space", windowsVirtualKeyCode: 32 } : { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 };
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...k });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
  }
  await sleep(2200);
  await shot(cdp, `${ROOT}video/takes/deck-${i}.png`);
}
console.log("errors:", await evaluate(cdp, "document.getElementById('count').textContent"));
console.log("fonts:", await evaluate(cdp, `[...document.fonts].map(f=>f.family+':'+f.status).join(',')`));
console.log("non-file requests:", reqs.filter((u) => !u.startsWith("file:") && !u.startsWith("data:")));
process.exit(0);
