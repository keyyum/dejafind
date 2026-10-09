/* eslint-disable @next/next/no-img-element -- thumbnails come from local routes at their real size */
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
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white shadow-paper",
        isScreenshot(doc) ? "rounded-xl" : "rounded-[3px]",
        className,
      )}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      {url && (
        <img
          src={url}
          alt=""
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
