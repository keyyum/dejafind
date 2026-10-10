"use client";
/* eslint-disable @next/next/no-img-element -- local thumbnails and in-memory captures */

import Link from "next/link";
import { ChevronDownIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/api-types";
import { getDocuments } from "@/lib/client/api";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { useDejaEvent } from "./events";
import { useImport } from "./import-drop";

const DEVICE_KEY = "dejafind:snap-device";

function readDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}
function saveDevice(id: string) {
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {}
}

/** Prefers the iPhone (Continuity Camera) when it is connected. */
function pickDefault(devices: MediaDeviceInfo[]): string | null {
  const saved = readDevice();
  if (saved && devices.some((d) => d.deviceId === saved)) return saved;
  return devices.find((d) => /iphone|continuity/i.test(d.label))?.deviceId ?? null;
}

/** Short camera names for the small picker: "iPhone Camera", "FaceTime HD Camera". */
function shortLabel(d: MediaDeviceInfo, i: number): string {
  return (d.label || `Camera ${i + 1}`).replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, "");
}

/** A photo taken in this sheet: shown at once, then replaced by the filed document. */
interface Shot {
  key: string;
  preview: string;
  takenAt: number;
  docId: string | null;
  doc: DocumentSummary | null;
  failed: boolean;
}

const STRIP = 6;

/** The strip under the shutter: this sheet's photos first (reading, then filed), then what is already in. */
function Strip({ shots, recent, now, onOpen }: { shots: Shot[]; recent: DocumentSummary[] | null; now: number; onOpen: () => void }) {
  const shotIds = new Set(shots.map((s) => s.docId).filter(Boolean));
  const rest = (recent ?? []).filter((d) => !shotIds.has(d.id)).slice(0, Math.max(0, STRIP - shots.length));
  const tile = "block h-24 w-full overflow-hidden rounded-xl bg-white/10 sm:h-28";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] text-white/60">{shots.length ? "Your photos, then what is already in" : "Already in DéjàFind"}</p>
      <ul className="grid grid-cols-3 gap-3 max-sm:[&>li:nth-child(n+4)]:hidden sm:grid-cols-6" aria-live="polite">
        {shots.slice(0, STRIP).map((s) => {
          const filed = s.doc && s.doc.status === "done";
          const secs = Math.max(0, Math.round(((now || s.takenAt) - s.takenAt) / 1000));
          return (
            <li key={s.key} className="min-w-0">
              {filed && s.doc ? (
                <Link href={`/d/${s.doc.id}`} onClick={onOpen} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <span className={tile}>
                    <img src={s.doc.thumbUrl ?? s.preview} alt={s.doc.title} className="size-full object-contain" />
                  </span>
                  <span className="mt-1.5 block truncate text-[14px] text-white">{s.doc.title}</span>
                  <span className="block truncate text-[14px] text-emerald-300">filed under {s.doc.subjectName ?? "Other"}</span>
                </Link>
              ) : (
                <div>
                  <span className={cn(tile, "df-sweep relative")}>
                    <img src={s.preview} alt="" className="size-full object-contain opacity-60" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2Icon className="size-6 animate-spin text-white" aria-hidden />
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[14px] text-white/80 tabular-nums">
                    {s.failed ? "Could not add this photo" : `Reading… ${secs} s`}
                  </span>
                </div>
              )}
            </li>
          );
        })}
        {rest.map((d) => (
          <li key={d.id} className="min-w-0">
            <Link href={`/d/${d.id}`} onClick={onOpen} title={d.title} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white">
              <span className={tile}>
                <img src={d.thumbUrl ?? undefined} alt={d.title} className="size-full object-contain transition-opacity group-hover:opacity-80" />
              </span>
              <span className="mt-1.5 block truncate text-[14px] text-white/75">{d.title}</span>
            </Link>
          </li>
        ))}
        {!recent && shots.length === 0 && Array.from({ length: STRIP }, (_, i) => <li key={i} className={tile} />)}
      </ul>
      {recent && recent.length === 0 && shots.length === 0 && (
        <p className="text-[15px] text-white/60">Nothing filed yet. Your first photo starts the library.</p>
      )}
    </div>
  );
}

function CaptureSheet({ onClose }: { onClose: () => void }) {
  const send = useImport();
  const video = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [recent, setRecent] = useState<DocumentSummary[] | null>(null);
  const now = useNow(1000);

  useEffect(() => {
    let live = true;
    void getDocuments()
      .then((r) => live && setRecent(r.groups.flatMap((g) => g.documents).filter((d) => d.status === "done" && d.thumbUrl).slice(0, STRIP)))
      .catch(() => live && setRecent([]));
    return () => {
      live = false;
    };
  }, []);

  useDejaEvent((e) => {
    if (e.type === "document.filed") {
      setShots((ss) => ss.map((s) => (s.docId === e.document.id ? { ...s, doc: e.document } : s)));
    } else if (e.type === "document.error") {
      setShots((ss) => ss.map((s) => (s.docId === e.documentId ? { ...s, failed: true } : s)));
    }
  });

  // Free the in-memory previews when the sheet closes.
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  });
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.preview)), []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async (s) => {
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) video.current.srcObject = s;
        const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (!live) return;
        setDevices(all);
        setError(null);
        if (!deviceId) {
          const preferred = pickDefault(all);
          const current = s.getVideoTracks()[0]?.getSettings().deviceId;
          setSelected(preferred ?? current ?? "");
          if (preferred && preferred !== current) setDeviceId(preferred);
        }
      })
      .catch((e: unknown) =>
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access is off. Allow it in the browser's site settings, then open Snap again."
            : "No camera found. Connect your iPhone or a webcam, then open Snap again.",
        ),
      );
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth || flash) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 160);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const key = `shot-${Date.now()}`;
        const file = new File([blob], `snap-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" });
        // The photo drops into the strip at once; the seconds count while the laptop reads it.
        setShots((ss) => [{ key, preview: URL.createObjectURL(blob), takenAt: Date.now(), docId: null, doc: null, failed: false }, ...ss]);
        void send([file], "snap").then((res) => {
          const doc = res?.documents[0] ?? null;
          setShots((ss) => ss.map((s) => (s.key === key ? { ...s, docId: doc?.id ?? null, failed: !doc } : s)));
        });
      },
      "image/jpeg",
      0.92,
    );
  };

  // Space shoots (unless the camera picker has focus).
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      e.preventDefault();
      captureRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[#1f1f1d] text-white">
      {/* Chrome above the viewfinder: close left, title, camera right. Nothing sits on the picture. */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-5">
        <DialogClose
          aria-label="Close"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
        >
          <XIcon className="size-5" aria-hidden />
        </DialogClose>
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogTitle className="text-[17px] font-semibold text-white">Snap a page</DialogTitle>
          <DialogDescription className="truncate text-[15px] text-white/60">Hold it up to the camera. Space takes the photo.</DialogDescription>
        </div>
        {devices.length > 0 && (
          <div className="relative max-w-[44%] min-w-0 sm:max-w-[240px]">
            <label htmlFor="snap-device" className="sr-only">Camera</label>
            <select
              id="snap-device"
              value={selected}
              onChange={(e) => {
                setReady(false);
                setSelected(e.target.value);
                setDeviceId(e.target.value);
                saveDevice(e.target.value);
              }}
              className="h-10 w-full cursor-pointer appearance-none truncate rounded-full border-0 bg-white/10 pr-9 pl-3.5 text-[14px] text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId} className="text-foreground">
                  {shortLabel(d, i)}
                </option>
              ))}
            </select>
            <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/70" />
          </div>
        )}
      </div>

      {/* Borderless viewfinder: it takes every pixel between the header and the strip; the shutter sits on the picture. */}
      <div className="relative min-h-[200px] min-w-0 flex-1 overflow-hidden bg-black">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className={cn("size-full object-cover transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
        />
        {error && <p className="absolute inset-0 flex items-center justify-center p-10 text-center text-[17px] text-white/80">{error}</p>}
        {!ready && !error && (
          <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Starting camera">
            <Loader2Icon className="size-7 animate-spin text-white/60" aria-hidden />
          </span>
        )}
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 bg-white transition-opacity", flash ? "opacity-90 duration-75" : "opacity-0 duration-300")}
        />
        <div className="absolute inset-x-0 bottom-5 flex justify-center">
          <button
            type="button"
            autoFocus
            aria-label="Take photo"
            disabled={!ready}
            onClick={capture}
            className="group flex size-[72px] items-center justify-center rounded-full border-4 border-white shadow-[0_4px_24px_rgb(0_0_0/0.5)] outline-none focus-visible:ring-4 focus-visible:ring-white/50 disabled:opacity-40"
          >
            <span className="size-[56px] rounded-full bg-white transition-transform duration-150 group-hover:scale-95 group-active:scale-90" />
          </button>
        </div>
      </div>

      {/* The strip is glued to the bottom edge; whole thumbnails, nothing cropped. */}
      <div className="shrink-0 px-4 pt-3 pb-4 sm:px-5">
        <Strip shots={shots} recent={recent} now={now} onOpen={onClose} />
      </div>
    </div>
  );
}

/** "Snap": a capture sheet that only takes photos; each one is read and filed on this laptop. */
export function SnapButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-16 shrink-0 rounded-full px-5 text-[17px] font-medium text-ink-soft outline-none hover:bg-black/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Snap
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] bg-[#1f1f1d] p-0 shadow-[0_24px_80px_rgb(0_0_0/0.45)] ring-0 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none"
        >
          {open && <CaptureSheet onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
