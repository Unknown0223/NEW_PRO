/** Vite / bundler: worker next to package entry. */
export declare function createVitePivotWorker(): Worker;
/** Alias used by hooks. */
export declare function createPackagePivotWorker(): Worker;
export declare function createDefaultPivotWorkerClient(threshold?: number): import("@salec/pivot-engine").PivotWorkerClient;
/** Next.js: pass a factory that uses `new Worker(new URL(..., import.meta.url))` from the app. */
export declare function createNextWorkerFactory(workerUrl: URL | string): () => Worker;
//# sourceMappingURL=createWorker.d.ts.map