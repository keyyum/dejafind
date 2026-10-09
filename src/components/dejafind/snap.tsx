"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

function SnapCamera({ onClose }: { onClose: () => void }) {
  const send = useImport();
  const video = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

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
          if (preferred && preferred !== current) setDeviceId(preferred);
        }
      })
      .catch((e: unknown) =>
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access is off. Allow it in the browser's site settings, then try again."
            : "No camera found. Connect your iPhone or a webcam.",
        ),
      );
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setBusy(false);
          return;
        }
        const file = new File([blob], `snap-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" });
        onClose();
        void send([file], "snap");
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-foreground">
        {/* Muted, inline, no captions: a live camera preview. */}
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className="size-full object-contain"
        />
        {error && (
          <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-[17px] text-background/80">{error}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {devices.length > 1 && (
          <>
            <label htmlFor="snap-device" className="text-[15px] text-muted-foreground">Camera</label>
            <select
              id="snap-device"
              value={deviceId ?? ""}
              onChange={(e) => {
                setReady(false);
                setDeviceId(e.target.value);
                saveDevice(e.target.value);
              }}
              className="min-w-0 max-w-[280px] rounded-md border border-border bg-white px-2 py-1 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {!deviceId && <option value="">Default camera</option>}
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          autoFocus
          disabled={!ready || busy}
          onClick={capture}
          className="ml-auto inline-flex h-12 items-center rounded-full bg-foreground px-7 text-[17px] font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
        >
          Take photo
        </button>
      </div>
    </div>
  );
}

/** "Snap": capture a page from the webcam or the iPhone and file it like any other capture. */
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
        <DialogContent className="gap-5 rounded-2xl p-6 sm:max-w-[760px]">
          <div className="flex flex-col gap-1.5 pr-8">
            <DialogTitle className="text-[22px] font-semibold">Snap a page</DialogTitle>
            <DialogDescription className="text-[16px]">
              Hold the slide or handout up to the camera. It gets read and filed on this laptop.
            </DialogDescription>
          </div>
          {open && <SnapCamera onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
