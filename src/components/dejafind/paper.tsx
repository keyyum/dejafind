"use client";
/* eslint-disable @next/next/no-img-element -- thumbnails come from local routes at their real size */
import { useEffect, useState } from "react";
import type { DocumentSummary } from "@/lib/api-types";
import { isScreenshot } from "@/lib/client/format";
import { cn } from "@/lib/utils";

/**
 * A document as a sheet of paper: real aspect ratio, soft shadow, square
 * corners for photos and pages, rounded corners for screenshots.
 */
export function Paper({
  doc,
  src,
  className,
  imgClassName,
  children,
  maxAspect = 2.2,
}: {
  doc: Pick<DocumentSummary, "width" | "height" | "docType" | "kind" | "thumbUrl" | "title">;
  src?: string | null;
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
  /** Very tall captures are cropped to this height-to-width ratio. */
  maxAspect?: number;
}) {
  const w = doc.width || 4;
  const h = Math.min(doc.height || 3, (doc.width || 4) * maxAspect);
  const url = src === undefined ? doc.thumbUrl : src;
  // A thumbnail can 404 for a moment while the pipeline writes it. Hide the broken
  // image and ask again a few times with a cache-buster instead of showing the icon.
  const [attempt, setAttempt] = useState({ url, n: 0, failed: false });
  const current = attempt.url === url ? attempt : { url, n: 0, failed: false };
  useEffect(() => {
    if (!current.failed || current.n >= 6) return;
    const t = setTimeout(() => setAttempt({ url, n: current.n + 1, failed: false }), 800 * (current.n + 1));
    return () => clearTimeout(t);
  }, [current.failed, current.n, url]);
  const shown = url && current.n > 0 ? `${url}${url.includes("?") ? "&" : "?"}r=${current.n}` : url;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white shadow-paper",
        isScreenshot(doc) ? "rounded-xl" : "rounded-[3px]",
        className,
      )}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      {shown && !current.failed && (
        <img
          key={shown}
          src={shown}
          onError={() => setAttempt({ url, n: current.n, failed: true })}
          alt=""
          width={w}
          height={h}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn("size-full object-cover object-top", imgClassName)}
        />
      )}
      {children}
    </div>
  );
}
