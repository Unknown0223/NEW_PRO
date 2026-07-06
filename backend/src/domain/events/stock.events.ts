/** Ombor domain eventlari — nomlar va payload turlari. */

export const STOCK_EVENT_CHANNEL = "stock-events" as const;

export const StockEventNames = {
  ADJUSTED: "stock.adjusted",
  TRANSFERRED: "stock.transferred",
  INVALIDATED: "stock.invalidated"
} as const;

export type StockEventName = (typeof StockEventNames)[keyof typeof StockEventNames];

export type StockAdjustedPayload = {
  type: typeof StockEventNames.ADJUSTED;
  tenant_id: number;
  warehouse_id: number;
  product_id: number;
  delta_qty: number;
};

export type StockTransferredPayload = {
  type: typeof StockEventNames.TRANSFERRED;
  tenant_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  product_id: number;
  qty: number;
};

export type StockInvalidatedPayload = {
  type: typeof StockEventNames.INVALIDATED;
  tenant_id: number;
  warehouse_id: number;
};

export type StockEventPayload = StockAdjustedPayload | StockTransferredPayload | StockInvalidatedPayload;

export function isStockAdjustedPayload(payload: unknown): payload is StockAdjustedPayload {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === StockEventNames.ADJUSTED &&
    typeof p.tenant_id === "number" &&
    typeof p.warehouse_id === "number" &&
    typeof p.product_id === "number" &&
    typeof p.delta_qty === "number"
  );
}

export function createStockAdjustedPayload(
  tenantId: number,
  warehouseId: number,
  productId: number,
  deltaQty: number
): StockAdjustedPayload {
  return {
    type: StockEventNames.ADJUSTED,
    tenant_id: tenantId,
    warehouse_id: warehouseId,
    product_id: productId,
    delta_qty: deltaQty
  };
}
