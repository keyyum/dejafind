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
  try {
    // EventEmitter.emit() runs listeners synchronously and rethrows whatever they
    // throw (e.g. an SSE route writing to a controller a disconnected browser tab
    // already closed). A caller like the watcher fires this without awaiting, so an
    // uncaught throw here becomes an unhandled rejection that can kill the process.
    getEventBus().emit("event", event);
  } catch (err) {
    console.error("[events] a listener threw while handling", event.type, err);
  }
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
