"use client";

import { EprPageLayout } from "@/components/payments/expeditor-payment-requests/epr-page-layout";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { paymentMethodSelectOptions, type ProfilePaymentMethodEntry } from "@/lib/payment-method-options";
import type { PaymentListApiRow } from "@/lib/payment-list-types";
import { STALE } from "@/lib/query-stale";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import { cn } from "@/lib/utils";
import { staffPickerDisplayName } from "@/lib/person-display";
import { commonBulkBooleanColumn, commonBulkColumnValue } from "@/lib/bulk-table-column";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };
type CashDeskRow = { id: number; name: string; is_active: boolean };

type ReviewRow = {
  id: number;
  clientName: string;
  paidAt: string;
  expeditorName: string;
  agentId: string;
  amount: string;
  paymentType: string;
  tradeDirection: string;
  consignment: boolean;
  note: string;
  orderDebt: number;
};

function parseIdsParam(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("ru-RU");
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return `${date} ${time}`;
  } catch {
    return "—";
  }
}

function defaultPaidAtLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromLocalLabel(label: string): string | undefined {
  const m = label.match(/(\d{1,2})\s+(\S+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const months: Record<string, number> = {
    Январь: 0, Февраль: 1, Март: 2, Апрель: 3, Май: 4, Июнь: 5,
    Июль: 6, Август: 7, Сентябрь: 8, Октябрь: 9, Ноябрь: 10, Декабрь: 11
  };
  const month = months[m[2]!];
  if (month === undefined) return undefined;
  const dt = new Date(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]));
  return dt.toISOString();
}

function listRowToReview(row: PaymentListApiRow): ReviewRow {
  return {
    id: row.id,
    clientName: row.client_name,
    paidAt: row.paid_at ?? row.created_at ?? "",
    expeditorName: row.expeditor_name ?? "—",
    agentId: row.agent_id != null ? String(row.agent_id) : "",
    amount: row.amount,
    paymentType: row.payment_type,
    tradeDirection: row.trade_direction ?? "",
    consignment: row.consignment,
    note: row.note ?? "",
    orderDebt: 0
  };
}

export function EprConfirmReviewWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();

  const ids = useMemo(() => parseIdsParam(searchParams.get("ids")), [searchParams]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [cashDeskId, setCashDeskId] = useState("");
  const [payDate, setPayDate] = useState(defaultPaidAtLocal);
  const [toast, setToast] = useState<string | null>(null);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [successCount, setSuccessCount] = useState(0);
  const [showPayBreakdown, setShowPayBreakdown] = useState(false);
  const consignmentHeaderRef = useRef<HTMLInputElement>(null);

  const paymentsQ = useQuery({
    queryKey: ["epr-confirm-payments", tenantSlug, ids.join(",")],
    enabled: Boolean(tenantSlug) && hydrated && ids.length > 0,
    staleTime: STALE.detail,
    queryFn: async () => {
      const results = await Promise.all(
        ids.map(async (id) => {
          const { data } = await api.get<{ payment: PaymentListApiRow }>(`/api/${tenantSlug}/payments/${id}`);
          return data.payment;
        })
      );
      return results.filter((r) => r.workflow_status === "pending_confirmation");
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "epr-confirm"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data ?? [];
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "epr-confirm"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return (data.data ?? []).filter((d) => d.is_active);
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "epr-confirm-methods"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
          trade_directions?: string[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const payMethods = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "epr-confirm-review");
  const tradeDirections = tradeDirectionsCatalog.labels;

  useEffect(() => {
    if (paymentsQ.data) setRows(paymentsQ.data.map(listRowToReview));
  }, [paymentsQ.data]);

  const displayRows = onlyErrors ? rows.filter((r) => r.orderDebt > 0) : rows;
  const totalReceived = useMemo(
    () => rows.reduce((sum, r) => sum + (Number.parseFloat(r.amount.replace(/\s/g, "")) || 0), 0),
    [rows]
  );

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const label = payMethods.find((m) => m.value === row.paymentType)?.label ?? row.paymentType;
      const amt = Number.parseFloat(row.amount.replace(/\s/g, "")) || 0;
      map.set(label, (map.get(label) ?? 0) + amt);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows, payMethods]);

  const applyBulkAmount = useCallback(() => {
    const raw = bulkAmount.replace(/\s/g, "").replace(",", ".");
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const formatted = formatNumberGrouped(n, { minFractionDigits: 0, maxFractionDigits: 0 });
    setRows((prev) => prev.map((r) => ({ ...r, amount: formatted })));
  }, [bulkAmount]);

  const applyBulkNote = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, note: bulkNote })));
  }, [bulkNote]);

  const headerAgentId = useMemo(
    () => commonBulkColumnValue(rows, (r) => r.agentId, ""),
    [rows]
  );

  const headerPaymentType = useMemo(
    () => commonBulkColumnValue(rows, (r) => r.paymentType, ""),
    [rows]
  );

  const headerTradeDirection = useMemo(
    () => commonBulkColumnValue(rows, (r) => r.tradeDirection, ""),
    [rows]
  );

  const headerConsignment = useMemo(
    () => commonBulkBooleanColumn(rows, (r) => r.consignment),
    [rows]
  );

  useEffect(() => {
    const el = consignmentHeaderRef.current;
    if (!el) return;
    el.indeterminate = headerConsignment === "mixed";
    el.checked = headerConsignment === true;
  }, [headerConsignment]);

  const patchAndConfirmMut = useMutation({
    mutationFn: async () => {
      const paid_at = toIsoFromLocalLabel(payDate);
      const deskRaw = cashDeskId.trim();
      const deskId = deskRaw ? Number.parseInt(deskRaw, 10) : null;
      const cash_desk_id =
        deskId != null && Number.isFinite(deskId) && deskId > 0 ? deskId : null;

      for (const row of rows) {
        const amount = Number.parseFloat(row.amount.replace(/\s/g, "").replace(",", "."));
        const agentId = row.agentId ? Number.parseInt(row.agentId, 10) : null;
        const patch: Record<string, unknown> = {};
        if (Number.isFinite(amount) && amount > 0) patch.amount = amount;
        if (row.paymentType.trim()) patch.payment_type = row.paymentType.trim();
        if (row.note.trim()) patch.note = row.note.trim();
        if (paid_at) patch.paid_at = paid_at;
        if (cash_desk_id) patch.cash_desk_id = cash_desk_id;
        if (agentId != null && Number.isFinite(agentId) && agentId > 0) patch.ledger_agent_id = agentId;
        if (Object.keys(patch).length > 0) {
          await api.patch(`/api/${tenantSlug}/payments/${row.id}`, patch);
        }
      }

      const { data } = await api.post<{ ok: number[]; failed: { id: number; error: string }[] }>(
        `/api/${tenantSlug}/payments/batch-confirm`,
        { ids: rows.map((r) => r.id) }
      );
      return data;
    },
    onSuccess: (data) => {
      const ok = data.ok.length;
      const failed = data.failed.length;
      setSuccessCount(ok);
      setToast(`Успешно оплачено: ${ok}${failed ? `, ошибок: ${failed}` : ""}`);
      void qc.invalidateQueries({ queryKey: ["expeditor-payment-requests", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
      setTimeout(() => router.push("/expeditor-payment-requests"), 900);
    },
    onError: () => {
      setToast("Ошибка оплаты. Повторите попытку");
      setTimeout(() => setToast(null), 2200);
    }
  });

  const updateRow = useCallback((id: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  if (!hydrated) return <p className="p-6 text-sm text-muted-foreground">Загрузка сессии…</p>;
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-destructive">
        <Link href="/login" className="underline">Войти</Link>
      </p>
    );
  }

  if (ids.length === 0) {
    return (
      <EprPageLayout>
        <p className="text-sm text-muted-foreground">Не выбраны заявки.</p>
        <Link href="/expeditor-payment-requests" className="mt-2 text-sm text-teal-700 underline">
          ← Назад к заявкам
        </Link>
      </EprPageLayout>
    );
  }

  const successPct = rows.length > 0 ? Math.round((successCount / rows.length) * 100) : 0;

  return (
    <EprPageLayout className="text-[13px] text-slate-700">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1660px] border-collapse text-[13px] text-slate-700">
            <thead className="bg-muted text-slate-500">
              <tr className="h-14">
                <th className="w-[140px] px-3 text-left font-medium">Клиенты</th>
                <th className="w-[145px] px-3 text-left font-medium">Тип</th>
                <th className="w-[145px] px-3 text-left font-medium">Дата оплаты</th>
                <th className="w-[155px] px-3 text-left font-medium">Экспедитор</th>
                <th className="w-[220px] px-3 text-left font-medium">
                  <select
                    value={headerAgentId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => prev.map((r) => ({ ...r, agentId: v })));
                    }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-slate-600 shadow-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Агент</option>
                    {(agentsQ.data ?? []).map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {staffPickerDisplayName(a)}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="w-[210px] px-3 text-left font-medium">
                  <input
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    onBlur={applyBulkAmount}
                    onKeyDown={(e) => e.key === "Enter" && applyBulkAmount()}
                    placeholder="Сумма для всех"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-slate-600 shadow-sm outline-none focus:border-teal-500"
                  />
                </th>
                <th className="w-[210px] px-3 text-left font-medium">
                  <select
                    value={headerPaymentType}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => prev.map((r) => ({ ...r, paymentType: v })));
                    }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-slate-600 shadow-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Способ оплаты</option>
                    {payMethods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="w-[235px] px-3 text-left font-medium">
                  <select
                    value={headerTradeDirection}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => prev.map((r) => ({ ...r, tradeDirection: v })));
                    }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-slate-600 shadow-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Направление</option>
                    {tradeDirections.map((td) => (
                      <option key={td} value={td}>
                        {td}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="w-[145px] px-3 text-left font-medium">Остаток долга (по заказам)</th>
                <th className="w-[145px] px-3 text-left font-medium">Остаток после оплаты</th>
                <th className="w-[105px] px-3 text-center font-medium">
                  <input
                    ref={consignmentHeaderRef}
                    type="checkbox"
                    className="size-4 rounded border-input accent-teal-600"
                    aria-label="Консигнация для всех"
                    title="Консигнация для всех"
                    onChange={(e) =>
                      setRows((prev) => prev.map((r) => ({ ...r, consignment: e.target.checked })))
                    }
                  />
                </th>
                <th className="w-[220px] px-3 text-left font-medium">
                  <input
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    onBlur={applyBulkNote}
                    onKeyDown={(e) => e.key === "Enter" && applyBulkNote()}
                    placeholder="Комментарий для всех"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-slate-600 shadow-sm outline-none focus:border-teal-500"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentsQ.isLoading ? (
                <tr>
                  <td colSpan={12} className="h-32 text-center text-slate-400">
                    Загрузка…
                  </td>
                </tr>
              ) : null}
              {displayRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={cn(
                    "h-[58px] border-t border-border",
                    index === 2 ? "bg-cyan-50/70" : "bg-card"
                  )}
                >
                  <td className="px-3 font-medium leading-5 text-slate-700">{row.clientName}</td>
                  <td className="px-3">Оплата для заказа</td>
                  <td className="whitespace-nowrap px-3">{formatDateTime(row.paidAt)}</td>
                  <td className="px-3 leading-5">{row.expeditorName}</td>
                  <td className="px-3">
                    <select
                      value={row.agentId}
                      onChange={(e) => updateRow(row.id, { agentId: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-slate-800 shadow-sm outline-none focus:border-teal-500"
                    >
                      <option value="">—</option>
                      {(agentsQ.data ?? []).map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {staffPickerDisplayName(a)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3">
                    <input
                      value={formatNumberGrouped(row.amount, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      onChange={(e) => updateRow(row.id, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-right text-slate-900 shadow-sm outline-none focus:border-teal-500"
                    />
                  </td>
                  <td className="px-3">
                    <select
                      value={row.paymentType}
                      onChange={(e) => updateRow(row.id, { paymentType: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-teal-500"
                    >
                      {payMethods.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3">
                    <select
                      value={row.tradeDirection}
                      onChange={(e) => updateRow(row.id, { tradeDirection: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-teal-500"
                    >
                      <option value="">—</option>
                      {tradeDirections.map((td) => (
                        <option key={td} value={td}>
                          {td}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 text-center tabular-nums">0</td>
                  <td className="px-3 text-center tabular-nums">0</td>
                  <td className="whitespace-nowrap px-3">
                    <div className="flex items-center gap-2">
                      <span>Кон - я</span>
                      <span
                        className={cn(
                          "inline-block h-5 w-9 rounded-full p-0.5 transition",
                          row.consignment ? "bg-teal-500" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "block size-4 rounded-full bg-card transition",
                            row.consignment && "translate-x-4"
                          )}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3">
                    <input
                      value={row.note}
                      onChange={(e) => updateRow(row.id, { note: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 shadow-sm outline-none focus:border-teal-500"
                    />
                  </td>
                </tr>
              ))}
              {!paymentsQ.isLoading && !displayRows.length ? (
                <tr>
                  <td colSpan={12} className="h-[232px] text-center text-slate-400">
                    {onlyErrors ? "Ошибочные платежи не найдены" : "Нет заявок для подтверждения"}
                  </td>
                </tr>
              ) : null}
              {displayRows.length > 0 ? (
                <tr>
                  <td colSpan={12} className="h-[min(360px,40vh)] bg-card" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border bg-muted px-3 py-3">
          <div className="grid grid-cols-[180px_180px_190px_180px_220px_1fr] items-center gap-3 text-slate-600">
            <div>
              <div>Общая сумма :</div>
              <div className="font-semibold text-slate-700">
                {formatNumberGrouped(totalReceived, { minFractionDigits: 0, maxFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div>Получено :</div>
              <div className="font-semibold text-slate-700">
                {formatNumberGrouped(totalReceived, { minFractionDigits: 0, maxFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div>Общий долг по заказам :</div>
              <div className="font-semibold text-slate-700">0</div>
            </div>
            <div className="text-red-600">Осталось : 0</div>
            <button
              type="button"
              onClick={() => setShowPayBreakdown((v) => !v)}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              По способу оплаты <span>{showPayBreakdown ? "⌃" : "⌄"}</span>
            </button>
          </div>
          {showPayBreakdown && paymentBreakdown.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              {paymentBreakdown.map(([label, amt]) => (
                <span key={label} className="rounded-md border border-border bg-card px-2 py-1">
                  {label}:{" "}
                  <span className="font-semibold text-slate-800">
                    {formatNumberGrouped(amt, { minFractionDigits: 0, maxFractionDigits: 0 })}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-3 h-2 rounded-full bg-slate-300 shadow-inner">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${Math.max(4, successPct)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="max-w-[60%]">
          <div className="h-[27px] rounded-md border border-[#063b36] bg-cyan-50 text-center text-xs font-bold leading-[27px] text-slate-900">
            Успешно {successCount} из {rows.length} ({successPct}%)
          </div>
          <label className="mt-2 flex items-center gap-2 text-slate-400">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
              className="size-4 rounded border-border accent-teal-600"
            />
            Показать только ошибочные платежи
          </label>
        </div>
      </div>

      <Link
        href="/expeditor-payment-requests"
        className="fixed bottom-4 left-4 z-30 text-xs text-slate-500 hover:text-slate-800 md:left-6"
      >
        ← Назад к заявкам
      </Link>

      <div className="fixed bottom-3 right-5 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-card shadow-sm">
          <button type="button" className="px-3 py-2 text-slate-500 hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <label className="border-x border-border px-3 py-1.5 text-xs text-slate-500">
            <span className="block leading-3">Дата</span>
            <input
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-[150px] text-sm text-slate-800 outline-none"
            />
          </label>
          <button type="button" className="px-3 py-2 text-slate-500 hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <select
          value={cashDeskId}
          onChange={(e) => setCashDeskId(e.target.value)}
          className="h-9 w-[215px] rounded-lg border border-border bg-card px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-teal-500"
        >
          <option value="">Выберите кассу</option>
          {(cashDesksQ.data ?? []).map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => patchAndConfirmMut.mutate()}
          disabled={patchAndConfirmMut.isPending || rows.length === 0}
          className="h-9 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {patchAndConfirmMut.isPending ? "Оплата..." : "Оплатить"}
        </button>
      </div>

      {toast ? (
        <div className="fixed right-6 top-16 z-50 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </EprPageLayout>
  );
}
