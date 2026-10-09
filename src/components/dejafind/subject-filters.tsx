import Link from "next/link";
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
  showSchedule = true,
}: {
  subjects: SubjectsResponse | null;
  active: SubjectFilter;
  hrefFor: (filter: SubjectFilter) => string;
  quizHref?: string | null;
  showSchedule?: boolean;
}) {
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
  return (
    <nav aria-label="Subjects" className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[17px]">
      {item("all", "All")}
      {subjects?.subjects.map((s) => item(s.id, s.name, s.count))}
      {subjects && subjects.otherCount > 0 && item("other", "Other", subjects.otherCount, true)}
      {showSchedule && item("schedule", "Schedule")}
      {quizHref && (
        <Link
          href={quizHref}
          className="ml-auto rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Quiz me
        </Link>
      )}
    </nav>
  );
}
