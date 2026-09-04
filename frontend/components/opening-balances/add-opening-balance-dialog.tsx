"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { DateTimePickerField } from "@/components/ui/datetime-popover";
import { FilterSelect } from "@/components/ui/filter-select";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Label } from "@/components/ui/label";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { useAuthStoreHydrated } from "@/lib/auth-store";
import { useActiveTradeDirectionsCatalog } from "@/hooks/use-active-trade-directions-catalog";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { isAxiosError } from "axios";
import {
  defaultPaymentTypeValue,
  paymentMethodSelectOptions,
  type ProfilePaymentMethodEntry
} from "@/lib/payment-method-options";
import type { OpeningBalanceListRow } from "@/lib/opening-balance-types";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };
type CashDeskRow = { id: number; name: string; is_active: boolean };

const controlClass =
  "flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  onCreated?: () => void;
};

export function AddOpeningBalanceDialog({ open, onOpenChange, tenantSlug, onCreated }: Props) {
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const [clientIds, setClientIds] = useState<number[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [balanceType, setBalanceType] = useState<"debt" | "surplus">("debt");
  const [amount, setAmount] = useState("");
  const [paidAtLocal, setPaidAtLocal] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
  });
  const [paymentType, setPaymentType] = useState("");
  const [cashDeskId, setCashDeskId] = useState("");
  const [tradeDirection, setTradeDirection] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);

  const clientsQ = useQuery({
    queryKey: ["clients", tenantSlug, "add-opening-balance"],
    enabled: Boolean(tenantSlug) && hydrated && open,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientRow[] }>(
        `/api/${tenantSlug}/clients?page=1&limit=500&is_active=true`
      );
      return data.data;
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "add-opening-balance"],
    enabled: Boolean(tenantSlug) && hydrated && open,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return data.data.filter((d) => d.is_active);
    }
  });

  const tradeDirectionsCatalog = useActiveTradeDirectionsCatalog(tenantSlug, "add-opening-balance");
  const tradeDirectionOptions = tradeDirectionsCatalog.labels;

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "add-opening-balance-refs"],
    enabled: Boolean(tenantSlug) && hydrated && open,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "add-opening-balance-agent-label"],
    enabled: Boolean(tenantSlug) && hydrated && open,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data;
    }
  });

  const agentById = useMemo(() => {
    const m = new Map<number, StaffPick>();
    for (const a of agentsQ.data ?? []) m.set(a.id, a);
    return m;
  }, [agentsQ.data]);

  const clientItems = useMemo(
    () =>
      (clientsQ.data ?? []).map((c) => {
        const agent = c.agent_id != null ? agentById.get(c.agent_id) : undefined;
        return {
          id: c.id,
          title: c.name,
          subtitle: [c.region, agent?.code ? `агент ${agent.code}` : null, c.phone]
            .filter(Boolean)
            .join(" · "),
          searchText: [c.client_code, c.region, agent?.code, String(c.id)].filter(Boolean).join(" ")
        };
      }),
    [clientsQ.data, agentById]
  );

  const selectedClients = useMemo(() => {
    const set = new Set(clientIds);
    return (clientsQ.data ?? []).filter((c) => set.has(c.id));
  }, [clientsQ.data, clientIds]);

  const virtualRows = useMemo(
    () =>
      selectedClients.map((c) => {
        const agent = c.agent_id != null ? agentById.get(c.agent_id) : undefined;
        return {
          id: c.id,
          name: c.name,
          region: c.region?.trim() || "—",
          agentCode: agent?.code?.trim() || "—",
          agentName: agent?.fio ?? null
        };
      }),
    [selectedClients, agentById]
  );

  const paySelectOpts = useMemo(
    () => paymentMethodSelectOptions(profileQ.data, profileQ.data?.payment_types),
    [profileQ.data]
  );
  const defaultPayType = useMemo(() => defaultPaymentTypeValue(paySelectOpts), [paySelectOpts]);

  const fillVirtualDefaults = () => {
    setAmount((prev) => (prev.trim() ? prev : "100000"));
    setBalanceType("debt");
    setPaymentType(defaultPayType || "Наличные");
    if (!cashDeskId && (cashDesksQ.data?.length ?? 0) > 0) {
      setCashDeskId(String(cashDesksQ.data![0]!.id));
    }
    if (!tradeDirection && tradeDirectionOptions.length > 0) {
      setTradeDirection(tradeDirectionOptions[0]!);
    }
    setNote((n) => n.trim() || "Начальный баланс (пакетное добавление)");
    setErr(null);
  };

  const resetForm = () => {
    setClientIds([]);
    setClientSearch("");
    setAmount("");
    setNote("");
    setProgress(null);
    setErr(null);
    setFieldErrs({});
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (clientIds.length < 1) throw new Error("NO_CLIENT");
      const raw = amount.replace(/\s/g, "").replace(",", ".");
      const amt = Number.parseFloat(raw);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("NO_AMOUNT");
      const pt = (paymentType || defaultPayType).trim();
      if (!pt) throw new Error("NO_PAYMENT");
      const deskRaw = cashDeskId.trim();
      const deskParsed = deskRaw ? Number.parseInt(deskRaw, 10) : NaN;
      const cash_desk_id = Number.isFinite(deskParsed) && deskParsed > 0 ? deskParsed : null;
      const pd = new Date(paidAtLocal);
      const paid_at = Number.isNaN(pd.getTime()) ? null : pd.toISOString();

      const rows: OpeningBalanceListRow[] = [];
      const fail: string[] = [];
      let i = 0;
      for (const cid of clientIds) {
        i += 1;
        setProgress(`Сохранение ${i} / ${clientIds.length}…`);
        try {
          const { data } = await api.post<OpeningBalanceListRow>(
            `/api/${tenantSlug}/opening-balances`,
            {
              client_id: cid,
              balance_type: balanceType,
              amount: amt,
              payment_type: pt,
              cash_desk_id,
              trade_direction: tradeDirection.trim() || null,
              note: note.trim() || null,
              paid_at
            }
          );
          rows.push(data);
        } catch (e) {
          const name = selectedClients.find((c) => c.id === cid)?.name ?? `ID ${cid}`;
          fail.push(`${name}: ${getUserFacingError(e, "ошибка")}`);
        }
      }
      return { rows, fail };
    },
    onMutate: () => {
      setErr(null);
      setFieldErrs({});
      setProgress(null);
    },
    onSuccess: async ({ rows, fail }) => {
      setProgress(null);
      await qc.invalidateQueries({ queryKey: ["opening-balances", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
      if (fail.length > 0) {
        setErr(
          `Сохранено ${rows.length}. Ошибки (${fail.length}): ${fail.slice(0, 4).join("; ")}${
            fail.length > 4 ? "…" : ""
          }`
        );
        if (rows.length > 0) onCreated?.();
        return;
      }
      onCreated?.();
      onOpenChange(false);
      resetForm();
    },
    onError: (e: unknown) => {
      setProgress(null);
      if (e instanceof Error && e.message === "NO_CLIENT") {
        setFieldErrs({ client_id: "Выберите хотя бы одного клиента" });
        setErr("Выберите клиентов.");
        return;
      }
      if (e instanceof Error && e.message === "NO_AMOUNT") {
        setFieldErrs({ amount: "Укажите сумму больше 0" });
        setErr("Укажите сумму.");
        return;
      }
      if (e instanceof Error && e.message === "NO_PAYMENT") {
        setFieldErrs({ payment_type: "Выберите способ оплаты" });
        setErr("Способ оплаты обязателен.");
        return;
      }
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          setFieldErrs(firstMessagePerField(flat));
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint;
          setErr(
            line
              ? withApiSupportLine(line, e)
              : withApiSupportLine(getUserFacingError(e, "Сохранить не удалось."), e)
          );
          return;
        }
      }
      setFieldErrs({});
      setErr(getUserFacingError(e, "Сохранить не удалось."));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="flex max-h-[min(94vh,48rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 pb-3 pt-4 pr-14 text-left">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Добавить начальные балансы
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Несколько клиентов сразу. Общие значения (сумма, тип, оплата…) применяются ко всем.
            У клиента должен быть привязан агент — иначе строка не сохранится. В балансе клиента
            появится оплата/расход с комментарием «Добавлено через начальный баланс».
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto flex w-full flex-col gap-4">
            {err ? (
              <p className="text-sm text-destructive" role="alert">
                {err}
              </p>
            ) : null}
            {progress ? (
              <p className="text-xs text-muted-foreground" role="status">
                {progress}
              </p>
            ) : null}

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-medium text-foreground">Клиенты</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={submitMut.isPending || selectedClients.length === 0}
                  onClick={fillVirtualDefaults}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Виртуальные данные
                </Button>
              </div>
              <SearchableMultiSelectPanel
                label="Клиенты"
                hideOuterLabel
                inline
                className="w-full"
                items={clientItems}
                selected={new Set(clientIds)}
                onSelectedChange={(fn) => {
                  const prev = new Set(clientIds);
                  const next = typeof fn === "function" ? fn(prev) : fn;
                  setClientIds(Array.from(next).sort((a, b) => a - b));
                }}
                search={clientSearch}
                onSearchChange={setClientSearch}
                triggerPlaceholder="Выберите клиентов"
                selectAllLabel="Выбрать все"
                clearVisibleLabel="Снять выбор"
                searchPlaceholder="Поиск по имени, ID, области, коду…"
                filterItemsBySearch
                minPopoverWidth={320}
                loading={clientsQ.isLoading}
              />
              {fieldErrs.client_id ? (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrs.client_id}
                </p>
              ) : null}
            </div>

            {virtualRows.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="max-h-44 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5 font-semibold">ID</th>
                        <th className="px-2 py-1.5 font-semibold">Клиент</th>
                        <th className="px-2 py-1.5 font-semibold">Область</th>
                        <th className="px-2 py-1.5 font-semibold">Код агента</th>
                      </tr>
                    </thead>
                    <tbody>
                      {virtualRows.map((r) => (
                        <tr key={r.id} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-1.5 font-mono tabular-nums">{r.id}</td>
                          <td className="px-2 py-1.5">{r.name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{r.region}</td>
                          <td className="px-2 py-1.5 text-muted-foreground" title={r.agentName ?? undefined}>
                            {r.agentCode}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-border bg-muted/30 px-2 py-1.5 text-[0.65rem] text-muted-foreground">
                  Выбрано: {virtualRows.length}. Ниже — по одному значению на каждый столбец для всех строк.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="aob-amt" className="text-sm font-medium text-foreground">
                  Сумма (для всех)
                </Label>
                <GroupedNumberInput
                  id="aob-amt"
                  className={cn(controlClass, "h-10")}
                  maxFractionDigits={2}
                  placeholder="0"
                  value={amount}
                  onValueChange={setAmount}
                  disabled={submitMut.isPending}
                />
                {fieldErrs.amount ? (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrs.amount}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aob-bt" className="text-sm font-medium text-foreground">
                  Тип остатка
                </Label>
                <FilterSelect
                  id="aob-bt"
                  className={cn(controlClass, "px-2")}
                  emptyLabel="—"
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value as "debt" | "surplus")}
                >
                  <option value="debt">Долг (задолженность)</option>
                  <option value="surplus">Излишек (предоплата)</option>
                </FilterSelect>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aob-paid" className="text-sm font-medium text-foreground">
                  Дата оплаты
                </Label>
                <DateTimePickerField
                  id="aob-paid"
                  value={paidAtLocal}
                  onChange={setPaidAtLocal}
                  disabled={submitMut.isPending}
                  dateOnly
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aob-pay-type" className="text-sm font-medium text-foreground">
                  Способ оплаты
                </Label>
                <FilterSelect
                  id="aob-pay-type"
                  className={cn(controlClass, "px-2")}
                  emptyLabel="—"
                  value={paymentType || defaultPayType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  {paySelectOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FilterSelect>
                {fieldErrs.payment_type ? (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrs.payment_type}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aob-desk" className="text-sm font-medium text-foreground">
                  Касса
                </Label>
                <FilterSelect
                  id="aob-desk"
                  className={cn(controlClass, "px-2")}
                  emptyLabel="—"
                  value={cashDeskId}
                  onChange={(e) => setCashDeskId(e.target.value)}
                >
                  <option value="">—</option>
                  {(cashDesksQ.data ?? []).map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aob-trade" className="text-sm font-medium text-foreground">
                  Направление торговли
                </Label>
                <FilterSelect
                  id="aob-trade"
                  className={cn(controlClass, "px-2")}
                  emptyLabel="—"
                  value={tradeDirection}
                  onChange={(e) => setTradeDirection(e.target.value)}
                >
                  <option value="">—</option>
                  {tradeDirectionOptions.map((td) => (
                    <option key={td} value={td}>
                      {td}
                    </option>
                  ))}
                </FilterSelect>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="aob-note" className="text-sm font-medium text-foreground">
                Комментарий
              </Label>
              <textarea
                id="aob-note"
                rows={3}
                className={cn(controlClass, "min-h-[4.5rem] resize-y py-2.5")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                disabled={submitMut.isPending}
                placeholder="Общий комментарий для всех выбранных"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-muted/20 px-5 py-4">
          <Button
            type="button"
            className="h-10 w-full bg-teal-600 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
            disabled={submitMut.isPending}
            onClick={() => submitMut.mutate()}
          >
            {submitMut.isPending
              ? progress ?? "Сохранение…"
              : clientIds.length > 1
                ? `Сохранить для ${clientIds.length} клиентов`
                : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
