"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGroupedInteger } from "@/lib/format-numbers";
import type { PayrollComponentDto, PayrollGateDto } from "./payroll-api";

/** Metrikalar ro‘yxati — backend `PAYROLL_METRIC_KEYS` bilan mos. */
export const PAYROLL_METRIC_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "sales_sum", label: "Продажи (сумма)" },
  { value: "sales_count", label: "Заказы (кол-во)" },
  { value: "sales_volume", label: "Объём продаж" },
  { value: "returns_sum", label: "Возвраты (сумма)" },
  { value: "new_clients", label: "Новые точки" },
  { value: "active_clients", label: "Активные точки" },
  { value: "visits", label: "Визиты" },
  { value: "collection_sum", label: "Инкассация (сумма)" },
  { value: "collection_count", label: "Инкассация (кол-во)" },
  { value: "deliveries", label: "Доставки" },
  { value: "warehouse_ops", label: "Складские операции" },
  { value: "audits_count", label: "Аудиты" },
  { value: "plan_sum", label: "План (сумма)" },
  { value: "worked_days", label: "Отработано дней" },
  { value: "planned_days", label: "Норма дней" },
  { value: "absent_days", label: "Прогулы" },
  { value: "team_sales_sum", label: "Продажи команды" },
  { value: "team_plan_sum", label: "План команды" },
  { value: "team_headcount", label: "Численность команды" },
  { value: "debt_sum", label: "Просроченный долг" }
];

export function metricLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "kpi_percent") return "Выполнение KPI (%)";
  return PAYROLL_METRIC_OPTIONS.find((m) => m.value === value)?.label ?? value;
}

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/** Ustama / ushlanmalar ro‘yxati muharriri. */
export function ComponentsEditor({
  value,
  onChange
}: {
  value: PayrollComponentDto[];
  onChange: (next: PayrollComponentDto[]) => void;
}) {
  const update = (i: number, patch: Partial<PayrollComponentDto>) => {
    const next = value.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/85">Надбавки и удержания</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onChange([
              ...value,
              {
                code: `comp_${value.length + 1}`,
                label: "",
                kind: "allowance",
                mode: "fixed",
                value: 0
              }
            ])
          }
        >
          + Добавить
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          Yo‘q. Masalan: yoqilg‘i uchun ustama, jarima, avans ushlanmasi.
        </p>
      ) : null}

      {value.map((c, i) => (
        <div key={`${c.code}-${i}`} className="grid grid-cols-12 items-center gap-1">
          <Input
            className="col-span-3 h-8 text-xs"
            placeholder="Ном"
            value={c.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <select
            className="col-span-2 h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={c.kind}
            onChange={(e) => update(i, { kind: e.target.value as PayrollComponentDto["kind"] })}
          >
            <option value="allowance">Надбавка</option>
            <option value="deduction">Удержание</option>
          </select>
          <select
            className="col-span-3 h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={c.mode}
            onChange={(e) => update(i, { mode: e.target.value as PayrollComponentDto["mode"] })}
          >
            <option value="fixed">Сумма (сўм)</option>
            <option value="percent_base">% от оклада</option>
            <option value="percent_gross">% от начисленного</option>
          </select>
          <Input
            className="col-span-3 h-8 text-right text-xs"
            inputMode="decimal"
            value={String(c.value)}
            onChange={(e) => update(i, { value: num(e.target.value) })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="col-span-1 h-8 text-xs text-destructive"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Shartlar (gates) muharriri. */
export function GatesEditor({
  value,
  onChange
}: {
  value: PayrollGateDto[];
  onChange: (next: PayrollGateDto[]) => void;
}) {
  const update = (i: number, patch: Partial<PayrollGateDto>) => {
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/85">Условия (шартлар)</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onChange([
              ...value,
              { metric: "sales_count", op: "lt", value: 20, effect: "zero_variable", reduce_percent: 0 }
            ])
          }
        >
          + Шарт
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          Shartsiz. Masalan: «20 tadan kam zakaz bo‘lsa — bonus 0».
        </p>
      ) : null}

      {value.map((g, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-1">
          <select
            className="col-span-4 h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={g.metric}
            onChange={(e) => update(i, { metric: e.target.value })}
          >
            <option value="kpi_percent">Выполнение KPI (%)</option>
            {PAYROLL_METRIC_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className="col-span-1 h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={g.op}
            onChange={(e) => update(i, { op: e.target.value as PayrollGateDto["op"] })}
          >
            <option value="lt">&lt;</option>
            <option value="lte">≤</option>
            <option value="gt">&gt;</option>
            <option value="gte">≥</option>
            <option value="eq">=</option>
          </select>
          <Input
            className="col-span-2 h-8 text-right text-xs"
            inputMode="decimal"
            value={String(g.value)}
            onChange={(e) => update(i, { value: num(e.target.value) })}
          />
          <select
            className="col-span-3 h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={g.effect}
            onChange={(e) => update(i, { effect: e.target.value as PayrollGateDto["effect"] })}
          >
            <option value="zero_variable">Бонус = 0</option>
            <option value="reduce_percent">Кесиб ташлаш (%)</option>
          </select>
          {g.effect === "reduce_percent" ? (
            <Input
              className="col-span-1 h-8 text-right text-xs"
              inputMode="decimal"
              title="Necha foizga kesiladi"
              value={String(g.reduce_percent ?? 0)}
              onChange={(e) => update(i, { reduce_percent: num(e.target.value) })}
            />
          ) : (
            <span className="col-span-1 text-center text-[10px] text-muted-foreground">—</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="col-span-1 h-8 text-xs text-destructive"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Rol tanlash (checkbox chip’lar). */
export function RolesPicker({
  roles,
  value,
  onChange
}: {
  roles: Array<{ role: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (role: string) => {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => {
        const on = value.includes(r.role);
        return (
          <button
            key={r.role}
            type="button"
            onClick={() => toggle(r.role)}
            className={
              on
                ? "rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary"
                : "rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            }
          >
            {r.label}
          </button>
        );
      })}
      {value.length === 0 ? (
        <span className="text-[11px] text-muted-foreground">Tanlanmagan = barcha rollar</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">{formatGroupedInteger(value.length)} ta rol</span>
      )}
    </div>
  );
}
