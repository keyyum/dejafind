/**
 * Synthetic data for building the UI before the core routes land.
 * Every name, chat, and document here is made up.
 */
import type {
  DateFound,
  DocType,
  DocumentDetail,
  DocumentGroup,
  DocumentSummary,
  DocumentsResponse,
  FlashcardsResponse,
  Quiz,
  ReviewSheetResponse,
  SchedulePending,
  ScheduleResponse,
  SearchResponse,
  StatusResponse,
  Subject,
  SubjectsResponse,
  TimelineEntry,
  WordsResponse,
} from "@/lib/api-types";

const SUBJECTS: Subject[] = [
  { id: "sub-bio", name: "Biology", source: "schedule", count: 0 },
  { id: "sub-calc", name: "Calculus", source: "schedule", count: 0 },
  { id: "sub-fil", name: "Filipino", source: "schedule", count: 0 },
  { id: "sub-phys", name: "Physics", source: "inferred", count: 0 },
];

const subjectName = (id: string | null) =>
  SUBJECTS.find((s) => s.id === id)?.name ?? null;

const HOUR = 3_600_000;
const now = () => Date.now();

function iso(ms: number): string {
  const d = new Date(ms);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}

export function localDay(ms: number): string {
  return iso(ms).slice(0, 10);
}

function dayOffset(days: number): string {
  return localDay(now() + days * 24 * HOUR);
}

interface Seed {
  id: string;
  file: string;
  w: number;
  h: number;
  docType: DocType;
  kind?: "image" | "pdf";
  title: string;
  summary: string;
  tags: string[];
  subjectId: string | null;
  hoursAgo: number;
  text: string;
}

const SEEDS: Seed[] = [
  {
    id: "doc-gc-bio",
    file: "gc-bio-quiz.svg",
    w: 900,
    h: 900,
    docType: "chat",
    title: "Biology quiz moved to Oct 17",
    summary:
      "GC announcement from Ma'am Reyes: the quiz moved to Oct 17 and covers chapters 4 and 5.",
    tags: ["quiz", "cell division", "genetics", "announcement"],
    subjectId: "sub-bio",
    hoursAgo: 1.5,
    text: "Group Chat: BSCS 2-A\n\nMa'am Reyes: Good evening class. Reminder: our Biology quiz is MOVED to October 17 (Friday). Coverage is Chapter 4 and 5, cell division and genetics. Bring calculators.\n\nMarc: noted maam\nHarry: okay po",
  },
  {
    id: "doc-bio-l5",
    file: "bio-lecture5.svg",
    w: 1600,
    h: 1200,
    docType: "slide",
    title: "Lecture 5 · Cell division",
    summary: "Mitosis in four phases, with the metaphase plate and spindle fibres.",
    tags: ["mitosis", "cell cycle", "slides"],
    subjectId: "sub-bio",
    hoursAgo: 3,
    text: "Lecture 5: Cell Division\nMitosis has four phases: prophase, metaphase, anaphase, telophase (PMAT).\nIn metaphase, chromosomes align at the metaphase plate, the cell's equator.\nAnaphase pulls the sister chromatids apart.\nThe quiz will include labeling a diagram of metaphase.",
  },
  {
    id: "doc-calc-ps3",
    file: "calc-ps3.svg",
    w: 1200,
    h: 1600,
    docType: "handout",
    title: "Problem set 3 · Limits",
    summary: "Ten limit problems, due Wednesday before class.",
    tags: ["limits", "problem set"],
    subjectId: "sub-calc",
    hoursAgo: 5,
    text: "Calculus 1, Problem Set 3: Limits\nSubmit on or before October 14 before class.\n1. Evaluate lim x→2 (x² − 4)/(x − 2).\n2. Evaluate lim x→0 sin(x)/x.\n3. Show that lim x→∞ 1/x = 0.",
  },
  {
    id: "doc-bio-wb",
    file: "bio-whiteboard.svg",
    w: 1600,
    h: 900,
    docType: "whiteboard",
    title: "Whiteboard · Photosynthesis",
    summary: "The photosynthesis equation and where light reactions happen.",
    tags: ["photosynthesis", "chloroplast", "equation"],
    subjectId: "sub-bio",
    hoursAgo: 6,
    text: "Photosynthesis\n6CO2 + 6H2O + light → C6H12O6 + 6O2\nLight reactions: thylakoid membrane\nCalvin cycle: stroma",
  },
  {
    id: "doc-fil-slide",
    file: "fil-sanaysay.svg",
    w: 1600,
    h: 1200,
    docType: "slide",
    title: "Sanaysay: Wika at Kultura",
    summary: "Mga gabay sa pagsulat ng sanaysay tungkol sa wika at kultura.",
    tags: ["sanaysay", "wika"],
    subjectId: "sub-fil",
    hoursAgo: 26,
    text: "Sanaysay: Wika at Kultura\nIpasa ang sanaysay sa Oktubre 20.\nHindi bababa sa 500 salita.",
  },
  {
    id: "doc-bio-ch4",
    file: "bio-ch4-handout.svg",
    w: 1200,
    h: 1600,
    docType: "handout",
    kind: "pdf",
    title: "Chapter 4 handout · Genetics",
    summary: "Mendel's laws, Punnett squares, dominant and recessive alleles.",
    tags: ["genetics", "Mendel", "Punnett square"],
    subjectId: "sub-bio",
    hoursAgo: 28,
    text: "Chapter 4: Genetics\nMendel's law of segregation: each parent passes one allele.\nPunnett squares show the possible offspring genotypes.\nThese will be covered in the quiz.",
  },
  {
    id: "doc-phys-lab2",
    file: "phys-lab2.svg",
    w: 1200,
    h: 1600,
    docType: "handout",
    kind: "pdf",
    title: "Lab 2 · Projectile motion",
    summary: "Lab procedure for measuring range at three launch angles.",
    tags: ["projectile", "lab"],
    subjectId: "sub-phys",
    hoursAgo: 30,
    text: "Physics Lab 2: Projectile Motion\nMeasure the range at 30, 45, and 60 degrees.\nLab report due October 11.",
  },
  {
    id: "doc-calc-wb",
    file: "calc-board.svg",
    w: 1600,
    h: 900,
    docType: "whiteboard",
    title: "Whiteboard · Derivative rules",
    summary: "Power, product, and chain rule with one example each.",
    tags: ["derivatives", "chain rule"],
    subjectId: "sub-calc",
    hoursAgo: 50,
    text: "Derivative rules\nPower rule: d/dx xⁿ = n·xⁿ⁻¹\nProduct rule: (fg)' = f'g + fg'\nChain rule: (f∘g)' = f'(g)·g'",
  },
  {
    id: "doc-schedule",
    file: "schedule.svg",
    w: 1170,
    h: 1170,
    docType: "schedule",
    title: "Class schedule · BSCS 2-B",
    summary: "First semester timetable with six subjects.",
    tags: ["schedule", "timetable"],
    subjectId: null,
    hoursAgo: 52,
    text: "BSCS 2-B, First Semester\nBiology · Mon, Wed 9:00–10:30 · Rm 204\nCalculus · Tue, Thu 10:30–12:00 · Rm 301\nFilipino · Mon, Wed 13:00–14:30 · Rm 105\nPhysics · Fri 8:00–11:00 · Lab 2",
  },
  {
    id: "doc-phys-slide",
    file: "phys-slide.svg",
    w: 1600,
    h: 1200,
    docType: "slide",
    title: "Newton's laws of motion",
    summary: "The three laws with a free-body diagram example.",
    tags: ["Newton", "forces"],
    subjectId: "sub-phys",
    hoursAgo: 54,
    text: "Newton's Laws\n1. An object stays at rest or in motion unless acted on.\n2. F = ma\n3. Every action has an equal and opposite reaction.",
  },
  {
    id: "doc-fil-gc",
    file: "fil-gc.svg",
    w: 900,
    h: 1600,
    docType: "chat",
    title: "Filipino 2 GC · reporting groups",
    summary: "Group assignments for next week's reporting.",
    tags: ["reporting", "groups"],
    subjectId: "sub-fil",
    hoursAgo: 75,
    text: "Filipino 2 GC\nSir Dela Cruz: Group 1 mag-uulat sa Lunes. Group 2 sa Miyerkules.\nAna: noted po sir",
  },
  {
    id: "doc-receipt",
    file: "receipt.svg",
    w: 900,
    h: 1200,
    docType: "other",
    title: "Jollibee receipt",
    summary: "Food order, two Chickenjoy meals.",
    tags: ["receipt"],
    subjectId: null,
    hoursAgo: 78,
    text: "Jollibee\nOrder 0423\n2 Chickenjoy w/ rice  ₱298.00\n1 Peach mango pie  ₱45.00\nTotal  ₱343.00",
  },
  {
    id: "doc-calc-gc",
    file: "calc-quiz-gc.svg",
    w: 900,
    h: 900,
    docType: "chat",
    title: "Calculus GC · long quiz coverage",
    summary: "The long quiz covers limits and continuity.",
    tags: ["quiz", "limits"],
    subjectId: "sub-calc",
    hoursAgo: 99,
    text: "Calculus GC\nSir Santos: Long quiz covers limits and continuity. Review problem sets 2 and 3.",
  },
  {
    id: "doc-bio-mitosis",
    file: "bio-slide-mitosis.svg",
    w: 1600,
    h: 1200,
    docType: "slide",
    title: "Mitosis · PMAT diagram",
    summary: "A labelled diagram of the four phases of mitosis.",
    tags: ["mitosis", "diagram"],
    subjectId: "sub-bio",
    hoursAgo: 101,
    text: "Mitosis: PMAT\nProphase: chromosomes condense.\nMetaphase: chromosomes line up at the middle.\nAnaphase: chromatids separate.\nTelophase: two nuclei form.",
  },
];

function toSummary(s: Seed, base = now()): DocumentSummary {
  const capturedMs = base - s.hoursAgo * HOUR;
  return {
    id: s.id,
    kind: s.kind ?? "image",
    status: "done",
    docType: s.docType,
    title: s.title,
    summary: s.summary,
    tags: s.tags,
    subjectId: s.subjectId,
    subjectName: subjectName(s.subjectId),
    capturedAt: iso(capturedMs),
    width: s.w,
    height: s.h,
    thumbUrl: `/mock/${s.file}`,
    fileUrl: `/mock/${s.file}`,
    filedAt: iso(capturedMs + 8000),
    comingUpCount: allDates().filter((d) => d.documentId === s.id && d.status === "auto").length,
  };
}

let datesCache: DateFound[] | null = null;
function datesSeed(): DateFound[] {
  return [
  {
    id: "date-phys-lab",
    documentId: "doc-phys-lab2",
    isoDate: "2026-10-11",
    label: "Physics lab report",
    confidence: 1,
    span: "October 11",
    status: "auto",
  },
  {
    id: "date-calc-ps3",
    documentId: "doc-calc-ps3",
    isoDate: "2026-10-14",
    label: "Problem set 3 due",
    confidence: 1,
    span: "October 14",
    status: "auto",
  },
  {
    id: "date-bio-quiz",
    documentId: "doc-gc-bio",
    isoDate: "2026-10-17",
    label: "Biology quiz, chapters 4 and 5",
    confidence: 1,
    span: "October 17 (Friday)",
    status: "auto",
  },
  {
    id: "date-fil-essay",
    documentId: "doc-fil-slide",
    isoDate: "2026-10-20",
    label: "Sanaysay due",
    confidence: 0.5,
    span: "Oktubre 20",
    status: "review",
  },
  {
    id: "date-receipt",
    documentId: "doc-receipt",
    isoDate: dayOffset(-3),
    label: "Receipt date",
    confidence: 1,
    span: "Order 0423",
    status: "ignored",
  },
];
}
const allDates = () => (datesCache ??= datesSeed());

/** Mutable mock state so PATCH and import calls feel real during a session. */
const state = {
  docs: new Map<string, DocumentSummary>(),
  extra: [] as DocumentSummary[],
};
function ensure() {
  if (state.docs.size) return;
  for (const s of SEEDS) state.docs.set(s.id, toSummary(s));
}

function dayLabel(day: string): string {
  const today = localDay(now());
  const yesterday = localDay(now() - 24 * HOUR);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function mockAllDocuments(): DocumentSummary[] {
  ensure();
  return [...state.extra, ...state.docs.values()].sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  );
}

export function mockDocuments(subject?: string | null): DocumentsResponse {
  let docs = mockAllDocuments();
  if (subject && subject !== "all") {
    docs = docs.filter((d) =>
      subject === "other" ? d.subjectId === null : d.subjectId === subject,
    );
  }
  const groups = new Map<string, DocumentGroup>();
  for (const d of docs) {
    const day = d.capturedAt.slice(0, 10);
    if (!groups.has(day)) groups.set(day, { day, label: dayLabel(day), documents: [] });
    groups.get(day)!.documents.push(d);
  }
  return { groups: [...groups.values()], total: docs.length };
}

export function mockDocument(id: string): DocumentDetail | null {
  ensure();
  const summary = state.docs.get(id) ?? state.extra.find((d) => d.id === id);
  if (!summary) return null;
  const seed = SEEDS.find((s) => s.id === id);
  return {
    ...summary,
    text: seed?.text ?? "",
    dates: allDates().filter((d) => d.documentId === id),
    readMs: 4800,
    path: `/Users/student/Desktop/${seed?.file ?? id}`,
    cleanUrl: null,
    pages: summary.kind === "pdf" ? 3 : 1,
    scheduleSection: summary.docType === "schedule" ? "BSCS 2-B" : null,
    error: null,
  };
}

export function mockPatchDocument(
  id: string,
  patch: { title?: string; subjectId?: string | null },
): DocumentSummary | null {
  ensure();
  const d = state.docs.get(id) ?? state.extra.find((x) => x.id === id);
  if (!d) return null;
  if (patch.title !== undefined) d.title = patch.title;
  if (patch.subjectId !== undefined) {
    d.subjectId = patch.subjectId;
    d.subjectName = subjectName(patch.subjectId);
  }
  return d;
}

export function mockDeleteDocument(id: string) {
  ensure();
  state.docs.delete(id);
  state.extra = state.extra.filter((d) => d.id !== id);
}

export function mockPatchDate(id: string, status: "auto" | "ignored") {
  const d = allDates().find((x) => x.id === id);
  if (d) d.status = status;
}

export function mockSubjects(): SubjectsResponse {
  const docs = mockAllDocuments();
  return {
    subjects: SUBJECTS.map((s) => ({
      ...s,
      count: docs.filter((d) => d.subjectId === s.id).length,
    })),
    otherCount: docs.filter((d) => d.subjectId === null).length,
    total: docs.length,
  };
}

export function mockTimeline(): { entries: TimelineEntry[] } {
  ensure();
  const soonLimit = now() + 48 * HOUR;
  const entries = allDates().filter((d) => d.status === "auto")
    .map((d): TimelineEntry => {
      const doc = state.docs.get(d.documentId);
      return {
        id: d.id,
        documentId: d.documentId,
        documentTitle: doc?.title ?? "",
        subjectId: doc?.subjectId ?? null,
        subjectName: doc?.subjectName ?? null,
        isoDate: d.isoDate,
        label: d.label,
        status: d.status,
        soon: new Date(`${d.isoDate}T23:59:59`).getTime() <= soonLimit,
      };
    })
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return { entries };
}

const scheduleState: ScheduleResponse = { section: null, entries: [], pending: null };

export function mockSchedule(): ScheduleResponse {
  return scheduleState;
}

export function mockPendingSchedule(): SchedulePending {
  const day = (weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6, subjectName: string, start: string, end: string, room: string) => ({
    subjectName,
    weekday,
    start,
    end,
    room,
    section: "BSCS 2-B",
  });
  scheduleState.pending = {
    documentId: "doc-schedule",
    section: "BSCS 2-B",
    subjects: ["Biology", "Calculus", "Filipino", "Physics", "Data Structures", "PE 3"],
    entries: [
      day(1, "Biology", "09:00", "10:30", "Rm 204"),
      day(2, "Calculus", "10:30", "12:00", "Rm 301"),
      day(1, "Filipino", "13:00", "14:30", "Rm 105"),
      day(5, "Physics", "08:00", "11:00", "Lab 2"),
      day(3, "Data Structures", "13:00", "16:00", "CL 1"),
      day(4, "PE 3", "15:00", "17:00", "Gym"),
    ],
  };
  return scheduleState.pending;
}

export function mockConfirmSchedule(confirm: boolean): ScheduleResponse {
  if (confirm && scheduleState.pending) scheduleState.section = scheduleState.pending.section;
  scheduleState.pending = null;
  return scheduleState;
}

export function mockSearch(q: string, subjectId?: string | null): SearchResponse {
  const query = q.trim().toLowerCase();
  const isQuestion = /\?$|^(when|what|where|who|how|why|which|is|are|do|does|kailan|ano)\b|'s\b/.test(query);
  const words = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  let docs = mockAllDocuments();
  if (subjectId) docs = docs.filter((d) => (subjectId === "other" ? d.subjectId === null : d.subjectId === subjectId));
  const results = docs
    .map((doc) => {
      const text = SEEDS.find((s) => s.id === doc.id)?.text ?? doc.summary;
      const lines = text.split("\n").filter(Boolean);
      let best = { line: lines[0] ?? "", hits: 0 };
      for (const line of lines) {
        const low = line.toLowerCase();
        const hits = words.filter((w) => low.includes(w)).length;
        if (hits > best.hits) best = { line, hits };
      }
      const titleHits = words.filter((w) => doc.title.toLowerCase().includes(w)).length;
      const matches: [number, number][] = [];
      const low = best.line.toLowerCase();
      for (const w of words) {
        let i = low.indexOf(w);
        while (i >= 0) {
          matches.push([i, i + w.length]);
          i = low.indexOf(w, i + w.length);
        }
      }
      matches.sort((a, b) => a[0] - b[0]);
      return { document: doc, snippet: best.line, matches, score: best.hits * 2 + titleHits };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const bio = results.find((r) => r.document.id === "doc-gc-bio");
  const answer =
    isQuestion && bio && /quiz|bio/.test(query)
      ? {
          text: "Your Biology quiz is on Friday, October 17. It covers chapters 4 and 5, cell division and genetics.",
          keyFact: "Friday, October 17",
          citations: [
            {
              documentId: "doc-gc-bio",
              lines: [
                "Reminder: our Biology quiz is MOVED to October 17 (Friday). Coverage is Chapter 4 and 5, cell division and genetics.",
              ],
            },
            {
              documentId: "doc-bio-ch4",
              lines: ["These will be covered in the quiz."],
            },
          ],
        }
      : null;
  return {
    q,
    isQuestion,
    answer,
    notInDocuments: isQuestion && !answer,
    results,
    conversationId: null,
    tookMs: 900,
  };
}

const STOP = new Set(["the", "and", "when", "what", "where", "who", "how", "why", "which", "my", "is", "are", "for", "with", "slide"]);

export function mockQuiz(): Quiz {
  ensure();
  const ids = ["doc-bio-l5", "doc-bio-ch4", "doc-bio-wb", "doc-gc-bio", "doc-bio-mitosis"];
  const sources = Object.fromEntries(ids.map((id) => [id, state.docs.get(id)!]));
  return {
    id: "quiz-mock",
    subjectId: "sub-bio",
    subjectName: "Biology",
    documentIds: ids,
    tookMs: 6400,
    sources,
    questions: [
      {
        id: "q1",
        question: "During which phase of mitosis do the chromosomes line up along the middle of the cell?",
        choices: ["Prophase", "Metaphase", "Anaphase", "Telophase"],
        answerIndex: 1,
        explanation: "Your Lecture 5 slide says chromosomes align at the metaphase plate, the cell's equator.",
        sourceDocumentId: "doc-bio-l5",
      },
      {
        id: "q2",
        question: "What does a Punnett square show?",
        choices: [
          "The phases of the cell cycle",
          "The possible offspring genotypes",
          "Where photosynthesis happens",
          "The order of DNA bases",
        ],
        answerIndex: 1,
        explanation: "The Chapter 4 handout: Punnett squares show the possible offspring genotypes.",
        sourceDocumentId: "doc-bio-ch4",
      },
      {
        id: "q3",
        question: "Where do the light reactions of photosynthesis happen?",
        choices: ["Stroma", "Nucleus", "Thylakoid membrane", "Cell wall"],
        answerIndex: 2,
        explanation: "The whiteboard photo lists light reactions on the thylakoid membrane.",
        sourceDocumentId: "doc-bio-wb",
      },
      {
        id: "q4",
        question: "Which chapters does the Biology quiz cover?",
        choices: ["Chapters 1 and 2", "Chapter 3 only", "Chapters 4 and 5", "Chapters 5 and 6"],
        answerIndex: 2,
        explanation: "Ma'am Reyes wrote in the GC: coverage is chapters 4 and 5.",
        sourceDocumentId: "doc-gc-bio",
      },
      {
        id: "q5",
        question: "In which phase do sister chromatids separate?",
        choices: ["Anaphase", "Prophase", "Metaphase", "Interphase"],
        answerIndex: 0,
        explanation: "The PMAT diagram: in anaphase the chromatids separate.",
        sourceDocumentId: "doc-bio-mitosis",
      },
    ],
  };
}

export function mockFlashcards(): FlashcardsResponse {
  ensure();
  const card = (id: string, term: string, definition: string, sourceDocumentId: string) => ({ id, term, definition, sourceDocumentId });
  const cards = [
    card("f1", "Metaphase", "The phase of mitosis where chromosomes line up at the metaphase plate, the cell's equator.", "doc-bio-l5"),
    card("f2", "Anaphase", "Sister chromatids are pulled apart toward opposite poles.", "doc-bio-mitosis"),
    card("f3", "Punnett square", "A grid that shows the possible offspring genotypes from two parents.", "doc-bio-ch4"),
    card("f4", "Law of segregation", "Each parent passes on one allele for each trait.", "doc-bio-ch4"),
    card("f5", "Thylakoid membrane", "Where the light reactions of photosynthesis happen.", "doc-bio-wb"),
    card("f6", "Calvin cycle", "The light-independent reactions in the stroma that build glucose.", "doc-bio-wb"),
  ];
  const sources = Object.fromEntries([...new Set(cards.map((c) => c.sourceDocumentId))].map((id) => [id, state.docs.get(id)!]));
  return { cards, sources };
}

export function mockReview(): ReviewSheetResponse {
  return {
    subjectId: "sub-bio",
    subjectName: "Biology",
    tookMs: 7200,
    lines: [
      { text: "Quiz on Oct 17 covers chapters 4 and 5: cell division and genetics. Bring a calculator.", documentId: "doc-gc-bio" },
      { text: "Mitosis runs prophase, metaphase, anaphase, telophase (PMAT).", documentId: "doc-bio-mitosis" },
      { text: "In metaphase, chromosomes align at the metaphase plate.", documentId: "doc-bio-l5" },
      { text: "Anaphase pulls the sister chromatids apart.", documentId: "doc-bio-l5" },
      { text: "Mendel's law of segregation: each parent passes one allele.", documentId: "doc-bio-ch4" },
      { text: "Punnett squares show the possible offspring genotypes.", documentId: "doc-bio-ch4" },
      { text: "Photosynthesis: 6CO2 + 6H2O + light → C6H12O6 + 6O2.", documentId: "doc-bio-wb" },
      { text: "Light reactions happen in the thylakoid membrane; the Calvin cycle in the stroma.", documentId: "doc-bio-wb" },
    ],
  };
}

/** Approximate word boxes for the mock GC screenshot (public/mock/gc-bio-quiz.svg, 28px text). */
export function mockWords(id: string): WordsResponse | null {
  if (id !== "doc-gc-bio") return null;
  const rows: [string, number, number, boolean?][] = [
    ["Ma'am Reyes", 128, 224],
    ["Good evening class. Reminder: our Biology", 128, 266],
    ["quiz is MOVED to October 17 (Friday).", 128, 304],
    ["Coverage is Chapter 4 and 5, cell division", 128, 342],
    ["and genetics. Bring calculators.", 128, 380],
    ["noted maam", 712, 476, true],
    ["okay po", 740, 554, true],
  ];
  const cw = 14;
  const words: WordsResponse["words"] = [];
  for (const [line, x0, base, centered] of rows) {
    let x = centered ? x0 - (line.length * cw) / 2 : x0;
    for (const w of line.split(" ")) {
      words.push({ text: w, x, y: base - 24, width: w.length * cw, height: 32 });
      x += (w.length + 1) * cw;
    }
  }
  return { words, width: 900, height: 900 };
}

export function mockStatus(): StatusResponse {
  return {
    requestsOut: 0,
    ollamaReachable: true,
    models: [
      { name: "qwen2.5vl:3b", params: "3B", sizeBytes: 3_200_000_000, role: "vision", loaded: true },
      { name: "qwen3:4b", params: "4B", sizeBytes: 2_500_000_000, role: "text", loaded: true },
      { name: "nomic-embed-text", params: "137M", sizeBytes: 274_000_000, role: "embedding", loaded: true },
    ],
    avgReadMs: null,
    documentsRead: mockAllDocuments().length,
    queued: 0,
    watching: ["~/Desktop", "~/Downloads", "data/watch"],
    machine: "Apple M4, 16 GB",
    startedAt: iso(now() - 2 * HOUR),
  };
}

/** Builds the queued and filed versions of a fresh capture, for simulating the demo on mock. */
export function mockNewCapture(): { queued: DocumentSummary; filed: DocumentSummary; dates: TimelineEntry[] } {
  ensure();
  const n = state.extra.length + 1;
  const id = `doc-new-${n}-${now()}`;
  const base: DocumentSummary = {
    ...toSummary(SEEDS[0]),
    id,
    status: "queued",
    title: "",
    summary: "",
    tags: [],
    subjectId: null,
    subjectName: null,
    capturedAt: iso(now()),
    thumbUrl: null,
    filedAt: null,
    comingUpCount: 0,
  };
  const filed: DocumentSummary = {
    ...toSummary(SEEDS[0]),
    id,
    capturedAt: base.capturedAt,
    filedAt: iso(now() + 3000),
  };
  const dates: TimelineEntry[] = [
    {
      id: `date-${id}`,
      documentId: id,
      documentTitle: filed.title,
      subjectId: "sub-bio",
      subjectName: "Biology",
      isoDate: "2026-10-17",
      label: "Biology quiz, chapters 4 and 5",
      status: "auto",
      soon: false,
    },
  ];
  state.extra.unshift(base);
  return { queued: base, filed, dates };
}

export function mockFinishCapture(filed: DocumentSummary) {
  const i = state.extra.findIndex((d) => d.id === filed.id);
  if (i >= 0) state.extra[i] = filed;
}
