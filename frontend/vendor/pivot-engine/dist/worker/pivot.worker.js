/// <reference lib="webworker" />
import { handlePivotWorkerRequest } from "./handleCompute.js";
self.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || msg.type !== "compute")
        return;
    const response = handlePivotWorkerRequest(msg);
    self.postMessage(response);
});
