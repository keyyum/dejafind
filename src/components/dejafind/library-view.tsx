"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DocumentGroup,
  DocumentSummary,
  SubjectsResponse,
  ScheduleResponse,
  TimelineEntry,
} from "@/lib/api-types";
import { getDocuments, getSchedule, getSubjects, getTimeline } from "@/lib/client/api";
import { downloadMarkdown, scheduleMarkdown } from "@/lib/client/markdown";
import { monthDay } from "@/lib/client/format";
import { useNow } from "@/hooks/use-now";
import { DateFlight, Landing, type Flight } from "./capture-motion";
import { ComingUp } from "./coming-up";
import { DocTile } from "./doc-tile";
import { useDejaEvent } from "./events";
import { isBulkImport, isBulkRunning } from "./import-drop";
import { ScheduleCard } from "./schedule-card";
import { SearchBar } from "./search-bar";
import { SnapButton } from "./snap";
import { SiteHeader } from "./site-header";
import { SubjectFilters } from "./subject-filters";

function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Puts a document at the top of its day, replacing any older copy. */
function upsert(groups: DocumentGroup[], doc: DocumentSummary): DocumentGroup[] {
  let found = false;
  const next = groups.map((g) => {
    const i = g.documents.findIndex((d) => d.id === doc.id);
    if (i < 0) return g;
    found = true;
    const documents = g.documents.slice();
    documents[i] = doc;
    return { ...g, documents };
  });
  if (found) return next;
  const day = todayKey();
  if (next[0]?.day === day) return [{ ...next[0], documents: [doc, ...next[0].documents] }, ...next.slice(1)];
  return [{ day, label: "Today", documents: [doc] }, ...next];
}

function patchDoc(groups: DocumentGroup[], id: string, patch: Partial<DocumentSummary>): DocumentGroup[] {
  return groups.map((g) =>
    g.documents.some((d) => d.id === id)
      ? { ...g, documents: g.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }
      : g,
  );
}

function remove(groups: DocumentGroup[], id: string): DocumentGroup[] {
  return groups
    .map((g) => ({ ...g, documents: g.documents.filter((d) => d.id !== id) }))
    .filter((g) => g.documents.length > 0);
}

export function LibraryView() {
  const params = useSearchParams();
  const filter = params.get("subject") ?? "all";
  const now = useNow(5_000);

  const [groups, setGroups] = useState<DocumentGroup[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectsResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  useEffect(() => {
    if (filter !== "schedule") return;
    let live = true;
    void getSchedule()
      .then((s) => live && setSchedule(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [filter]);

  // Landing choreography: tiles that flew in, titles still typing, date chips in the air.
  const [arrivals, setArrivals] = useState<ReadonlySet<string>>(new Set());
  const [typing, setTyping] = useState<ReadonlySet<string>>(new Set());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hiddenDates, setHiddenDates] = useState<ReadonlySet<string>>(new Set());
  const pendingDates = useRef(new Map<string, TimelineEntry[]>());

  const loadDocs = useCallback(
    () =>
      getDocuments(filter === "schedule" ? "all" : filter).then(
        (res) => {
          setGroups(
            filter === "schedule"
              ? res.groups
                  .map((g) => ({ ...g, documents: g.documents.filter((d) => d.docType === "schedule") }))
                  .filter((g) => g.documents.length)
              : res.groups,
          );
          setError(null);
        },
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      ),
    [filter],
  );

  const loadSide = useCallback(() => {
    void getSubjects().then(setSubjects).catch(() => {});
    void getTimeline(3).then((t) => setTimeline(t.entries)).catch(() => setTimeline([]));
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);
  useEffect(() => {
    loadSide();
  }, [loadSide]);

  useEffect(() => {
    const refresh = () => {
      void loadDocs();
      loadSide();
    };
    window.addEventListener("dejafind:refresh", refresh);
    return () => window.removeEventListener("dejafind:refresh", refresh);
  }, [loadDocs, loadSide]);

  useDejaEvent((e) => {
    switch (e.type) {
      case "document.queued":
        if (filter === "all") {
          if (!isBulkImport(e.document.id)) setArrivals((a) => new Set(a).add(e.document.id));
          setGroups((g) => upsert(g ?? [], e.document));
        }
        break;
      case "document.reading":
        setGroups((g) => g && patchDoc(g, e.documentId, { status: "reading" }));
        break;
      case "document.filed": {
        const doc = e.document;
        const belongs =
          filter === "all" ||
          filter === doc.subjectId ||
          (filter === "other" && doc.subjectId === null) ||
          (filter === "schedule" && doc.docType === "schedule");
        if (belongs && !isBulkImport(doc.id)) {
          const seen = groups?.some((g) => g.documents.some((d) => d.id === doc.id));
          if (!seen) setArrivals((a) => new Set(a).add(doc.id));
          setTyping((t) => new Set(t).add(doc.id));
          if (e.dates.length) {
            pendingDates.current.set(doc.id, e.dates);
            setHiddenDates((h) => new Set([...h, ...e.dates.map((d) => d.id)]));
          }
        }
        setGroups((g) => (belongs ? upsert(g ?? [], doc) : g && remove(g, doc.id)));
        void getSubjects().then(setSubjects).catch(() => {});
        void getTimeline(3).then((t) => setTimeline(t.entries)).catch(() => {});
        break;
      }
      case "document.error":
        setGroups((g) => g && patchDoc(g, e.documentId, { status: "error" }));
        break;
      case "document.deleted":
        setGroups((g) => g && remove(g, e.documentId));
        loadSide();
        break;
      case "subject.created":
        loadSide();
        break;
    }
  });

  /** Title finished typing: show the subject, then lift each new date into Coming up. */
  const onTyped = useCallback((id: string) => {
    setTyping((t) => {
      const next = new Set(t);
      next.delete(id);
      return next;
    });
    const dates = pendingDates.current.get(id);
    pendingDates.current.delete(id);
    if (!dates?.length) return;
    const tile = document.querySelector(`[data-doc-id="${CSS.escape(id)}"]`);
    const strip = document.getElementById("coming-up");
    if (!tile || !strip) {
      setHiddenDates((h) => new Set([...h].filter((x) => !dates.some((d) => d.id === x))));
      return;
    }
    const from = tile.getBoundingClientRect();
    setFlights((f) => [
      ...f,
      ...dates.map((d) => {
        const slot = document.querySelector(`[data-date-id="${CSS.escape(d.id)}"]`) ?? strip.querySelector("h2") ?? strip;
        return { id: d.id, label: monthDay(d.isoDate), from, to: slot.getBoundingClientRect() };
      }),
    ]);
  }, []);

  const onLand = useCallback((dateId: string) => {
    setFlights((f) => f.filter((x) => x.id !== dateId));
    setHiddenDates((h) => {
      const next = new Set(h);
      next.delete(dateId);
      return next;
    });
  }, []);

  const quizHref = useMemo(() => {
    if (filter !== "all" && filter !== "other" && filter !== "schedule") return `/quiz?subject=${filter}`;
    const ids = (groups ?? [])
      .flatMap((g) => g.documents)
      .filter((d) => d.status === "done" && d.subjectId)
      .slice(0, 6)
      .map((d) => d.id);
    return ids.length ? `/quiz?documents=${ids.join(",")}` : null;
  }, [filter, groups]);

  const empty = groups && groups.length === 0;
  // Day headers only help once the library is big; until then it is one grid.
  const docCount = groups?.reduce((n, g) => n + g.documents.length, 0) ?? 0;
  const grouped = docCount > 20;
  const displayGroups =
    groups && !grouped && groups.length > 0
      ? [{ day: "all", label: "Your documents", documents: groups.flatMap((g) => g.documents) }]
      : groups;
  const calm = isBulkRunning();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-6 pt-12 pb-32 sm:px-12">
        <h1 className="sr-only">Your documents</h1>
        <div className="flex max-w-[1000px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchBar subjectId={filter !== "all" && filter !== "schedule" ? filter : null} />
          </div>
          <SnapButton />
        </div>
        <SubjectFilters
          subjects={subjects}
          active={filter}
          hrefFor={(f) => (f === "all" ? "/" : f === "schedule" ? "/schedule" : `/?subject=${encodeURIComponent(f)}`)}
          quizHref={quizHref}
          flashcardsHref={quizHref?.replace("/quiz?", "/flashcards?")}
          reviewHref={quizHref?.startsWith("/quiz?subject=") ? quizHref.replace("/quiz?", "/review?") : null}
        />
        <ComingUp entries={timeline} hidden={hiddenDates} />
        <ScheduleCard
          onConfirmed={() => {
            void loadDocs();
            loadSide();
          }}
        />

        {error && (
          <p className="text-[17px] text-muted-foreground">
            Could not load your documents: {error}. Check that the local server is running.
          </p>
        )}
        {empty && (
          <div className="flex flex-col items-start gap-6 py-12">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand illustration */}
            <img src="/brand/empty-library.svg" alt="" className="w-[280px]" />
            <p className="text-[19px] text-muted-foreground">
            {filter === "all"
              ? "Nothing here yet. Take a screenshot, save a PDF to Downloads, or drop files on this window."
              : "No documents filed here yet."}
            </p>
          </div>
        )}

        {filter === "schedule" && schedule && schedule.entries.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="text-[17px] text-ink-soft">
              Your class schedule{schedule.section ? ` for ${schedule.section}` : ""}: {schedule.entries.length} classes a week
            </p>
            <button
              type="button"
              onClick={() => downloadMarkdown(`class-schedule${schedule.section ? `-${schedule.section.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}`, scheduleMarkdown(schedule.entries, schedule.section))}
              className="rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Save as .md
            </button>
          </div>
        )}

        <div className="flex flex-col gap-12">
          {displayGroups?.map((g) => (
            <motion.section layout={calm ? false : "position"} key={g.day} aria-label={g.label} className="flex flex-col gap-5">
              <h2 className={displayGroups.length === 1 && !grouped ? "sr-only" : "text-[17px] font-medium text-muted-foreground"}>{g.label}</h2>
              <div className="columns-1 gap-7 sm:columns-2 lg:columns-3 xl:columns-4">
                {g.documents.map((d) => (
                  <motion.div
                    layout={calm ? false : "position"}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                    key={d.id}
                    data-doc-id={d.id}
                    className="mb-9 break-inside-avoid"
                  >
                    <Landing fly={arrivals.has(d.id)}>
                      <DocTile doc={d} now={now} typing={typing.has(d.id)} onTyped={onTyped} />
                    </Landing>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
        {flights.map((f) => (
          <DateFlight key={f.id} flight={f} onLand={onLand} />
        ))}
      </main>
    </>
  );
}
