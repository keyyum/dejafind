"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { importFiles } from "@/lib/client/api";
import { useDejaEvent } from "./events";

const ACCEPT = /\.(png|jpe?g|heic|heif|webp|gif|pdf)$/i;

/** Files from a drop, walking into folders via webkitGetAsEntry. */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = [...dt.items]
    .map((i) => (i.kind === "file" ? i.webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return [...dt.files];
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns at most ~100 at a time; keep reading until empty.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

/** Documents from a multi-file drop; the snackbar stays quiet for these. */
const bulkIds = new Set<string>();
let bulkUntil = 0;
let bulkRunning = false;
/** True from a multi-file drop until its last document is filed. The grid skips layout springs meanwhile. */
export const isBulkRunning = () => bulkRunning;
/** True for documents from a multi-file drop, and for anything queued while one is uploading. */
export const isBulkImport = (id: string) => bulkIds.has(id) || Date.now() < bulkUntil;

interface Batch {
  ids: Set<string>;
  done: number;
  total: number;
}

const ImportContext = createContext<(files: File[] | Blob[], source?: "snap" | "drop") => Promise<void>>(async () => {});

/** Sends files to /api/import and tracks them as one batch for the progress line. */
export function useImport() {
  return useContext(ImportContext);
}

/** Whole-window drop zone plus the "Reading 7 of 20" progress line. */
export function ImportDrop({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const depth = useRef(0);

  const send = useCallback(
    async (files: File[] | Blob[], source?: "snap" | "drop") => {
      const list = [...files].filter((f) => !(f instanceof File) || ACCEPT.test(f.name));
      if (!list.length) {
        toast("Nothing to add. DéjàFind reads images and PDFs.");
        return;
      }
      if (window.location.pathname !== "/") router.push("/");
      if (list.length > 1) {
        bulkUntil = Date.now() + 10_000;
        bulkRunning = true;
      }
      try {
        const res = await importFiles(list as File[], source);
        bulkUntil = 0;
        if (res.duplicates) toast(`${res.duplicates} already in your library`);
        if (res.documents.length > 1) {
          for (const d of res.documents) bulkIds.add(d.id);
          setBatch({ ids: new Set(res.documents.map((d) => d.id)), done: 0, total: res.documents.length });
        }
      } catch (e) {
        bulkRunning = false;
        bulkUntil = 0;
        toast(`Could not add files: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [router],
  );

  useDejaEvent((e) => {
    const id = e.type === "document.filed" ? e.document.id : e.type === "document.error" ? e.documentId : null;
    if (!id) return;
    setBatch((b) => (b && b.ids.has(id) ? { ...b, done: b.done + 1 } : b));
  });

  useEffect(() => {
    if (!batch || batch.done < batch.total) return;
    bulkRunning = false;
    const t = setTimeout(() => setBatch(null), 2500);
    return () => clearTimeout(t);
  }, [batch]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e) || !e.dataTransfer) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      void filesFromDrop(e.dataTransfer).then((files) => send(files, "drop"));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [send]);

  return (
    <ImportContext.Provider value={send}>
      {children}
      {over && (
        <div className="pointer-events-none fixed inset-3 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-foreground/40 bg-background/85 backdrop-blur-[2px]">
          <p className="text-[24px] font-medium">Drop to add to DéjàFind</p>
        </div>
      )}
      {batch && (
        <div className="fixed inset-x-0 top-0 z-40" role="status" aria-live="polite">
          <div className="h-0.5 bg-hairline">
            <div
              className="h-full origin-left bg-foreground transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${batch.done / batch.total})` }}
            />
          </div>
          <p className="mx-auto mt-2 w-fit rounded-full bg-foreground px-4 py-1.5 text-[15px] font-medium text-background tabular-nums shadow-md">
            {batch.done < batch.total
              ? `Reading ${Math.min(batch.done + 1, batch.total)} of ${batch.total}`
              : `Filed ${batch.total} of ${batch.total}`}
          </p>
        </div>
      )}
    </ImportContext.Provider>
  );
}
