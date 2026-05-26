import type { ReturnFilterMeta } from "./returns-filter.types";

export type OrderPickBalancesResult = {
  balances: import("./returns-enhanced.types").OrderReturnBalance[];
  filter_meta: ReturnFilterMeta;
};
