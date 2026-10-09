"use client";
/* eslint-disable @next/next/no-img-element -- local originals at full size */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The document image, large. Click to zoom in at the pointer, wheel to change zoom, move to pan. */
export function Zoomable({
  src,
  alt,
  width,
  height,
  rounded,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  rounded?: boolean;
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

  return (
    <div
      ref={box}
      className={cn(
        "relative w-full overflow-hidden bg-white shadow-paper",
        rounded ? "rounded-2xl" : "rounded-[3px]",
      )}
      style={{
        aspectRatio: `${width || 4} / ${height || 3}`,
        maxWidth: `calc(80vh * ${(width || 4) / (height || 3)})`,
      }}
      onPointerMove={(e) => scale > 1 && originAt(e.clientX, e.clientY)}
    >
      <button
        type="button"
        aria-label={scale > 1 ? "Zoom out" : "Zoom in"}
        className={cn("block size-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", scale > 1 ? "cursor-zoom-out" : "cursor-zoom-in")}
        onClick={(e) => {
          originAt(e.clientX, e.clientY);
          setScale((s) => (s > 1 ? 1 : 2.2));
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="size-full object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `scale(${scale})`, transformOrigin: origin }}
        />
      </button>
    </div>
  );
}
