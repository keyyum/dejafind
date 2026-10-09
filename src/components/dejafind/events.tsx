"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DejaEvent } from "@/lib/api-types";
import { subscribeEvents } from "@/lib/client/api";

type Listener = (e: DejaEvent) => void;

const EventsContext = createContext<Set<Listener> | null>(null);

/** One EventSource for the whole app; screens listen through `useDejaEvent`. */
export function EventsProvider({ children }: { children: ReactNode }) {
  const [listeners] = useState(() => new Set<Listener>());
  useEffect(() => subscribeEvents((e) => listeners.forEach((fn) => fn(e))), [listeners]);
  return <EventsContext.Provider value={listeners}>{children}</EventsContext.Provider>;
}

export function useDejaEvent(onEvent: Listener) {
  const listeners = useContext(EventsContext);
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  });
  useEffect(() => {
    if (!listeners) return;
    const fn: Listener = (e) => latest.current(e);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, [listeners]);
}
