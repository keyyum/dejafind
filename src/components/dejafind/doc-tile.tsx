import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { motion } from "motion/react";
import type { DocumentSummary } from "@/lib/api-types";
import { TypeIn } from "./capture-motion";
import { Paper } from "./paper";

const FILED_FOR_MS = 60_000;

/**
 * One paper tile in the Library grid, caption underneath. `typing` plays the
 * landing: the page fades in, the title types, then the subject label appears.
 */
export function DocTile({
  doc,
  now,
  typing,
  onTyped,
}: {
  doc: DocumentSummary;
  now: number;
  typing?: boolean;
  onTyped?: (id: string) => void;
}) {
  const reading = doc.status === "queued" || doc.status === "reading";
  const justFiled =
    doc.status === "done" && doc.filedAt && now > 0 && now - new Date(doc.filedAt).getTime() < FILED_FOR_MS;

  if (reading) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <Paper doc={{ ...doc, width: doc.width || 4, height: doc.height || 3 }} src={doc.thumbUrl} className="df-sweep bg-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2Icon className="size-7 animate-spin text-muted-foreground" aria-hidden />
          </div>
        </Paper>
        <p className="text-[16px] text-muted-foreground">Reading…</p>
      </div>
    );
  }

  const subject = doc.status === "error" ? (
    <span className="text-[15px] text-primary">Could not read this file</span>
  ) : justFiled ? (
    <span className="text-[15px] font-medium text-filed">filed under {doc.subjectName ?? "Other"}</span>
  ) : (
    <span className="text-[15px] text-muted-foreground">{doc.subjectName ?? "Other"}</span>
  );

  return (
    <Link
      href={`/d/${doc.id}`}
      className="group flex flex-col gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <Paper doc={doc} imgClassName={typing ? "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500" : undefined} />
      <span className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-2 text-[16px] leading-snug font-medium text-foreground">
          {typing ? <TypeIn text={doc.title || "Untitled"} onDone={() => onTyped?.(doc.id)} /> : doc.title || "Untitled"}
        </span>
        {typing ? (
          <span className="text-[15px] opacity-0" aria-hidden>
            filed
          </span>
        ) : justFiled && onTyped ? (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {subject}
          </motion.span>
        ) : (
          subject
        )}
      </span>
    </Link>
  );
}
