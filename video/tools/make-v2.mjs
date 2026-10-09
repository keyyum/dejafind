// "The night before": the level-2 demo cut. Builds video/hf/lvl2/index.html on the beat grid of
// "Newer Wave" (110 BPM), plus video/audio/lvl2-cues.json for mix.mjs.
//   node video/tools/make-v2.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname;
const HF = ROOT + "video/hf/";
const A = ROOT + "video/audio/";
const dur = JSON.parse(readFileSync(A + "vo-v2-durations.json", "utf8"));
const real = JSON.parse(readFileSync(A + "lvl2-real.json", "utf8"));
const say = Object.fromEntries(JSON.parse(readFileSync(A + "v2-say.json", "utf8")).map((x) => [x.id, x.text]));
const markSvg = readFileSync(HF + "index.html", "utf8").match(/<svg class="mk" data-mark[\s\S]*?<\/svg>/)[0];

const BEAT = 60 / 110, b = (n) => +(0.534 + n * BEAT).toFixed(3);
// sections
const S = { hook: 0, turn: b(8), answer: b(12), proof: b(26), point: b(62), close: b(76) };
const H = [b(26), b(34), b(38), b(46), b(50), b(58), b(62)]; // proof hit boundaries: 2,1,2,1,2,1 bars
const END = +(S.close + 3.2).toFixed(3), TOTAL = +(END + 3.2).toFixed(2);

// voice placement
const VO = { "v2-0": 0.55, "v2-1": 2.25, "v2-2": S.turn + 0.3, "v2-3": S.answer + 0.45, "v2-4": S.answer + 4.35,
  "v2-5": H[0] + 0.15, "v2-6": H[1] + 0.12, "v2-7": H[2] + 1.55, "v2-8": H[3] + 0.08, "v2-9": H[4] + 0.15, "v2-10": H[5] + 0.12,
  "v2-11": S.point + 0.35, "v2-12": S.point + 4.9, "v2-13": S.close + 0.35 };
const subs = Object.entries(VO).map(([id, t]) => ({ id, t, end: +(t + dur[id] + 0.15).toFixed(3), text: say[id] }));
for (let i = 0; i + 1 < subs.length; i++) if (subs[i].end > subs[i + 1].t - 0.05) subs[i].end = subs[i + 1].t - 0.05;

const sfx = [];
const cue = (t, kind) => sfx.push({ t: +t.toFixed(3), kind });

// kinetic hit captions: words land on beats
const HITS = [
  { at: H[0], words: ["Timetable", "in.", "Subjects", "out."], key: [2, 3] },
  { at: H[1], words: ["Angled", "photo.", "Flat", "slide."], key: [2, 3] },
  { at: H[2] + 1.1, words: ["Snap.", "Filed."], key: [1] },
  { at: H[3], words: ["Deadline,", "on", "your", "timeline."], key: [3] },
  { at: H[4], words: ["Quiz,", "from", "your", "own", "notes."], key: [0] },
  { at: H[5], words: ["Reviewer,", "written", "for", "you."], key: [0] },
];
const kin = HITS.map((h, i) => `<div id="k${i}" class="kin">${h.words.map((w, j) => `<span class="${h.key.includes(j) ? "accent" : ""}">${w}</span>`).join(" ")}</div>`).join("\n      ");

const label = (id, text, left = 40, top = 1022) => `<div id="${id}" class="speed" style="left:${left}px;top:${top}px">${text}</div>`;

const PH = ["bio-mitosis-slide", "whiteboard-photosynthesis", "calc-limits-slide", "sanaysay-wika-kultura", "physics-kinematics-slide",
  "calc-longquiz-handout", "gc-biology-quiz-oct17", "timetable-bscs-2b", "gc-calculus-longquiz-oct19", "jollibee-receipt"];

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>DéjàFind — the night before</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: block; src: url("../assets/fonts/figtree-latin.woff2") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
      @font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: block; src: url("../assets/fonts/figtree-latin-ext.woff2") format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }
      :root { --page: #fcfcfa; --ink: #1f1f1d; --secondary: #7a7a74; --accent: #c2410c; --success: #3c9a5f; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--page); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Figtree", sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
      .bg { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 40%, #fefefc 0%, #fbfaf6 55%, #f2efe7 100%); }
      .accent { color: var(--accent); }
      .card { position: absolute; background: #fff; border-radius: 22px; overflow: hidden; opacity: 0;
        box-shadow: 0 1px 2px rgba(31,31,29,.05), 0 10px 24px rgba(31,31,29,.06), 0 40px 90px rgba(31,31,29,.14); }
      .card video, .card img { display: block; width: 100%; height: auto; }
      .sweep { position: absolute; top: -20%; bottom: -20%; width: 34%; left: -40%; pointer-events: none;
        background: linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.65) 50%, rgba(255,255,255,0) 100%); }
      /* phone */
      .phone { position: absolute; left: 780px; top: 120px; width: 360px; height: 740px; border-radius: 54px; background: #141413; padding: 14px; opacity: 0;
        box-shadow: 0 30px 80px rgba(31,31,29,.3); }
      .screen { position: relative; width: 100%; height: 100%; border-radius: 42px; overflow: hidden; background: #f4f4f1; }
      .bar { height: 92px; background: #fff; border-bottom: 1px solid #e6e6e2; padding: 46px 20px 0; font-size: 18px; font-weight: 600; }
      .bubble { margin: 14px 16px 0; background: #e9e9e6; border-radius: 18px; padding: 12px 14px; font-size: 15px; line-height: 1.35; width: 250px; }
      .bubble.me { margin-left: auto; background: #3c9a5f; color: #fff; width: 170px; }
      .notif { position: absolute; left: 12px; right: 12px; top: 14px; background: rgba(255,255,255,.96); border-radius: 22px; padding: 14px 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,.18); font-size: 15px; line-height: 1.3; opacity: 0; }
      .notif b { display: block; font-size: 14px; color: var(--secondary); font-weight: 600; margin-bottom: 4px; }
      .pflash { position: absolute; inset: 0; background: #fff; opacity: 0; }
      .thumb { position: absolute; left: 16px; bottom: 26px; width: 92px; height: 190px; border-radius: 12px; border: 3px solid #fff; overflow: hidden; opacity: 0;
        box-shadow: 0 8px 20px rgba(0,0,0,.3); background: #f4f4f1; }
      .pile div { position: absolute; width: 250px; height: 180px; border-radius: 10px; background-size: cover; background-position: center; opacity: 0;
        border: 4px solid #fff; box-shadow: 0 10px 26px rgba(31,31,29,.2); }
      .tag { position: absolute; left: 0; right: 0; text-align: center; }
      .tag .big { font-size: 128px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; }
      .tag .sub { margin-top: 26px; font-size: 48px; font-weight: 500; color: var(--secondary); }
      .tagband { position: absolute; left: 0; right: 0; top: 340px; height: 380px; opacity: 0;
        background: linear-gradient(180deg, rgba(252,252,250,0) 0%, rgba(252,252,250,.97) 20%, rgba(252,252,250,.97) 80%, rgba(252,252,250,0) 100%); }
      .wipe { position: absolute; left: 0; right: 0; top: 0; height: 100%; background: var(--page); transform-origin: 0 50%; }
      .turn { position: absolute; left: 0; right: 0; top: 400px; text-align: center; font-size: 104px; font-weight: 600; letter-spacing: -0.02em; }
      .smallname { position: absolute; left: 0; right: 0; top: 560px; display: flex; justify-content: center; align-items: center; gap: 18px; font-size: 52px; font-weight: 600; opacity: 0; }
      .smallname svg { width: 54px; height: 54px; color: var(--ink); }
      .kin { position: absolute; left: 150px; bottom: 150px; font-size: 92px; font-weight: 600; letter-spacing: -0.02em; white-space: nowrap; }
      .kin span { display: inline-block; opacity: 0; }
      .sub2 { position: absolute; left: 0; right: 0; bottom: 40px; display: flex; justify-content: center; pointer-events: none; }
      .sub2 span { display: block; background: rgba(31,31,29,.86); color: #fcfcfa; font-size: 36px; font-weight: 500; line-height: 1; padding: 14px 26px 16px; border-radius: 14px; white-space: nowrap; }
      .speed { position: absolute; font-size: 22px; font-weight: 500; color: #5f5f59; background: rgba(255,255,255,.92); border-radius: 999px; padding: 8px 16px; opacity: 0; white-space: nowrap;
        box-shadow: 0 4px 14px rgba(31,31,29,.1); }
      .cursor { position: absolute; left: 0; top: 0; width: 24px; height: 24px; border-radius: 50%; background: var(--ink); opacity: 0; box-shadow: 0 0 0 4px rgba(31,31,29,.12); }
      .trail { position: absolute; left: 0; top: 0; width: 16px; height: 16px; border-radius: 50%; background: var(--ink); opacity: 0; }
      .caption2 { position: absolute; left: 0; right: 0; text-align: center; font-size: 72px; font-weight: 600; letter-spacing: -0.02em; opacity: 0; }
      .cam { position: absolute; left: 380px; top: 90px; width: 1160px; height: 700px; border-radius: 44px; background: #121211; opacity: 0; box-shadow: 0 30px 90px rgba(31,31,29,.28); }
      .feed { position: absolute; left: 36px; top: 36px; width: 1088px; height: 540px; border-radius: 26px; overflow: hidden; }
      .feed img { position: absolute; left: -30px; top: 0; width: 1150px; height: 600px; object-fit: cover; object-position: center 20%; }
      .focus { position: absolute; left: 470px; top: 180px; width: 150px; height: 150px; border: 2px solid #fff; border-radius: 10px; opacity: 0; }
      .shutter { position: absolute; left: 534px; top: 596px; width: 92px; height: 92px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 6px #121211, 0 0 0 9px rgba(255,255,255,.85); }
      .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
      .roll { position: absolute; width: 30px; height: 44px; overflow: hidden; background: #fff; font-family: ui-monospace, Menlo, monospace; font-size: 36px; font-weight: 600; line-height: 44px; text-align: center; }
      .roll div { will-change: transform; }
      .wifi { position: absolute; left: 1290px; top: 108px; width: 64px; height: 64px; opacity: 0; color: var(--ink); }
      .ink { position: absolute; inset: 0; background: var(--ink); opacity: 0; }
      .endlock { position: absolute; left: 0; right: 0; top: 330px; display: flex; justify-content: center; align-items: center; gap: 36px; opacity: 0; }
      .endlock svg { width: 150px; height: 150px; color: var(--page); }
      .endlock span { font-size: 150px; font-weight: 600; letter-spacing: -0.02em; color: var(--page); line-height: 1; }
      .endline { position: absolute; left: 0; right: 0; text-align: center; color: var(--page); opacity: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="lvl2" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <div class="bg"></div>

      <!-- HOOK: the phone, the GC, the pile -->
      <div id="pile" class="pile">${Array.from({ length: 26 }, (_, i) => `<div style="background-image:url('../assets/photos/${PH[(i * 3) % PH.length]}.jpg')"></div>`).join("")}</div>
      <div id="phone" class="phone"><div class="screen">
        <div class="bar">BSCS 2-A</div>
        <div class="bubble">Who has the slides from Tuesday?</div>
        <div class="bubble me">sent na po</div>
        <div class="bubble">ty!!</div>
        <div id="notif" class="notif"><b>Ma'am Reyes · BSCS 2-A</b>our Biology quiz is MOVED to October 17</div>
        <div id="pflash" class="pflash"></div>
        <div id="thumb" class="thumb"><img src="../assets/gc.png" alt="" style="width:100%;height:100%;object-fit:cover;object-position:left top" /></div>
      </div></div>
      <div id="tagband" class="tagband"></div>
      <div id="tag" class="tag" style="top:420px"><div class="big" id="tagbig">Kailan nga ulit yung quiz?</div><div class="sub" id="tagsub">When was the quiz again?</div></div>

      <!-- TURN -->
      <div id="wipe" class="wipe" style="opacity:0"></div>
      <div id="turn" class="turn" style="opacity:0">What if your laptop just… <span class="accent">knew.</span></div>
      <div id="smallname" class="smallname">${markSvg}<span>DéjàFind</span></div>

      <!-- ANSWER -->
      <div id="typeCard" class="card" style="left:210px;top:330px;width:1500px;border-radius:26px">
        <video id="v-type" class="clip" src="../assets/clips/v2-type.mp4" muted playsinline data-playback-rate="2" data-start="${(S.answer + 0.5).toFixed(2)}" data-duration="${(S.proof - S.answer - 0.5).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      <div id="answerCard" class="card" style="left:160px;top:330px;width:1600px">
        <video id="v-answer" class="clip" src="../assets/clips/v2-answer.mp4" muted playsinline data-start="${(S.answer + 2.25).toFixed(2)}" data-duration="${(S.proof - S.answer - 2.25).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      <div id="cap-answer" class="caption2" style="top:800px">It read the screenshot. <span class="accent">On your laptop.</span></div>
      ${label("lab-answer", `typing ×2 · answer took ${real["l2-find"]} s, cut`, 210, 268)}

      <!-- PROOF HITS -->
      <div id="h1" class="card" style="left:210px;top:120px;width:1500px">
        <video id="lv1" class="clip" src="../assets/clips/l2-sched.mp4" muted playsinline data-playback-rate="1.5" data-start="${H[0].toFixed(2)}" data-duration="${(H[1] - H[0]).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      ${label("lab1", `×1.5 · first read took ${real["l2-sched"]} s, cut`)}
      <div id="h2" class="card" style="left:335px;top:70px;width:1250px">
        <video id="lv2" class="clip" src="../assets/clips/l2-mitosis.mp4" muted playsinline data-playback-rate="1.25" data-start="${H[1].toFixed(2)}" data-duration="${(H[2] - H[1]).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      ${label("lab2", `×1.25 · read took ${real["l2-mitosis"]} s, cut`)}
      <div id="cam" class="cam">
        <div id="feed" class="feed"><img id="feedimg" src="../assets/cam-whiteboard.jpg" alt="" /><div id="focus" class="focus"></div><div id="flash2" class="flash"></div></div>
        <div id="shutter" class="shutter"></div>
      </div>
      <div id="h3" class="card" style="left:335px;top:70px;width:1250px">
        <video id="lv3" class="clip" src="../assets/clips/v2-snaplib.mp4" muted playsinline data-playback-rate="1.3" data-start="${(H[2] + 1.15).toFixed(2)}" data-duration="${(H[3] - H[2] - 1.15).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      ${label("lab3", `×1.3 · read took ${real["l2-snap"]} s, cut`)}
      <div id="h4" class="card" style="left:335px;top:70px;width:1250px">
        <video id="lv4" class="clip" src="../assets/clips/l2-chip.mp4" muted playsinline data-start="${H[3].toFixed(2)}" data-duration="${(H[4] - H[3]).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      <div id="h5" class="card" style="left:520px;top:40px;width:880px">
        <video id="lv5" class="clip" src="../assets/clips/v2-quiz.mp4" muted playsinline data-playback-rate="1.1" data-start="${H[4].toFixed(2)}" data-duration="${(H[5] - H[4]).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      ${label("lab5", `quiz written in 25 s, cut`)}
      <div id="h6" class="card" style="left:410px;top:40px;width:1100px">
        <video id="lv6" class="clip" src="../assets/clips/l2-review.mp4" muted playsinline data-start="${H[5].toFixed(2)}" data-duration="${(H[6] - H[5]).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      ${label("lab6", `written in ${real["l2-review"]} s, cut`)}
      ${kin}

      <!-- THE POINT -->
      <div id="status" class="card" style="left:1120px;top:120px;width:640px"><img src="../assets/stills/status-panel.jpg" alt="" />
        <div id="roll" class="roll" style="left:46px;top:104px"><div id="rollstrip">${[7, 3, 9, 1, 5, 2, 8, 4, 6, 0].map((n) => `<div>${n}</div>`).join("")}</div></div>
      </div>
      <div id="pointHead" class="caption2" style="left:150px;right:auto;text-align:left;top:330px;font-size:104px;line-height:1.04"><span style="display:block">Three small models.</span><span class="accent" style="display:block">Zero requests out.</span></div>
      <div id="q2type" class="card" style="left:160px;top:250px;width:1500px;border-radius:26px">
        <video id="lv7" class="clip" src="../assets/clips/l2-ask2-type.mp4" muted playsinline data-playback-rate="2" data-start="${(S.point + 3.3).toFixed(2)}" data-duration="${(S.close - S.point - 3.3).toFixed(2)}"></video>
      </div>
      <div id="q2answer" class="card" style="left:160px;top:430px;width:1600px">
        <video id="lv8" class="clip" src="../assets/clips/l2-ask2-answer.mp4" muted playsinline data-start="${(S.point + 5.0).toFixed(2)}" data-duration="${(S.close - S.point - 5.0).toFixed(2)}"></video><div class="sweep"></div>
      </div>
      ${label("lab7", `typing ×2 · answer took ${real["l2-ask2"]} s, cut`, 160, 190)}
      <div id="cap-point" class="caption2" style="top:860px">No internet. <span class="accent">Nothing leaves.</span></div>

      <!-- CLOSE -->
      <div id="phone2" class="phone" style="left:520px"><div class="screen" style="background:#fff;padding:60px 18px">
        <img src="../assets/gc.png" alt="" style="width:100%;border-radius:12px;border:1px solid #e6e6e2" />
        <div style="margin-top:22px;font-size:22px;font-weight:600;line-height:1.3"><span style="display:block">October 17 (Saturday)</span><span style="display:block">Room 301 · 1:00 PM</span></div>
        <div style="margin-top:8px;font-size:15px;color:#7a7a74">From your screenshot</div>
      </div></div>
      <div id="closeHead" class="caption2" style="left:960px;right:auto;text-align:left;top:420px;font-size:96px;line-height:1.05"><span style="display:block">Find what you</span><span class="accent" style="display:block">already saw.</span></div>

      <div id="ink" class="ink"></div>
      <div id="endlock" class="endlock">${markSvg}<span>DéjàFind</span></div>
      <div id="endtag" class="endline" style="top:610px;font-size:64px;font-weight:600;letter-spacing:-0.02em">Find what you already saw.</div>
      <div id="endmeta" class="endline" style="top:760px;font-size:34px;font-weight:500;color:#b9b9b2">github.com/keyyum/dejafind · #AppBuildersPH</div>

      <div id="cursor" class="cursor"></div><div id="t1" class="trail"></div><div id="t2" class="trail"></div>

${subs.map((x, i) => `      <div id="s${i}" class="sub2 clip" data-start="${x.t.toFixed(2)}" data-duration="${(x.end - x.t).toFixed(2)}"><span>${x.text}</span></div>`).join("\n")}
    </div>
    <script>
      const S = ${JSON.stringify(S)}, H = ${JSON.stringify(H)}, BEAT = ${BEAT}, END = ${END}, TOTAL = ${TOTAL};
      const tl = gsap.timeline({ paused: true });
      const E = "power3.out";
      const cardIn = (sel, at, from = { y: 60, scale: 0.96 }) => tl.fromTo(sel, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 0.45, ease: E }, at);
      const cardOut = (sel, at, to = { y: -40, scale: 0.98 }) => tl.to(sel, { opacity: 0, ...to, duration: 0.3, ease: "power2.in" }, at);
      const push = (sel, at, d, to = 1.05) => tl.fromTo(sel, { scale: 1 }, { scale: to, duration: d, ease: "none", immediateRender: false }, at);
      const sweep = (sel, at) => tl.fromTo(sel + " .sweep", { x: 0 }, { x: "520%", duration: 0.7, ease: "power2.inOut" }, at);
      const lab = (sel, at, d) => { tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at); tl.to(sel, { opacity: 0, duration: 0.2 }, at + d); };
      const cur = (pts) => { // ink-dot cursor with a lagging trail: [[t, x, y], ...]
        tl.set(["#cursor", "#t1", "#t2"], { x: pts[0][1], y: pts[0][2] }, pts[0][0]);
        tl.to("#cursor", { opacity: 1, duration: 0.2 }, pts[0][0]); tl.to("#t1", { opacity: 0.25, duration: 0.2 }, pts[0][0]); tl.to("#t2", { opacity: 0.12, duration: 0.2 }, pts[0][0]);
        for (let i = 1; i < pts.length; i++) {
          const d = pts[i][0] - pts[i - 1][0];
          tl.to("#cursor", { x: pts[i][1], y: pts[i][2], duration: d, ease: "power2.inOut" }, pts[i - 1][0]);
          tl.to("#t1", { x: pts[i][1] + 4, y: pts[i][2] + 4, duration: d, ease: "power2.inOut" }, pts[i - 1][0] + 0.06);
          tl.to("#t2", { x: pts[i][1] + 4, y: pts[i][2] + 4, duration: d, ease: "power2.inOut" }, pts[i - 1][0] + 0.12);
        }
        const last = pts[pts.length - 1][0];
        tl.to(["#cursor", "#t1", "#t2"], { opacity: 0, duration: 0.25 }, last + 0.3);
      };
      const click = (at) => tl.fromTo("#cursor", { scale: 1 }, { scale: 0.6, duration: 0.08, yoyo: true, repeat: 1 }, at);

      // ---- HOOK ----
      tl.fromTo("#phone", { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: E }, 0.0);
      tl.fromTo("#notif", { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.6)" }, 0.35);
      tl.to("#pflash", { opacity: 0.9, duration: 0.04 }, 1.3); tl.to("#pflash", { opacity: 0, duration: 0.18 }, 1.36);
      tl.fromTo("#thumb", { opacity: 0, scale: 1.6, x: 80, y: -200 }, { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.35, ease: E }, 1.38);
      const pile = [...document.querySelectorAll("#pile div")];
      let seed = 5; const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      pile.forEach((p, i) => {
        const ang = r() * Math.PI * 2, rad = 120 + r() * 560, x = 960 - 125 + Math.cos(ang) * rad * 1.5, y = 490 - 90 + Math.sin(ang) * rad * 0.7;
        tl.set(p, { left: x, top: y }, 0);
        tl.fromTo(p, { opacity: 0, scale: 1.4, rotation: (r() - 0.5) * 40, y: -60 }, { opacity: 1, scale: 1, rotation: (r() - 0.5) * 24, y: 0, duration: 0.3, ease: "back.out(1.3)" }, 1.7 + i * 0.045);
      });
      tl.to("#phone", { scale: 0.94, duration: 2.2, ease: "none" }, 1.7);
      tl.to("#tagband", { opacity: 1, duration: 0.3 }, 2.3);
      tl.fromTo("#tagbig", { opacity: 0, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: E }, 2.35);
      tl.fromTo("#tagsub", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: E }, 2.75);
      tl.fromTo("#tag", { scale: 1 }, { scale: 1.04, duration: 2.4, ease: "none", immediateRender: false }, 2.4);

      // ---- TURN: one wipe clears it ----
      tl.fromTo("#wipe", { opacity: 1, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.45, ease: "power3.inOut" }, S.turn - 0.1);
      tl.set(["#phone", "#pile", "#tag", "#tagband"], { opacity: 0 }, S.turn + 0.35);
      tl.fromTo("#turn", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, S.turn + 0.3);
      tl.fromTo("#smallname", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, S.turn + 1.2);
      tl.fromTo("#turn", { scale: 1 }, { scale: 1.03, duration: 1.8, ease: "none", immediateRender: false }, S.turn + 0.4);
      tl.to(["#turn", "#smallname"], { opacity: 0, y: -24, duration: 0.3, ease: "power2.in" }, S.answer - 0.3);

      // ---- ANSWER FIRST ----
      cardIn("#typeCard", S.answer, { y: 50, scale: 0.97 });
      cur([[S.answer + 0.05, 1500, 900], [S.answer + 0.45, 330, 400]]); click(S.answer + 0.45);
      tl.to("#typeCard", { y: -200, duration: 0.45, ease: "power3.inOut" }, S.answer + 2.0);
      cardIn("#answerCard", S.answer + 2.2, { y: 120, scale: 0.97 }); sweep("#answerCard", S.answer + 2.5);
      push("#answerCard", S.answer + 2.7, 4.6, 1.05);
      lab("#lab-answer", S.answer + 0.6, 2.4);
      tl.fromTo("#cap-answer", { opacity: 0, y: 16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: E }, S.answer + 2.6);
      cardOut("#typeCard", S.proof - 0.3, { y: -300 }); cardOut("#answerCard", S.proof - 0.3); tl.to("#cap-answer", { opacity: 0, duration: 0.25 }, S.proof - 0.3);

      // ---- PROOF HITS (cards land on the caption, captions land on the beat) ----
      const hits = [["#h1", 0], ["#h2", 1], ["#h3", 2], ["#h4", 3], ["#h5", 4], ["#h6", 5]];
      for (const [sel, i] of hits) {
        const t0 = i === 2 ? H[2] + 1.1 : H[i], t1 = H[i + 1];
        cardIn(sel, t0, { y: 80, scale: 0.94, rotation: i % 2 ? 1.2 : -1.2 });
        sweep(sel, t0 + 0.3);
        push(sel, t0 + 0.45, t1 - t0 - 0.7, 1.05);
        cardOut(sel, t1 - 0.25, { y: -40, scale: 1.04 });
        const words = document.querySelectorAll("#k" + i + " span");
        const kAt = i === 2 ? H[2] + 1.1 : H[i];
        words.forEach((w, j) => tl.fromTo(w, { opacity: 0, y: 30, scale: 1.25 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: "back.out(2)" }, kAt + 0.1 + j * BEAT / 2));
        tl.fromTo("#k" + i, { y: 0 }, { y: -6, duration: 0.12, yoyo: true, repeat: 1 }, t0 + 0.45); // the caption bumps when the card lands
        tl.to("#k" + i + " span", { opacity: 0, duration: 0.2 }, t1 - 0.22);
      }
      lab("#lab1", H[0] + 0.4, H[1] - H[0] - 0.7); lab("#lab2", H[1] + 0.3, H[2] - H[1] - 0.6);
      lab("#lab3", H[2] + 1.5, H[3] - H[2] - 1.8); lab("#lab5", H[4] + 0.4, H[5] - H[4] - 0.7); lab("#lab6", H[5] + 0.3, H[6] - H[5] - 0.6);
      // the camera inside hit 3
      tl.fromTo("#cam", { opacity: 0, y: 60, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: E }, H[2]);
      tl.fromTo("#feedimg", { scale: 1.06 }, { scale: 1.12, duration: 1.2, ease: "none" }, H[2]);
      tl.fromTo("#feed", { x: -3 }, { x: 3, duration: 0.25, yoyo: true, repeat: 2, ease: "sine.inOut" }, H[2]);
      tl.fromTo("#focus", { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.25, ease: E }, H[2] + 0.25);
      tl.to("#shutter", { scale: 0.86, duration: 0.06, yoyo: true, repeat: 1 }, H[2] + 0.6);
      tl.to("#flash2", { opacity: 1, duration: 0.03 }, H[2] + 0.66); tl.to("#flash2", { opacity: 0, duration: 0.12 }, H[2] + 0.75);
      tl.to("#feed", { x: -300, y: 140, scale: 0.25, duration: 0.4, ease: "power3.in" }, H[2] + 0.8);
      tl.to("#cam", { opacity: 0, duration: 0.25 }, H[2] + 1.0);

      // ---- THE POINT ----
      cardIn("#status", S.point, { x: 80, y: 0, scale: 0.95 }); sweep("#status", S.point + 0.3);
      tl.fromTo("#rollstrip", { y: 0 }, { y: -9 * 44, duration: 1.0, ease: "power3.out" }, S.point + 0.5);   // rolls, lands on the real 0
      tl.fromTo("#pointHead", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: E }, S.point + 0.3);
      tl.to("#pointHead", { opacity: 0, y: -20, duration: 0.3 }, S.point + 2.9);
      tl.to("#status", { opacity: 0, x: 60, duration: 0.35, ease: "power2.in" }, S.point + 2.9);
      cardIn("#q2type", S.point + 3.2, { y: 50, scale: 0.97 });
      cur([[S.point + 3.25, 1500, 900], [S.point + 3.6, 300, 315]]); click(S.point + 3.6);
      cardIn("#q2answer", S.point + 4.95, { y: 100, scale: 0.97 }); sweep("#q2answer", S.point + 5.2);
      push("#q2answer", S.point + 5.4, S.close - S.point - 5.7, 1.04);
      lab("#lab7", S.point + 3.4, 3.0);
      tl.fromTo("#cap-point", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: E }, S.point + 5.1);
      cardOut("#status", S.close - 0.3); cardOut("#q2type", S.close - 0.3); cardOut("#q2answer", S.close - 0.3); tl.to("#cap-point", { opacity: 0, duration: 0.25 }, S.close - 0.3);

      // ---- CLOSE ----
      tl.fromTo("#phone2", { opacity: 0, y: 50, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: E }, S.close);
      tl.fromTo("#closeHead", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: E }, S.close + 0.3);
      tl.to("#phone2", { scale: 1.03, duration: 2.6, ease: "none" }, S.close + 0.5);
      tl.to("#ink", { opacity: 1, duration: 0.45 }, END - 0.25);
      tl.fromTo("#endlock", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, END + 0.1);
      tl.fromTo("#endtag", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, END + 0.4);
      tl.fromTo("#endmeta", { opacity: 0 }, { opacity: 1, duration: 0.4 }, END + 0.8);

      // subtitles
      document.querySelectorAll(".sub2").forEach((c) => { const st = parseFloat(c.dataset.start), d = parseFloat(c.dataset.duration);
        tl.fromTo(c.firstElementChild, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2 }, st); tl.to(c.firstElementChild, { opacity: 0, duration: 0.15 }, st + d - 0.15); });
      window.__timelines["lvl2"] = tl;
    </script>
  </body>
</html>
`;
mkdirSync(HF + "lvl2", { recursive: true });
writeFileSync(HF + "lvl2/index.html", html);

// ---- sound cues ----
let wn = 0; const wh = (t) => cue(t, ["whoosh1", "whoosh2", "whoosh3"][wn++ % 3]);
wh(0.0); cue(0.35, "pop"); cue(1.3, "click"); cue(1.34, "click2");
for (let i = 0; i < 8; i++) cue(1.7 + i * 0.14, "whoosh3-soft");
cue(2.35, "tick");
wh(S.turn - 0.1); cue(S.turn + 1.2, "chime");
wh(S.answer); cue(S.answer + 0.45, "click3");
for (let k = 0; k < 9; k++) cue(S.answer + 0.55 + k * 0.15, `key${(k % 4) + 1}`);
cue(S.answer + 2.25, "pop");
for (let i = 0; i < 6; i++) { const t0 = i === 2 ? H[2] + 1.1 : H[i]; wh(t0); cue(t0 + 0.35, i === 3 ? "tick" : "chime"); }
cue(H[0] + 1.6, "click3"); // Use it
wh(H[2]); cue(H[2] + 0.66, "click"); cue(H[2] + 0.7, "click2");
cue(H[4] + 1.0, "click3");
wh(S.point); for (let k = 0; k < 5; k++) cue(S.point + 0.5 + k * 0.1, "tick");
wh(S.point + 3.2); for (let k = 0; k < 8; k++) cue(S.point + 3.7 + k * 0.13, `key${(k % 4) + 1}`); cue(S.point + 5.0, "pop");
wh(S.close); cue(END - 1.4, "riser-tail");
writeFileSync(A + "lvl2-cues.json", JSON.stringify({ tag: "lvl2", total: TOTAL, endStart: END, vo: Object.entries(VO).map(([id, t]) => ({ id, t })), sfx }, null, 2));
console.log(`lvl2/index.html ${TOTAL} s · sections ${JSON.stringify(S)} · hits ${JSON.stringify(H)}`);
