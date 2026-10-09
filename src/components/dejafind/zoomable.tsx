"use client";
/* eslint-disable @next/next/no-img-element -- local originals at full size */

import { useEffect, useRef, useState } from "react";
import type { WordsResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/**
 * The document image, large. Click to zoom in at the pointer, wheel to change zoom, move to pan.
 * With word boxes, a click on a word calls `onWordTap` instead of zooming (the Lens tap), and
 * `lit` outlines those words.
 */
export function Zoomable({
  src,
  alt,
  width,
  height,
  rounded,
  words,
  lit,
  onWordTap,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  rounded?: boolean;
  words?: WordsResponse | null;
  lit?: ReadonlySet<number>;
  onWordTap?: (index: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState("50% 50%");

  const originAt = (clientX: number, clientY: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setOrigin(`${((clientX - r.left) / r.width) * 100}% ${((clientY - r.top) / r.height) * 100}%`);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (scale === 1 && e.deltaY > 0) return;
      e.preventDefault();
      originAt(e.clientX, e.clientY);
      setScale((s) => Math.min(4, Math.max(1, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale]);

  /** Index of the word under the pointer, in the image's own pixels, or -1. */
  const wordAt = (target: HTMLElement, clientX: number, clientY: number): number => {
    if (!words?.words.length) return -1;
    const r = target.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * words.width;
    const y = ((clientY - r.top) / r.height) * words.height;
    const pad = words.width * 0.004;
    return words.words.findIndex(
      (w) => x >= w.x - pad && x <= w.x + w.width + pad && y >= w.y - pad && y <= w.y + w.height + pad,
    );
  };

  return (
    <div
      ref={box}
      className={cn("relative w-full overflow-hidden bg-white shadow-paper", rounded ? "rounded-2xl" : "rounded-[3px]")}
      style={{
        aspectRatio: `${width || 4} / ${height || 3}`,
        maxWidth: `calc(80vh * ${(width || 4) / (height || 3)})`,
      }}
      onPointerMove={(e) => scale > 1 && originAt(e.clientX, e.clientY)}
    >
      <button
        type="button"
        aria-label={scale > 1 ? "Zoom out" : "Zoom in"}
        className={cn(
          "block size-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          scale > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
        )}
        onClick={(e) => {
          const inner = e.currentTarget.firstElementChild as HTMLElement | null;
          const hit = inner && onWordTap ? wordAt(inner, e.clientX, e.clientY) : -1;
          if (hit >= 0) {
            onWordTap?.(hit);
            return;
          }
          originAt(e.clientX, e.clientY);
          setScale((s) => (s > 1 ? 1 : 2.2));
        }}
      >
        <span
          className="relative block size-full transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `scale(${scale})`, transformOrigin: origin }}
        >
          <img src={src} alt={alt} draggable={false} className="size-full object-contain" />
          {words && words.words.length > 0 && (
            <span aria-hidden className="absolute inset-0">
              {words.words.map((w, i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute cursor-pointer rounded-[3px] transition-colors duration-200",
                    lit?.has(i) ? "bg-[rgb(194_65_12/0.22)] ring-2 ring-primary" : "hover:bg-[rgb(194_65_12/0.12)]",
                  )}
                  style={{
                    left: `${(w.x / words.width) * 100}%`,
                    top: `${(w.y / words.height) * 100}%`,
                    width: `${(w.width / words.width) * 100}%`,
                    height: `${(w.height / words.height) * 100}%`,
                  }}
                />
              ))}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
