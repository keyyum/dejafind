"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { FlashcardsResponse, SubjectsResponse } from "@/lib/api-types";
import { flashcards as fetchFlashcards, getSubjects } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Paper } from "./paper";
import { SiteHeader } from "./site-header";

export function FlashcardsView() {
  const params = useSearchParams();
  const subjectId = params.get("subject");
  const docsKey = params.get("documents") ?? "";
  return <FlashcardsRun key={`${subjectId}|${docsKey}`} subjectId={subjectId} docsKey={docsKey} />;
}

function FlashcardsRun({ subjectId, docsKey }: { subjectId: string | null; docsKey: string }) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<FlashcardsResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let live = true;
    fetchFlashcards(subjectId ? { subjectId } : { documentIds: docsKey.split(",").filter(Boolean) })
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    void getSubjects().then((s) => live && setSubjects(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [subjectId, docsKey]);

  const total = data?.cards.length ?? 0;
  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((i) => Math.min(Math.max(0, i + delta), Math.max(0, total - 1)));
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const subjectName = subjectId ? subjects?.subjects.find((s) => s.id === subjectId)?.name : null;
  const backHref = subjectId ? `/?subject=${subjectId}` : "/";
  const card = data?.cards[index];
  const source = card ? data?.sources[card.sourceDocumentId] : null;

  return (
    <>
      <SiteHeader
        left={
          <Link href={backHref} className="inline-flex items-center gap-2 rounded-sm text-[17px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeftIcon className="size-5" aria-hidden />
            {subjectName ?? "Back"}
          </Link>
        }
        center={
          total > 0 ? (
            <span className="text-[17px] text-muted-foreground tabular-nums" aria-live="polite">
              {index + 1} of {total}
            </span>
          ) : null
        }
      />
      <div aria-hidden className="mx-auto mt-5 h-0.5 w-[calc(100%-3rem)] max-w-[1224px] bg-hairline sm:w-[calc(100%-6rem)]">
        <div
          className="h-full origin-left bg-foreground transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${total ? (index + 1) / total : 0})` }}
        />
      </div>

      <main id="main" className="mx-auto flex w-full max-w-[860px] flex-1 flex-col items-center gap-8 px-6 pt-14 pb-24 sm:px-12">
        <h1 className="sr-only">Flashcards{subjectName ? ` for ${subjectName}` : ""}</h1>
        {error && <p className="self-start text-[19px] text-muted-foreground">Could not make flashcards: {error}</p>}
        {!data && !error && (
          <p className="flex items-center gap-3 self-start text-[19px] text-muted-foreground" role="status">
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
            Making flashcards from your notes, on this laptop…
          </p>
        )}
        {data && total === 0 && (
          <p className="self-start text-[19px] text-muted-foreground">No terms to make cards from in these documents yet.</p>
        )}

        {card && (
          <>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? `Definition of ${card.term}. Show the term` : `${card.term}. Show the definition`}
              className="group w-full rounded-3xl outline-none [perspective:1600px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <span
                className={cn(
                  "relative grid min-h-[380px] w-full [transform-style:preserve-3d]",
                  !reduced && "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  flipped && "[transform:rotateY(180deg)]",
                )}
              >
                <span className="col-start-1 row-start-1 flex flex-col items-center justify-center gap-6 rounded-3xl bg-white px-12 py-14 shadow-paper [backface-visibility:hidden]">
                  <span className="text-center text-[44px] leading-tight font-semibold tracking-[-0.02em] text-balance">{card.term}</span>
                  <span className="text-[15px] text-muted-foreground">Click or press ↑ to flip</span>
                </span>
                <span className="col-start-1 row-start-1 flex flex-col items-center justify-center gap-6 rounded-3xl bg-white px-12 py-14 shadow-paper [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="text-[17px] font-medium text-muted-foreground">{card.term}</span>
                  <span className="max-w-[620px] text-center text-[26px] leading-snug text-pretty">{card.definition}</span>
                </span>
              </span>
            </button>

            {source && (
              <Link
                href={`/d/${source.id}`}
                className="flex items-center gap-4 self-start rounded-lg outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-16 shrink-0">
                  <Paper doc={source} maxAspect={1} />
                </span>
                <span className="text-[16px] text-ink-soft underline decoration-border underline-offset-4">From {source.title}</span>
              </Link>
            )}

            <nav aria-label="Cards" className="flex w-full items-center justify-between gap-4 text-[17px]">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="rounded-full px-5 py-2.5 text-ink-soft outline-none hover:bg-black/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
              >
                ← Previous
              </button>
              <span className="hidden text-[15px] text-muted-foreground sm:inline">← → to move · ↑ to flip</span>
              {index + 1 < total ? (
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="rounded-full bg-foreground px-6 py-2.5 font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Next →
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="rounded-full bg-foreground px-6 py-2.5 font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Done
                </Link>
              )}
            </nav>
          </>
        )}
      </main>
    </>
  );
}
