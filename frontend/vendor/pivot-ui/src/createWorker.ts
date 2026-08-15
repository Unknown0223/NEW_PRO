import { createPivotWorkerClient, DEFAULT_WORKER_THRESHOLD } from "@salec/pivot-engine";

/** Vite / bundler: worker next to package entry. */
export function createVitePivotWorker(): Worker {
  return new Worker(new URL("./workers/pivot.worker.ts", import.meta.url), { type: "module" });
}

/** Alias used by hooks. */
export function createPackagePivotWorker(): Worker {
  return createVitePivotWorker();
}

export function createDefaultPivotWorkerClient(threshold = DEFAULT_WORKER_THRESHOLD) {
  return createPivotWorkerClient({
    threshold,
    workerFactory: createPackagePivotWorker
  });
}

/** Next.js: pass a factory that uses `new Worker(new URL(..., import.meta.url))` from the app. */
export function createNextWorkerFactory(workerUrl: URL | string): () => Worker {
  return () => new Worker(workerUrl, { type: "module" });
}
