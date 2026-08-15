import { PivotEngine } from "../core/PivotEngine.js";
import type { PivotWorkerComputeRequest, PivotWorkerResponse } from "./types.js";

const engine = new PivotEngine();

export function handlePivotWorkerRequest(msg: PivotWorkerComputeRequest): PivotWorkerResponse {
  try {
    const result = engine.compute(msg.rawData, msg.fields, msg.config);
    return { type: "result", id: msg.id, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: "error", id: msg.id, error: message };
  }
}
