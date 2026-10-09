"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Where macOS shows its screenshot preview: a ~220px card in the bottom-right corner. */
const PREVIEW_WIDTH = 220;
const PREVIEW_INSET = 24;

/**
 * A new capture flies in from the bottom-right corner, holds for a beat like the
 * macOS preview, then settles into its slot in the grid.
 */
export function Landing({ fly, children }: { fly: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!fly || !el) return;
    if (reduced) {
      void animate(el, { opacity: [0, 1] }, { duration: 0.3 });
      return;
    }
    const r = el.getBoundingClientRect();
    const s0 = Math.min(1, PREVIEW_WIDTH / r.width);
    const cx = window.innerWidth - PREVIEW_INSET - (r.width * s0) / 2;
    const cy = window.innerHeight - PREVIEW_INSET - (r.height * s0) / 2;
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    const controls = animate(
      el,
      {
        x: [dx + 60, dx, dx, 0],
        y: [dy, dy, dy, 0],
        scale: [s0, s0, s0, 1],
        rotate: [0, 0, -1.5, 0],
        opacity: [0, 1, 1, 1],
      },
      { duration: 1.25, times: [0, 0.18, 0.38, 1], ease: [0.22, 1, 0.36, 1] },
    );
    return () => controls.stop();
    // Only on mount: a tile flies in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="relative z-10 origin-center will-change-transform">
      {children}
    </div>
  );
}

/** Types `text` in, one character at a time, then calls `onDone`. */
export function TypeIn({ text, onDone, cps = 45 }: { text: string; onDone?: () => void; cps?: number }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (reduced) {
      done.current?.();
      return;
    }
    // Cap the whole title at about 0.7 s so the landing stays under two seconds.
    const step = Math.max(1, Math.ceil(text.length / (0.7 * cps)));
    const t = setInterval(() => {
      setN((x) => {
        const next = Math.min(text.length, x + step);
        if (next >= text.length) {
          clearInterval(t);
          setTimeout(() => done.current?.(), 0);
        }
        return next;
      });
    }, 1000 / cps);
    return () => clearInterval(t);
  }, [text, cps, reduced]);
  if (reduced) return <>{text}</>;
  return (
    <>
      <span>{text.slice(0, n)}</span>
      <span aria-hidden className="text-transparent">{text.slice(n)}</span>
    </>
  );
}

export interface Flight {
  id: string;
  label: string;
  from: DOMRect;
  to: DOMRect;
}

/** A small date chip that rises off a tile and drops into the Coming up strip. */
export function DateFlight({ flight, onLand }: { flight: Flight; onLand: (id: string) => void }) {
  const reduced = useReducedMotion();
  const { from, to } = flight;
  const x0 = from.left + from.width / 2 - 40;
  const y0 = from.top + from.height * 0.35;
  const x1 = to.left;
  const y1 = to.top + to.height / 2 - 18;
  const peak = Math.min(y0, y1) - 28;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-50 rounded-full bg-primary px-3.5 py-1.5 text-[16px] font-semibold whitespace-nowrap text-white shadow-[0_6px_18px_rgb(194_65_12/0.35)]"
      initial={{ x: x0, y: y0, scale: 0.6, opacity: 0 }}
      animate={
        reduced
          ? { x: x1, y: y1, scale: 1, opacity: 1 }
          : {
              x: [x0, x0, (x0 + x1) / 2, x1],
              y: [y0, y0 - 36, peak, y1],
              scale: [0.6, 1.1, 1.05, 1],
              opacity: [0, 1, 1, 1],
            }
      }
      transition={{ duration: reduced ? 0.01 : 0.9, times: [0, 0.2, 0.55, 1], ease: "easeInOut" }}
      onAnimationComplete={() => onLand(flight.id)}
    >
      {flight.label}
    </motion.div>
  );
}
