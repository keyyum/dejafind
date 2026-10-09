"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentSummary, ReviewSheetResponse } from "@/lib/api-types";
import { getDocument, reviewSheet } from "@/lib/client/api";
import { seconds } from "@/lib/client/format";
import { downloadMarkdown, reviewMarkdown, slug } from "@/lib/client/markdown";
import { Paper } from "./paper";
import { SiteHeader } from "./site-header";

export function ReviewView() {
  const params = useSearchParams();
  const subjectId = params.get("subject") ?? "";
  return <ReviewRun key={subjectId} subjectId={subjectId} />;
}

function ReviewRun({ subjectId }: { subjectId: string }) {
  const [data, setData] = useState<ReviewSheetResponse | null>(null);
  const [docs, setDocs] = useState<Record<string, DocumentSummary>>({});
  const [error, setError] = useState<string | null>(subjectId ? null : "Pick a subject first.");

  useEffect(() => {
    if (!subjectId) return;
    let live = true;
    reviewSheet(subjectId)
      .then(async (r) => {
        if (!live) return;
        setData(r);
        const ids = [...new Set(r.lines.map((l) => l.documentId))];
        const found = await Promise.all(ids.map((id) => getDocument(id).catch(() => null)));
        if (live) setDocs(Object.fromEntries(found.filter((d) => d).map((d) => [d!.id, d!])));
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [subjectId]);

  const sourceCount = data ? new Set(data.lines.map((l) => l.documentId)).size : 0;

  return (
    <>
      <SiteHeader
        left={
          <Link
            href={subjectId ? `/?subject=${subjectId}` : "/"}
            className="inline-flex items-center gap-2 rounded-sm text-[17px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeftIcon className="size-5" aria-hidden />
            {data?.subjectName ?? "Back"}
          </Link>
        }
      />
      <main id="main" className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-6 pt-14 pb-24 sm:px-12">
        {error && <p className="text-[19px] text-muted-foreground">Could not make a reviewer: {error}</p>}
        {!data && !error && (
          <p className="flex items-center gap-3 text-[19px] text-muted-foreground" role="status">
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
            Writing a one-page reviewer from your notes, on this laptop…
          </p>
        )}
        {data && (
          <>
            <header className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-6">
              <h1 className="text-[34px] leading-tight font-semibold tracking-[-0.02em]">{data.subjectName} reviewer</h1>
                <button
                  type="button"
                  onClick={() => downloadMarkdown(`${slug(data.subjectName)}-reviewer`, reviewMarkdown(data, docs))}
                  className="shrink-0 text-[17px] rounded-sm text-ink-soft underline decoration-border decoration-2 underline-offset-[6px] outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Save as .md
                </button>
              </div>
              <p className="text-[16px] text-muted-foreground tabular-nums">
                {data.lines.length} {data.lines.length === 1 ? "line" : "lines"} from {sourceCount === 1 ? "one of your documents" : `${sourceCount} of your documents`} · written on this laptop in {seconds(data.tookMs)}
              </p>
            </header>
            {data.lines.length === 0 ? (
              <p className="text-[19px] text-muted-foreground">Nothing filed under {data.subjectName} to review yet.</p>
            ) : (
              <ul className="flex flex-col">
                {data.lines.map((line, i) => {
                  const doc = docs[line.documentId];
                  return (
                    <li key={i} className="flex items-start gap-5 border-b border-hairline py-4 last:border-b-0">
                      <p className="min-w-0 flex-1 text-[19px] leading-relaxed text-pretty">{line.text}</p>
                      <Link
                        href={`/d/${line.documentId}`}
                        aria-label={`Source: ${doc?.title ?? "document"}`}
                        title={doc?.title}
                        className="w-14 shrink-0 rounded-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {doc ? <Paper doc={doc} maxAspect={1} /> : <span className="block aspect-[4/3] rounded-[3px] bg-muted" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
