/**
 * Next.js / bundler worker factory — same API as `@salec/pivot-ui` createNextWorkerFactory.
 */
export function createNextWorkerFactory(workerUrl: URL | string): () => Worker {
  return () => new Worker(workerUrl, { type: "module" });
}
