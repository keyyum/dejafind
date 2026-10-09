// Builds video/hf/index.html (the 60 s demo) from the voice-over phrase lengths, so every
// caption is timed to its own phrase and every visual beat is anchored to the words it shows.
// Also writes video/audio/cues.json (voice placements + sound-design cues) for mix.mjs.
//   node video/tools/make-vo.mjs && node video/tools/make-demo.mjs
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname;
const HF = ROOT + "video/hf/";
const vo = JSON.parse(readFileSync(ROOT + "video/audio/vo-durations.json", "utf8"));
const tiles = JSON.parse(readFileSync(HF + "assets/tiles/tiles.json", "utf8"));
const markSvg = readFileSync(HF + "index.html", "utf8").match(/<svg class="mk" data-mark[\s\S]*?<\/svg>/)[0];

// ---------- timing ----------
const GAP = 0.28, BEAT_GAP = 0.6;
const extraAfter = { "0-2": 0.4, "1-0": 0.5, "2-0": 0.85, "2-3": 0.7, "3-1": 0.6, "4-0": 1.45, "4-1": 0.4, "5-0": 0.45, "5-1": 0.9, "6-0": 0.3, "6-2": 0.5, "7-1": 0.7 }; // room for the flash, the shutter, a beat
const P = {}; // id -> {start, end, cap, beat}
let t = 0.45, lastBeat = null;
const beatStart = {};
for (const ph of vo) {
  if (lastBeat !== null && ph.beat !== lastBeat) t += BEAT_GAP;
  if (beatStart[ph.beat] === undefined) beatStart[ph.beat] = +(t - (ph.beat === "hook" ? 0.45 : 0.25)).toFixed(3);
  P[ph.id] = { start: +t.toFixed(3), end: +(t + ph.dur).toFixed(3), cap: ph.cap, beat: ph.beat };
  t += ph.dur + GAP + (extraAfter[ph.id] ?? 0);
  lastBeat = ph.beat;
}
const END_START = beatStart.end;
const TOTAL = +(P["8-0"].end + 1.4).toFixed(2);
const s = (id) => P[id].start, e = (id) => P[id].end;

const sfx = []; // {t, kind}
const cue = (time, kind) => sfx.push({ t: +time.toFixed(3), kind });

// ---------- markup ----------
const caps = [];
const capFor = (id, opts = {}) => caps.push({ id, start: s(id), end: (opts.until ?? e(id)) + 0.25, html: P[id].cap });

// hook: headlines carry the first and last phrase; the middle one is a caption
capFor("0-1");
// gc: the headline carries "Screenshot the GC. That's all."; captions for the rest
capFor("2-1"); capFor("2-2"); capFor("2-3");
capFor("3-0"); capFor("3-1");
capFor("4-0"); capFor("4-1");
capFor("5-0"); capFor("5-1");
capFor("6-1"); capFor("6-2");
capFor("7-0"); capFor("7-1");
// make consecutive captions hand over without overlap
caps.sort((a, b) => a.start - b.start);
for (let i = 0; i + 1 < caps.length; i++) if (caps[i].end > caps[i + 1].start - 0.05) caps[i].end = caps[i + 1].start - 0.05;

const TILE_PICK = [8, 4, 6, 5, 0]; // slide, handout photo, PDF, Filipino page, mitosis slide
const tileCards = TILE_PICK.map((ti, k) => {
  const m = tiles[ti];
  const w = 320, h = Math.round((m.h * w) / m.w);
  const x = 115 + k * 345, y = 470 - Math.round(h / 2) - 40;
  return `<div id="tile${k}" class="card tile" style="left:${x}px;top:${y}px;width:${w}px"><img src="assets/tiles/${m.f}" alt="" /></div>`;
}).join("\n      ");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>DéjàFind — 60 s demo</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: block; src: url("assets/fonts/figtree-latin.woff2") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
      @font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: block; src: url("assets/fonts/figtree-latin-ext.woff2") format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
      :root { --page: #fcfcfa; --ink: #1f1f1d; --secondary: #7a7a74; --hairline: #ededea; --accent: #c2410c; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--page); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Figtree", sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
      .bg { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 40%, #fefefc 0%, #fbfaf6 55%, #f2efe7 100%); }
      .layer { position: absolute; inset: 0; }
      .headline { position: absolute; font-weight: 600; letter-spacing: -0.02em; line-height: 1.04; }
      .headline .line { display: block; white-space: nowrap; }
      .headline .ch { opacity: 0; }
      .accent { color: var(--accent); }
      .card { position: absolute; background: #fff; border-radius: 22px; overflow: hidden; opacity: 0;
        box-shadow: 0 1px 2px rgba(31,31,29,.05), 0 10px 24px rgba(31,31,29,.06), 0 40px 90px rgba(31,31,29,.13); }
      .card video, .card img { display: block; width: 100%; height: auto; }
      .tile { border-radius: 16px; }
      .cap { position: absolute; left: 0; right: 0; bottom: 54px; display: flex; justify-content: center; pointer-events: none; }
      .cap span.pill { display: block; background: #fff; color: var(--ink); white-space: nowrap; font-size: 46px; font-weight: 500; letter-spacing: -0.01em; line-height: 1;
        padding: 22px 38px 24px; border-radius: 18px; box-shadow: 0 1px 2px rgba(31,31,29,.06), 0 18px 44px rgba(31,31,29,.12); }
      .cap b { font-weight: 600; color: var(--accent); }
      .flood { position: absolute; left: -12px; top: -4px; width: 1944px; display: grid; grid-template-columns: repeat(8, 236px); gap: 8px; }
      .flood div { height: 172px; border-radius: 6px; background-size: cover; background-position: center; opacity: 0; box-shadow: 0 6px 18px rgba(31,31,29,.12); }
      .veil { position: absolute; inset: 0; background: var(--page); opacity: 0; }
      .vband { position: absolute; left: 0; right: 0; top: 380px; height: 330px; opacity: 0;
        background: linear-gradient(180deg, rgba(252,252,250,0) 0%, rgba(252,252,250,.96) 22%, rgba(252,252,250,.96) 78%, rgba(252,252,250,0) 100%); }
      .lockup { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 46px; }
      .lockup svg { width: 176px; height: 176px; flex: none; opacity: 0; color: var(--ink); }
      .lockup .word { font-size: 176px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; opacity: 0; }
      .cutnote { position: absolute; font-size: 22px; font-weight: 500; color: #66665f; background: #fff; border-radius: 999px; padding: 9px 18px; opacity: 0;
        box-shadow: 0 6px 18px rgba(31,31,29,.1); white-space: nowrap; }
      /* camera */
      .cam { position: absolute; left: 330px; top: 60px; width: 1260px; height: 790px; border-radius: 44px; background: #121211; opacity: 0;
        box-shadow: 0 30px 90px rgba(31,31,29,.28); }
      .cam .top { position: absolute; left: 44px; top: 26px; color: #fcfcfa; font-size: 26px; font-weight: 600; }
      .cam .top span { color: #b9b9b2; font-weight: 500; margin-left: 14px; }
      .feed { position: absolute; left: 40px; top: 78px; width: 1180px; height: 590px; border-radius: 26px; overflow: hidden; background: #000; }
      .feed img { position: absolute; left: -40px; top: 0; width: 1260px; height: 640px; object-fit: cover; object-position: center 20%; transform-origin: 40% 30%; }
      .focus { position: absolute; left: 520px; top: 210px; width: 150px; height: 150px; border: 2px solid rgba(255,255,255,.95); border-radius: 10px; opacity: 0; }
      .shutter { position: absolute; left: 584px; top: 686px; width: 92px; height: 92px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 6px #121211, 0 0 0 9px rgba(255,255,255,.85); }
      .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
      .ink { position: absolute; inset: 0; background: var(--ink); opacity: 0; }
      .endlock { bottom: auto; height: 220px; top: 330px; gap: 36px; opacity: 0; }
      .endlock svg { width: 150px; height: 150px; opacity: 1; color: var(--page); }
      .endlock .word { font-size: 150px; opacity: 1; color: var(--page); }
      .endline { position: absolute; left: 0; right: 0; text-align: center; color: var(--page); opacity: 0; }
      .endtag { top: 610px; font-size: 64px; font-weight: 600; letter-spacing: -0.02em; }
      .endmeta { top: 760px; font-size: 34px; font-weight: 500; color: #b9b9b2; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <div class="bg"></div>

      <div id="s1" class="layer"><div id="flood" class="flood"></div><div id="veil" class="veil"></div><div id="band" class="vband"></div></div>
      <div id="h1a" class="headline clip" data-start="0" data-duration="${(s("0-1")).toFixed(2)}" data-track-index="5" style="left:0;right:0;top:452px;text-align:center;font-size:132px"><span class="line">You photograph everything.</span></div>
      <div id="h1b" class="headline clip" data-start="${(s("0-2") - 0.15).toFixed(2)}" data-duration="${(e("0-2") - s("0-2") + 0.6).toFixed(2)}" data-track-index="5" style="left:0;right:0;top:452px;text-align:center;font-size:112px"><span class="line">And you <span class="accent">never open any of it</span> again.</span></div>

      <div id="name" class="lockup clip" data-start="${(beatStart.name - 0.1).toFixed(2)}" data-duration="${(beatStart.gc - beatStart.name + 0.1).toFixed(2)}" data-track-index="4">
        ${markSvg}
        <span class="word">DéjàFind</span>
      </div>

      <div id="h3" class="headline clip" data-start="${beatStart.gc.toFixed(2)}" data-duration="${(e("2-0") + 0.75 - beatStart.gc).toFixed(2)}" data-track-index="5" style="left:150px;top:404px;font-size:96px">
        <span class="line">Screenshot the GC.</span>
        <span class="line accent">That’s all.</span>
      </div>
      <div id="gc" class="card" style="left:1130px;top:310px;width:680px"><img src="assets/gc.png" alt="" /></div>
      <div id="flash1" class="flash"></div>

      <div id="watchCard" class="card" style="left:335px;top:96px;width:1250px">
        <video id="v-watch" class="clip" src="assets/clips/v2-watch.mp4" muted playsinline data-start="${(e("2-0") + 0.75).toFixed(2)}" data-duration="${(beatStart.watch - e("2-0") - 0.5).toFixed(2)}" data-track-index="1"></video>
      </div>
      <div id="cut1" class="cutnote" style="left:1400px;top:70px">Model wait cut</div>

      ${tileCards}

      <div id="cam" class="cam">
        <div class="top">Snap a page<span>Hold it up to the camera</span></div>
        <div id="feed" class="feed"><img id="feedimg" src="assets/cam-whiteboard.jpg" alt="" /><div id="focus" class="focus"></div><div id="flash2" class="flash"></div></div>
        <div id="shutter" class="shutter"></div>
      </div>
      <div id="snapLibCard" class="card" style="left:335px;top:96px;width:1250px">
        <video id="v-snaplib" class="clip" src="assets/clips/v2-snaplib.mp4" muted playsinline data-start="${(e("4-0") + 0.85).toFixed(2)}" data-duration="${(beatStart.find - e("4-0") - 0.7).toFixed(2)}" data-track-index="2"></video>
      </div>
      <div id="cut3" class="cutnote" style="left:1400px;top:70px">Model wait cut</div>

      <div id="typeCard" class="card" style="left:210px;top:330px;width:1500px;border-radius:26px">
        <video id="v-type" class="clip" src="assets/clips/v2-type.mp4" muted playsinline data-playback-rate="2" data-start="${beatStart.find.toFixed(2)}" data-duration="${(beatStart.offline - beatStart.find).toFixed(2)}" data-track-index="1"></video>
      </div>
      <div id="answerCard" class="card" style="left:160px;top:300px;width:1600px">
        <video id="v-answer" class="clip" src="assets/clips/v2-answer.mp4" muted playsinline data-start="${(beatStart.find + 1.55).toFixed(2)}" data-duration="${(beatStart.offline - beatStart.find - 1.55).toFixed(2)}" data-track-index="2"></video>
      </div>
      <div id="docCard" class="card" style="left:300px;top:60px;width:1320px"><img src="assets/stills/find-doc.jpg" alt="" /></div>
      <div id="cut2" class="cutnote" style="left:1500px;top:268px">Model wait cut</div>

      <div id="h6" class="headline clip" data-start="${beatStart.offline.toFixed(2)}" data-duration="${(beatStart.quiz - beatStart.offline).toFixed(2)}" data-track-index="5" style="left:150px;top:380px;font-size:112px">
        <span class="line">Nothing leaves</span>
        <span class="line accent">the laptop.</span>
      </div>
      <div id="statusCard" class="card" style="left:1110px;top:170px;width:640px"><img src="assets/stills/status-panel.jpg" alt="" /></div>

      <div id="quizCard" class="card" style="left:520px;top:46px;width:880px">
        <video id="v-quiz" class="clip" src="assets/clips/v2-quiz.mp4" muted playsinline data-start="${beatStart.quiz.toFixed(2)}" data-duration="${(END_START - beatStart.quiz).toFixed(2)}" data-track-index="1"></video>
      </div>
      <div id="cut4" class="cutnote" style="left:1430px;top:70px">Model wait cut</div>

${caps.map((c, i) => `      <div id="cap${i}" class="cap clip" data-start="${c.start.toFixed(2)}" data-duration="${(c.end - c.start).toFixed(2)}" data-track-index="8"><span class="pill">${c.html}</span></div>`).join("\n")}

      <div id="ink" class="ink"></div>
      <div id="endlogo" class="lockup endlock">
        ${markSvg}
        <span class="word">DéjàFind</span>
      </div>
      <div id="endtag" class="endline endtag">Find what you already saw.</div>
      <div id="endmeta" class="endline endmeta">github.com/keyyum/dejafind · #AppBuildersPH</div>
    </div>

    <script>
      const T = ${JSON.stringify({ beatStart, P: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, [v.start, v.end]])) })};
      const s = (id) => T.P[id][0], e = (id) => T.P[id][1], B = T.beatStart;
      const PHOTOS = ["bio-mitosis-slide", "whiteboard-photosynthesis", "calc-limits-slide", "sanaysay-wika-kultura", "physics-kinematics-slide",
        "calc-longquiz-handout", "gc-biology-quiz-oct17", "timetable-bscs-2b", "gc-calculus-longquiz-oct19", "jollibee-receipt"];
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const flood = document.getElementById("flood"), tiles = [];
      for (let i = 0; i < 48; i++) {
        const d = document.createElement("div");
        d.style.backgroundImage = 'url("assets/photos/' + PHOTOS[(i * 7 + Math.floor(i / 8) * 3) % PHOTOS.length] + '.jpg")';
        flood.appendChild(d); tiles.push(d);
      }
      function typeify(el) {
        const chars = [];
        const walk = (node) => { for (const c of [...node.childNodes]) {
          if (c.nodeType === 3) { const f = document.createDocumentFragment();
            for (const ch of c.textContent) { const sp = document.createElement("span"); sp.className = "ch"; sp.textContent = ch; f.appendChild(sp); chars.push(sp); }
            c.replaceWith(f); } else walk(c); } };
        walk(el); return chars;
      }
      const typed = {};
      for (const id of ["h1a", "h1b", "h3", "h6"]) typed[id] = typeify(document.getElementById(id));

      const tl = gsap.timeline({ paused: true });
      const E = "power3.out";
      const type = (id, at, total) => tl.to(typed[id], { opacity: 1, duration: 0.01, stagger: total / typed[id].length, ease: "none" }, at);
      const cardIn = (sel, at, from = { y: 60, scale: 0.97 }) => tl.fromTo(sel, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 0.6, ease: E }, at);
      const cardOut = (sel, at, to = { y: -40, scale: 0.98 }) => tl.to(sel, { opacity: 0, ...to, duration: 0.4, ease: "power2.in" }, at);
      const drift = (sel, at, dur, to = 1.04) => tl.fromTo(sel, { scale: 1 }, { scale: to, duration: dur, ease: "none", immediateRender: false }, at);
      const note = (sel, at) => { tl.fromTo(sel, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 }, at); tl.to(sel, { opacity: 0, duration: 0.25 }, at + 1.1); };

      // 1 · hook: the camera roll floods in
      tiles.forEach((t, i) => {
        const r = (rnd() - 0.5) * 7, at = 0.04 + (i % 8) * 0.035 + Math.floor(i / 8) * 0.11 + rnd() * 0.1;
        tl.fromTo(t, { opacity: 0, scale: 0.72, y: 40, rotation: r * 2 }, { opacity: 1, scale: 1, y: 0, rotation: r, duration: 0.42, ease: "back.out(1.4)" }, at);
      });
      tl.fromTo("#flood", { scale: 1.0 }, { scale: 1.06, duration: e("0-2") + 0.4, ease: "none" }, 0);
      tl.to("#band", { opacity: 1, duration: 0.4 }, 0.2);
      tl.to("#veil", { opacity: 0.18, duration: 0.6 }, 0.2);
      type("h1a", s("0-0"), 0.75);
      tl.to("#h1a .line", { opacity: 0, y: -20, duration: 0.3, ease: "power2.in" }, s("0-1") - 0.3);
      tl.to("#band", { opacity: 0.35, duration: 0.3 }, s("0-1") - 0.3);
      tl.to("#band", { opacity: 1, duration: 0.3 }, s("0-2") - 0.3);
      tl.to("#veil", { opacity: 0.55, duration: 0.7 }, s("0-2") - 0.2);
      tl.to(tiles, { filter: "grayscale(1)", duration: 0.8 }, s("0-2") - 0.2);
      type("h1b", s("0-2") - 0.1, 0.9);
      const collapse = e("0-2") + 0.15;
      tl.to(tiles, { x: (i) => (960 - (i % 8) * 244 - 118) * 0.85, y: (i) => (540 - Math.floor(i / 8) * 180 - 86) * 0.85, scale: 0.25, opacity: 0, duration: 0.55, ease: "power3.in", stagger: { each: 0.004, from: "center" } }, collapse);
      tl.to("#h1b .line", { opacity: 0, scale: 0.94, duration: 0.3, ease: "power2.in" }, collapse);
      tl.to("#veil, #band", { opacity: 0, duration: 0.35 }, collapse + 0.3);

      // 2 · name
      tl.fromTo("#name svg", { opacity: 0, scale: 0.6, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: "back.out(1.6)" }, B.name - 0.05);
      tl.fromTo("#name .word", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.55, ease: E }, B.name + 0.08);
      tl.fromTo("#name", { scale: 1 }, { scale: 1.04, duration: B.gc - B.name, ease: "none" }, B.name);
      tl.to("#name svg, #name .word", { opacity: 0, y: -30, duration: 0.35, ease: "power2.in" }, B.gc - 0.3);

      // 3 · screenshot the GC (thesis held ~2.5 s), then the real tile lands
      type("h3", B.gc + 0.05, 0.7);
      cardIn("#gc", B.gc + 0.2, { x: 160, y: 0, rotation: 4, scale: 0.94 });
      tl.fromTo("#gc", { y: 0 }, { y: -14, duration: 2.2, ease: "sine.inOut", immediateRender: false }, B.gc + 0.8);
      const flash1 = e("2-0") + 0.25;
      tl.to("#flash1", { opacity: 0.85, duration: 0.06, ease: "none" }, flash1);
      tl.to("#flash1", { opacity: 0, duration: 0.3, ease: "power2.out" }, flash1 + 0.08);
      tl.to("#gc", { x: -560, y: 330, scale: 0.28, rotation: -6, opacity: 0, duration: 0.55, ease: "power3.in" }, flash1 + 0.1);
      tl.to("#h3 .line", { opacity: 0, x: -30, duration: 0.3, ease: "power2.in" }, flash1 + 0.15);
      const w0 = e("2-0") + 0.7;
      cardIn("#watchCard", w0, { y: 90, scale: 0.95 });
      drift("#watchCard", w0 + 0.6, B.watch - w0 - 0.9, 1.04);
      note("#cut1", w0 + 1.7);
      cardOut("#watchCard", B.watch - 0.35, { y: -50, scale: 1.06 });

      // 4 · it watches your folders: real tiles, staggered, filed by subject
      ["#tile0", "#tile1", "#tile2", "#tile3", "#tile4"].forEach((id, k) => {
        const rot = [-3, 2, -1.5, 2.5, -2][k];
        tl.fromTo(id, { opacity: 0, y: 140, rotation: rot * 2, scale: 0.9 }, { opacity: 1, y: 0, rotation: rot, scale: 1, duration: 0.6, ease: "back.out(1.3)" }, B.watch + 0.1 + k * 0.16);
        tl.fromTo(id, { x: 0 }, { x: (k - 2) * -10, y: -16 + k * 3, duration: 4.6, ease: "none", immediateRender: false }, B.watch + 0.8);
        tl.to(id, { opacity: 0, y: -60, duration: 0.35, ease: "power2.in" }, B.snap - 0.4 + k * 0.03);
      });

      // 5 · snap: a camera, a shutter, the tile lands
      tl.fromTo("#cam", { opacity: 0, y: 70, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: E }, B.snap);
      tl.fromTo("#feedimg", { scale: 1.06, x: 0 }, { scale: 1.13, x: -24, duration: 2.6, ease: "none" }, B.snap);
      for (let k = 0; k < 4; k++) tl.fromTo("#feed", { x: k % 2 ? 3 : -3, y: k % 2 ? -2 : 2 }, { x: k % 2 ? -3 : 3, y: k % 2 ? 2 : -2, duration: 0.6, ease: "sine.inOut", immediateRender: false }, B.snap + k * 0.6);
      tl.fromTo("#focus", { opacity: 0, scale: 1.35 }, { opacity: 1, scale: 1, duration: 0.3, ease: E }, s("4-0") + 0.25);
      tl.to("#focus", { opacity: 0, duration: 0.25 }, s("4-0") + 0.95);
      const shot = e("4-0") + 0.25;
      tl.to("#shutter", { scale: 0.86, duration: 0.08 }, shot - 0.08);
      tl.to("#shutter", { scale: 1, duration: 0.15 }, shot + 0.02);
      tl.to("#flash2", { opacity: 1, duration: 0.03, ease: "none" }, shot);
      tl.to("#flash2", { opacity: 0, duration: 0.12, ease: "none" }, shot + 0.09);
      tl.to("#feed", { x: -330, y: 120, scale: 0.26, duration: 0.6, ease: "power3.in" }, shot + 0.3);
      tl.to("#cam", { opacity: 0, duration: 0.35 }, shot + 0.55);
      cardIn("#snapLibCard", e("4-0") + 0.8, { y: 60, scale: 0.97 });
      drift("#snapLibCard", e("4-0") + 1.4, B.find - e("4-0") - 1.6, 1.04);
      note("#cut3", e("4-0") + 1.6);
      cardOut("#snapLibCard", B.find - 0.3);

      // 6 · find: typed fast, answers fly in at once
      cardIn("#typeCard", B.find, { y: 70, scale: 0.97 });
      tl.to("#typeCard", { y: -230, duration: 0.55, ease: "power3.inOut" }, B.find + 1.4);
      cardIn("#answerCard", B.find + 1.5, { y: 140, scale: 0.97 });
      note("#cut2", B.find + 1.6);
      drift("#answerCard", B.find + 2.1, 2.2, 1.03);
      cardOut("#typeCard", s("5-1") + 1.15, { y: -300 });
      cardOut("#answerCard", s("5-1") + 1.2, { y: -60 });
      cardIn("#docCard", s("5-1") + 1.3, { y: 80, scale: 0.96 });
      drift("#docCard", s("5-1") + 1.9, B.offline - s("5-1") - 2.2, 1.04);
      cardOut("#docCard", B.offline - 0.3);

      // 7 · nothing leaves the laptop
      type("h6", B.offline + 0.05, 0.7);
      cardIn("#statusCard", B.offline + 0.3, { x: 90, y: 0, scale: 0.95 });
      drift("#statusCard", B.offline + 0.9, B.quiz - B.offline - 1.2, 1.05);
      tl.fromTo("#h6", { y: 0 }, { y: -12, duration: B.quiz - B.offline - 0.5, ease: "none", immediateRender: false }, B.offline + 0.5);
      tl.to("#h6 .line", { opacity: 0, x: -30, duration: 0.3, ease: "power2.in" }, B.quiz - 0.35);
      cardOut("#statusCard", B.quiz - 0.35, { x: 60, y: 0 });

      // 8 · quiz
      cardIn("#quizCard", B.quiz, { y: 90, scale: 0.95 });
      drift("#quizCard", B.quiz + 0.6, ${END_START} - B.quiz - 0.9, 1.04);
      note("#cut4", B.quiz + 0.9);
      cardOut("#quizCard", ${END_START} - 0.3);

      // captions: rise 8 px while fading in
      document.querySelectorAll(".cap").forEach((c) => {
        const st = parseFloat(c.dataset.start), d = parseFloat(c.dataset.duration), pill = c.querySelector(".pill");
        tl.fromTo(pill, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: E }, st);
        tl.to(pill, { opacity: 0, duration: 0.18 }, st + d - 0.18);
      });

      // 9 · close: appears with a soft fade, no typing
      tl.to("#ink", { opacity: 1, duration: 0.45, ease: "power2.inOut" }, ${END_START} - 0.2);
      tl.fromTo("#endlogo", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: E }, ${END_START} + 0.2);
      tl.fromTo("#endtag", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: E }, ${END_START} + 0.6);
      tl.fromTo("#endmeta", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${END_START} + 1.1);
      tl.fromTo("#endlogo", { scale: 1 }, { scale: 1.03, duration: ${(TOTAL - END_START).toFixed(2)}, ease: "none", immediateRender: false }, ${END_START} + 0.2);

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(HF + "index.html", html);

// ---------- sound cues (kinds map to the Pawi kit's Kenney CC0 / synthesized SFX in mix.mjs) ----------
const B = beatStart;
let wn = 0;
const whoosh = (time) => cue(time, ["whoosh1", "whoosh2", "whoosh3"][wn++ % 3]);
const keys = (from, n, every) => { for (let k = 0; k < n; k++) cue(from + k * every, `key${(k % 4) + 1}`); };
whoosh(0.05);
keys(s("0-0"), 6, 0.11);                       // headline typing
keys(s("0-2") - 0.1, 7, 0.12);
whoosh(B.name - 0.05);
keys(B.gc + 0.05, 6, 0.11);
whoosh(B.gc + 0.2);
cue(e("2-0") + 0.25, "click"); cue(e("2-0") + 0.32, "click2");   // screenshot taken
const w0 = e("2-0") + 0.75;                    // watch clip starts
whoosh(w0 - 0.05);
cue(w0 + 0.25, "click3");                      // the capture lands in the grid
cue(w0 + 1.85, "chime");                       // filed under Biology
cue(w0 + 2.2, "tick");                         // Oct 17 lifts into Coming up
for (let k = 0; k < 5; k++) cue(B.watch + 0.1 + k * 0.16, "whoosh3-soft");
whoosh(B.snap);
cue(e("4-0") + 0.25, "click"); cue(e("4-0") + 0.31, "click2");   // shutter
const sn0 = e("4-0") + 0.85;
whoosh(sn0 - 0.05);
cue(sn0 + 0.2, "click3");                      // tile lands
cue(sn0 + 1.0, "chime");                       // filed under Biology
cue(sn0 + 1.35, "tick");                       // date lifts
whoosh(B.find);
keys(B.find + 0.15, 9, 0.13);                  // typing the question
cue(B.find + 1.55, "pop");                     // the answer appears
whoosh(s("5-1") + 1.3);
keys(B.offline + 0.05, 6, 0.11);
whoosh(B.offline + 0.3);
whoosh(B.quiz);
cue(B.quiz + 1.0, "click3");                   // answer picked
cue(B.quiz + 1.2, "chime");                    // graded correct
cue(END_START - 1.4, "riser-tail");
writeFileSync(ROOT + "video/audio/cues.json", JSON.stringify({ total: TOTAL, endStart: END_START, vo: Object.entries(P).map(([id, p]) => ({ id, t: p.start })), sfx }, null, 2));
console.log(`index.html: ${TOTAL} s · beats ${JSON.stringify(beatStart)}`);
