import type { PivotConfig, PivotData, PivotField } from "../types/pivot.types.js";
export type PivotWorkerClientOptions = {
    /** Qatorlar soni shu qiymatdan oshsa worker ishlatiladi */
    threshold?: number;
    /** Vite `?worker` yoki Next.js worker factory */
    workerFactory?: () => Worker;
};
export type PivotWorkerClient = {
    shouldUseWorker: (rowCount: number) => boolean;
    compute: (rawData: Record<string, unknown>[], fields: PivotField[], config: PivotConfig) => Promise<PivotData>;
    terminate: () => void;
};
export declare function createPivotWorkerClient(options?: PivotWorkerClientOptions): PivotWorkerClient;
//# sourceMappingURL=createPivotWorkerClient.d.ts.map