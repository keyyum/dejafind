# Voice-over with edge-tts (Microsoft neural TTS, online), one file per caption phrase so each
# caption is timed to its own audio. Founder's choice for the demo video only; the product
# itself makes no network calls. Run with the Pawi kit's venv:
#   ~/Desktop/Pawi-Reset-Lanes/video/v2/venv/bin/python video/tools/tts_edge.py
import asyncio, json, os, subprocess, edge_tts
ROOT = os.path.join(os.path.dirname(__file__), "..", "audio")
VOICE, RATE = "en-US-AndrewMultilingualNeural", "+4%"
FIX = {"Day-zha-find.": "DéjàFind.", "Day-zha-find. Find what you already saw.": "DéjàFind. Find what you already saw.",
       "Screenshot the G C. That's all.": "Screenshot the GC. That's all.",
       "Slides, whiteboards, P D Fs, filed by subject.": "Slides, whiteboards, PDFs, filed by subject.",
       "and puts October seventeenth on your timeline.": "and puts October 17 on your timeline."}
async def one(path, text):
    c = edge_tts.Communicate(text, VOICE, rate=RATE)
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
async def main():
    import sys
    if len(sys.argv) > 1:  # a flat list of {id, text} (the backup captions), written to vo-edge/<id>.mp3
        os.makedirs(os.path.join(ROOT, "vo-edge"), exist_ok=True)
        for item in json.load(open(sys.argv[1])):
            await one(os.path.join(ROOT, "vo-edge", item["id"] + ".mp3"), item["text"])
            print(item["id"], item["text"])
        return
    beats = json.load(open(os.path.join(ROOT, "vo.json")))
    os.makedirs(os.path.join(ROOT, "vo-edge"), exist_ok=True)
    for bi, b in enumerate(beats):
        for pi, p in enumerate(b["phrases"]):
            text = FIX.get(p["tts"], p["tts"])
            mp3 = os.path.join(ROOT, "vo-edge", f"{bi}-{pi}.mp3")
            await one(mp3, text)
            print(bi, pi, text)
asyncio.run(main())
