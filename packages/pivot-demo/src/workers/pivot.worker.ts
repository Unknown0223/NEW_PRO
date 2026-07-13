/// <reference lib="webworker" />
import { handlePivotWorkerRequest } from "@salec/pivot-engine";
import type { PivotWorkerRequest } from "@salec/pivot-engine";

self.addEventListener("message", (event: MessageEvent<PivotWorkerRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== "compute") return;
  const response = handlePivotWorkerRequest(msg);
  self.postMessage(response);
});
