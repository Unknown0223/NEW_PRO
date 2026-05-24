"use client";

import { fmtMoney } from "@/components/dashboard/sales/format";
import { salesExportButtonClass, SalesSectionHeader } from "@/components/dashboard/sales/sales-section-header";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";

export function SalesPaymentSection({
  data,
  resolvePayment,
  onExportPayment,
  onExportOrdersRefusals
}: {
  data: SalesDashboardSnapshot;
  resolvePayment: (ref: string) => string;
  onExportPayment: () => void;
  onExportOrdersRefusals: () => void;
}) {
  const o = data.orders_refusals;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="По способам оплаты"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExportPayment}>
              Excel
            </button>
          }
        />
        <div className="overflow-x-auto p-4 pt-0">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-2 py-2">Способ оплаты</th>
                <th className="px-2 py-2 text-right">Сумма</th>
                <th className="px-2 py-2 text-right">Доля</th>
              </tr>
            </thead>
            <tbody>
              {data.payment_method_analytics.map((r) => (
                <tr key={r.payment_type} className="border-b border-slate-50">
                  <td className="px-2 py-1.5">{resolvePayment(r.payment_type)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.sales_sum)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.share_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="Заказы / отказы"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExportOrdersRefusals}>
              Excel
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-2 p-4 pt-0">
          {[
            { label: "Принято", value: o.accepted },
            { label: "Отклонено", value: o.rejected },
            { label: "В обработке", value: o.pending },
            { label: "Конверсия", value: `${o.conversion_pct.toFixed(1)}%` }
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
