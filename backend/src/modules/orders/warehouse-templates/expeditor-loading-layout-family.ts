import type { ExpeditorLoadingLayoutId } from "./expeditor-loading-template-ids";

export type ExpeditorLoadingFillFamily =
  | "list518"
  | "matrixAgents"
  | "matrixClients"
  | "matrix300"
  | "multi401";

export function expeditorLoadingFillFamily(layoutId: ExpeditorLoadingLayoutId): ExpeditorLoadingFillFamily {
  if (layoutId === "ex-2.0") return "matrixClients";
  if (layoutId === "ex-3.0") return "matrix300";
  if (layoutId === "ex-4.0.1") return "multi401";
  if (layoutId === "ex-5.1.7" || layoutId === "ex-5.1.8") return "list518";
  if (
    layoutId === "ex-5.1.1" ||
    layoutId === "ex-5.1.2" ||
    layoutId === "ex-5.1.3" ||
    layoutId === "ex-5.1.4" ||
    layoutId === "ex-5.1.5" ||
    layoutId === "ex-5.1.6" ||
    layoutId === "ex-5.1.9"
  ) {
    return "matrixAgents";
  }
  return "matrixAgents";
}
