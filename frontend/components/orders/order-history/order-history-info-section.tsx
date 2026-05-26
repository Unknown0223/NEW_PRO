"use client";

import type { OrderHistoryProduct, OrderHistoryVersion } from "./build-order-history-data";
import { OrderHistoryStatusBadge } from "./order-history-status-badge";
import Link from "next/link";

type RowDef = {
  label: string;
  key: keyof OrderHistoryVersion;
  isLink?: boolean;
  isStatus?: boolean;
  isDate?: boolean;
  isMultiLine?: boolean;
};

const rows: RowDef[] = [
  { label: "Дата", key: "date", isDate: true },
  { label: "Клиенты", key: "client", isLink: true },
  { label: "Агент", key: "agent", isMultiLine: true },
  { label: "Экспедитор", key: "expediter" },
  { label: "Дата отгрузки", key: "shipDate" },
  { label: "Дата доставки", key: "deliveryDate" },
  { label: "Консигнация", key: "consignation" },
  { label: "Консигнация (срок)", key: "consignationDeadline" },
  { label: "Статус", key: "status", isStatus: true },
  { label: "Тип цены", key: "priceType" },
  { label: "Кол-во", key: "quantity" },
  { label: "Объем", key: "volume" },
  { label: "Сумма", key: "sum" },
  { label: "Склад", key: "warehouse" },
  { label: "Направление торговли", key: "tradeDirection" },
  { label: "Дата возврата", key: "returnDate" },
  { label: "Комментарий", key: "comment" },
  { label: "Кто создал", key: "createdBy", isMultiLine: true },
  { label: "Кто изменил", key: "updatedBy", isMultiLine: true }
];

function renderValue(value: string, isMultiLine?: boolean) {
  if (isMultiLine && value.includes("\n")) {
    return value.split("\n").map((line, i) => <div key={i}>{line}</div>);
  }
  return value;
}

function formatProductMoney(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function OrderHistoryInfoSection({
  versions,
  products
}: {
  versions: OrderHistoryVersion[];
  products: OrderHistoryProduct[];
}) {
  if (versions.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Нет данных для отображения.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/60 last:border-b-0">
              <td className="w-52 whitespace-nowrap bg-muted/30 px-4 py-[7px] text-xs font-medium text-muted-foreground">
                {row.label}
              </td>
              {versions.map((version, idx) => {
                const value = version[row.key] as string;
                const hasValue = value && value.trim().length > 0;
                const clientHref =
                  row.key === "client" && version.clientId
                    ? `/clients/${version.clientId}`
                    : null;

                return (
                  <td
                    key={idx}
                    className="min-w-[220px] border-l border-border/60 px-4 py-[7px] align-top text-foreground"
                  >
                    {row.isStatus && hasValue ? (
                      <OrderHistoryStatusBadge
                        status={version.status}
                        statusKey={version.statusKey}
                      />
                    ) : row.isLink && hasValue && clientHref ? (
                      <Link
                        href={clientHref}
                        className="whitespace-pre-line break-words text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
                      >
                        {renderValue(value, row.isMultiLine)}
                      </Link>
                    ) : row.isDate && hasValue ? (
                      <span className="font-semibold text-teal-600 dark:text-teal-400">{value}</span>
                    ) : hasValue ? (
                      <span className="whitespace-pre-line break-words">
                        {renderValue(value, row.isMultiLine)}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}

          <tr>
            <td
              colSpan={versions.length + 1}
              className="bg-muted/30 px-4 py-3 text-base font-bold text-foreground"
            >
              Состав
            </td>
          </tr>

          {products.length === 0 ? (
            <tr>
              <td
                colSpan={versions.length + 1}
                className="px-4 py-6 text-center text-xs text-muted-foreground"
              >
                Позиции отсутствуют
              </td>
            </tr>
          ) : (
            products.map((product, pIdx) => (
              <tr
                key={product.id}
                className={`border-b border-border/60 last:border-b-0 ${
                  pIdx % 2 === 1 ? "bg-muted/20" : ""
                }`}
              >
                <td className="w-52 whitespace-nowrap bg-muted/30 px-4 py-[7px]" />
                {versions.map((_, idx) => (
                  <td
                    key={idx}
                    className="min-w-[220px] border-l border-border/60 px-4 py-[7px] align-top text-foreground"
                  >
                    {idx === 0 ? (
                      <>
                        <div className="text-[13px]">{product.name}</div>
                        <div className="mt-0.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
                          Заказ
                        </div>
                      </>
                    ) : idx === 1 ? (
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <div>
                          Кол-во:{" "}
                          <span className="font-semibold text-foreground">
                            {product.quantity} шт
                          </span>
                        </div>
                        <div>
                          Цена:{" "}
                          <span className="font-semibold text-foreground">
                            {formatProductMoney(product.price)} сум
                          </span>
                        </div>
                        <div>
                          Объем:{" "}
                          <span className="font-semibold text-foreground">{product.volume}</span>
                        </div>
                        <div>
                          Сумма:{" "}
                          <span className="font-semibold text-foreground">
                            {formatProductMoney(product.total)} сум
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
