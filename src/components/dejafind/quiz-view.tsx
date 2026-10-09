"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Quiz } from "@/lib/api-types";
import { quiz as fetchQuiz } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Paper } from "./paper";
import { SiteHeader } from "./site-header";

const KEYS = ["A", "B", "C", "D"];

export function QuizView() {
  const params = useSearchParams();
  const subjectId = params.get("subject");
  const docsKey = params.get("documents") ?? "";
  const [round, setRound] = useState(0);
  return (
    <QuizRun
      key={`${subjectId}|${docsKey}|${round}`}
      subjectId={subjectId}
      documentIds={docsKey.split(",").filter(Boolean)}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function QuizRun({
  subjectId,
  documentIds,
  onAgain,
}: {
  subjectId: string | null;
  documentIds: string[];
  onAgain: () => void;
}) {
  const docsKey = documentIds.join(",");
  const [data, setData] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    let live = true;
    fetchQuiz(subjectId ? { subjectId } : { documentIds: docsKey ? docsKey.split(",") : [] })
      .then((q) => live && setData(q))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [subjectId, docsKey]);

  const total = data?.questions.length ?? 5;
  const done = data != null && index >= data.questions.length;
  const question = data && !done ? data.questions[index] : null;

  const pick = useCallback(
    (i: number) => {
      if (!question || picked !== null) return;
      setPicked(i);
      if (i === question.answerIndex) setScore((s) => s + 1);
    },
    [question, picked],
  );
  const next = useCallback(() => {
    setPicked(null);
    setIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toUpperCase();
      const i = KEYS.indexOf(k) >= 0 ? KEYS.indexOf(k) : ["1", "2", "3", "4"].indexOf(k);
      if (i >= 0 && picked === null) pick(i);
      else if (e.key === "Enter" && picked !== null && !(e.target instanceof HTMLButtonElement)) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, next, picked]);

  const backHref = subjectId ? `/?subject=${subjectId}` : documentIds.length === 1 ? `/d/${documentIds[0]}` : "/";
  const backLabel = data?.subjectName ?? (documentIds.length === 1 ? "Back to the document" : "Back");
  const progress = data ? ((done ? total : index + (picked !== null ? 1 : 0)) / total) * 100 : 0;
  const source = question ? data?.sources[question.sourceDocumentId] : null;
  const right = question && picked === question.answerIndex;

  return (
    <>
      <SiteHeader
        left={
          <Link href={backHref} className="inline-flex items-center gap-2 rounded-sm text-[17px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeftIcon className="size-5" aria-hidden />
            {backLabel}
          </Link>
        }
        center={
          data && !done ? (
            <span className="text-[17px] text-muted-foreground tabular-nums" aria-live="polite">
              {index + 1} of {total}
            </span>
          ) : null
        }
      />
      <div aria-hidden className="mx-auto mt-5 h-0.5 w-[calc(100%-3rem)] max-w-[1224px] bg-hairline sm:w-[calc(100%-6rem)]">
        <div className="h-full bg-foreground transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>

      <main className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-10 px-6 pt-16 pb-24 sm:px-12">
        {error && <p className="text-[19px] text-muted-foreground">Could not make a quiz: {error}</p>}
        {!data && !error && (
          <p className="flex items-center gap-3 text-[19px] text-muted-foreground" role="status">
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
            Writing five questions from your notes, on this laptop…
          </p>
        )}

        {question && (
          <>
            <h1 className="text-[30px] leading-[1.35] font-medium tracking-[-0.015em]">{question.question}</h1>
            <div className="flex flex-col gap-3" role="group" aria-label="Choices">
              {question.choices.map((c, i) => {
                const isRight = i === question.answerIndex;
                const isPicked = i === picked;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => pick(i)}
                    className={cn(
                      "flex min-h-16 items-center gap-5 rounded-2xl border bg-white px-6 py-4 text-left text-[19px] transition-[opacity,border-color,background-color] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      picked === null && "cursor-pointer border-border hover:border-foreground/50",
                      picked !== null && isRight && "border-2 border-filed bg-[#eef7f0]",
                      picked !== null && isPicked && !isRight && "border-2 border-wrong bg-[#fdf1ec]",
                      picked !== null && !isRight && !isPicked && "border-border opacity-40",
                    )}
                  >
                    <span className="w-5 shrink-0 text-[15px] text-muted-foreground">{KEYS[i]}</span>
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <section aria-live="polite" className="flex flex-wrap items-start gap-x-10 gap-y-6 border-t border-hairline pt-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
                <div className="flex min-w-0 flex-[999_1_360px] flex-col gap-3">
                  <p className={cn("text-[20px] font-semibold", right ? "text-filed" : "text-wrong")}>
                    {right ? "Correct" : `Not quite. It’s ${question.choices[question.answerIndex]}.`}
                  </p>
                  <p className="text-[17px] leading-relaxed text-ink-soft">{question.explanation}</p>
                  {source && (
                    <Link href={`/d/${source.id}`} className="w-fit rounded-sm text-[15px] text-muted-foreground underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                      From {source.title}
                    </Link>
                  )}
                </div>
                {source && (
                  <Link href={`/d/${source.id}`} aria-label={`Open ${source.title}`} className="w-[200px] shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
                    <Paper doc={source} maxAspect={1.2} />
                  </Link>
                )}
                <div className="flex w-full justify-end">
                  <button
                    type="button"
                    autoFocus
                    onClick={next}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[17px] font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {index + 1 === total ? "See score" : "Next"}
                    <ArrowRightIcon className="size-5" aria-hidden />
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {done && data && (
          <section className="flex flex-col items-start gap-6 pt-6">
            <p className="text-[56px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {score} of {total}
            </p>
            <p className="text-[19px] text-ink-soft">
              {score === total ? "All correct." : score >= total / 2 ? "Good. Open the sources of the ones you missed." : "Worth another look at these notes."}
            </p>
            <div className="flex items-center gap-6 text-[17px]">
              <button
                type="button"
                autoFocus
                onClick={onAgain}
                className="inline-flex h-12 items-center rounded-full bg-foreground px-6 font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Again
              </button>
              <Link href={backHref} className="rounded-sm text-ink-soft underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                Back
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
