# DéjàFind, the Offline Study Brain

**One line.** It watches your files, organizes them, and answers your questions. No upload, no internet.

**Hackathon.** AppBuildersPH Hackathon 2026, theme Local AI. Submission 10:00 AM Oct 10 2026 Manila. Judging: 25% problem and usefulness, 25% local-AI implementation, 20% technical execution, 15% innovation, 15% product and demo.

## Who it's for

Built for students first, works for anyone with files. The student: a camera roll full of slide and whiteboard photos never opened again, deadlines scattered across the LMS, slides, and Messenger group chats. Students already photograph slides; the product fixes what happens after.

## Core three for the demo

1. **Snap, file, timeline.** No upload button. The app watches Screenshots, Downloads, and a drop folder. A new photo, screenshot, or PDF is read, titled, summarized, tagged by subject, and saved by itself. Every date found lands on one timeline with the source file beside it.
2. **Ask your files.** "When's my bio quiz?" Answers come only from your own files, cite the file, and show it. If nothing matches, it says "not in your files".
3. **Summary on every file.** Title, one-line summary, tags, for every file, acad or not. IMG_4821 becomes "Bio lecture 5, cell division, quiz Oct 17". Tags decide what is a school subject and what is a receipt or personal.

**Stretch, only if the core is working by 05:00.** Quiz: "quiz me on Biology", five questions generated from your own files, graded, with the source shown.

## Not in scope for the hackathon

Reviewer sheets, flashcards, calendar sync, reminders, phone app, sync or backup, share sheet, camera-roll import, auto-written lecture notes, social features, streaks, grade prediction.

## Why local AI

A website cannot watch your folders. It has to ask you to upload. Only something running on your machine can organize files as they arrive. Also: works with no signal and no load (under half of Philippine households have home internet), zero cost per file so a free app stays free at high volume, class photos and personal screenshots never leave the device, results are instant.

## What nobody else does

No product found combines offline, auto-filing by subject, a deadline timeline, and cited Q&A over your own files. Pixel Screenshots needs a Pixel 9 and caps at 15 images a day. NotebookLM cites sources but is cloud-only and you file by hand. Apple's visual intelligence does one calendar event at a time. SnapClass files by timetable but lists no dates, no Q&A, no offline claim. Microsoft Lens was retired in 2025.

On stage say "the only one we found that does all of this offline", never "the only one".

## Not a chatbot

A chatbot waits for you to type. DéjàFind works even if you never type anything. The main screen is Files, Subjects, Timeline, and an Ask bar. Asking is the bonus.

## Non-acad files

Same engine, minus the quiz. Find by meaning ("the GCash I sent to Ate Jen last week"), ask ("how much did I pay Shopee last month"), dates (bills, tickets, bookings land on the same timeline), amounts (receipts can be totaled). Mention in one line in Q&A, do not demo.

## Platform

Laptop web app for the hackathon: Next.js UI plus a local server on the same machine, opened at localhost. Phone next. The models are 2 to 4 billion parameters because they fit in a phone's memory.

## Stage claims that are safe

- "Everything runs on this laptop with Wi-Fi off." Show the network monitor at zero.
- "We use small models, roughly 2 to 4 billion parameters, because they fit in a phone's memory."
- Quote only latencies measured on this machine, and say the machine and the number of files.
- "Measured on N of our own files," never a public benchmark.
- Do not claim handwriting accuracy until it is scored.
