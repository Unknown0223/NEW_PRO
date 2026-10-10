"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { PAYROLL_QUERY_KEYS, payrollApi } from "./payroll-api";
import type { PayrollEntryRow } from "./payroll-api";
import { currentMonth, formatMoney, monthLabel, remainingAmount } from "./payroll-utils";

type Props = { tenantSlug: string };

export function PaymentsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => currentMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsQ = useQuery({
    queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => (await payrollApi.options(tenantSlug)).data.data
  });

  const listQ = useQuery({
    queryKey: [...PAYROLL_QUERY_KEYS.payments(tenantSlug), month],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => (await payrollApi.payments(tenantSlug, { month })).data.data
  });

  const calcQ = useQuery({
    queryKey: ["payroll", "calc", tenantSlug, month],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.detail,
    queryFn: async () => (await payrollApi.calc(tenantSlug, { month })).data
  });

  const voidMut = useMutation({
    mutationFn: (id: number) => payrollApi.voidPayment(tenantSlug, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payroll", "payments", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["payroll", "calc", tenantSlug] });
    },
    onError: (e) => setError(getUserFacingError(e))
  });

  const rows = listQ.data?.rows ?? [];
  const entries: PayrollEntryRow[] = calcQ.data?.rows ?? [];

  const unpaid = useMemo(
    () =>
      entries
        .map((e) => ({ ...e, remaining: remainingAmount(e.net_amount, e.paid_amount) }))
        .filter((e) => e.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining),
    [entries]
  );

  return (
    <PageShell>
      <PageHeader
        title="Выплаты зарплаты"
        description="Oy bo‘yicha to‘lovlar. Hisobdan qolgan summa avtomatik ko‘rinadi."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadXlsxSheet(
                  `payroll_payments_${month}.xlsx`,
                  monthLabel(month),
                  ["Дата", "ФИО", "Роль", "Сумма", "Способ", "Касса", "Комментарий"],
                  rows.map((r) => [
                    r.paid_at.slice(0, 10),
                    r.fio,
                    r.role_label,
                    r.amount,
                    r.method,
                    r.cash_desk_name ?? "",
                    r.comment ?? ""
                  ])
                )
              }
            >
              Excel
            </Button>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Выплата
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Oy</span>
                <Input className="h-9 w-36 text-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </label>
              <div className="ml-auto text-xs text-muted-foreground">
                {formatGroupedInteger(listQ.data?.paid ?? 0)} ta to‘lov ·{" "}
                <span className="font-medium text-foreground">{formatMoney(listQ.data?.total ?? 0)}</span>
              </div>
            </div>

            {error ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p> : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">Дата</th>
                    <th className="p-2 font-medium">ФИО</th>
                    <th className="p-2 font-medium">Роль</th>
                    <th className="p-2 text-right font-medium">Сумма</th>
                    <th className="p-2 font-medium">Способ</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={cn("border-b border-border/60 last:border-0", r.voided_at && "opacity-50 line-through")}
                    >
                      <td className="p-2 tabular-nums">{r.paid_at.slice(0, 10)}</td>
                      <td className="p-2 font-medium">{r.fio}</td>
                      <td className="p-2">{r.role_label}</td>
                      <td className="p-2 text-right font-medium tabular-nums">{formatMoney(r.amount)}</td>
                      <td className="p-2">
                        {r.method}
                        {r.cash_desk_name ? <span className="text-muted-foreground"> · {r.cash_desk_name}</span> : null}
                      </td>
                      <td className="p-2 text-right">
                        {!r.voided_at ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            onClick={() => voidMut.mutate(r.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        {listQ.isLoading ? "Yuklanmoqda…" : "Bu oyda to‘lov yo‘q."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-3">
            <p className="text-xs font-medium">Qolgan summalar</p>
            {unpaid.map((e) => (
              <div key={e.id} className="flex items-center gap-2 border-b border-border/50 pb-1 text-xs last:border-0">
                <span className="min-w-0 flex-1 truncate">{e.fio}</span>
                <span className="tabular-nums text-muted-foreground">{formatMoney(e.net_amount)}</span>
                <span className="font-medium tabular-nums text-amber-700">{formatMoney(e.remaining)}</span>
              </div>
            ))}
            {unpaid.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {calcQ.isLoading ? "Yuklanmoqda…" : "Hisoblanmagan yoki hammasi to‘langan."}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <PaymentDialog
        open={addOpen}
        tenantSlug={tenantSlug}
        month={month}
        entries={entries}
        cashDesks={optionsQ.data?.cash_desks ?? []}
        onOpenChange={setAddOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["payroll", "payments", tenantSlug] });
          void qc.invalidateQueries({ queryKey: ["payroll", "calc", tenantSlug] });
          void qc.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.options(tenantSlug) });
        }}
      />
    </PageShell>
  );
}

function PaymentDialog({
  open,
  tenantSlug,
  month,
  entries,
  cashDesks,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  tenantSlug: string;
  month: string;
  entries: PayrollEntryRow[];
  cashDesks: Array<{ id: number; name: string }>;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [cashDesk, setCashDesk] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUserId("");
    setAmount("");
    setComment("");
  }, [open]);

  useEffect(() => {
    const entry = entries.find((e) => String(e.user_id) === userId);
    if (entry && amount === "") setAmount(String(remainingAmount(entry.net_amount, entry.paid_amount)));
  }, [userId, entries, amount]);

  const submit = async () => {
    setError(null);
    if (!userId) {
      setError("Xodimni tanlang.");
      return;
    }
    const n = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Summa 0 dan katta bo‘lishi kerak.");
      return;
    }
    setSaving(true);
    try {
      await payrollApi.createPayment(tenantSlug, {
        month,
        user_id: Number(userId),
        amount: n,
        method,
        cash_desk_id: cashDesk ? Number(cashDesk) : null,
        paid_at: `${paidAt}T09:00:00.000Z`,
        comment: comment.trim() || null
      });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Выплата — {monthLabel(month)}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Xodim</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setAmount("");
              }}
            >
              <option value="">Tanlang…</option>
              {entries.map((e) => (
                <option key={e.user_id} value={String(e.user_id)}>
                  {e.fio} — {formatMoney(remainingAmount(e.net_amount, e.paid_amount))}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Summa (сўм)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sana</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Способ</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="cash">Наличные</option>
              <option value="bank">Банк (перечисление)</option>
              <option value="card">Карта</option>
              <option value="other">Другое</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Касса</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={cashDesk}
              onChange={(e) => setCashDesk(e.target.value)}
            >
              <option value="">—</option>
              {cashDesks.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Izoh</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Сақланмоқда…" : "Сақлаш"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
