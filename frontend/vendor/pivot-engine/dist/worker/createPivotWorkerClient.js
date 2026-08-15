import { DEFAULT_WORKER_THRESHOLD } from "./types.js";
export function createPivotWorkerClient(options = {}) {
    const threshold = options.threshold ?? DEFAULT_WORKER_THRESHOLD;
    let worker = null;
    let workerFailed = false;
    function getWorker() {
        if (workerFailed || !options.workerFactory)
            return null;
        if (!worker) {
            try {
                worker = options.workerFactory();
                worker.addEventListener("error", () => {
                    workerFailed = true;
                    worker?.terminate();
                    worker = null;
                });
            }
            catch {
                workerFailed = true;
                return null;
            }
        }
        return worker;
    }
    function shouldUseWorker(rowCount) {
        return rowCount > threshold && Boolean(options.workerFactory) && !workerFailed;
    }
    function compute(rawData, fields, config) {
        const w = getWorker();
        if (!w) {
            return Promise.reject(new Error("Pivot worker mavjud emas"));
        }
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const onMessage = (event) => {
                const msg = event.data;
                if (!msg || msg.id !== id)
                    return;
                w.removeEventListener("message", onMessage);
                if (msg.type === "error")
                    reject(new Error(msg.error));
                else
                    resolve(msg.result);
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
