"use client";

import { useEffect, useState } from "react";

/** Current time in ms, refreshed every `everyMs`. Starts at 0 before mount. */
export function useNow(everyMs = 10_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
