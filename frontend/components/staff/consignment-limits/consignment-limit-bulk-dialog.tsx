"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollPickMonth, PayrollPickSelect } from "@/components/payroll/kit/payroll-kit-picker";
import {
  PAYROLL_CHECKBOX,
  PAYROLL_MODAL_INPUT,
  PayrollModal,
  PayrollModalActions,
  PayrollModalField,
  PayrollModalNote
} from "@/components/payroll/kit/payroll-kit-modal";
import {
  NO_SUPERVISOR,
  shiftYm,
  sum,
  supervisorQuery,
  toNum,
  ymKey,
  type ConsignmentSupervisor
} from "@/components/staff/consignment-limits/consignment-limit-shared";

type Source = "month" | "plan";
type Ym = { year: number; month: number };
type Row = {
  user_id: number;
  code: string | null;
  name: string;
  supervisor_name: string | null;
  consignment: boolean;
  current_limit: string | null;
  outstanding: string;
  basis: string | null;
  proposed_limit: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  tradeDirectionId: string;
  supervisors: ConsignmentSupervisor[];
  initialSupervisor: string;
  pageMonth: string;
  onDone: (message: string) => void;
};

const ROUND_OPTIONS = [
  { value: "1", label: "Без округления" },
  { value: "1000", label: "До 1 000" },
  { value: "10000", label: "До 10 000" },
  { value: "100000", label: "До 100 000" },
  { value: "1000000", label: "До 1 000 000" }
];
const TH = "sticky top-0 z-10 bg-[var(--pr-head)] px-3 py-2 text-left text-[11.5px] font-semibold text-muted-foreground";
const TD = "border-t border-[var(--pr-line)] px-3 py-2 text-[12.5px]";

function parseYm(raw: string): Ym {
  const [y, m] = raw.split("-").map(Number);
  return y && m ? { year: y, month: m } : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
}

/** Limitlarni bir yo‘la qo‘yish: tanlangan oy limitlari yoki reja summasining foizi (agent kesimida). */
export function ConsignmentLimitBulkDialog({ open, onClose, tenantSlug, tradeDirectionId, supervisors, initialSupervisor, pageMonth, onDone }: Props) {
  const [source, setSource] = useState<Source>("month");
  const [monthYm, setMonthYm] = useState<Ym>(() => shiftYm(parseYm(pageMonth), -1));
  const [planYm, setPlanYm] = useState<Ym>(() => parseYm(pageMonth));
  const [percent, setPercent] = useState("30");
  const [percentDebounced, setPercentDebounced] = useState("30");
  const [round, setRound] = useState("1000");
  const [supervisor, setSupervisor] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSource("month");
    setMonthYm(shiftYm(parseYm(pageMonth), -1));
    setPlanYm(parseYm(pageMonth));
    setSupervisor(initialSupervisor);
    setExcluded(new Set());
    setError(null);
  }, [open, pageMonth, initialSupervisor]);
  useEffect(() => {
    const t = setTimeout(() => setPercentDebounced(percent), 400);
    return () => clearTimeout(t);
  }, [percent]);

  const ym = source === "month" ? monthYm : planYm;
  const percentNum = toNum(percentDebounced);
  const ready = open && Boolean(tradeDirectionId) && (source === "month" || percentNum > 0);
  const proposalQ = useQuery({
    queryKey: ["consignment", "limit-proposal", tenantSlug, tradeDirectionId, source, ymKey(ym), percentNum, round, supervisor],
    enabled: ready,
    queryFn: async () => {
      const qs = [
        `source=${source}`,
        `year_month=${ymKey(ym)}`,
        `trade_direction_id=${encodeURIComponent(tradeDirectionId)}`,
        source === "plan" ? `percent=${percentNum}&round=${round}` : "",
        supervisorQuery(supervisor)
      ]
        .filter(Boolean)
        .join("&");
      const { data } = await api.get<{ data: Row[] }>(`/api/${tenantSlug}/consignment/limits/proposal?${qs}`);
      return data.data;
    }
  });
  const rows = useMemo(() => proposalQ.data ?? [], [proposalQ.data]);
  useEffect(() => setExcluded(new Set()), [proposalQ.data]);

  const applicable = rows.filter((r) => r.proposed_limit != null);
  const selected = applicable.filter((r) => !excluded.has(r.user_id));
  const totalBefore = selected.reduce((s, r) => s + toNum(r.current_limit), 0);
  const totalAfter = selected.reduce((s, r) => s + toNum(r.proposed_limit), 0);
  const allOn = applicable.length > 0 && selected.length === applicable.length;
  const toggle = (id: number) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/${tenantSlug}/consignment/limits/apply`, {
        rows: selected.map((r) => ({ user_id: r.user_id, limit_amount: String(toNum(r.proposed_limit)) })),
        source,
        year_month: ymKey(ym),
        ...(source === "plan" ? { percent: percentNum } : {})
      });
      onDone(`Лимит установлен для ${selected.length} агентов`);
      onClose();
    } catch (e) {
      setError(getUserFacingError(e, "Не удалось установить лимиты"));
    } finally {
      setBusy(false);
    }
  };

  const supervisorOptions = [
    ...supervisors.map((s) => ({ value: String(s.id), label: s.fio })),
    { value: NO_SUPERVISOR, label: "Агенты без супервайзера" }
  ];

  return (
    <PayrollModal
      open={open}
      onClose={onClose}
      title="Установка лимитов консигнации"
      width="sm:max-w-[980px]"
      headerExtra={
        <PayrollSegmentedTabs<Source>
          variant="status"
          tabs={[
            { id: "month", label: "Лимиты прошлого месяца" },
            { id: "plan", label: "% от плана" }
          ]}
          value={source}
          onChange={setSource}
        />
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PayrollPickMonth
            size="field"
            label={source === "month" ? "Взять лимиты месяца" : "Планы месяца"}
            value={ym}
            onChange={source === "month" ? setMonthYm : setPlanYm}
          />
          {source === "plan" ? (
            <>
              <PayrollModalField label="Процент от суммы плана, %">
                <GroupedNumberInput value={percent} onValueChange={setPercent} maxFractionDigits={2} placeholder="30" className={cn(PAYROLL_MODAL_INPUT, "font-semibold")} />
              </PayrollModalField>
              <PayrollPickSelect size="field" label="Округление" placeholder="Округление" allowEmpty={false} value={round} options={ROUND_OPTIONS} onChange={setRound} />
            </>
          ) : null}
          <PayrollPickSelect
            size="field"
            label="Супервайзер"
            placeholder="Все супервайзеры"
            searchable={supervisorOptions.length > 8}
            value={supervisor}
            options={supervisorOptions}
            className={source === "month" ? "lg:col-span-3 lg:max-w-[320px]" : undefined}
            onChange={setSupervisor}
          />
        </div>

        <PayrollModalNote>
          {source === "month"
            ? "Каждому агенту ставится лимит, который действовал у него в выбранном месяце. Агенты без данных за этот месяц пропускаются."
            : "Лимит каждого агента = сумма его плана за месяц × процент. Агенты без плана пропускаются."}
        </PayrollModalNote>

        <div className="max-h-[46vh] overflow-auto rounded-xl border border-[var(--pr-border)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cn(TH, "w-10")}>
                  <input
                    type="checkbox"
                    aria-label="Выбрать всех"
                    className={PAYROLL_CHECKBOX}
                    checked={allOn}
                    disabled={applicable.length === 0}
                    onChange={() => setExcluded(allOn ? new Set(applicable.map((r) => r.user_id)) : new Set())}
                  />
                </th>
                <th className={TH}>Агент</th>
                <th className={TH}>Супервайзер</th>
                <th className={cn(TH, "text-right")}>Текущий лимит</th>
                <th className={cn(TH, "text-right")}>Использовано</th>
                <th className={cn(TH, "text-right")}>{source === "month" ? `Лимит за ${String(ym.month).padStart(2, "0")}.${ym.year}` : "Сумма плана"}</th>
                <th className={cn(TH, "text-right")}>Новый лимит</th>
              </tr>
            </thead>
            <tbody>
              {!ready ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">Укажите процент</td></tr>
              ) : proposalQ.isLoading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">Загрузка…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">Агентов не найдено</td></tr>
              ) : (
                rows.map((r) => {
                  const can = r.proposed_limit != null;
                  const on = can && !excluded.has(r.user_id);
                  const before = toNum(r.current_limit);
                  const after = toNum(r.proposed_limit);
                  const belowUsed = can && after < toNum(r.outstanding);
                  return (
                    <tr key={r.user_id} className={cn("transition-colors hover:bg-[var(--pr-row-hover)]", !can && "opacity-55", can && !on && "opacity-70")}>
                      <td className={TD}>
                        <input type="checkbox" aria-label={r.name} className={PAYROLL_CHECKBOX} checked={on} disabled={!can} onChange={() => toggle(r.user_id)} />
                      </td>
                      <td className={TD}>
                        <span className="font-medium text-foreground">{r.name}</span>
                        {r.code ? <span className="ml-1.5 text-[11.5px] text-muted-foreground">{r.code}</span> : null}
                        {!r.consignment ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">консигнация выкл.</span> : null}
                      </td>
                      <td className={cn(TD, "text-muted-foreground")}>{r.supervisor_name ?? "—"}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>{r.current_limit != null ? sum(r.current_limit) : "не задан"}</td>
                      <td className={cn(TD, "text-right tabular-nums text-muted-foreground")}>{sum(r.outstanding)}</td>
                      <td className={cn(TD, "text-right tabular-nums text-muted-foreground")}>{r.basis != null ? sum(r.basis) : "нет данных"}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>
                        {can ? (
                          <span className="inline-flex items-center gap-1 font-bold" title={belowUsed ? "Новый лимит меньше уже использованной суммы — новые заказы в консигнацию будут недоступны" : undefined}>
                            {belowUsed ? <AlertTriangle className="size-3.5 text-amber-600" /> : null}
                            {after > before ? <ArrowUpRight className="size-3.5 text-[var(--pr-brand-600)]" /> : after < before ? <ArrowDownRight className="size-3.5 text-rose-600" /> : null}
                            <span className={after > before ? "text-[var(--pr-brand-700)]" : after < before ? "text-rose-600" : "text-foreground"}>{sum(after)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">пропуск</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--pr-head)] px-3.5 py-2.5 text-[12.5px]">
          <span className="text-muted-foreground">
            Выбрано агентов: <span className="font-semibold text-foreground">{selected.length}</span> из {rows.length}
          </span>
          <span className="tabular-nums text-muted-foreground">
            Итого лимит: <span className="text-foreground">{sum(totalBefore)}</span> → <span className="font-bold text-[var(--pr-brand-700)]">{sum(totalAfter)}</span>
          </span>
        </div>

        {proposalQ.isError ? <PayrollModalNote tone="error">{getUserFacingError(proposalQ.error, "Не удалось рассчитать лимиты")}</PayrollModalNote> : null}
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        <PayrollModalActions onCancel={onClose} onSubmit={() => void submit()} submitLabel="Принять" busy={busy} disabled={selected.length === 0} />
      </div>
    </PayrollModal>
  );
}
