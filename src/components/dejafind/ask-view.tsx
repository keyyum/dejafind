"use client";
/* eslint-disable @next/next/no-img-element -- thumbnails come from local routes */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { DocumentSummary, SearchResponse, TimelineEntry } from "@/lib/api-types";
import { getDocument, getTimeline, search } from "@/lib/client/api";
import { seconds } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { SEARCH_INPUT_ID } from "./search-bar";
import { SiteHeader } from "./site-header";

type Turn =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "answer"; q: string; res: SearchResponse; docs: Record<string, DocumentSummary> }
  | { id: number; role: "error"; text: string };

/** Wall clock for the elapsed-seconds counter; called from event handlers only. */
const clockNow = () => Date.now();

const FALLBACK = ["When's my Biology quiz?", "What's due this week?", "What does the photosynthesis slide say?"];

/** Three questions the user is likely to ask, from the dates already found in their documents. */
function suggestionsFrom(entries: TimelineEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    const subject = e.subjectName;
    if (!subject) continue;
    const kind = e.label.toLowerCase().replace(/\bdate\b/g, "").trim();
    const q = /quiz|exam|test/.test(kind)
      ? `When's my ${subject} ${/long/.test(kind) ? "long quiz" : /exam/.test(kind) ? "exam" : "quiz"}?`
      : `What's due for ${subject}?`;
    if (!out.includes(q)) out.push(q);
  }
  for (const f of FALLBACK) if (out.length < 3 && !out.includes(f)) out.push(f);
  return out.slice(0, 3);
}

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

function DocChip({ doc, q }: { doc: DocumentSummary; q: string }) {
  return (
    <Link
      href={`/d/${doc.id}?q=${encodeURIComponent(q)}`}
      className="group flex max-w-full items-center gap-3 rounded-xl border border-hairline bg-background py-1.5 pr-4 pl-1.5 outline-none hover:border-border focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative aspect-[4/3] w-12 shrink-0 overflow-hidden rounded-[3px] bg-white shadow-paper">
        {doc.thumbUrl && (
          <img src={doc.thumbUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover object-top" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-medium text-foreground group-hover:underline">{doc.title}</span>
        <span className="truncate text-[14px] text-muted-foreground">{doc.subjectName ?? "Other"}</span>
      </span>
    </Link>
  );
}

function AnswerCard({ turn }: { turn: Extract<Turn, { role: "answer" }> }) {
  const { res, docs, q } = turn;
  // Core can also say it in the answer text ("Not in your files.") with no citations.
  const notIn =
    res.notInDocuments ||
    (!!res.answer && res.answer.citations.length === 0 && /^not in your (files|documents)/i.test(res.answer.text.trim()));
  const answer = notIn ? null : res.answer;
  const cited: string[] = [];
  for (const c of answer?.citations ?? []) if (docs[c.documentId] && !cited.includes(c.documentId)) cited.push(c.documentId);
  const nearest = res.results.slice(0, 3).map((r) => r.document);

  return (
    <div className={cn("flex max-w-[680px] flex-col gap-4", answer && "rounded-2xl bg-white p-5 shadow-paper sm:p-6")}>
      {answer ? (
        <>
          <p className="text-[19px] leading-[1.55] text-pretty text-foreground">
            <AnswerText text={answer.text} keyFact={answer.keyFact} />
          </p>
          {cited.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cited.slice(0, 3).map((id) => (
                <DocChip key={id} doc={docs[id]} q={q} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[19px] leading-[1.55] text-foreground">
            {notIn || res.isQuestion ? "Not in your documents." : "Here is what matches in your documents."}
          </p>
          {nearest.length > 0 && (
            <div className="flex flex-col gap-2">
              {(notIn || res.isQuestion) && <p className="text-[15px] text-muted-foreground">Closest documents</p>}
              <div className="flex flex-wrap gap-2">
                {nearest.map((d) => (
                  <DocChip key={d.id} doc={d} q={q} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <p className="text-[14px] text-faint tabular-nums">{seconds(res.tookMs)} on this laptop</p>
    </div>
  );
}

function Typing({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-[17px] text-muted-foreground shadow-paper">
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
      Reading your documents… <span className="tabular-nums">{s} s</span>
    </div>
  );
}

/** A thread over /api/search. Follow-up questions keep the conversation id. */
export function AskView() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    let live = true;
    void getTimeline(12)
      .then((t) => live && setSuggestions(suggestionsFrom(t.entries)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
  }, [turns.length, pendingSince, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.activeElement === input.current && input.current?.value) {
        setDraft("");
        return;
      }
      router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || pendingSince !== null) return;
    setDraft("");
    setTurns((t) => [...t, { id: nextId.current++, role: "user", text: q }]);
    setPendingSince(clockNow());
    search({ q, conversationId })
      .then(async (res) => {
        const docs: Record<string, DocumentSummary> = Object.fromEntries(res.results.map((r) => [r.document.id, r.document]));
        const missing = [...new Set((res.answer?.citations ?? []).map((c) => c.documentId))].filter((id) => !docs[id]);
        const fetched = await Promise.all(missing.map((id) => getDocument(id).catch(() => null)));
        for (const d of fetched) if (d) docs[d.id] = d;
        if (res.conversationId) setConversationId(res.conversationId);
        setTurns((t) => [...t, { id: nextId.current++, role: "answer", q, res, docs }]);
      })
      .catch((e) =>
        setTurns((t) => [
          ...t,
          { id: nextId.current++, role: "error", text: `Could not answer: ${e instanceof Error ? e.message : String(e)}. Check that the local server is running.` },
        ]),
      )
      .finally(() => {
        setPendingSince(null);
        input.current?.focus();
      });
  };

  const enter = reduced ? false : { opacity: 0, y: 8 };

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-4 pt-8 pb-48 sm:px-8">
        <h1 className={cn("text-[30px] font-semibold tracking-[-0.015em]", turns.length > 0 && "sr-only")}>Ask your documents</h1>
        {turns.length === 0 && (
          <p className="mt-2 text-[19px] text-muted-foreground">
            Answers come only from the files on this laptop, with the documents they came from.
          </p>
        )}

        <ol aria-label="Conversation" aria-live="polite" className="mt-8 flex flex-col gap-6">
          {turns.map((t) => (
            <motion.li
              key={t.id}
              initial={enter}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
              className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}
            >
              {t.role === "user" ? (
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-5 py-3 text-[18px] leading-snug text-background sm:max-w-[70%]">
                  {t.text}
                </p>
              ) : t.role === "answer" ? (
                <AnswerCard turn={t} />
              ) : (
                <p className="text-[17px] text-muted-foreground">{t.text}</p>
              )}
            </motion.li>
          ))}
          {pendingSince !== null && (
            <motion.li initial={enter} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <Typing since={pendingSince} />
            </motion.li>
          )}
        </ol>
        <div ref={end} />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-70% to-transparent pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3 px-4 sm:px-8">
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-border bg-white px-4 py-2 text-[16px] text-ink-soft outline-none hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-3 rounded-[28px] border border-border bg-white py-2 pr-2 pl-5 shadow-[0_2px_10px_rgb(0_0_0/0.05)] transition-[border-color] focus-within:border-foreground/60"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
              Ask about your documents
            </label>
            <textarea
              ref={input}
              id={SEARCH_INPUT_ID}
              rows={1}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              placeholder={turns.length ? "Ask a follow-up" : "Ask about your documents"}
              autoComplete="off"
              className="field-sizing-content max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[18px] leading-snug text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="mb-3 hidden shrink-0 rounded-md border border-border px-2 py-0.5 font-sans text-sm text-muted-foreground sm:block">⌘K</kbd>
            <button
              type="submit"
              aria-label="Ask"
              disabled={!draft.trim() || pendingSince !== null}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-30"
            >
              <ArrowUpIcon className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
