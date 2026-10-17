import { api } from "@/lib/api";

export async function downloadStockByDateExcel(input: {
  tenantSlug: string;
  date: string;
  warehouseId: string;
  categoryId: string;
  productId: string;
  priceType: string;
  q: string;
}): Promise<void> {
  const p = new URLSearchParams({ date: input.date, warehouse_id: input.warehouseId });
  if (input.categoryId) p.set("category_id", input.categoryId);
  if (input.productId) p.set("product_id", input.productId);
  if (input.priceType.trim()) p.set("price_type", input.priceType.trim());
  if (input.q.trim()) p.set("q", input.q.trim());
  const res = await api.get(`/api/${input.tenantSlug}/stock/by-date/export?${p.toString()}`, {
    responseType: "arraybuffer"
  });
  const blob = new Blob([res.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stock-by-date.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
