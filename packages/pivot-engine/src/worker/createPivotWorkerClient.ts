import type { PivotConfig, PivotData, PivotField } from "../types/pivot.types.js";
import { DEFAULT_WORKER_THRESHOLD, type PivotWorkerResponse } from "./types.js";

export type PivotWorkerClientOptions = {
  /** Qatorlar soni shu qiymatdan oshsa worker ishlatiladi */
  threshold?: number;
  /** Vite `?worker` yoki Next.js worker factory */
  workerFactory?: () => Worker;
};

export type PivotWorkerClient = {
  shouldUseWorker: (rowCount: number) => boolean;
  compute: (
    rawData: Record<string, unknown>[],
    fields: PivotField[],
    config: PivotConfig
  ) => Promise<PivotData>;
  terminate: () => void;
};

export function createPivotWorkerClient(options: PivotWorkerClientOptions = {}): PivotWorkerClient {
  const threshold = options.threshold ?? DEFAULT_WORKER_THRESHOLD;
  let worker: Worker | null = null;
  let workerFailed = false;

  function getWorker(): Worker | null {
    if (workerFailed || !options.workerFactory) return null;
    if (!worker) {
      try {
        worker = options.workerFactory();
        worker.addEventListener("error", () => {
          workerFailed = true;
          worker?.terminate();
          worker = null;
        });
      } catch {
        workerFailed = true;
        return null;
      }
    }
    return worker;
  }

  function shouldUseWorker(rowCount: number): boolean {
    return rowCount > threshold && Boolean(options.workerFactory) && !workerFailed;
  }

  function compute(
    rawData: Record<string, unknown>[],
    fields: PivotField[],
    config: PivotConfig
  ): Promise<PivotData> {
    const w = getWorker();
    if (!w) {
      return Promise.reject(new Error("Pivot worker mavjud emas"));
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<PivotWorkerResponse>) => {
        const msg = event.data;
        if (!msg || msg.id !== id) return;
        w.removeEventListener("message", onMessage);
        if (msg.type === "error") reject(new Error(msg.error));
        else resolve(msg.result);
      };

      w.addEventListener("message", onMessage);
      w.postMessage({ type: "compute", id, rawData, fields, config });
    });
  }

  function terminate() {
    worker?.terminate();
    worker = null;
  }

  return { shouldUseWorker, compute, terminate };
}
