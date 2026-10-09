declare global {
  var __dejafindRegistered: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__dejafindRegistered) return;
  globalThis.__dejafindRegistered = true;

  // Must install before any other server module can make an outbound request.
  const { installNetCounter } = await import("@/server/net-counter");
  installNetCounter();

  const { startWatcher } = await import("@/server/watcher");
  startWatcher();

  const { startPipeline } = await import("@/server/pipeline");
  startPipeline();
}
