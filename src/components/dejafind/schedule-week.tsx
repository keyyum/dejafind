"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ScheduleEntry } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const DAYS = [
  { weekday: 1, short: "Mon" },
  { weekday: 2, short: "Tue" },
  { weekday: 3, short: "Wed" },
  { weekday: 4, short: "Thu" },
  { weekday: 5, short: "Fri" },
  { weekday: 6, short: "Sat" },
] as const;

const FIRST_HOUR = 7;
const LAST_HOUR = 19;
const HOUR_PX = 60;
const HEIGHT = (LAST_HOUR - FIRST_HOUR) * HOUR_PX;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toY = (mins: number) =>
  Math.min(HEIGHT, Math.max(0, ((mins - FIRST_HOUR * 60) / 60) * HOUR_PX));

/** "9:00" or "1:30 pm": short, and only says pm after noon. */
function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")}${h >= 12 ? " pm" : ""}`;
}

/** One quiet hue per subject, stable across reloads. */
export function subjectHue(subjectId: string | null) {
  if (!subjectId) return 60;
  let h = 0;
  for (let i = 0; i < subjectId.length; i++) h = (h * 31 + subjectId.charCodeAt(i)) >>> 0;
  return [22, 145, 205, 265, 330, 95, 180, 45][h % 8];
}

/** Classes that overlap share the column side by side. */
function lanes(entries: ScheduleEntry[]) {
  const sorted = [...entries].sort((a, b) => minutes(a.start) - minutes(b.start) || minutes(a.end) - minutes(b.end));
  const out: { entry: ScheduleEntry; lane: number; of: number }[] = [];
  let cluster: { entry: ScheduleEntry; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const of = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) out.push({ ...c, of });
    cluster = [];
  };
  for (const entry of sorted) {
    if (minutes(entry.start) >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const busy = new Set(cluster.filter((c) => minutes(c.entry.end) > minutes(entry.start)).map((c) => c.lane));
    let lane = 0;
    while (busy.has(lane)) lane++;
    cluster.push({ entry, lane });
    clusterEnd = Math.max(clusterEnd, minutes(entry.end));
  }
  flush();
  return out;
}

/** Mon to Sat, 07:00 to 19:00. Today's column is softly lit, with a thin line at the current time. */
export function ScheduleWeek({ entries, now }: { entries: ScheduleEntry[]; now: Date | null }) {
  const reduced = useReducedMotion();
  const today = now?.getDay() ?? -1;
  const nowMins = now ? now.getHours() * 60 + now.getMinutes() : -1;
  const showNow = nowMins >= FIRST_HOUR * 60 && nowMins <= LAST_HOUR * 60;
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  let order = 0;

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[720px] grid-cols-[64px_repeat(6,minmax(0,1fr))]">
        {/* Day names */}
        <div />
        {DAYS.map((d) => (
          <div
            key={d.weekday}
            className={cn(
              "border-b border-hairline pb-3 pl-3 text-[17px]",
              d.weekday === today ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {d.short}
            {d.weekday === today && <span className="ml-2 text-[15px] font-normal text-muted-foreground">Today</span>}
          </div>
        ))}

        {/* Hour labels */}
        <div className="relative" style={{ height: HEIGHT }} aria-hidden>
          {hours.map((h) => (
            <span
              key={h}
              className="absolute right-3 -translate-y-1/2 whitespace-nowrap text-[14px] text-faint tabular-nums"
              style={{ top: toY(h * 60) }}
            >
              {h % 12 === 0 ? 12 : h % 12}
              {h === 12 ? " pm" : ""}
            </span>
          ))}
        </div>

        {DAYS.map((d) => {
          const isToday = d.weekday === today;
          const dayEntries = lanes(entries.filter((e) => e.weekday === d.weekday));
          return (
            <div
              key={d.weekday}
              role="list"
              aria-label={d.short}
              className={cn("relative border-l border-hairline", isToday && "bg-[#f6f5f0]")}
              style={{ height: HEIGHT }}
            >
              {hours.slice(1, -1).map((h) => (
                <div key={h} aria-hidden className="absolute inset-x-0 border-t border-hairline/70" style={{ top: toY(h * 60) }} />
              ))}
              {dayEntries.map(({ entry, lane, of }) => {
                const top = toY(minutes(entry.start));
                const height = Math.max(28, toY(minutes(entry.end)) - top - 3);
                const hue = subjectHue(entry.subjectId);
                const i = order++;
                return (
                  <motion.div
                    key={entry.id}
                    role="listitem"
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.2, 0, 0, 1], delay: i * 0.03 }}
                    className="absolute overflow-hidden rounded-lg border bg-white px-2.5 py-1.5"
                    style={{
                      top: top + 1,
                      height,
                      left: `calc(${(lane / of) * 100}% + 4px)`,
                      width: `calc(${100 / of}% - 8px)`,
                      borderColor: `oklch(0.82 0.06 ${hue})`,
                      backgroundColor: `oklch(0.985 0.012 ${hue})`,
                    }}
                    title={`${entry.subjectName} · ${clock(entry.start)} to ${clock(entry.end)}${entry.room ? ` · ${entry.room}` : ""}`}
                  >
                    <p className="truncate text-[15px] leading-tight font-semibold text-foreground">{entry.subjectName}</p>
                    {height > 44 && (
                      <p className="truncate text-[14px] leading-snug text-ink-soft">
                        {entry.room ?? clock(entry.start)}
                      </p>
                    )}
                    {height > 64 && (
                      <p className="truncate text-[14px] leading-snug text-muted-foreground tabular-nums">
                        {clock(entry.start)} to {clock(entry.end)}
                      </p>
                    )}
                  </motion.div>
                );
              })}
              {isToday && showNow && (
                <div aria-label="Now" className="pointer-events-none absolute inset-x-0 z-10" style={{ top: toY(nowMins) }}>
                  <div className="absolute -top-[4px] -left-[4.5px] size-2 rounded-full bg-foreground" />
                  <div className="h-px bg-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
