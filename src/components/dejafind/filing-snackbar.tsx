"use client";

import { toast } from "sonner";
import { patchDocument } from "@/lib/client/api";
import { kindWord, monthDay } from "@/lib/client/format";
import { useDejaEvent } from "./events";

/** "Screenshot filed under Biology · Oct 17 added to Coming up", with Undo. */
export function FilingSnackbar() {
  useDejaEvent((e) => {
    if (e.type !== "document.filed") return;
    const doc = e.document;
    const where = doc.subjectName ? `filed under ${doc.subjectName}` : "filed under Other";
    const first = e.dates[0];
    const dates = first
      ? ` · ${monthDay(first.isoDate)}${e.dates.length > 1 ? ` and ${e.dates.length - 1} more` : ""} added to Coming up`
      : "";
    toast(`${kindWord(doc)} ${where}${dates}`, {
      id: `filed-${doc.id}`,
      action: doc.subjectId
        ? {
            label: "Undo",
            onClick: () => {
              void patchDocument(doc.id, { subjectId: null }).then(() =>
                window.dispatchEvent(new CustomEvent("dejafind:refresh")),
              );
            },
          }
        : undefined,
    });
  });
  return null;
}
