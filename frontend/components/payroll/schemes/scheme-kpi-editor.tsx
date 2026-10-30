"use client";

import { Plus, X } from "lucide-react";
import { money } from "@/lib/payroll/payroll-api";
import { METRIC_LABEL, type Gate, type KpiPart, type Metric, type RuleParams, type ScalePoint } from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";
import { CasesEditor, ChipMulti, CondList, LINK_BTN, Labeled, MINI, NumField, useSchemeOptions } from "./scheme-fields";

const SPLIT_LABEL = { plan: "по доле плана", equal: "поровну", weights: "по весам" } as const;

/** Shkala matni: «ниже 60% → 0; 60% → 60%; 100% → 100%; выше 120% → 120%». */
export function scaleText(scale: ScalePoint[]): string {
  const p = [...scale].sort((a, b) => a.at - b.at);
  if (!p.length) return "—";
  const mid = p.map((x) => `${x.at}% → ${x.pay}%`).join("; ");
  return `ниже ${p[0]!.at}% → 0; ${mid}; выше — ${p[p.length - 1]!.pay}%`;
}

function ScaleEditor({ value, onChange, disabled }: { value: ScalePoint[]; onChange: (v: ScalePoint[]) => void; disabled?: boolean }) {
  const set = (i: number, patch: Partial<ScalePoint>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const sorted = [...value].sort((a, b) => a.at - b.at);
  const max = Math.max(130, ...value.map((p) => p.at), ...value.map((p) => p.pay));
  return (
    <div className="grid gap-2 md:grid-cols-[auto_1fr]">
      <div className="grid gap-1">
        {value.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[12px]">
            <span className="w-16 text-muted-foreground">выполнение</span>
            <NumField className="w-16" value={p.at} onChange={(v) => set(i, { at: v ?? 0 })} disabled={disabled} />
            <span className="text-muted-foreground">% → платим</span>
            <NumField className="w-16" value={p.pay} onChange={(v) => set(i, { pay: v ?? 0 })} disabled={disabled} />
            <span className="text-muted-foreground">%</span>
            <button type="button" disabled={disabled || value.length <= 1} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:text-rose-600" aria-label="Убрать точку">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className={LINK_BTN} disabled={disabled || value.length >= 12} onClick={() => onChange([...value, { at: (sorted.at(-1)?.at ?? 100) + 10, pay: sorted.at(-1)?.pay ?? 100 }])}>
            <Plus className="size-3.5" /> Точка шкалы
          </button>
        </div>
      </div>
      <svg viewBox="0 0 200 90" className="h-24 w-full max-w-xs rounded-md bg-[var(--pr-head)]" aria-label="Шкала KPI">
        <line x1="10" y1="80" x2="195" y2="80" stroke="currentColor" className="text-muted-foreground/40" />
        {sorted.length ? (
          <polyline
            fill="none"
            strokeWidth="2"
            className="stroke-primary"
            points={[
              `10,80`,
              `${10 + (sorted[0]!.at / max) * 185},80`,
              ...sorted.map((p) => `${10 + (p.at / max) * 185},${80 - (p.pay / max) * 70}`),
              `195,${80 - (sorted.at(-1)!.pay / max) * 70}`
            ].join(" ")}
          />
        ) : null}
        <text x="12" y="10" className="fill-muted-foreground text-[8px]">платим %</text>
        <text x="150" y="88" className="fill-muted-foreground text-[8px]">выполнение %</text>
      </svg>
    </div>
  );
}

function PartEditor({ part, onChange, onRemove, disabled }: { part: KpiPart; onChange: (p: KpiPart) => void; onRemove: () => void; disabled?: boolean }) {
  const o = useSchemeOptions();
  return (
    <div className="grid gap-2 rounded-lg border border-[var(--pr-border)] p-2">
      <div className="flex flex-wrap items-end gap-2">
        <Labeled label="Вес, %">
          <NumField className="w-16" value={part.weight} onChange={(v) => onChange({ ...part, weight: v ?? 0 })} disabled={disabled} />
        </Labeled>
        <Labeled label="Показатель">
          <select className={cn(MINI, "w-32")} value={part.metric} disabled={disabled} onChange={(e) => onChange({ ...part, metric: e.target.value as Metric })}>
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Чей план">
          <select className={cn(MINI, "w-32")} value={part.source} disabled={disabled} onChange={(e) => onChange({ ...part, source: e.target.value as KpiPart["source"] })}>
            <option value="own">свой</option>
            <option value="team">команды (СВ)</option>
          </select>
        </Labeled>
        <Labeled label="План">
          <select className={cn(MINI, "w-36")} value={part.mode} disabled={disabled} onChange={(e) => onChange({ ...part, mode: e.target.value as KpiPart["mode"] })}>
            <option value="total">общий</option>
            <option value="groups">по KPI-группам</option>
          </select>
        </Labeled>
        {part.mode === "groups" ? (
          <Labeled label="Деление фонда">
            <select className={cn(MINI, "w-36")} value={part.split} disabled={disabled} onChange={(e) => onChange({ ...part, split: e.target.value as KpiPart["split"] })}>
              {(Object.keys(SPLIT_LABEL) as KpiPart["split"][]).map((s) => (
                <option key={s} value={s}>
                  {SPLIT_LABEL[s]}
                </option>
              ))}
            </select>
          </Labeled>
        ) : null}
        <Labeled label="Подпись (необяз.)" className="min-w-32 flex-1">
          <input className={cn(MINI, "w-full min-w-0")} value={part.label ?? ""} maxLength={80} disabled={disabled} onChange={(e) => onChange({ ...part, label: e.target.value || undefined })} />
        </Labeled>
        <button type="button" disabled={disabled} onClick={onRemove} className="mb-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-rose-600" aria-label="Убрать часть">
          <X className="size-4" />
        </button>
      </div>
      {part.mode === "groups" ? (
        <div className="grid gap-1">
          <span className="text-[11px] text-muted-foreground">Группы (пусто — все группы, где у сотрудника есть план):</span>
          <ChipMulti options={o.groups.map((g) => ({ value: g.id, label: g.name }))} value={part.groups} onChange={(groups) => onChange({ ...part, groups })} disabled={disabled} empty="все с планом" />
          {part.split === "weights" ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {(part.groups.length ? part.groups : o.groups.map((g) => g.id)).map((gid) => (
                <label key={gid} className="flex items-center gap-1 text-[12px]">
                  {o.groups.find((g) => g.id === gid)?.name ?? `#${gid}`}
                  <NumField
                    className="w-14"
                    value={part.group_weights[String(gid)] ?? 0}
                    onChange={(v) => onChange({ ...part, group_weights: { ...part.group_weights, [String(gid)]: v ?? 0 } })}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GateEditor({ gate, onChange, onRemove, disabled }: { gate: Gate; onChange: (g: Gate) => void; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="grid gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-2 dark:bg-amber-500/5">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-medium">Если условие выполнено:</span>
        <span className="text-muted-foreground">KPI ×</span>
        <NumField className="w-16" allowNull placeholder="—" value={gate.factor ?? null} onChange={(v) => onChange({ ...gate, factor: v ?? undefined })} disabled={disabled} />
        <span className="text-muted-foreground">и не меньше</span>
        <NumField className="w-16" allowNull placeholder="—" value={gate.min_pay ?? null} onChange={(v) => onChange({ ...gate, min_pay: v ?? undefined })} disabled={disabled} />
        <span className="text-muted-foreground">% фонда</span>
        <button type="button" disabled={disabled} onClick={onRemove} className="ml-auto rounded p-1 text-muted-foreground hover:text-rose-600" aria-label="Убрать правило">
          <X className="size-3.5" />
        </button>
      </div>
      <CondList value={gate.when} onChange={(when) => onChange({ ...gate, when })} disabled={disabled} />
    </div>
  );
}

export function KpiRuleEditor({ params, onChange, disabled }: { params: RuleParams; onChange: (p: RuleParams) => void; disabled?: boolean }) {
  const parts = params.parts ?? [];
  const weightSum = parts.reduce((s, p) => s + (p.weight || 0), 0);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Labeled label="Фонд KPI в месяц, сум">
          <NumField className="w-40" value={params.fund ?? 0} onChange={(v) => onChange({ ...params, fund: v ?? 0 })} disabled={disabled} />
        </Labeled>
        <p className="pb-1.5 text-[12px] text-muted-foreground">
          Выплата = фонд × вес части × % по шкале. Сумма фонда у отдельного сотрудника задаётся в «Индивидуальных условиях».
        </p>
      </div>
      <CasesEditor value={params.cases ?? []} onChange={(cases) => onChange({ ...params, cases })} disabled={disabled} />

      <div className="grid gap-1.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold">
          Части фонда
          <span className={cn("text-[11.5px] font-normal", weightSum === 100 ? "text-emerald-600" : "text-amber-600")}>
            сумма весов: {money(weightSum, 2)}%{weightSum !== 100 ? " (обычно 100%)" : ""}
          </span>
        </div>
        {parts.map((p, i) => (
          <PartEditor
            key={i}
            part={p}
            disabled={disabled}
            onChange={(n) => onChange({ ...params, parts: parts.map((x, j) => (j === i ? n : x)) })}
            onRemove={() => onChange({ ...params, parts: parts.filter((_, j) => j !== i) })}
          />
        ))}
        <div>
          <button
            type="button"
            className={LINK_BTN}
            disabled={disabled || parts.length >= 12}
            onClick={() =>
              onChange({ ...params, parts: [...parts, { metric: "acb", source: "own", mode: "total", weight: Math.max(0, 100 - weightSum), groups: [], split: "plan", group_weights: {} }] })
            }
          >
            <Plus className="size-3.5" /> Часть фонда
          </button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="text-[12.5px] font-semibold">
          Шкала <span className="font-normal text-muted-foreground">— {scaleText(params.scale ?? [])}</span>
        </div>
        <ScaleEditor value={params.scale ?? []} onChange={(scale) => onChange({ ...params, scale })} disabled={disabled} />
      </div>

      <div className="grid gap-1.5">
        <div className="text-[12.5px] font-semibold">Понижающие и гарантирующие правила</div>
        {(params.gates ?? []).map((g, i) => (
          <GateEditor
            key={i}
            gate={g}
            disabled={disabled}
            onChange={(n) => onChange({ ...params, gates: (params.gates ?? []).map((x, j) => (j === i ? n : x)) })}
            onRemove={() => onChange({ ...params, gates: (params.gates ?? []).filter((_, j) => j !== i) })}
          />
        ))}
        <div>
          <button
            type="button"
            className={LINK_BTN}
            disabled={disabled || (params.gates ?? []).length >= 10}
            onClick={() => onChange({ ...params, gates: [...(params.gates ?? []), { when: [{ field: "return_pct", op: ">", value: 5 }], factor: 0.8 }] })}
          >
            <Plus className="size-3.5" /> Правило (например, возвраты &gt; 5% → KPI × 0,8)
          </button>
        </div>
      </div>
    </div>
  );
}
