"use client";

import { useState } from "react";
import type { StatusResponse } from "@/lib/api-types";
import { getStatus } from "@/lib/client/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function size(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

const ROLE: Record<string, string> = { vision: "reads images", text: "reads text, answers", embedding: "search meaning" };

/** "On this laptop · nothing sent", and the panel that proves it. */
export function StatusPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () =>
    getStatus()
      .then((s) => {
        setStatus(s);
        setFailed(false);
      })
      .catch(() => setFailed(true));

  const online = !failed && (status?.ollamaReachable ?? true);
  return (
    <Popover onOpenChange={(open) => open && void load()}>
      <PopoverTrigger
        className="inline-flex items-center gap-2.5 rounded-full px-2 py-1 text-[15px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative flex size-2" aria-hidden>
          <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", online ? "bg-emerald-500" : "bg-amber-500")} />
          <span className={cn("relative inline-flex size-2 rounded-full", online ? "bg-emerald-500" : "bg-amber-500")} />
        </span>
        On this laptop · nothing sent
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] gap-4 rounded-2xl p-5 text-[15px] shadow-[0_12px_32px_rgb(0_0_0/0.12)]">
        {failed ? (
          <p className="text-muted-foreground">The local server is not answering. Start it with npm run dev.</p>
        ) : !status ? (
          <p className="text-muted-foreground">Checking…</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-medium tabular-nums">{status.requestsOut}</span>
              <span className="text-ink-soft">requests out since start</span>
            </div>
            <ul className="flex flex-col gap-2.5 border-t border-hairline pt-4">
              {status.models.map((m) => (
                <li key={m.name} className="flex items-baseline justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-sm text-muted-foreground">{ROLE[m.role]}</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                    {m.params} · {size(m.sizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-4">
              <span className="text-ink-soft">Seconds per document</span>
              {status.avgReadMs != null ? (
                <span className="font-mono tabular-nums">{(status.avgReadMs / 1000).toFixed(1)} s</span>
              ) : (
                <span className="text-muted-foreground">not measured yet</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Measured on this machine ({status.machine}) over {status.documentsRead} documents.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
