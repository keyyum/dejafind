import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import type { DocumentSummary } from "@/lib/api-types";
import { Paper } from "./paper";

const FILED_FOR_MS = 60_000;

/** One paper tile in the Library grid, caption underneath. */
export function DocTile({ doc, now }: { doc: DocumentSummary; now: number }) {
  const reading = doc.status === "queued" || doc.status === "reading";
  const justFiled =
    doc.status === "done" && doc.filedAt && now > 0 && now - new Date(doc.filedAt).getTime() < FILED_FOR_MS;

  if (reading) {
    return (
      <div className="flex flex-col gap-3" aria-live="polite">
        <Paper doc={{ ...doc, width: doc.width || 4, height: doc.height || 3 }} src={doc.thumbUrl} className="bg-muted df-sweep">
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2Icon className="size-7 animate-spin text-muted-foreground" aria-hidden />
          </div>
        </Paper>
        <p className="text-[16px] text-muted-foreground">Reading…</p>
      </div>
    );
  }

  return (
    <Link
      href={`/d/${doc.id}`}
      className="group flex flex-col gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <Paper doc={doc} />
      <span className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-2 text-[16px] leading-snug font-medium text-foreground">
          {doc.title || "Untitled"}
        </span>
        {doc.status === "error" ? (
          <span className="text-[15px] text-primary">Could not read this file</span>
        ) : justFiled ? (
          <span className="text-[15px] font-medium text-filed">filed under {doc.subjectName ?? "Other"}</span>
        ) : (
          <span className="text-[15px] text-muted-foreground">{doc.subjectName ?? "Other"}</span>
        )}
      </span>
    </Link>
  );
}
