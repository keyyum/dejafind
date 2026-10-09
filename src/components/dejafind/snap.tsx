"use client";
/* eslint-disable @next/next/no-img-element -- local thumbnails at their real size */

import Link from "next/link";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/api-types";
import { getDocuments } from "@/lib/client/api";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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

/** The six most recent filed documents: "these are already in". */
function RecentStrip({ onOpen }: { onOpen: () => void }) {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    void getDocuments()
      .then((r) => {
        if (!live) return;
        setDocs(
          r.groups
            .flatMap((g) => g.documents)
            .filter((d) => d.status === "done" && d.thumbUrl)
            .slice(0, 6),
        );
      })
      .catch(() => live && setDocs([]));
    return () => {
      live = false;
    };
  }, []);

  if (docs && docs.length === 0) {
    return <p className="px-6 py-5 text-[15px] text-white/60">Nothing filed yet. Your first photo starts the library.</p>;
  }
  return (
    <div className="flex flex-col gap-3 px-6 pt-4 pb-5">
      <p className="text-[15px] text-white/60">Already in DéjàFind</p>
      <ul className="grid grid-cols-6 gap-3">
        {(docs ?? Array.from({ length: 6 }, () => null)).map((d, i) => (
          <li key={d?.id ?? i} className="min-w-0">
            {d ? (
              <Link
                href={`/d/${d.id}`}
                onClick={onOpen}
                title={d.title}
                className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1f1f1d]"
              >
                <span className="block aspect-[4/3] overflow-hidden rounded-lg bg-white/10">
                  <img
                    src={d.thumbUrl ?? undefined}
                    alt={d.title}
                    width={d.width}
                    height={d.height}
                    className="size-full object-cover object-top transition-opacity group-hover:opacity-80"
                  />
                </span>
                <span className="mt-1.5 block truncate text-[14px] text-white/75">{d.title}</span>
              </Link>
            ) : (
              <span className="block aspect-[4/3] rounded-lg bg-white/10" />
            )}
          </li>
        ))}
      </ul>
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
        // Labels are only visible after permission is granted.
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
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setFlash(false);
          return;
        }
        const file = new File([blob], `snap-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" });
        // Let the flash read, then close; the Library plays the landing when the capture is queued.
        setTimeout(() => {
          onClose();
          void send([file], "snap");
        }, 180);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="flex flex-col bg-[#1f1f1d] text-white">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-[16/10]">
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
          <p className="absolute inset-0 flex items-center justify-center text-[17px] text-white/60" role="status">
            Starting camera…
          </p>
        )}

        {/* Top bar over the viewfinder. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/55 to-transparent p-4">
          <div className="flex flex-col pt-1.5 pl-1">
            <DialogTitle className="text-[17px] font-semibold text-white">Snap a page</DialogTitle>
            <DialogDescription className="text-[15px] text-white/70">Hold the slide or handout up to the camera.</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {devices.length > 0 && (
              <>
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
                  className="h-10 max-w-[200px] cursor-pointer truncate rounded-full border-0 bg-black/45 px-3.5 text-[14px] text-white backdrop-blur outline-none hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white"
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId} className="text-foreground">
                      {shortLabel(d, i)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <DialogClose
              aria-label="Close"
              className="inline-flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur outline-none hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white"
            >
              <XIcon className="size-5" aria-hidden />
            </DialogClose>
          </div>
        </div>

        {/* Shutter, bottom centre. */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/45 to-transparent pt-10 pb-6">
          <button
            type="button"
            autoFocus
            aria-label="Take photo"
            disabled={!ready}
            onClick={capture}
            className="group flex size-[78px] items-center justify-center rounded-full border-4 border-white outline-none focus-visible:ring-4 focus-visible:ring-white/50 disabled:opacity-40"
          >
            <span className="size-[62px] rounded-full bg-white transition-transform duration-150 group-hover:scale-95 group-active:scale-90" />
          </button>
        </div>

        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-white transition-opacity",
            flash ? "opacity-90 duration-75" : "opacity-0 duration-300",
          )}
        />
      </div>
      <RecentStrip onOpen={onClose} />
    </div>
  );
}

/** "Snap": a capture sheet that only takes a photo, then files it like any other capture. */
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
          className="gap-0 overflow-hidden overscroll-contain rounded-3xl bg-[#1f1f1d] p-0 ring-0 shadow-[0_24px_80px_rgb(0_0_0/0.45)] sm:max-w-[min(960px,calc(100vw-4rem))]"
        >
          {open && <CaptureSheet onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
