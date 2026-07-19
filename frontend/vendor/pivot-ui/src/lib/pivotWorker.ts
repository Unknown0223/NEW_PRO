export function createDemoPivotWorker(): Worker {
  return new Worker(new URL("../workers/pivot.worker.ts", import.meta.url), { type: "module" });
}

export { createDemoPivotWorker as createPackagePivotWorker };

