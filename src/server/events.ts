import { EventEmitter } from "node:events";
import type { DejaEvent } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { newId } from "@/server/ids";

declare global {
  var __dejafindEvents: EventEmitter | undefined;
}

export function getEventBus(): EventEmitter {
  if (!globalThis.__dejafindEvents) {
    const bus = new EventEmitter();
    bus.setMaxListeners(200);
    globalThis.__dejafindEvents = bus;
  }
  return globalThis.__dejafindEvents;
}

/** Emits to live SSE subscribers and persists a row in `events` for history. */
export function emitEvent(event: DejaEvent, documentId?: string | null) {
  getEventBus().emit("event", event);
  try {
    getDb()
      .prepare(
        `INSERT INTO events (id, kind, document_id, payload, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(newId(), event.type, documentId ?? null, JSON.stringify(event), new Date().toISOString());
  } catch {
    // history is best-effort; live delivery already happened above
  }
}

export function onEvent(listener: (event: DejaEvent) => void): () => void {
  const bus = getEventBus();
  const wrapped = (event: DejaEvent) => listener(event);
  bus.on("event", wrapped);
  return () => bus.off("event", wrapped);
}
