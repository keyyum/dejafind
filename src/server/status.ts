import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ollama from "ollama";
import type { ModelInfo, StatusResponse } from "@/lib/api-types";
import { getDb } from "@/server/db";
import { requestsOut } from "@/server/net-counter";
import { watchedFolders } from "@/server/watcher";

const execFileAsync = promisify(execFile);

const MODEL_ROLES: Record<string, ModelInfo["role"]> = {
  "qwen2.5vl:3b": "vision",
  "qwen3:4b": "text",
  "nomic-embed-text": "embedding",
};

declare global {
  var __dejafindStartedAt: string | undefined;
}

export function startedAt(): string {
  if (!globalThis.__dejafindStartedAt) globalThis.__dejafindStartedAt = new Date().toISOString();
  return globalThis.__dejafindStartedAt;
}

function baseModelName(name: string): string {
  return name.replace(/:latest$/, "");
}

async function loadedModelNames(): Promise<Set<string>> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/ps");
    if (!res.ok) return new Set();
    const data = (await res.json()) as { models?: { name: string }[] };
    return new Set((data.models ?? []).map((m) => baseModelName(m.name)));
  } catch {
    return new Set();
  }
}

async function modelInfos(): Promise<{ reachable: boolean; models: ModelInfo[] }> {
  try {
    const res = await ollama.list();
    const loaded = await loadedModelNames();
    const models: ModelInfo[] = res.models
      .filter((m) => MODEL_ROLES[baseModelName(m.name)])
      .map((m) => {
        const base = baseModelName(m.name);
        return {
          name: base,
          params: m.details?.parameter_size ?? "",
          sizeBytes: m.size,
          role: MODEL_ROLES[base],
          loaded: loaded.has(base),
        };
      });
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

async function machineDescription(): Promise<string> {
  try {
    const [{ stdout: brand }, { stdout: memBytes }] = await Promise.all([
      execFileAsync("sysctl", ["-n", "machdep.cpu.brand_string"]),
      execFileAsync("sysctl", ["-n", "hw.memsize"]),
    ]);
    const gb = Math.round(Number(memBytes.trim()) / 1024 / 1024 / 1024);
    return `${brand.trim()}, ${gb} GB`;
  } catch {
    return "Unknown machine";
  }
}

export async function getStatus(): Promise<StatusResponse> {
  const db = getDb();
  const { reachable, models } = await modelInfos();

  const avgRow = db
    .prepare(`SELECT AVG(read_ms) as avg, COUNT(*) as n FROM documents WHERE status = 'done' AND read_ms IS NOT NULL`)
    .get() as { avg: number | null; n: number };
  const queuedRow = db
    .prepare(`SELECT COUNT(*) as n FROM documents WHERE status IN ('queued','reading')`)
    .get() as { n: number };

  return {
    requestsOut: requestsOut(),
    ollamaReachable: reachable,
    models,
    avgReadMs: avgRow.n > 0 ? Math.round(avgRow.avg ?? 0) : null,
    documentsRead: avgRow.n,
    queued: queuedRow.n,
    watching: watchedFolders(),
    machine: await machineDescription(),
    startedAt: startedAt(),
  };
}
