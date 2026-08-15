/// <reference lib="webworker" />
import { handlePivotWorkerRequest } from "./handleCompute.js";
import type { PivotWorkerRequest } from "./types.js";

self.addEventListener("message", (event: MessageEvent<PivotWorkerRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== "compute") return;
  const response = handlePivotWorkerRequest(msg);
  self.postMessage(response);
});
