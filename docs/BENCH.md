# Benchmark, measured on this machine

Machine: Apple M4, 16 GB. Models loaded: nomic-embed-text, qwen2.5vl:3b, qwen3:4b. Server started 2026-10-09T21:08:51.060Z. Run at 2026-10-09T21:08:56.216Z.
All numbers below are wall-clock from the public API on one server with nothing else using Ollama. Model output varies between runs; the times are what to expect, not a promise.

## Reading documents (drop to filed)

| File | Kind | Subject | Dates | Model read | Drop to filed |
|---|---|---|---|---|---|
| timetable-bscs-2b.png (first read after start) | schedule | Other | 2026-10-09 (ignored) | 21.9 s | 39.1 s |
| (schedule confirmed: 6 subjects) | | | | | 0.0 s |
| gc-biology-quiz-oct17.png | chat | Biology | 2026-10-17 | 10.1 s | 12.0 s |
| bio-mitosis-slide.jpg | handout | Biology | none | 8.5 s | 9.5 s |
| whiteboard-photosynthesis.jpg | handout | Biology | 2026-10-17 | 8.3 s | 8.5 s |
| calc-limits-slide.png | slide | Calculus | none | 8.5 s | 9.0 s |
| calc-longquiz-handout.jpg | handout | Calculus | 2026-10-19 | 13.2 s | 13.5 s |
| gc-calculus-longquiz-oct19.png | chat | Calculus | 2026-10-19 | 13.5 s | 14.1 s |
| physics-kinematics-slide.png | handout | Physics | none | 10.3 s | 12.1 s |
| physics-lab-handout.pdf | handout | Physics | 2026-10-11 | 38.1 s | 39.7 s |
| sanaysay-wika-kultura.jpg | handout | Filipino | 2026-10-13 | 17.4 s | 18.1 s |
| jollibee-receipt.jpg | pdf | Other | 2026-10-09 (ignored) | 19.2 s | 20.8 s |

First read after server start: **39.1 s** (model load included). Warm reads, 10 files: average **15.7 s** drop to filed, model read 14.7 s on average, fastest 8.5 s, slowest 39.7 s.

## Search and answers

| Query | Kind | Time | Result |
|---|---|---|---|
| jollibee | keyword | 0.1 s | top: Jollibee Receipt |
| photosynthesis equation | keyword | 0.1 s | top: Photosynthesis |
| when's my bio quiz | question | 10.6 s | "Your Biology quiz is on October 17 (Saturday) in Room 301 at 1:00 PM." citing 1 line(s) |
| what room is the bio quiz in | question | 9.7 s | "The bio quiz is in Room 301." citing 1 line(s) |
| when is the calculus long quiz | question | 14.1 s | "The calculus long quiz is on Monday, October 19, 2026." citing 2 line(s) |

## Study tools (subject: Biology)

| Tool | Time | Result |
|---|---|---|
| Quiz | 60.7 s | 5 questions |
| Flashcards | 37.8 s | 7 cards |
| Reviewer sheet | 44.1 s | 10 lines |
| Word boxes (Apple Vision) | 17.7 s | 57 words |
| Calendar export (.ics) | 0.0 s | 6 events |

## Network

Outbound requests counted by the server during this whole run: **0** (counter at 0). Documents read: 11. Watching: /Users/edriantala/dejafind/data/watch, /Users/edriantala/Desktop, /Users/edriantala/Downloads.
