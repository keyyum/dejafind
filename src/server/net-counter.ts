import { createRequire } from "node:module";
import type * as HttpModule from "node:http";
import type * as HttpsModule from "node:https";

// Built-in modules imported via `import * as` are read-only ES namespace objects in
// Next's ESM output; `require` gives the same underlying module object, mutable.
const nodeRequire = createRequire(import.meta.url);
const http = nodeRequire("node:http") as typeof HttpModule;
const https = nodeRequire("node:https") as typeof HttpsModule;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

declare global {
  var __dejafindRequestsOut: number | undefined;
  var __dejafindNetCounterInstalled: boolean | undefined;
}

function bumpIfRemote(hostname: string | null | undefined) {
  if (hostname && !LOCAL_HOSTS.has(hostname)) {
    globalThis.__dejafindRequestsOut = (globalThis.__dejafindRequestsOut ?? 0) + 1;
  }
}

function hostFromRequestArgs(args: unknown[]): string | null {
  const first = args[0];
  try {
    if (typeof first === "string") return new URL(first).hostname;
    if (first instanceof URL) return first.hostname;
    if (first && typeof first === "object") {
      const opts = first as { hostname?: string; host?: string };
      return opts.hostname ?? (opts.host ? opts.host.split(":")[0] : null);
    }
  } catch {
    // unparsable, treat as unknown (not counted)
  }
  return null;
}

/** Wraps outbound fetch/http/https so `/api/status` can report requestsOut. Install once, first, from instrumentation. */
export function installNetCounter() {
  if (globalThis.__dejafindNetCounterInstalled) return;
  globalThis.__dejafindNetCounterInstalled = true;
  globalThis.__dejafindRequestsOut = globalThis.__dejafindRequestsOut ?? 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      bumpIfRemote(new URL(url).hostname);
    } catch {
      // unparsable, ignore
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  for (const mod of [http, https] as const) {
    const originalRequest = mod.request.bind(mod);
    mod.request = ((...args: unknown[]) => {
      bumpIfRemote(hostFromRequestArgs(args));
      // @ts-expect-error forwarding the original overloaded signature
      return originalRequest(...args);
    }) as typeof mod.request;
  }
}

export function requestsOut(): number {
  return globalThis.__dejafindRequestsOut ?? 0;
}
