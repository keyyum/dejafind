// Minimal Chrome DevTools Protocol driver for recording the real app.
// No npm dependencies: Node's global WebSocket and fetch, plus ffmpeg on PATH.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const FFMPEG = "/opt/homebrew/bin/ffmpeg";
export const PORT = 9431;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launches headless Chrome with a fake camera fed from a y4m file. */
export function launchChrome({ camFile, profileDir }) {
  rmSync(profileDir, { recursive: true, force: true });
  const args = [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1536,864",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
  ];
  if (camFile) args.push(`--use-file-for-fake-video-capture=${camFile}`);
  const proc = spawn(CHROME, [...args, "about:blank"], { stdio: "ignore", detached: true });
  proc.unref();
  return proc;
}

export async function connect() {
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };
  const off = (method) => listeners.delete(method);
  return { send, on, off, ws };
}

export async function setup(cdp, { dpr = 2 } = {}) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1536,
    height: 864,
    deviceScaleFactor: dpr,
    mobile: false,
  });
  await cdp.send("Browser.grantPermissions", { permissions: ["videoCapture"] }).catch(() => {});
}

export async function goto(cdp, url, settle = 1500) {
  await cdp.send("Page.navigate", { url });
  await sleep(settle);
}

export async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result.value;
}

export async function shot(cdp, path, clip) {
  const params = { format: "png", captureBeyondViewport: false };
  if (clip) params.clip = { ...clip, scale: 1 };
  const { data } = await cdp.send("Page.captureScreenshot", params);
  writeFileSync(path, Buffer.from(data, "base64"));
  return path;
}

/** Returns the CSS-pixel rect of the first element matching a selector. */
export async function rect(cdp, selector) {
  return evaluate(
    cdp,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
      const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`
  );
}

export async function click(cdp, x, y) {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}

export async function clickSelector(cdp, selector) {
  const r = await rect(cdp, selector);
  if (!r) throw new Error(`no element for ${selector}`);
  await click(cdp, r.x + r.width / 2, r.y + r.height / 2);
}

export async function typeText(cdp, text, delay = 70) {
  for (const ch of text) {
    await cdp.send("Input.insertText", { text: ch });
    await sleep(delay);
  }
}

export async function pressKey(cdp, key, code = key, keyCode = 13) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, text: key === "Enter" ? "\r" : undefined });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
}

/**
 * Records a screencast. Returns stop(), which writes a constant-30fps H.264 mp4
 * timed from each frame's own timestamp.
 */
export async function startRecording(cdp, outMp4) {
  const dir = `${outMp4}.frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  cdp.on("Page.screencastFrame", (p) => {
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(p.data, "base64"));
    frames.push({ file, t: p.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: 3072, maxHeight: 1728 });
  const started = Date.now() / 1000;
  return async () => {
    const ended = Date.now() / 1000;
    await cdp.send("Page.stopScreencast");
    cdp.off("Page.screencastFrame");
    if (!frames.length) throw new Error("no frames captured");
    const lines = [];
    for (let i = 0; i < frames.length; i++) {
      const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(ended, frames[i].t + 0.1);
      const start = i === 0 ? Math.min(started, frames[0].t) : frames[i].t;
      lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, next - start).toFixed(4)}`);
    }
    lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = join(dir, "list.txt");
    writeFileSync(list, lines.join("\n"));
    execFileSync(FFMPEG, [
      "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
      "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
      "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-movflags", "+faststart", outMp4,
    ]);
    return { frames: frames.length, seconds: ended - started };
  };
}
