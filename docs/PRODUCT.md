# DéjàFind, the Offline Study Brain

**One line.** Snap your slides, screenshot your GC, drop your LMS files. DéjàFind files them by subject, puts every deadline on one timeline, and quizzes you from your own notes. No upload, no internet.

**Hook.** You already take the photos. Nobody ever studies from them. We made the photos study you back.

**Hackathon.** AppBuildersPH Hackathon 2026, theme Local AI. Submission 10:00 AM Oct 10 2026 Manila. Judging: 25% problem and usefulness, 25% local-AI implementation, 20% technical execution, 15% innovation, 15% product and demo.

## Who it's for

Students. Only students. Not "anyone with files"; a general file finder is a search box with a story bolted on. The student: a camera roll full of slide and whiteboard photos never opened again, deadlines scattered across the LMS, slides, and Messenger group chats. Students already photograph slides; the product fixes what happens after.

## Inputs

Class materials only: photos of slides and whiteboards, handouts, GC screenshots, PDFs and slide decks from the LMS. No upload button. The app watches Screenshots, Downloads, and a drop folder. Anything that is not class material is tagged Other and left alone. That is not a feature and is not mentioned on stage.

## Core four for the demo

1. **Snap, file, timeline.** A new photo, screenshot, or PDF is read, titled, summarized, and filed under its subject by itself. Every date found lands on one timeline with the source beside it. The home screen is Subjects, not files; open Biology and you see this week's captures, the next deadline, and a "quiz me" button.
2. **Ask your notes.** "When's my bio quiz?" "What did sir say about mitosis?" Answers come only from your own captures, scoped to a subject or all, cite the capture, and show it. If nothing matches, it says "not in your notes". It is a conversation: follow-ups like "explain that simpler" or "what's chapter 5 about" keep the context of the last few turns. An optional **Explain** switch, off by default, lets the model add general knowledge, always labeled "not from your notes". Never call it a chatbot on stage; it is "ask your notes, and it remembers the conversation".
3. **Summary on every capture.** Title, one-line summary, tags. IMG_4821 becomes "Bio lecture 5, cell division, quiz Oct 17".
4. **Quiz me.** "Quiz me on Biology": five questions generated from your own captures, graded, with the source shown. This is core. It is the first thing cut if time runs out, but a study brain that does not quiz you is a folder.

## Tier 2, only after the core four and the network panel are proven (target 05:00 to 06:30)

- **Reviewer sheet.** One prompt over a subject's captures; every line cites its source capture.
- **Flashcards.** Term and definition pairs from captures, flip UI. No spaced repetition.
- **Add to calendar.** Export the timeline as an .ics file that opens in Apple or Google Calendar. No two-way sync.

## Tier 3, only if tier 2 is done before 07:00

- **Reminders.** A macOS notification before a deadline. Low demo value.
- **Study streak.** Counts days you quizzed, never days you captured.
- **Clean notes from a whiteboard photo.** Messy board to editable typed text. The model can misread; show the source photo beside it.

At 07:00 everything stops. Remaining hours go to the video, the post, and the form.

## Never

Social features (sharing, feeds, group rooms, note marketplace: all need accounts and a server), two-way calendar sync, phone app, backup or sync, share sheet, camera-roll import, grade prediction.

## Why local AI

A website cannot watch your folders. It has to ask you to upload. Only something running on your machine can organize files as they arrive. Also: works with no signal and no load (under half of Philippine households have home internet), zero cost per file so a free app stays free at high volume, class photos and personal screenshots never leave the device, results are instant.

## What nobody else does

No product found combines offline, auto-filing by subject, a deadline timeline, and cited Q&A over your own files. Pixel Screenshots needs a Pixel 9 and caps at 15 images a day. NotebookLM cites sources but is cloud-only and you file by hand. Apple's visual intelligence does one calendar event at a time. SnapClass files by timetable but lists no dates, no Q&A, no offline claim. Microsoft Lens was retired in 2025.

On stage say "the only one we found that does all of this offline", never "the only one".

## Not a chatbot

A chatbot waits for you to type. DéjàFind works even if you never type anything. The main screen is Subjects, with Timeline and Quiz tabs and an Ask bar. Asking is the bonus.

## Non-acad files

Indexed anyway, because the pipeline runs on every file: a receipt gets a title, summary, and the tag Other, and is searchable. It gets no subject, no timeline entry, no quiz, and no mention in the pitch. If a judge asks: "it handles them, we built for class".

## Platform

Laptop web app for the hackathon: Next.js UI plus a local server on the same machine, opened at localhost. Phone next. The models are 2 to 4 billion parameters because they fit in a phone's memory.

## Stage claims that are safe

- "Everything runs on this laptop with Wi-Fi off." Show the network monitor at zero.
- "We use small models, roughly 2 to 4 billion parameters, because they fit in a phone's memory."
- Quote only latencies measured on this machine, and say the machine and the number of files.
- "Measured on N of our own files," never a public benchmark.
- Do not claim handwriting accuracy until it is scored.
