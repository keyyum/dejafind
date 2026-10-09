#!/usr/bin/env bash
# Final takes for the demo video, run inside a quiet Ollama window.
# Fresh database, synthetic files only, real app on :3103 under `next start`.
#   bash video/tools/final.sh <take>
set -euo pipefail
cd "$(dirname "$0")/../.."
TAKE="${1:-1}"
T=video/takes
S=data/samples/demo
STAMP=$(date +%H%M%S)

# 1. fresh data dir (the previous one is kept under video/takes, which is gitignored)
pkill -f "next start -p 3103" || true
sleep 1
mkdir -p "$T/old-data-$STAMP" data/watch
mv data/dejafind.sqlite* data/derived "$T/old-data-$STAMP/" 2>/dev/null || true
rm -f data/watch/*
(npx next start -p 3103 > "$T/server-$TAKE.log" 2>&1 &)
for _ in $(seq 1 30); do curl -sf localhost:3103/api/status >/dev/null && break; sleep 1; done

idle() { # wait until the pipeline queue is empty
  sleep 2
  for _ in $(seq 1 120); do
    q=$(curl -s localhost:3103/api/status | grep -o '"queued":[0-9]*' | cut -d: -f2)
    [ "$q" = "0" ] && return 0
    sleep 1
  done
  echo "queue never drained" >&2; return 1
}

# 2. library before the demo starts (also warms the vision and text models)
for f in calc-limits-slide.png physics-kinematics-slide.png physics-lab-handout.pdf sanaysay-wika-kultura.jpg calc-longquiz-handout.jpg ${WITH_CALC_GC:+gc-calculus-longquiz-oct19.png}; do
  cp "$S/$f" data/watch/
  idle
  echo "in: $f"
done
curl -s -X POST localhost:3103/api/search -H 'content-type: application/json' -d '{"q":"what is a limit"}' >/dev/null || true

# 3. browser with the whiteboard as the fake camera
pkill -f "user-data-dir=$PWD/$T/profile" || true
sleep 1
node video/tools/launch.mjs board

# 4. beats, in demo-script order
for beat in schedule watch snap find drop quiz status; do
  echo "== $beat"
  node video/tools/scene.mjs "$beat" "$TAKE"
done
curl -s localhost:3103/api/status > "$T/status-$TAKE.json"
echo "done: $(cat "$T/status-$TAKE.json" | grep -o '"avgReadMs":[^,]*,"documentsRead":[0-9]*')"
