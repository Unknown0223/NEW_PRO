/** Nakladnoy Excel — barrel. */
export * from "./order-nakladnoy-xlsx.types";
export { buildLoadingSheetWorkbook } from "./order-nakladnoy-xlsx.loading";
export { buildConsignmentWorkbook } from "./order-nakladnoy-xlsx.consignment";

import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "./order-nakladnoy-xlsx.types";
import { buildConsignmentWorkbook } from "./order-nakladnoy-xlsx.consignment";
import { buildLoadingSheetWorkbook } from "./order-nakladnoy-xlsx.loading";

export async function buildNakladnoyXlsx(
  template: "nakladnoy_warehouse" | "nakladnoy_expeditor",
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions = DEFAULT_NAKLADNOY_BUILD_OPTIONS
): Promise<Buffer> {
  if (template === "nakladnoy_warehouse") {
    return buildLoadingSheetWorkbook(orders, options);
  }
  return buildConsignmentWorkbook(orders, options);
}

