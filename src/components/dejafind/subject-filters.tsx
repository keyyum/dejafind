"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubjectsResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/** "all", a subject id, "other", or "schedule". */
export type SubjectFilter = string;

/** Subject names as plain text filters with counts, and "Quiz me" at the right. */
export function SubjectFilters({
  subjects,
  active,
  hrefFor,
  quizHref,
  flashcardsHref,
  reviewHref,
  showSchedule = true,
}: {
  subjects: SubjectsResponse | null;
  active: SubjectFilter;
  hrefFor: (filter: SubjectFilter) => string;
  quizHref?: string | null;
  flashcardsHref?: string | null;
  reviewHref?: string | null;
  showSchedule?: boolean;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const item = (filter: SubjectFilter, label: string, count?: number, faint?: boolean) => {
    const on = active === filter;
    return (
      <Link
        key={filter}
        href={hrefFor(filter)}
        scroll={false}
        aria-current={on ? "page" : undefined}
        className={cn(
          "rounded-sm border-b-2 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          on ? "border-foreground font-semibold text-foreground" : "border-transparent hover:text-foreground",
          !on && (faint ? "text-faint" : "text-ink-soft"),
        )}
      >
        {label}
        {count != null && count > 0 && (
          <span className="ml-1.5 text-[15px] font-normal text-faint tabular-nums">{count}</span>
        )}
      </Link>
    );
  };
  // Subjects with nothing filed yet (from a timetable) wait behind a "+N" chip; the active one always shows.
  const filled = subjects?.subjects.filter((s) => s.count > 0 || s.id === active) ?? [];
  const empty = subjects?.subjects.filter((s) => s.count === 0 && s.id !== active) ?? [];
  return (
    <nav aria-label="Subjects" className="flex items-baseline gap-x-6 text-[17px]">
      <div className="flex min-w-0 flex-1 items-baseline gap-x-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {item("all", "All")}
      {filled.map((s) => item(s.id, s.name, s.count))}
      {showEmpty && empty.map((s) => item(s.id, s.name, s.count))}
      {subjects && subjects.otherCount > 0 && item("other", "Other", subjects.otherCount, true)}
      {showSchedule && item("schedule", "Schedule")}
      {empty.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEmpty((v) => !v)}
          aria-expanded={showEmpty}
          aria-label={showEmpty ? "Hide subjects with no documents" : `Show ${empty.length} more subjects with no documents yet`}
          className="shrink-0 self-center rounded-full border border-border px-2.5 py-0.5 text-[15px] text-muted-foreground outline-none hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showEmpty ? "Less" : `+${empty.length}`}
        </button>
      )}
      </div>
      {reviewHref && (
        <Link
          href={reviewHref}
          className="ml-auto shrink-0 rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reviewer
        </Link>
      )}
      {flashcardsHref && (
        <Link
          href={flashcardsHref}
          className={cn(!reviewHref && "ml-auto", "shrink-0 rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring")}
        >
          Flashcards
        </Link>
      )}
      {quizHref && (
        <Link
          href={quizHref}
          className={cn(!flashcardsHref && !reviewHref && "ml-auto", "shrink-0 rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring")}
        >
          Quiz me
        </Link>
      )}
    </nav>
  );
}
