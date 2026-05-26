import { api } from "@/lib/api";

export type ShelfReturnByOrderCheckResult = {
  allowed: boolean;
  code: string;
  message: string;
};

export async function checkShelfReturnByOrder(
  tenantSlug: string,
  clientId: number,
  orderId: number
): Promise<ShelfReturnByOrderCheckResult> {
  const params = new URLSearchParams({
    client_id: String(clientId),
    order_id: String(orderId)
  });
  const { data } = await api.get<ShelfReturnByOrderCheckResult>(
    `/api/${tenantSlug}/returns/shelf-return-by-order/check?${params.toString()}`
  );
  return data;
}

export function buildShelfReturnByOrderHref(clientId: number, orderId: number): string {
  const p = new URLSearchParams({
    type: "return_by_order",
    client_id: String(clientId),
    source_order_id: String(orderId)
  });
  return `/orders/new?${p.toString()}`;
}
