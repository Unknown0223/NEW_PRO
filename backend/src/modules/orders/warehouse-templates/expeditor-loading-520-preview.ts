import type { NakladnoyBuildOptions } from "../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "./warehouse-template-shared";
import {
  buildExpeditorLoading520Document,
  type ExpeditorLoading520Document,
  type ExpeditorLoading520Group,
  type ExpeditorLoading520Line
} from "./expeditor-loading-520-document";

export type ExpeditorLoading520Preview = ExpeditorLoading520Document;
export type ExpeditorLoading520PreviewLine = ExpeditorLoading520Line;
export type ExpeditorLoading520PreviewGroup = ExpeditorLoading520Group;

export function buildExpeditorLoading520Preview(
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
): ExpeditorLoading520Preview {
  return buildExpeditorLoading520Document(ctx, options, versionLabel);
}
