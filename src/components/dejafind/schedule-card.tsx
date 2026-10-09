"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { DocumentSummary, SchedulePending } from "@/lib/api-types";
import { confirmSchedule, getDocument, getSchedule } from "@/lib/client/api";
import { useDejaEvent } from "./events";
import { Paper } from "./paper";

/**
 * "This looks like a class schedule for BSCS 2-B. Is it yours?" The only thing
 * the app ever asks. Defaults to Not mine when the section differs from the
 * confirmed one.
 */
export function ScheduleCard({ onConfirmed }: { onConfirmed: () => void }) {
  const [pending, setPending] = useState<SchedulePending | null>(null);
  const [confirmedSection, setConfirmedSection] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSchedule()
      .then((s) => {
        setPending(s.pending);
        setConfirmedSection(s.section);
      })
      .catch(() => {});
  }, []);

  useDejaEvent((e) => {
    if (e.type === "schedule.pending") setPending(e.pending);
  });

  useEffect(() => {
    if (!pending) return;
    let live = true;
    void getDocument(pending.documentId)
      .then((d) => live && setDoc(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pending]);

  if (!pending) return null;

  const differs = !!confirmedSection && !!pending.section && pending.section !== confirmedSection;
  const answer = (confirm: boolean) => {
    setBusy(true);
    void confirmSchedule({ documentId: pending.documentId, confirm })
      .then((s) => {
        setPending(null);
        setConfirmedSection(s.section);
        if (confirm) {
          toast(`Schedule saved · ${pending.subjects.length} subjects added`);
          onConfirmed();
        }
      })
      .catch((e) => toast(`Could not save the schedule: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setBusy(false));
  };

  const primary =
    "inline-flex h-12 items-center rounded-full bg-foreground px-6 text-[17px] font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";
  const quiet =
    "inline-flex h-12 items-center rounded-full border border-border bg-white px-6 text-[17px] font-medium text-ink-soft outline-none hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";

  return (
    <motion.section
      aria-label="Class schedule found"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-x-10 gap-y-6 rounded-2xl border border-border bg-white p-6 shadow-[0_2px_12px_rgb(0_0_0/0.05)]"
    >
      {doc && (
        <div className="w-[140px] shrink-0">
          <Paper doc={doc} maxAspect={1.1} />
        </div>
      )}
      <div className="flex min-w-[280px] flex-1 flex-col gap-2">
        <p className="text-[24px] leading-snug font-medium tracking-[-0.01em]">
          This looks like a class schedule{pending.section ? ` for ${pending.section}` : ""}. Is it yours?
        </p>
        {pending.subjects.length > 0 && (
          <p className="text-[17px] text-muted-foreground">
            It would add {pending.subjects.length} subjects: {pending.subjects.join(", ")}.
          </p>
        )}
        {differs && (
          <p className="text-[17px] text-muted-foreground">Your saved schedule is for {confirmedSection}.</p>
        )}
      </div>
      <div className="flex gap-3">
        {differs ? (
          <>
            <button type="button" autoFocus disabled={busy} onClick={() => answer(false)} className={primary}>Not mine</button>
            <button type="button" disabled={busy} onClick={() => answer(true)} className={quiet}>Use it</button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => answer(true)} className={primary}>Use it</button>
            <button type="button" disabled={busy} onClick={() => answer(false)} className={quiet}>Not mine</button>
          </>
        )}
      </div>
    </motion.section>
  );
}
