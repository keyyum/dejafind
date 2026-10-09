"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DocumentGroup,
  DocumentSummary,
  SubjectsResponse,
  TimelineEntry,
} from "@/lib/api-types";
import { getDocuments, getSubjects, getTimeline } from "@/lib/client/api";
import { useNow } from "@/hooks/use-now";
import { ComingUp } from "./coming-up";
import { DocTile } from "./doc-tile";
import { useDejaEvent } from "./events";
import { SearchBar } from "./search-bar";
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
        if (filter === "all") setGroups((g) => upsert(g ?? [], e.document));
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
        setGroups((g) => (belongs ? upsert(g ?? [], doc) : g && remove(g, doc.id)));
        loadSide();
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-6 pt-12 pb-32 sm:px-12">
        <div className="max-w-[880px]">
          <SearchBar subjectId={filter !== "all" && filter !== "schedule" ? filter : null} />
        </div>
        <SubjectFilters
          subjects={subjects}
          active={filter}
          hrefFor={(f) => (f === "all" ? "/" : `/?subject=${encodeURIComponent(f)}`)}
          quizHref={quizHref}
        />
        <ComingUp entries={timeline} />

        {error && (
          <p className="text-[17px] text-muted-foreground">
            Could not load your documents: {error}. Check that the local server is running.
          </p>
        )}
        {empty && (
          <p className="py-16 text-[19px] text-muted-foreground">
            {filter === "all"
              ? "Nothing here yet. Take a screenshot, save a PDF to Downloads, or drop files on this window."
              : "No documents filed here yet."}
          </p>
        )}

        <div className="flex flex-col gap-12">
          {groups?.map((g) => (
            <section key={g.day} aria-label={g.label} className="flex flex-col gap-5">
              <h2 className="text-[17px] font-medium text-muted-foreground">{g.label}</h2>
              <div className="columns-1 gap-7 sm:columns-2 lg:columns-3 xl:columns-4">
                {g.documents.map((d) => (
                  <div key={d.id} className="mb-9 break-inside-avoid">
                    <DocTile doc={d} now={now} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
