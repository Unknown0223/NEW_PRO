import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../order-nakladnoy-xlsx.types";
import type { WarehouseLayoutId } from "./warehouse-template-ids";
import { getWarehouseLayoutDef } from "./warehouse-template-ids";
import type { WarehouseAggregateContext } from "./warehouse-template-shared";
import { fillCatalogDual110 } from "./fill/fill-catalog-dual-110";
import { fillListSimple112 } from "./fill/fill-list-simple-112";
import { fillTtnGrouped410 } from "./fill/fill-ttn-grouped-410";
import { fillMatrixAgents600 } from "./fill/fill-matrix-agents-600";
import { fillMatrixClients601 } from "./fill/fill-matrix-clients-601";
import { fillSummaryClients602 } from "./fill/fill-summary-clients-602";
import { fillSummaryCompact700 } from "./fill/fill-summary-compact-700";
import { fillPerExpeditor701 } from "./fill/fill-per-expeditor-701";
import { fillThermal702 } from "./fill/fill-thermal-702";
import { fillTerritoryMatrix703 } from "./fill/fill-territory-matrix-703";
import { fillCategoryClient704 } from "./fill/fill-category-client-704";

export function fillWarehouseTemplate(
  layoutId: WarehouseLayoutId,
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions
): void {
  const def = getWarehouseLayoutDef(layoutId);
  switch (def.family) {
    case "catalog_dual_110":
      fillCatalogDual110(wb, ctx);
      break;
    case "list_simple_112":
      fillListSimple112(wb, ctx, options);
      break;
    case "ttn_grouped_410":
      fillTtnGrouped410(wb, ctx, layoutId, options);
      break;
    case "matrix_agents_600":
      fillMatrixAgents600(wb, ctx, options);
      break;
    case "matrix_clients_601":
      fillMatrixClients601(wb, ctx);
      break;
    case "summary_clients_602":
      fillSummaryClients602(wb, ctx);
      break;
    case "summary_compact_700":
      fillSummaryCompact700(wb, ctx);
      break;
    case "per_expeditor_701":
      fillPerExpeditor701(wb, ctx);
      break;
    case "thermal_702":
      fillThermal702(wb, ctx);
      break;
    case "territory_matrix_703":
      fillTerritoryMatrix703(wb, ctx);
      break;
    case "category_client_704":
      fillCategoryClient704(wb, ctx);
      break;
    default:
      throw new Error(`UNSUPPORTED_WAREHOUSE_FAMILY:${def.family}`);
  }
}
