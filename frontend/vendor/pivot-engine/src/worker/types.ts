import type { PivotConfig, PivotData, PivotField } from "../types/pivot.types.js";

export type PivotWorkerComputeRequest = {
  type: "compute";
  id: string;
  rawData: Record<string, unknown>[];
  fields: PivotField[];
  config: PivotConfig;
};

export type PivotWorkerComputeResult = {
  type: "result";
  id: string;
  result: PivotData;
};

export type PivotWorkerComputeError = {
  type: "error";
  id: string;
  error: string;
};

export type PivotWorkerRequest = PivotWorkerComputeRequest;
export type PivotWorkerResponse = PivotWorkerComputeResult | PivotWorkerComputeError;

/** Shu qator sonidan oshganda Web Worker orqali hisoblash (UI bloklanmasin). */
export const DEFAULT_WORKER_THRESHOLD = 5_000;

/** Worker maqsadli maksimal qator hajmi (benchmark / ogohlantirish). */
export const WORKER_TARGET_ROW_COUNT = 50_000;
