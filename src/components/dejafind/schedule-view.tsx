"use client";
/* eslint-disable @next/next/no-img-element -- thumbnails come from local routes */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ScheduleResponse, TimelineEntry } from "@/lib/api-types";
import { getSchedule, getTimeline, patchDate } from "@/lib/client/api";
import { longDay } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { useDejaEvent } from "./events";
import { ScheduleWeek } from "./schedule-week";
import { SiteHeader } from "./site-header";

const link =
  "rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** The week of classes on top, every upcoming date found in your documents below. */
export function ScheduleView() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([getSchedule(), getTimeline(100)])
      .then(([s, t]) => {
        if (!live) return;
        setSchedule(s);
        setTimeline(t.entries);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [reload]);

  // Keep the "now" line honest while the page sits open.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  useDejaEvent((e) => {
    if (e.type === "document.filed" || e.type === "document.deleted" || e.type === "subject.created") setReload((r) => r + 1);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const ignore = (entry: TimelineEntry) => {
    setTimeline((t) => t?.filter((x) => x.id !== entry.id) ?? null);
    void patchDate(entry.id, { status: "ignored" })
      .then(() =>
        toast(`${entry.label} ignored`, {
          action: {
            label: "Undo",
            onClick: () => void patchDate(entry.id, { status: "auto" }).then(() => setReload((r) => r + 1)),
          },
        }),
      )
      .catch((e) => {
        toast(`Could not ignore that date: ${e instanceof Error ? e.message : String(e)}`);
        setReload((r) => r + 1);
      });
  };

  const entries = schedule?.entries ?? [];

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-[1320px] flex-col gap-10 px-6 pt-10 pb-32 text-[19px] sm:px-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em]">Schedule</h1>
          {schedule?.section && <p className="text-[17px] text-muted-foreground">{schedule.section}</p>}
        </div>

        {error && <p className="text-muted-foreground">Could not load your schedule: {error}. Check that the local server is running.</p>}

        <section aria-label="This week">
          {schedule === null && !error ? (
            <div className="h-[420px] rounded-2xl bg-muted/40 df-sweep relative overflow-hidden" aria-busy />
          ) : entries.length > 0 ? (
            <ScheduleWeek entries={entries} now={now} />
          ) : (
            !error && <EmptyWeek waiting={!!schedule?.pending} />
          )}
        </section>

        <ComingUpList entries={timeline} onIgnore={ignore} />
      </main>
    </>
  );
}

function EmptyWeek({ waiting }: { waiting: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div aria-hidden className="relative aspect-[4/3] w-[240px] rounded-[3px] border-2 border-dashed border-border bg-white/60">
        <div className="absolute inset-x-6 top-6 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="h-5 rounded-[3px] border border-hairline" />
          ))}
        </div>
      </div>
      <p className="max-w-[600px] text-[21px] leading-snug text-ink-soft text-balance">
        Drop your timetable and tap Use it. Classes land here.
      </p>
      {waiting && <p className="text-[17px] text-muted-foreground">A timetable is waiting for you in the Library.</p>}
      <Link href="/" className={cn(link, "text-[17px]")}>
        Back to the Library
      </Link>
    </div>
  );
}

function ComingUpList({ entries, onIgnore }: { entries: TimelineEntry[] | null; onIgnore: (e: TimelineEntry) => void }) {
  const reduced = useReducedMotion();
  const days: { isoDate: string; entries: TimelineEntry[] }[] = [];
  for (const e of entries ?? []) {
    const last = days.at(-1);
    if (last?.isoDate === e.isoDate) last.entries.push(e);
    else days.push({ isoDate: e.isoDate, entries: [e] });
  }
  const nearest = days[0]?.isoDate;

  return (
    <section aria-labelledby="coming-up-heading" className="flex flex-col gap-2 border-t border-hairline pt-8">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="coming-up-heading" className="text-[24px] font-semibold tracking-[-0.01em]">
          Coming up
        </h2>
        <a href="/api/timeline.ics" download="dejafind-coming-up.ics" className={cn(link, "text-[17px]")}>
          Add to calendar
        </a>
      </div>

      {entries?.length === 0 && (
        <p className="text-muted-foreground">No dates yet. Dates inside your documents land here.</p>
      )}

      <div className="flex flex-col gap-6">
        <AnimatePresence initial={false}>
          {days.map((day, di) => (
            <motion.div
              key={day.isoDate}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: Math.min(di, 10) * 0.03 }}
              className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-2 sm:grid-cols-[150px_minmax(0,1fr)]"
            >
              <h3
                className={cn(
                  "pt-3 text-[17px] font-semibold tabular-nums",
                  day.isoDate === nearest ? "text-primary" : "text-foreground",
                )}
              >
                {longDay(day.isoDate)}
              </h3>
              <ul className="flex min-w-0 flex-col">
                <AnimatePresence initial={false}>
                  {day.entries.map((e) => (
                    <motion.li
                      key={e.id}
                      layout={!reduced}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-5 border-b border-hairline py-3 last:border-b-0"
                    >
                      <Link
                        href={`/d/${e.documentId}`}
                        className="group flex min-w-0 flex-1 items-center gap-5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="relative aspect-[4/3] w-[72px] shrink-0 overflow-hidden rounded-[3px] bg-white shadow-paper">
                          <img
                            src={`/api/thumb/${encodeURIComponent(e.documentId)}`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover object-top"
                          />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span
                            className={cn(
                              "truncate text-[18px] font-medium",
                              day.isoDate === nearest ? "text-primary" : "text-foreground group-hover:underline",
                            )}
                          >
                            {e.label}
                          </span>
                          <span className="truncate text-[16px] text-muted-foreground">
                            {e.subjectName ?? "Other"} · {e.documentTitle}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => onIgnore(e)}
                        className="shrink-0 rounded-sm px-1 text-[16px] text-faint outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Ignore
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
