"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentSummary, SearchResponse, SubjectsResponse } from "@/lib/api-types";
import { getDocument, getSubjects, search } from "@/lib/client/api";
import { kindWord, relativeDay, seconds } from "@/lib/client/format";
import { Highlight } from "./highlight";
import { Paper } from "./paper";
import { SearchBar } from "./search-bar";
import { SiteHeader } from "./site-header";
import { SubjectFilters } from "./subject-filters";

/** The answer text with its key fact in bold. */
function AnswerText({ text, keyFact }: { text: string; keyFact: string | null }) {
  const i = keyFact ? text.indexOf(keyFact) : -1;
  if (!keyFact || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-semibold">{keyFact}</strong>
      {text.slice(i + keyFact.length)}
    </>
  );
}

export function SearchView() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const subject = params.get("subject");

  const [subjects, setSubjects] = useState<SubjectsResponse | null>(null);
  const key = `${q}|${subject ?? ""}`;
  const [result, setResult] = useState<{
    key: string;
    res: SearchResponse | null;
    cited: Record<string, DocumentSummary>;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    void getSubjects().then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!q) return;
    let live = true;
    search({ q, subjectId: subject && subject !== "all" ? subject : null })
      .then(async (r) => {
        const known: Record<string, DocumentSummary> = Object.fromEntries(r.results.map((x) => [x.document.id, x.document]));
        const missing = (r.answer?.citations ?? []).map((c) => c.documentId).filter((id) => !known[id]);
        const fetched = await Promise.all(missing.map((id) => getDocument(id).catch(() => null)));
        for (const d of fetched) if (d) known[d.id] = d;
        if (live) setResult({ key, res: r, cited: known, error: null });
      })
      .catch((e) => live && setResult({ key, res: null, cited: {}, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [q, subject, key]);

  const pending = !!q && result?.key !== key;
  const res = q ? (result?.res ?? null) : null;
  const cited = result?.cited ?? {};
  const error = !pending ? (result?.error ?? null) : null;

  const hrefFor = (f: string) => {
    const p = new URLSearchParams({ q });
    if (f !== "all") p.set("subject", f);
    return `/search?${p}`;
  };

  const answer = res?.isQuestion ? res.answer : null;
  const citations = answer?.citations.filter((c) => cited[c.documentId]).slice(0, 2) ?? [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-6 pt-12 pb-32 sm:px-12">
        <div className="max-w-[880px]">
          <SearchBar defaultValue={q} subjectId={subject} autoFocus={!q} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <div className="min-w-0 flex-1">
            <SubjectFilters subjects={subjects} active={subject ?? "all"} hrefFor={hrefFor} showSchedule={false} />
          </div>
          {res && !pending && (
            <span className="text-[15px] text-muted-foreground tabular-nums">
              {res.results.length} {res.results.length === 1 ? "document" : "documents"} · {seconds(res.tookMs)} on this laptop
            </span>
          )}
        </div>

        {!q && <p className="text-[19px] text-muted-foreground">Try “when’s my bio quiz” or “the slide with the photosynthesis equation”.</p>}

        {pending && (
          <p className="flex items-center gap-3 text-[17px] text-muted-foreground" role="status">
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
            Reading your documents on this laptop…
          </p>
        )}
        {error && <p className="text-[17px] text-muted-foreground">Search failed: {error}. Check that the local server is running.</p>}

        {res && (
          <div className={pending ? "opacity-50" : undefined}>
            {answer && (
              <section aria-label="Answer" className="mb-12 flex flex-wrap items-start justify-between gap-x-12 gap-y-8 border-b border-hairline pb-12">
                <div className="flex max-w-[680px] min-w-[320px] flex-[1_1_420px] flex-col gap-3">
                  <p className="text-[24px] leading-[1.45] tracking-[-0.01em] text-foreground">
                    <AnswerText text={answer.text} keyFact={answer.keyFact} />
                  </p>
                  <p className="text-[15px] text-muted-foreground">
                    From {answer.citations.length} of your {answer.citations.length === 1 ? "document" : "documents"}
                  </p>
                </div>
                {citations.length > 0 && (
                  <div className="df-paint flex shrink-0 gap-6" style={{ "--d": "0.35s" } as React.CSSProperties}>
                    {citations.map((c) => {
                      const doc = cited[c.documentId];
                      return (
                        <Link
                          key={c.documentId}
                          href={`/d/${doc.id}?q=${encodeURIComponent(q)}`}
                          className="group flex w-[220px] flex-col gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                        >
                          <Paper doc={doc} maxAspect={0.9} />
                          <span className="flex flex-col gap-1">
                            <span className="line-clamp-1 text-[15px] font-medium">{doc.title}</span>
                            {c.lines.slice(0, 2).map((line, i) => (
                              <span key={i} className="line-clamp-3 text-[15px] leading-snug text-ink-soft">
                                <mark>{line}</mark>
                              </span>
                            ))}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {res.notInDocuments && <p className="mb-8 text-[19px] text-muted-foreground">Not in your documents.</p>}

            {res.results.length === 0 ? (
              !res.notInDocuments && <p className="text-[19px] text-muted-foreground">Nothing in your documents matches that.</p>
            ) : (
              <section aria-labelledby="results-heading" className="flex flex-col gap-1">
                <h2 id="results-heading" className="mb-3 text-[17px] font-medium text-muted-foreground">
                  Documents
                </h2>
                <ul className="flex max-w-[960px] flex-col">
                  {res.results.map((r, i) => (
                    <li key={r.document.id} className="df-paint" style={{ "--d": `${0.2 + i * 0.08}s` } as React.CSSProperties}>
                      <Link
                        href={`/d/${r.document.id}?q=${encodeURIComponent(q)}`}
                        className="-mx-4 flex items-start gap-6 rounded-xl p-4 outline-none hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="w-24 shrink-0">
                          <Paper doc={r.document} maxAspect={1.33} />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-[18px] font-medium">{r.document.title}</span>
                          <span className="line-clamp-2 text-[16px] leading-relaxed text-ink-soft">
                            <Highlight text={r.snippet} spans={r.matches} />
                          </span>
                          <span className="text-[15px] text-muted-foreground">
                            {kindWord(r.document)} · {r.document.subjectName ?? "Other"} · {relativeDay(r.document.capturedAt)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
