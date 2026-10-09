import Link from "next/link";
import type { TimelineEntry } from "@/lib/api-types";
import { shortDay } from "@/lib/client/format";
import { cn } from "@/lib/utils";

/** The next three dates found in documents. The one within 48 hours is in accent. */
export function ComingUp({ entries }: { entries: TimelineEntry[] | null }) {
  return (
    <section
      aria-label="Coming up"
      id="coming-up"
      className="flex min-h-[58px] flex-wrap items-baseline gap-x-9 gap-y-2 border-y border-hairline py-4 text-[17px]"
    >
      <h2 className="text-muted-foreground">Coming up</h2>
      {entries?.length === 0 && (
        <p className="text-muted-foreground">No dates yet. Dates inside your documents land here.</p>
      )}
      {entries?.map((e) => (
        <Link
          key={e.id}
          href={`/d/${e.documentId}`}
          data-date-id={e.id}
          className="group rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn("font-semibold tabular-nums", e.soon ? "text-primary" : "text-foreground")}>
            {shortDay(e.isoDate)}
          </span>{" "}
          <span className="text-ink-soft group-hover:text-foreground">{e.label}</span>
        </Link>
      ))}
    </section>
  );
}
