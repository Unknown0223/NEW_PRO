import { Icon } from "../Icon";
import { useRefundStore } from "../../store/refundStore";
import { formatMoney, formatNumber } from "../../utils/format";

export default function TotalsPanel() {
  const { getTotals, items } = useRefundStore();
  const { quantity, volume, amount } = getTotals();
  const rows = items.length;

  const stats = [
    {
      label: "Позиций в возврате",
      value: rows.toString(),
      sublabel: "уникальных товаров",
      color: "from-indigo-500 to-violet-500",
      icon: "package" as const,
    },
    {
      label: "Общее количество",
      value: quantity.toString(),
      sublabel: "единиц",
      color: "from-sky-500 to-blue-500",
      icon: "box" as const,
    },
    {
      label: "Общий объём",
      value: formatNumber(volume, 3),
      sublabel: "литров",
      color: "from-emerald-500 to-teal-500",
      icon: "archive" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${s.color} text-white shadow-sm`}
            >
              <Icon name={s.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {s.label}
              </div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="text-[11px] text-slate-500">{s.sublabel}</div>
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
              Итоговая сумма
            </div>
            <div className="mt-1 text-3xl font-bold text-slate-900">
              {formatMoney(amount)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              К возврату на склад
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
            <Icon name="wallet" className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
