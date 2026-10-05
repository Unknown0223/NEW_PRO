"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from "lucide-react";
import { money } from "@/lib/payroll/payroll-api";
import { KIND_META, RATE_METRIC_LABEL, type RateMetric, type RuleParams, type SchemeRuleDraft } from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";
import { CasesEditor, CondList, Labeled, MINI, NumField, condText, useSchemeOptions } from "./scheme-fields";
import { KpiRuleEditor, scaleText } from "./scheme-kpi-editor";

const KIND_TONE: Record<SchemeRuleDraft["kind"], string> = {
  base: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  fixed: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  kpi: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rate: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  formula: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  manual: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300"
};

export function ruleSummary(r: SchemeRuleDraft): string {
  const p = r.params;
  const extra = [(p.cases?.length ?? 0) > 0 ? `вариантов: ${p.cases!.length}` : null, (p.when?.length ?? 0) > 0 ? "есть условие" : null].filter(Boolean);
  let main = "";
  if (r.kind === "base" || r.kind === "fixed") main = `${money(p.amount ?? 0)}${p.prorate ? " · по дням" : ""}`;
  if (r.kind === "kpi") main = `фонд ${money(p.fund ?? 0)} · частей ${p.parts?.length ?? 0} · ${scaleText(p.scale ?? [])}`;
  if (r.kind === "rate") main = `${p.percent ? `${p.rate ?? 0}%` : money(p.rate ?? 0)} × ${RATE_METRIC_LABEL[p.metric ?? "exp_orders"].toLowerCase()}`;
  if (r.kind === "formula") main = p.text || "формула не задана";
  if (r.kind === "manual") main = p.max != null ? `до ${money(p.max)}` : "ввод в ведомости";
  return [main, ...extra].join(" · ");
}

function AmountBlock({ params, onChange, disabled, prorateLabel }: { params: RuleParams; onChange: (p: RuleParams) => void; disabled?: boolean; prorateLabel: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <Labeled label="Сумма в месяц, сум">
          <NumField className="w-40" value={params.amount ?? 0} onChange={(v) => onChange({ ...params, amount: v ?? 0 })} disabled={disabled} />
        </Labeled>
        <label className="flex items-center gap-1.5 pb-1.5 text-[12.5px]">
          <input type="checkbox" className="size-4 accent-primary" checked={Boolean(params.prorate)} disabled={disabled} onChange={(e) => onChange({ ...params, prorate: e.target.checked })} />
          {prorateLabel}
        </label>
      </div>
      <CasesEditor value={params.cases ?? []} onChange={(cases) => onChange({ ...params, cases })} disabled={disabled} />
    </div>
  );
}

function KindBody({ rule, onChange, disabled }: { rule: SchemeRuleDraft; onChange: (p: RuleParams) => void; disabled?: boolean }) {
  const p = rule.params;
  switch (rule.kind) {
    case "base":
      return <AmountBlock params={p} onChange={onChange} disabled={disabled} prorateLabel="пропорционально отработанным дням" />;
    case "fixed":
      return <AmountBlock params={p} onChange={onChange} disabled={disabled} prorateLabel="пропорционально дням" />;
    case "kpi":
      return <KpiRuleEditor params={p} onChange={onChange} disabled={disabled} />;
    case "rate":
      return (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-end gap-3">
            <Labeled label="Показатель">
              <select className={cn(MINI, "w-48")} value={p.metric ?? "exp_orders"} disabled={disabled} onChange={(e) => onChange({ ...p, metric: e.target.value as RateMetric })}>
                {(Object.keys(RATE_METRIC_LABEL) as RateMetric[]).map((m) => (
                  <option key={m} value={m}>
                    {RATE_METRIC_LABEL[m]}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label={p.percent ? "Процент, %" : "Ставка за единицу, сум"}>
              <NumField className="w-32" value={p.rate ?? 0} onChange={(v) => onChange({ ...p, rate: v ?? 0 })} disabled={disabled} />
            </Labeled>
            <label className="flex items-center gap-1.5 pb-1.5 text-[12.5px]">
              <input type="checkbox" className="size-4 accent-primary" checked={Boolean(p.percent)} disabled={disabled} onChange={(e) => onChange({ ...p, percent: e.target.checked })} />
              процент от показателя
            </label>
          </div>
          <CasesEditor value={p.cases ?? []} onChange={(cases) => onChange({ ...p, cases })} disabled={disabled} unit={p.percent ? "%" : "сум"} />
        </div>
      );
    case "formula":
      return (
        <div className="grid gap-2">
          <Labeled label="Формула">
            <textarea
              className={cn(MINI, "h-20 py-1.5 font-mono")}
              value={p.text ?? ""}
              maxLength={4000}
              disabled={disabled}
              placeholder="ЕСЛИ([Выполнение плана] >= 100; [Оклад статьи]; [Оклад статьи] * 0.5)"
              onChange={(e) => onChange({ ...p, text: e.target.value })}
            />
          </Labeled>
          <div className="flex flex-wrap items-end gap-3">
            <Labeled label="«Оклад статьи», сум">
              <NumField className="w-40" value={p.amount ?? 0} onChange={(v) => onChange({ ...p, amount: v ?? 0 })} disabled={disabled} />
            </Labeled>
            <p className="pb-1.5 text-[12px] text-muted-foreground">Значения — в [квадратных скобках], разделитель — «;», дробь — через точку.</p>
          </div>
        </div>
      );
    case "manual":
      return (
        <Labeled label="Максимум, сум (необязательно)">
          <NumField className="w-40" allowNull placeholder="без лимита" value={p.max ?? null} onChange={(v) => onChange({ ...p, max: v })} disabled={disabled} />
        </Labeled>
      );
  }
}

export function SchemeRuleCard({
  rule,
  onChange,
  onRemove,
  onMove,
  canUp,
  canDown,
  disabled,
  usedItemIds
}: {
  rule: SchemeRuleDraft;
  onChange: (r: SchemeRuleDraft) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
  disabled?: boolean;
  usedItemIds: number[];
}) {
  const o = useSchemeOptions();
  const [open, setOpen] = useState(!rule.name || (rule.kind === "base" && !rule.params.amount));
  const items = o.items.filter((i) => !i.system_key && (i.is_active || i.id === rule.item_id));
  const when = rule.params.when ?? [];
  return (
    <div className="rounded-lg border border-[var(--pr-border)] bg-card">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label={open ? "Свернуть" : "Развернуть"}>
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", KIND_TONE[rule.kind])}>{KIND_META[rule.kind].label}</span>
        <input
          className={cn(MINI, "w-44 font-medium")}
          value={rule.name}
          placeholder="Название"
          maxLength={160}
          disabled={disabled}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
        />
        {rule.kind !== "base" ? (
          <select
            className={cn(MINI, "w-44")}
            value={rule.item_id ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...rule, item_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— статья ведомости —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.type === "deduction" ? " (удержание)" : ""}
                {usedItemIds.includes(i.id) && i.id !== rule.item_id ? " · уже есть" : ""}
              </option>
            ))}
          </select>
        ) : null}
        {!open ? <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{ruleSummary(rule)}</span> : <span className="flex-1" />}
        <span className="font-mono text-[11px] text-muted-foreground" title="Код для индивидуальных условий">
          {rule.code}
        </span>
        <div className="flex items-center">
          <button type="button" disabled={disabled || !canUp} onClick={() => onMove(-1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Выше">
            <ArrowUp className="size-3.5" />
          </button>
          <button type="button" disabled={disabled || !canDown} onClick={() => onMove(1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Ниже">
            <ArrowDown className="size-3.5" />
          </button>
          <button type="button" disabled={disabled} onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" aria-label="Удалить правило">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {!open && when.length ? <div className="px-10 pb-2 text-[11.5px] text-amber-700">Только если: {when.map((c) => condText(c, o)).join(" и ")}</div> : null}
      {open ? (
        <div className="grid gap-3 border-t border-[var(--pr-line)] px-3 py-3">
          <KindBody rule={rule} onChange={(params) => onChange({ ...rule, params })} disabled={disabled} />
          {rule.kind !== "manual" ? (
            <div className="grid gap-1">
              <span className="text-[12px] font-medium text-foreground/80">Начислять только если</span>
              <CondList value={when} onChange={(w) => onChange({ ...rule, params: { ...rule.params, when: w } })} disabled={disabled} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
