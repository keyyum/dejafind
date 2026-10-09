"use client";
/* eslint-disable @next/next/no-img-element -- local originals at full size */

import { useState } from "react";
import type { WordsResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export type PageMode = "fit" | "actual";

/**
 * The document image, static. "fit" shows the whole page in the column; "actual" shows it at
 * its real pixel size in a scrolling frame. With word boxes, clicking a word calls `onWordTap`
 * (the Lens tap) and `lit` outlines words; the text lines are the keyboard route to the same.
 */
export function Zoomable({
  src,
  alt,
  width,
  height,
  rounded,
  mode = "fit",
  words,
  lit,
  onWordTap,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  rounded?: boolean;
  mode?: PageMode;
  words?: WordsResponse | null;
  lit?: ReadonlySet<number>;
  onWordTap?: (index: number) => void;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const ratio = (width || 4) / (height || 3);

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

  const page = (
    <span
      className="relative block"
      style={mode === "actual" && natural ? { width: natural.w, height: natural.h } : { width: "100%", height: "100%" }}
      onClick={(e) => {
        const hit = onWordTap ? wordAt(e.currentTarget, e.clientX, e.clientY) : -1;
        if (hit >= 0) onWordTap?.(hit);
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className="size-full object-contain"
      />
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
  );

  if (mode === "actual") {
    return (
      <div
        tabIndex={0}
        aria-label={`${alt}, actual size. Scroll to move around.`}
        className={cn(
          "max-h-[80vh] w-full overflow-auto overscroll-contain bg-white shadow-paper outline-none focus-visible:ring-2 focus-visible:ring-ring",
          rounded ? "rounded-2xl" : "rounded-[3px]",
        )}
      >
        {page}
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-white shadow-paper", rounded ? "rounded-2xl" : "rounded-[3px]")}
      style={{ aspectRatio: `${width || 4} / ${height || 3}`, maxWidth: `calc(80vh * ${ratio})` }}
    >
      {page}
    </div>
  );
}
