/** Ombor / warehouse domain eventlari. */

export const WAREHOUSE_EVENT_CHANNEL = "warehouse-events" as const;

export const WarehouseEventNames = {
  STOCK_ADJUSTED: "warehouse.stock_adjusted",
  BLOCK_UPDATED: "warehouse.block_updated"
} as const;

export type WarehouseEventName = (typeof WarehouseEventNames)[keyof typeof WarehouseEventNames];

export type WarehouseStockAdjustedPayload = {
  type: typeof WarehouseEventNames.STOCK_ADJUSTED;
  tenant_id: number;
  warehouse_id: number;
  product_id: number;
};

export type WarehouseBlockUpdatedPayload = {
  type: typeof WarehouseEventNames.BLOCK_UPDATED;
  tenant_id: number;
  warehouse_id: number;
  block_id: number;
};

export type WarehouseEventPayload = WarehouseStockAdjustedPayload | WarehouseBlockUpdatedPayload;

export function createWarehouseStockAdjustedPayload(
  tenantId: number,
  warehouseId: number,
  productId: number
): WarehouseStockAdjustedPayload {
  return {
    type: WarehouseEventNames.STOCK_ADJUSTED,
    tenant_id: tenantId,
    warehouse_id: warehouseId,
    product_id: productId
  };
}
