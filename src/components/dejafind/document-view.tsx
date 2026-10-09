"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateFound, DocumentDetail, SearchResult, SubjectsResponse } from "@/lib/api-types";
import {
  deleteDocument,
  getDocument,
  getSimilar,
  getSubjects,
  patchDate,
  patchDocument,
} from "@/lib/client/api";
import { isScreenshot, kindWord, longDay, relativeDay, seconds } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { useDejaEvent } from "./events";
import { Highlight, queryTerms, termSpans } from "./highlight";
import { Paper } from "./paper";
import { SiteHeader } from "./site-header";
import { Zoomable } from "./zoomable";

function isSoon(isoDate: string): boolean {
  const t = new Date(`${isoDate}T23:59:59`).getTime();
  const now = Date.now();
  return t >= now && t - now <= 48 * 3_600_000;
}

function DateRow({ date, onToggle }: { date: DateFound; onToggle: (d: DateFound) => void }) {
  const on = date.status === "auto";
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={cn("font-semibold tabular-nums", on && isSoon(date.isoDate) ? "text-primary" : "text-foreground")}>
        {longDay(date.isoDate)}
      </span>
      <span className="text-ink-soft">{date.label}</span>
      <span className={cn("text-[15px]", on ? "font-medium text-filed" : "text-muted-foreground")}>
        {on ? "on Coming up" : date.status === "review" ? "needs a look" : "ignored"}
      </span>
      <button
        type="button"
        onClick={() => onToggle(date)}
        className="rounded-sm text-[15px] text-muted-foreground underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {on ? "Ignore" : "Put on Coming up"}
      </button>
    </li>
  );
}

export function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectsResponse | null>(null);
  const [similar, setSimilar] = useState<SearchResult[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    getDocument(id)
      .then((d) => {
        setDoc(d);
        setMissing(null);
      })
      .catch((e) => setMissing(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    load();
    void getSubjects().then(setSubjects).catch(() => {});
  }, [load]);

  useDejaEvent((e) => {
    if ((e.type === "document.filed" && e.document.id === id) || (e.type === "document.error" && e.documentId === id)) load();
    if (e.type === "document.deleted" && e.documentId === id) router.push("/");
  });

  const spans = useMemo(() => {
    if (!doc) return [];
    return termSpans(doc.text, [...queryTerms(q), ...doc.dates.filter((d) => d.status !== "ignored").map((d) => d.span)]);
  }, [doc, q]);

  if (missing) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1320px] px-6 pt-16 sm:px-12">
          <p className="text-[19px] text-muted-foreground">This document is not in your library anymore.</p>
          <Link href="/" className="mt-4 inline-block underline underline-offset-4">Back to your documents</Link>
        </main>
      </>
    );
  }

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="inline-flex items-center gap-2 rounded-sm text-[17px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeftIcon className="size-5" aria-hidden />
      {q ? "Back to results" : "Back"}
    </button>
  );

  if (!doc) {
    return (
      <>
        <SiteHeader left={back} />
        <main className="mx-auto w-full max-w-[1320px] px-6 pt-16 sm:px-12" aria-busy />
      </>
    );
  }

  const reading = doc.status === "queued" || doc.status === "reading";
  const imageSrc = doc.kind === "pdf" ? doc.thumbUrl : (doc.cleanUrl ?? doc.fileUrl);

  const saveTitle = (title: string) => {
    const t = title.trim();
    if (!t || t === doc.title) return;
    setDoc({ ...doc, title: t });
    void patchDocument(doc.id, { title: t }).catch(load);
  };

  const changeSubject = (value: string) => {
    const subjectId = value === "other" ? null : value;
    const name = subjects?.subjects.find((s) => s.id === subjectId)?.name ?? null;
    setDoc({ ...doc, subjectId, subjectName: name });
    void patchDocument(doc.id, { subjectId }).catch(load);
  };

  const toggleDate = (d: DateFound) => {
    const status = d.status === "auto" ? "ignored" : "auto";
    setDoc({ ...doc, dates: doc.dates.map((x) => (x.id === d.id ? { ...x, status } : x)) });
    void patchDate(d.id, { status }).catch(load);
  };

  return (
    <>
      <SiteHeader left={back} />
      <main className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-start gap-12 px-6 pt-10 pb-32 sm:px-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(380px,1fr)]">
        <figure className="flex flex-col gap-3 lg:sticky lg:top-8">
          {imageSrc ? (
            <Zoomable src={imageSrc} alt={doc.title} width={doc.width} height={doc.height} rounded={isScreenshot(doc)} />
          ) : (
            <Paper doc={doc} className="bg-muted df-sweep" />
          )}
          <figcaption className="flex flex-wrap justify-between gap-2 text-[15px] text-muted-foreground">
            <span>
              {kindWord(doc)}
              {doc.pages > 1 ? `, ${doc.pages} pages` : ""} · {doc.width}×{doc.height}
            </span>
            <span>Click to zoom</span>
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col gap-8">
          {reading ? (
            <p className="flex items-center gap-3 text-[19px] text-muted-foreground" role="status">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              Reading this on your laptop…
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label htmlFor="doc-title" className="sr-only">Title</label>
              <input
                id="doc-title"
                key={doc.title}
                defaultValue={doc.title}
                onBlur={(e) => saveTitle(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="-mx-2 rounded-lg bg-transparent px-2 py-1 text-[30px] leading-tight font-semibold tracking-[-0.015em] outline-none hover:bg-black/[0.03] focus:bg-white focus:ring-2 focus:ring-ring"
              />
              {doc.summary && <p className="text-[18px] leading-relaxed text-ink-soft">{doc.summary}</p>}
              {doc.status === "error" && <p className="text-[17px] text-primary">Could not read this file: {doc.error}</p>}
            </div>
          )}

          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-5 gap-y-4 text-[17px]">
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="flex flex-wrap items-baseline gap-3">
              <span className="font-medium">{doc.subjectName ?? "Other"}</span>
              <label className="sr-only" htmlFor="doc-subject">Change subject</label>
              <select
                id="doc-subject"
                value={doc.subjectId ?? "other"}
                onChange={(e) => changeSubject(e.target.value)}
                className="cursor-pointer rounded-md border border-border bg-white px-2 py-0.5 text-[15px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {subjects?.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {doc.subjectId && !subjects?.subjects.some((s) => s.id === doc.subjectId) && (
                  <option value={doc.subjectId}>{doc.subjectName}</option>
                )}
                <option value="other">Other</option>
              </select>
            </dd>

            <dt className="text-muted-foreground">Captured</dt>
            <dd>
              {relativeDay(doc.capturedAt)},{" "}
              {new Date(doc.capturedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </dd>

            {doc.tags.length > 0 && (
              <>
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-2">
                  {doc.tags.map((t) => (
                    <Link
                      key={t}
                      href={`/search?q=${encodeURIComponent(t)}`}
                      className="rounded-full border border-border px-3 py-0.5 text-[15px] text-ink-soft outline-none hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t}
                    </Link>
                  ))}
                </dd>
              </>
            )}

            <dt className="text-muted-foreground">Dates found</dt>
            <dd>
              {doc.dates.length === 0 ? (
                <span className="text-muted-foreground">None in this document</span>
              ) : (
                <ul className="flex flex-col gap-2">
                  {doc.dates.map((d) => (
                    <DateRow key={d.id} date={d} onToggle={toggleDate} />
                  ))}
                </ul>
              )}
            </dd>
          </dl>

          {doc.text && (
            <section aria-labelledby="text-heading" className="flex flex-col gap-3">
              <h2 id="text-heading" className="text-[17px] font-medium text-muted-foreground">Text it read</h2>
              <div
                tabIndex={0}
                className="max-h-[300px] overflow-auto rounded-xl border border-hairline bg-white px-5 py-4 text-[16px] leading-relaxed whitespace-pre-wrap text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Highlight text={doc.text} spans={spans} />
              </div>
              {doc.readMs != null && (
                <p className="text-[15px] text-muted-foreground">Read on this laptop in {seconds(doc.readMs)}</p>
              )}
            </section>
          )}

          <nav aria-label="Document actions" className="flex flex-wrap items-baseline gap-x-7 gap-y-3 border-t border-hairline pt-6 text-[17px]">
            <Link href={`/quiz?documents=${doc.id}`} className="rounded-sm font-semibold underline decoration-foreground/40 decoration-2 underline-offset-[6px] outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Quiz me on this
            </Link>
            <button
              type="button"
              onClick={() => void getSimilar(doc.id).then((r) => setSimilar(r.results)).catch(() => setSimilar([]))}
              className="rounded-sm text-ink-soft outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Find similar
            </button>
            <a href={doc.fileUrl} target="_blank" rel="noreferrer" title={doc.path} className="rounded-sm text-ink-soft outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Open original file
            </a>
            {confirmDelete ? (
              <span className="ml-auto flex items-baseline gap-4">
                <span className="text-muted-foreground">Delete from DéjàFind?</span>
                <button
                  type="button"
                  onClick={() => void deleteDocument(doc.id).then(() => router.push("/"))}
                  className="rounded-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-sm text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                Delete
              </button>
            )}
          </nav>
          <p className="-mt-5 truncate text-[15px] text-muted-foreground" title={doc.path}>{doc.path}</p>

          {similar && (
            <section aria-labelledby="similar-heading" className="flex flex-col gap-4">
              <h2 id="similar-heading" className="text-[17px] font-medium text-muted-foreground">Similar documents</h2>
              {similar.length === 0 ? (
                <p className="text-muted-foreground">Nothing similar in your documents.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-5">
                  {similar.slice(0, 6).map((r) => (
                    <li key={r.document.id}>
                      <Link href={`/d/${r.document.id}`} className="flex flex-col gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Paper doc={r.document} maxAspect={1.33} />
                        <span className="line-clamp-2 text-[15px] leading-snug">{r.document.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
