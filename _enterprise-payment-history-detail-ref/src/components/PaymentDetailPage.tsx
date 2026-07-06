import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./ui";
import * as api from "../api/paymentApi";
import {
  METHOD_CONFIG,
  STATUS_CONFIG,
  formatDate,
  formatDateTime,
  formatMoney,
  type Payment,
} from "../data/payment";
import { cn } from "../utils/cn";

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── STATUS BADGES (exact template colors) ────────────────────
function StatusBadge({ children, tone }: { children: ReactNode; tone: "pending" | "approved" | "rejected" | "cancelled" | "completed" }) {
  const tones: Record<string, string> = {
    pending: "bg-cyan-100 text-cyan-600",
    approved: "bg-yellow-100 text-yellow-600",
    rejected: "bg-red-100 text-red-600",
    cancelled: "bg-gray-200 text-gray-600",
    completed: "bg-blue-100 text-blue-600",
  };
  return (
    <span className={cn("inline-block rounded-md px-3 py-1.5 text-[14px] leading-none font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

// ── SKELETON (loading state) ─────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-6 shadow-sm">
      <div className="space-y-0 divide-y divide-slate-100 border border-slate-200">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="flex h-[38px] items-center gap-6 px-4">
            <div className="h-3 w-40 rounded bg-slate-200/80" />
            <div className="ml-auto h-3 w-32 rounded bg-slate-100" />
            <div className="h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TABLE ROW MODEL ──────────────────────────────────────────
type Row = {
  label: string;
  v1?: ReactNode; // column 1 (current / created version)
  v2?: ReactNode; // column 2 (modified / approved version)
  shaded?: boolean;
};

export default function PaymentDetailPage({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getPayment(1000)
      .then(setPayment)
      .catch(() => setError("Не удалось загрузить данные платежа. Проверьте соединение."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // ── ROWS (1:1 template layout) ─────────────────────────────
  const rows: Row[] = payment
    ? [
        {
          label: "Дата",
          v1: <span className="font-semibold text-teal-600">{formatDateTime(payment.createdAt)}</span>,
          v2: <span className="font-semibold text-teal-600">{formatDateTime(payment.updatedAt)}</span>,
        },
        { label: "Клиенты", v1: payment.customer.name },
        { label: "Агент", v1: payment.agent.fullName },
        {
          label: "Статус",
          v1: <StatusBadge tone="pending">{STATUS_CONFIG.PENDING.label}</StatusBadge>,
          v2: <StatusBadge tone="approved">{STATUS_CONFIG.APPROVED.label}</StatusBadge>,
        },
        { label: "ID", v2: String(payment.id) },
        { label: "Сумма", v1: formatMoney(payment.amount) },
        { label: "Дата оплаты", v1: formatDateTime(payment.paymentDate) },
        {
          label: "Дата создания",
          v1: formatDateTime(payment.createdAt),
          v2: formatDateTime(payment.updatedAt),
        },
        { label: "Долг срок", v1: payment.debtDueDate ? formatDate(payment.debtDueDate) : undefined, shaded: true },
        { label: "Способ оплаты", v1: METHOD_CONFIG[payment.method].label },
        { label: "Тип выплаты дохода", v1: payment.incomeType },
        { label: "Направление торговли", v1: payment.tradeDirection },
        { label: "Касса", v1: payment.cashbox.name },
        { label: "Экспедитор", v1: payment.expeditor?.fullName, shaded: true },
        { label: "Подтверждение", v2: payment.approval.approvedBy?.fullName ?? "Op Anvar" },
        { label: "Кто создал", v1: payment.createdBy.fullName },
        { label: "Кто изменил", v2: payment.modifiedBy.fullName },
        { label: "Комментарий", v1: payment.comment || undefined },
      ]
    : [];

  return (
    <>
      {/* ── TOP BAR (60px) ── */}
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 bg-white px-4 print:hidden lg:px-6">
        <button
          onClick={onToggleSidebar}
          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 lg:hidden"
          aria-label="Меню"
        >
          <Icon d="M4 6h16M4 12h16M4 18h16" />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[14px] font-medium text-slate-600">
          <Icon d="M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" className="h-4 w-4 text-slate-500" />
          GPS
        </span>
        <span className="hidden text-[15px] text-slate-400 sm:block">Нет избранные страницы</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-[13px] font-semibold text-white ring-2 ring-slate-200">
            OA
          </div>
        </div>
      </header>

      {/* ── PAGE HEADER on gradient strip ── */}
      <div className="bg-gradient-to-b from-slate-200/70 via-slate-100/60 to-transparent px-6 pt-5 pb-1 print:hidden">
        <h1 className="text-[24px] leading-8 font-bold tracking-tight text-slate-800">
          История оплаты клиентов
        </h1>
      </div>

      <main className="px-6 pt-4 pb-20 print:hidden">
        {error ? (
          /* ── ERROR STATE ── */
          <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-24 text-center shadow-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Icon d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" className="h-7 w-7" />
            </div>
            <h2 className="text-[18px] font-semibold text-slate-800">Ошибка загрузки</h2>
            <p className="mt-1 max-w-sm text-[14px] text-slate-500">{error}</p>
            <Button variant="primary" className="mt-5" onClick={load}>
              Повторить запрос
            </Button>
          </div>
        ) : loading || !payment ? (
          <Skeleton />
        ) : (
          /* ── MAIN CARD: comparison table (1:1 template) ── */
          <div className="rounded-xl bg-white p-6 shadow-[0_1px_4px_rgba(15,52,56,0.08)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.label}
                      className={cn("border border-slate-200", r.shaded && "bg-slate-50")}
                    >
                      <td className="w-[56%] border border-slate-200 px-4 py-2 text-[14px] text-slate-400">
                        {r.label}
                      </td>
                      <td className="w-[22%] border border-slate-200 px-4 py-2 text-[14px] text-slate-600">
                        {r.v1 ?? ""}
                      </td>
                      <td className="w-[22%] border border-slate-200 px-4 py-2 text-[14px] text-slate-600">
                        {r.v2 ?? ""}
                      </td>
                    </tr>
                  ))}
                  {/* trailing empty strip like the template */}
                  <tr>
                    <td colSpan={3} className="h-4" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── ACTION BAR: back only ── */}
      {!loading && payment && !error && (
        <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-2px_10px_rgba(15,52,56,0.07)] backdrop-blur print:hidden lg:left-[260px]">
          <Button variant="outline">
            <Icon d="m12 19-7-7 7-7M5 12h14" />
            Назад
          </Button>
        </div>
      )}
    </>
  );
}
