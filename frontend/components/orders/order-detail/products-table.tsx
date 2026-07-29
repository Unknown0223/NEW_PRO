"use client";

import type { OrderDetailRow, OrderItemRow } from "@/components/orders/order-detail-view";
import { availableOrderQty } from "@/components/orders/order-create/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDiscountPctLabel, orderDiscountPctFromSums } from "@/lib/format-discount-pct";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";
import { OrderDetailCard } from "./info-row";

function parseDec(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number.parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type Line = { key: string; productId: string; qty: string };

type ProductOption = { id: number; sku: string; name: string };

type StockRow = { qty: string; reserved_qty: string };

export function OrderProductsTable({
  data,
  canEditOrderLines,
  isOperatorHint,
  editingLines,
  onStartEdit,
  lines,
  products,
  loadingProducts,
  stockByProduct,
  loadingStock,
  originalQtyByProduct,
  editError,
  patchPending,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  onSave,
  onCancel,
  itemAggregates
}: {
  data: OrderDetailRow;
  canEditOrderLines: boolean;
  isOperatorHint: boolean;
  editingLines: boolean;
  onStartEdit: () => void;
  lines: Line[];
  products: ProductOption[];
  loadingProducts: boolean;
  stockByProduct: Map<number, StockRow>;
  loadingStock: boolean;
  /** Joriy zakazdagi (saqlangan) miqdor — tahrirda «mavjud»ga qo‘shiladi. */
  originalQtyByProduct: Map<number, number>;
  editError: string | null;
  patchPending: boolean;
  onUpdateLine: (key: string, patch: Partial<Pick<Line, "productId" | "qty">>) => void;
  onAddLine: () => void;
  onRemoveLine: (key: string) => void;
  onSave: () => void;
  onCancel: () => void;
  itemAggregates: {
    vol: number;
    weightedDiscountPct: string | null;
  };
}) {
  const totalQty = data.items.reduce((acc, i) => acc + parseDec(i.qty), 0);
  const grandTotal = data.items.reduce((acc, i) => acc + parseDec(i.total), 0);

  function maxQtyForProduct(productId: number): number {
    if (!Number.isFinite(productId) || productId < 1) return 0;
    const free = availableOrderQty(stockByProduct.get(productId));
    const credit = originalQtyByProduct.get(productId) ?? 0;
    return Math.max(0, free + credit);
  }

  return (
    <OrderDetailCard
      title="Товары"
      action={
        canEditOrderLines && !editingLines ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 text-xs"
            onClick={onStartEdit}
          >
            Редактировать
          </Button>
        ) : null
      }
    >
      {isOperatorHint ? (
        <p className="mb-4 text-xs text-amber-800 dark:text-amber-200/90">
          Оператору редактирование строк недоступно. Нужно право «Заказы → редактирование».
        </p>
      ) : !canEditOrderLines && !editingLines ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Редактирование доступно для статусов «Новый» / «Подтверждён» при праве orders.zakaz.update.
          Клиент, агент, склад и тип цены не меняются. Все изменения пишутся в историю заказа.
        </p>
      ) : null}

      {canEditOrderLines && editingLines ? (
        <div className="mb-4 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Как при создании заказа: меняйте только состав и количество. Клиент, агент, склад,
            консигнация и тип цены зафиксированы.
          </p>
          {editError ? (
            <p className="text-xs text-destructive" role="alert">
              {editError}
            </p>
          ) : null}
          {loadingProducts || loadingStock ? (
            <p className="text-xs text-muted-foreground">Загрузка товаров и остатков…</p>
          ) : null}
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Товар</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Доступно</th>
                  <th className="w-28 px-3 py-2 font-medium">Количество</th>
                  <th className="w-24 px-3 py-2 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const pid = Number.parseInt(line.productId, 10);
                  const maxQ = Number.isFinite(pid) ? maxQtyForProduct(pid) : 0;
                  const q = Number.parseFloat(line.qty.replace(",", "."));
                  const over =
                    Number.isFinite(pid) &&
                    pid > 0 &&
                    Number.isFinite(q) &&
                    q > 0 &&
                    q > maxQ + 1e-9;
                  return (
                    <tr key={line.key} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <select
                          className="h-9 w-full max-w-xl rounded-md border border-input bg-background px-2 text-xs"
                          value={line.productId}
                          onChange={(e) => onUpdateLine(line.key, { productId: e.target.value })}
                          disabled={patchPending || loadingProducts}
                        >
                          <option value="">— выберите —</option>
                          {products.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.sku} — {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {Number.isFinite(pid) && pid > 0
                          ? formatNumberGrouped(maxQ, { maxFractionDigits: 3 })
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {over ? (
                          <span className="mb-0.5 block text-[11px] font-semibold text-destructive">
                            Макс: {formatNumberGrouped(maxQ, { maxFractionDigits: 3 })}
                          </span>
                        ) : null}
                        <Input
                          type="number"
                          min={0.001}
                          step="any"
                          className={cn("h-9 text-xs", over && "border-destructive")}
                          value={line.qty}
                          onChange={(e) => onUpdateLine(line.key, { qty: e.target.value })}
                          disabled={patchPending}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs"
                          disabled={patchPending || lines.length <= 1}
                          onClick={() => onRemoveLine(line.key)}
                        >
                          Удалить
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={onAddLine}
              disabled={patchPending}
            >
              + Строка
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-teal-600 text-xs hover:bg-teal-700"
              disabled={patchPending || loadingProducts || loadingStock}
              onClick={onSave}
            >
              {patchPending ? "Сохранение…" : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              disabled={patchPending}
              onClick={onCancel}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      {data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Товары отсутствуют
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-6 py-3">
            <div className="flex size-5 items-center justify-center rounded-full bg-amber-400">
              <Package className="size-3 text-white" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-foreground">Состав заказа</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ассортимент
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Цена
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Блок
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Количество
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Объем
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Скидка
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Общая сумма
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.items.map((i) => (
                  <ProductRow
                    key={i.id}
                    item={i}
                    blockName={data.warehouse_block_name}
                    orderPct={orderDiscountPctFromSums(data.total_sum, data.discount_sum)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40">
                  <td className="px-6 py-4 text-sm font-semibold text-foreground">Итого</td>
                  <td className="px-6 py-4" />
                  <td className="px-6 py-4" />
                  <td className="px-6 py-4 text-right text-sm font-semibold tabular-nums">
                    {formatNumberGrouped(String(totalQty), { maxFractionDigits: 3 })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium tabular-nums">
                    {itemAggregates.vol > 0
                      ? formatNumberGrouped(String(itemAggregates.vol), { maxFractionDigits: 4 })
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium tabular-nums">
                    {formatDiscountPctLabel(
                      itemAggregates.weightedDiscountPct ??
                        orderDiscountPctFromSums(data.total_sum, data.discount_sum),
                      { empty: "—" }
                    ) ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold tabular-nums">
                    {formatNumberGrouped(String(grandTotal), { maxFractionDigits: 2 })} So&apos;m
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </OrderDetailCard>
  );
}

function ProductRow({
  item,
  blockName,
  orderPct
}: {
  item: OrderItemRow;
  blockName: string | null | undefined;
  orderPct: number | null;
}) {
  const linePct = parseDec(item.discount_pct);
  const discLabel = item.is_bonus
    ? "—"
    : formatDiscountPctLabel(linePct > 0 ? linePct : orderPct, { empty: "0%" });
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/30",
        item.is_bonus && "bg-emerald-500/[0.06]"
      )}
    >
      <td className="px-6 py-4">
        <span className="text-sm font-medium text-foreground">
          {item.name}
          <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">
            {item.sku}
          </span>
        </span>
      </td>
      <td className="px-6 py-4 text-right text-sm tabular-nums">
        {formatNumberGrouped(item.price, { maxFractionDigits: 2 })}
      </td>
      <td className="px-6 py-4 text-right text-sm text-muted-foreground">
        {blockName?.trim() || "—"}
      </td>
      <td className="px-6 py-4 text-right text-sm tabular-nums">
        {formatNumberGrouped(item.qty, { maxFractionDigits: 3 })}
      </td>
      <td className="px-6 py-4 text-right text-sm tabular-nums text-muted-foreground">
        {item.line_volume_m3 != null && item.line_volume_m3 !== ""
          ? formatNumberGrouped(item.line_volume_m3, { maxFractionDigits: 4 })
          : "—"}
      </td>
      <td className="px-6 py-4 text-right text-sm tabular-nums">{discLabel}</td>
      <td className="px-6 py-4 text-right text-sm font-medium tabular-nums">
        {formatNumberGrouped(item.total, { maxFractionDigits: 2 })}
      </td>
    </tr>
  );
}
